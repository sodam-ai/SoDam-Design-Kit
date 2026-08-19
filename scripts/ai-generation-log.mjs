#!/usr/bin/env node
// SoDam-Design-Kit — AI 생성 이력 자동 기록 (Phase 3, 03_PHASES.md L108)
// 범위(2026-08-17 결정 — 02_DATA_MODEL.md 결정 기록 참조): "AI가 자유 형식으로 창작하는
// 콘텐츠"(카피 등, 향후 마케팅 소재)만 다룬다. Figma→코드 변환(pipeline-codegen.mjs)은
// component-map.json·runs/*.json에 이미 출처(Figma 노드 ID·생성 스크립트·시각)가 남는
// 결정적 변환이라 이 로그의 대상이 아니다(범위 밖 — 임의 확장 금지).
//
// ⚠️ 이 파일이 쓰는 .design-kit/AI-GENERATION-LOG.md는 runs/·reports/·screenshots/와 달리
// .gitignore 대상이 아니라 커밋 대상이다(02_DATA_MODEL.md 파일 트리 — [P3] 표기만 있고
// gitignore 표기가 없음). 이 킷을 쓰는 프로젝트가 공개 저장소일 수 있으므로, 프롬프트를
// 시크릿 필터 없이 그대로 적으면 커밋되는 순간 영구적으로 공개 노출된다(사후 수정 불가능한
// 실패 모드 — 버그처럼 나중에 고칠 수 없다). 04_PROJECT_SPEC.md Must "AI-GENERATION-LOG의
// 프롬프트 기록에도 시크릿 필터 적용"을 이 모듈이 구현한다. redactSecrets()를 거치지 않은
// 프롬프트를 절대 파일에 쓰지 말 것.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 알려진 패턴 기반 시크릿 필터. **최선의 방어이며 100%를 보장하지 않는다** — 이 프로젝트가
 * 법률·라이선스 자동화 도구에 항상 붙이는 정직 고지("참고용, 보장 안 함")와 같은 원칙을
 * 여기도 적용한다. 값 자체를 지우고 어떤 종류를 지웠는지만 표시한다(원문 흔적을 남기지 않음).
 * @returns {{ text: string, redactionCount: number }}
 */
