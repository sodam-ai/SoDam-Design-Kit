#!/usr/bin/env node
// SoDam-Design-Kit — 판정서 기록기
// verify-runner.mjs의 결과를 .design-kit/runs/*.json (기계용) + reports/*.md (사람용)로 기록
// 스키마 정본: .PRD/02_DATA_MODEL.md (PipelineRun, VerifyReport)

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const SCREENSHOT_RETENTION_COUNT = 10;

/**
 * .design-kit/reports/screenshots/를 .gitignore에 등록 (setup-wizard.mjs의
 * ensureScreenshotsGitignored와 같은 패턴 — 2026-07-27 실측 발견·수정).
 *
 * writeReport()는 setup을 거치지 않고도 .design-kit를 새로 만들 수 있는 유일한 경로다
 * (verify-runner.mjs를 --target만으로 직접 실행 — tests/verify-runner.test.mjs가 이
 * 사용법을 의도적으로 테스트하며 정상 동작으로 취급한다, 막아서는 안 됨). 문제는 이
 * 경로로 생긴 .design-kit는 gitignore 등록이 setup-wizard.mjs 쪽에만 있어서, setup 없이
 * 바로 --target을 실행하면 스크린샷이 git에 그대로 커밋될 수 있는 상태로 남는다는 것 —
 * 22차에서 고친 것과 같은 결함이 이 경로로는 여전히 재현됨을 실측으로 확인했다(스크래치
 * 프로젝트에 setup 없이 --target+--screenshotDir로 직접 실행 → .design-kit/runs·reports는
 * 생겼지만 .gitignore는 끝내 생기지 않는 것을 확인). **이 호출을 제거하지 말 것.**
 */
async function ensureScreenshotsGitignored(projectDir) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const pattern = '.design-kit/reports/screenshots/';
  const content = existsSync(gitignorePath) ? await readFile(gitignorePath, 'utf-8') : '';
  if (content.includes(pattern)) return false;

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  await writeFile(gitignorePath, `${content}${separator}${pattern}\n`, 'utf-8');
  return true;
}

/**
 * reports/screenshots/의 실행별 폴더가 최근 N개(기본 10)를 넘으면 오래된 것부터 삭제.
 * 스키마 정본: .PRD/02_DATA_MODEL.md ComponentMap 절 위쪽 파일 트리 주석
 * ("screenshots/ # 최근 10회만 보관") — 문서엔 확정으로 체크돼 있었지만 코드가 없어
 * 실제로는 무제한 누적되던 걸 실측으로 발견·구현. runs/*.json·reports/*.md는 대상 아님
 * (git 커밋 대상 텍스트라 용량 문제가 없고, 02가 삭제 대상을 screenshots/로만 명시).
 */
async function pruneScreenshots(designKitDir, keep = SCREENSHOT_RETENTION_COUNT) {
  const screenshotsDir = path.join(designKitDir, 'reports', 'screenshots');
  let entries;
  try {
    entries = await readdir(screenshotsDir, { withFileTypes: true });
  } catch {
    return;
  }

  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length <= keep) return;

  const withMtime = await Promise.all(
    dirs.map(async (e) => {
      const full = path.join(screenshotsDir, e.name);
      const info = await stat(full);
      return { full, mtimeMs: info.mtimeMs };
    })
  );
  withMtime.sort((a, b) => a.mtimeMs - b.mtimeMs);

  const toDelete = withMtime.slice(0, withMtime.length - keep);
  for (const { full } of toDelete) {
    await rm(full, { recursive: true, force: true });
  }
}