export function redactSecrets(text) {
  if (typeof text !== 'string') return { text: '', redactionCount: 0 };

  let redactionCount = 0;
  let result = text;

  const patterns = [
    // 알려진 클라우드/서비스 API 키·토큰 접두 형식
    { re: /\bsk-[A-Za-z0-9_-]{16,}\b/g, label: 'api-key' },
    { re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, label: 'github-token' },
    { re: /\bAIza[0-9A-Za-z_-]{20,}\b/g, label: 'google-key' },
    { re: /\bAKIA[0-9A-Z]{12,}\b/g, label: 'aws-key' },
    { re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g, label: 'slack-token' },
    { re: /\bBearer\s+[A-Za-z0-9._-]{10,}/gi, label: 'bearer-token' },
    // .env 스타일 대입에서 이름이 KEY/TOKEN/SECRET/PASSWORD류면 값만 제거
    {
      re: /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PWD|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*("[^"]+"|'[^']+'|\S+)/g,
      label: 'env-assignment',
      replace: (m, name) => `${name}=`,
    },
    // Windows 절대경로의 사용자명 구간(실제 계정명 노출 방지 — 한글 계정명 포함)
    { re: /([A-Za-z]:\\Users\\)[^\\/\s"]+/g, label: 'windows-user-path', replace: (m, prefix) => `${prefix}` },
    // Unix 절대경로의 사용자명 구간(/home/<user>, /Users/<user>)
    { re: /(\/(?:home|Users)\/)[^/\s"]+/g, label: 'unix-user-path', replace: (m, prefix) => `${prefix}` },
    // 그 외 40자 이상 연속된 영숫자/-_ 시퀀스(고엔트로피 토큰 추정 — 보수적 캐치올)
    { re: /\b[A-Za-z0-9_-]{40,}\b/g, label: 'high-entropy-token' },
  ];

  for (const { re, label, replace } of patterns) {
    result = result.replace(re, (...args) => {
      redactionCount += 1;
      if (replace) return `${replace(...args)}[REDACTED:${label}]`;
      return `[REDACTED:${label}]`;
    });
  }

  return { text: result, redactionCount };
}

const VALID_ASSET_TYPES = new Set(['copy', 'image', 'other']);

/**
 * .design-kit/AI-GENERATION-LOG.md에 항목 1건을 append(기존 항목은 절대 덮어쓰지 않음 —
 * report-writer.mjs의 runs/reports와 같은 append-only 원칙).
 * @param {object} opts
 * @param {string} opts.designKitDir - '.design-kit' 절대경로
 * @param {string} opts.assetType - 'copy' | 'image' | 'other'
 * @param {string} opts.model - 생성에 쓰인 모델/도구 이름 (예: "Claude (Claude Code)")
 * @param {string} opts.prompt - 원본 프롬프트(이 함수 안에서 redactSecrets를 거친 뒤 기록됨 —
 *   호출자가 미리 필터링할 필요 없음, 오히려 이중 필터가 안전)
 * @param {string} [opts.humanEdits] - 사람이 편집/선택한 부분 설명(자유 텍스트)
 * @param {string[]} [opts.generatedFiles] - 이 생성물이 반영된 파일 경로 목록(기록용, 검증 안 함)
 * @param {Date} [opts.date] - 기록 시각 기준(기본값 = 실행 시각). 테스트에서 날짜를 결정적으로
 *   재현하기 위한 주입구 — report-writer.mjs의 nextRunId(dir, date)/writeReport({date})와
 *   동일한 패턴(04 ALWAYS DO "테스트에 오늘 날짜를 하드코딩하지 말 것"). 실사용 호출부는 넘기지 않는다.
 */
export async function appendGenerationLog({
  designKitDir,
  assetType,
  model,
  prompt,
  humanEdits = '',
  generatedFiles = [],
  date = new Date(),
}) {
  if (!VALID_ASSET_TYPES.has(assetType)) {
    throw new Error(`assetType은 ${[...VALID_ASSET_TYPES].join('/')} 중 하나여야 합니다: ${assetType}`);
  }
  if (!model || typeof model !== 'string' || model.trim().length === 0) {
    throw new Error('model은 비어있지 않은 문자열이어야 합니다.');
  }
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('prompt는 비어있지 않은 문자열이어야 합니다.');
  }

  await mkdir(designKitDir, { recursive: true });
  const logPath = path.join(designKitDir, 'AI-GENERATION-LOG.md');

  if (!existsSync(logPath)) {
    const header = [
      '# AI Generation Log',
      '',
      '이 파일은 SoDam-Design-Kit이 생성한 AI 콘텐츠(카피 등)의 이력을 자동 기록합니다.',
      '(자동 생성 — 수동 편집 시 다음 자동 기록과 충돌하지 않도록 append만 하는 것을 권장합니다.)',
      '',
      '> ⚠️ 시크릿 필터는 알려진 패턴 기반 최선의 방어이며 100%를 보장하지 않습니다.',
      '> 프롬프트에 API 키·비밀번호·개인정보를 직접 입력하지 마세요.',
      '',
      '',
    ].join('\n');
    await writeFile(logPath, header, 'utf-8');
  }

  const { text: redactedPrompt, redactionCount } = redactSecrets(prompt);
  const timestamp = date.toISOString();

  const lines = [`## ${timestamp} — ${assetType}`, '', `- 모델: ${model}`];
  if (generatedFiles.length > 0) {
    lines.push(`- 생성/반영 파일: ${generatedFiles.join(', ')}`);
  }
  lines.push(`- 사람 편집: ${humanEdits && humanEdits.trim().length > 0 ? humanEdits : '(기록 없음)'}`);
  lines.push('');
  lines.push(`**프롬프트**${redactionCount > 0 ? ` _(시크릿 패턴 ${redactionCount}건 필터링됨)_` : ''}:`);
  // 프롬프트 자체에 ``` (코드블록)이 포함될 수 있다(에이전트가 코드 스니펫을 언급하는 등) —
  // 고정 3개 백틱으로 감싸면 그 안쪽 백틱과 겹쳐 코드펜스가 깨지고, 그 뒤에 오는 모든 후속
  // 로그 항목이 미종료 코드블록에 갇히는 심각한 파일 손상으로 이어진다(2026-08-17 실측
  // 발견). CommonMark 표준 해법: 펜스 길이를 본문 최장 백틱 연속보다 항상 길게 잡는다.
  const longestBacktickRun = Math.max(3, ...(redactedPrompt.match(/`+/g) || ['']).map((s) => s.length + 1));
  const fence = '`'.repeat(longestBacktickRun);
  lines.push(fence);
  lines.push(redactedPrompt);
  lines.push(fence);
  lines.push('');

  await appendFile(logPath, lines.join('\n') + '\n', 'utf-8');

  return { logPath, redactionCount };
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const projectDir = path.resolve(getArg('project') || process.cwd());
  // setup-wizard.mjs가 2026-07-20에 이미 겪고 고친 결함과 같은 패턴 방지 — 존재하지 않는
  // 프로젝트 경로(오타 등)를 조용히 새로 만들어버리면 사용자가 "성공"으로 오인할 수 있다.
  // existsSync만으로는 파일과 디렉터리를 구분 못 해 --project가 파일을 가리키면 이 가드를
  // 통과한 뒤 하위에서 Node 내부 에러(ENOTDIR)가 그대로 노출됐다(asset-ledger.mjs에서
  // 2026-08-19 실측 발견 — 같은 패턴 회귀 방지).
  if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) {
    console.error(`프로젝트 디렉터리를 찾을 수 없습니다: ${projectDir}`);
    process.exit(1);
  }
  const designKitDir = path.join(projectDir, '.design-kit');

  const assetType = getArg('assetType');
  const model = getArg('model');
  const promptFile = getArg('promptFile');

  if (!assetType || !model || !promptFile) {
    console.error(
      '사용법: ai-generation-log.mjs --project <경로> --assetType <copy|image|other> --model <모델명> --promptFile <프롬프트 텍스트 파일 경로> [--humanEdits <설명>] [--generatedFiles <파일1,파일2>]'
    );
    process.exit(2);
  }

  const prompt = readFileSync(path.resolve(promptFile), 'utf-8');
  const generatedFilesArg = getArg('generatedFiles');
  const generatedFiles = generatedFilesArg
    ? generatedFilesArg.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const result = await appendGenerationLog({
    designKitDir,
    assetType,
    model,
    prompt,
    humanEdits: getArg('humanEdits') || '',
    generatedFiles,
  });
  console.log(JSON.stringify(result, null, 2));
}

// 진입점 판정은 fileURLToPath로(04_PROJECT_SPEC.md ALWAYS DO — pathname 기반 비교는 경로에
// 공백·한글이 있으면 항상 어긋나 main()이 안 돌고 exit 0으로 조용히 끝난다. 이 킷의 다른
// 스크립트들과 동일한 규칙 — 새 스크립트를 추가할 때마다 반드시 이 형태를 그대로 따를 것).
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[ai-generation-log] 실패:', err.message);
    process.exitCode = 1;
  });
}