function todayPrefix(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 오늘 날짜 기준 다음 순번의 runId 생성 (예: 2026-07-19-001).
 * 파일명에서 실제 순번을 파싱해 최댓값+1을 쓴다 — 예전엔 "존재하는 파일 개수+1"이었는데,
 * 중간 번호 파일이 하나라도 삭제되면(사용자가 지우거나, 잘못 기록된 판정서를 정리하거나)
 * 개수가 실제 최대 번호보다 작아져서 이미 존재하는 번호와 충돌 — writeReport()가 그 번호로
 * 다시 쓰면서 기존 판정 이력을 조용히 덮어쓰는 실제 데이터 손상을 실측으로 재현·확인했다
 * (020번을 지운 뒤 021번이 두 번 이상 겹쳐 써짐 — 서로 다른 실행 3건의 판정 기록이 1개만 남음).
 * 이 계산 방식을 다시 "개수 기반"으로 되돌리지 말 것 — 판정 이력이 이력이 아니게 된다.
 */
export async function nextRunId(designKitDir, date = new Date()) {
  const prefix = todayPrefix(date);
  const runsDir = path.join(designKitDir, 'runs');
  let existing = [];
  try {
    existing = await readdir(runsDir);
  } catch {
    existing = [];
  }
  const pattern = new RegExp(`^${prefix}-(\\d+)\\.json$`);
  const maxSeq = existing.reduce((max, f) => {
    const match = f.match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const seq = maxSeq + 1;
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

function renderReportMarkdown({ runId, target, verifyResult, judgement, devServerInfo, recheck }) {
  const { renderOk, consoleErrors, axeCounts, axeViolations, screenshots } = verifyResult;
  const lines = [];
  lines.push(`# 판정서 — ${runId}`);
  lines.push('');
  lines.push(`- 대상: ${target}`);
  lines.push(`- 판정: **${judgement.verdict}**`);
  if (judgement.reasons.length > 0) {
    lines.push(`- 사유: ${judgement.reasons.join(', ')}`);
  }
  lines.push('');
  lines.push('## playwright');
  lines.push(`- 렌더: ${renderOk ? 'OK' : 'FAIL'}`);
  lines.push(`- 콘솔 에러: ${consoleErrors.length}건${consoleErrors.length ? '\n  - ' + consoleErrors.join('\n  - ') : ''}`);
  lines.push('');
  lines.push('## axe (접근성)');
  lines.push(`- critical: ${axeCounts.critical} / serious: ${axeCounts.serious} / moderate: ${axeCounts.moderate} / minor: ${axeCounts.minor}`);
  // 위반 상세(규칙 id·설명·대상 선택자) — 2026-07-27 신설(M5). 예전엔 개수만 기록해
  // 사람도 AI도 "무엇을 고쳐야 하는지" 알 수 없었다. FAIL 재시도 시 이 상세를 다음 생성
  // 시도에 그대로 넘기면 된다(pipeline.md 재시도 절차 참조) — judge()의 판정 기준(카운트
  // 기반)은 이 상세와 무관하게 그대로다.
  if (axeViolations && axeViolations.length > 0) {
    lines.push('');
    lines.push('### 위반 상세 (다음 생성 시도에 참고)');
    for (const v of axeViolations) {
      const targetsText = v.targets && v.targets.length ? ` — 대상: ${v.targets.join(', ')}` : '';
      lines.push(`- [${v.impact}] ${v.id}: ${v.description}${targetsText}`);
    }
  }
  lines.push('');
  lines.push('## devServer');
  lines.push(devServerInfo.autoStarted ? `- 포트 ${devServerInfo.port} (자동 기동)` : `- 외부 제공 URL: ${devServerInfo.url}`);
  lines.push('');
  if (recheck) {
    lines.push('## recheck');
    lines.push(`- ${recheck}`);
    lines.push('');
  }
  lines.push('## screenshots');
  if (screenshots.length === 0) {
    lines.push('- (없음)');
  } else {
    for (const s of screenshots) lines.push(`- ${s.viewport}px: ${s.path}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * verify-runner.mjs 결과를 runs/*.json + reports/*.md로 기록.
 * @param {object} opts
 * @param {string} opts.designKitDir - '.design-kit' 절대경로
 * @param {string} opts.target - 대상 설명 (예: "fixture / 홈")
 * @param {string[]} [opts.generatedFiles] - 생성/수정된 파일 목록
 * @param {number} [opts.retryCount] - 자동 재시도 횟수
 * @param {string} [opts.recheck] - FAIL 재검 결과 문구 (2연속 FAIL 확정 로직은 호출자 책임)
 * @param {Date} [opts.date] - runId의 날짜 부분을 계산할 기준 시각 (기본값 = 실행 시각).
 *   nextRunId()가 이미 갖고 있던 것과 같은 주입 패턴을 writeReport()에도 연 것이다.
 *   용도는 테스트뿐 — "특정 날짜에 순번이 충돌하는 상황"을 결정적으로 재현하려면 이 주입구가
 *   있어야 한다. 없을 때는 테스트가 픽스처 날짜를 하드코딩할 수밖에 없어서 그 날 하루만
 *   통과하는 시한폭탄이 됐다(2026-07-27 실측 발견 — 실제로 깨져 있었음).
 *   실사용 호출부(verify-runner.mjs·e2e-selftest.mjs)는 이 값을 넘기지 않는다.
 * @param {object} opts.verifyRunnerOutput - verify-runner.mjs의 JSON 출력 전체
 */
export async function writeReport(opts) {
  const { designKitDir, target, generatedFiles = [], retryCount = 0, recheck = null, date = new Date(), verifyRunnerOutput } = opts;
  const { devServer: devServerInfo, verdict, reasons, ...rawVerifyResult } = verifyRunnerOutput;
  const judgement = { verdict, reasons };

  // 판정서(reports/*.md)는 커밋 대상(02 데이터 모델)인데 verify-runner.mjs가 돌려주는
  // 스크린샷 경로는 항상 절대경로 — 그대로 기록하면 로컬 폴더 구조가 그대로 git 이력에
  // 남는다(04 DO NOT: "판정서·runs·로그에 절대경로를 기록하지 마" 위반, 실제 판정서 파일에서
  // 실측 확인). designKitDir 기준 상대경로로 바꿔서 기록 — 이미 상대경로인 값(테스트 목업 등)은
  // 그대로 둔다.
  const verifyResult = {
    ...rawVerifyResult,
    screenshots: (rawVerifyResult.screenshots || []).map((s) => ({
      ...s,
      path: path.isAbsolute(s.path)
        ? path.relative(designKitDir, s.path).split(path.sep).join('/')
        : s.path,
    })),
  };

  const runsDir = path.join(designKitDir, 'runs');
  const reportsDir = path.join(designKitDir, 'reports');
  await mkdir(runsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await ensureScreenshotsGitignored(path.dirname(designKitDir));

  const runId = await nextRunId(designKitDir, date);
  // startedAt은 의도적으로 date를 쓰지 않는다 — runId는 "파일명의 날짜 구간"이고
  // startedAt은 "실제 실행 시각"이라 의미가 다르다. 테스트가 날짜를 주입해도 실행 시각은 진짜여야 한다.
  const startedAt = new Date().toISOString();

  const runRecord = {
    runId,
    startedAt,
    target,
    generatedFiles,
    status: judgement.verdict === 'PASS' ? 'pass' : 'fail',
    retryCount,
  };

  const runPath = path.join(runsDir, `${runId}.json`);
  const reportPath = path.join(reportsDir, `${runId}.md`);

  await writeFile(runPath, JSON.stringify(runRecord, null, 2), 'utf-8');
  await writeFile(
    reportPath,
    renderReportMarkdown({ runId, target, verifyResult, judgement, devServerInfo, recheck }),
    'utf-8'
  );
  await pruneScreenshots(designKitDir);

  return { runId, runPath, reportPath, status: runRecord.status };
}
