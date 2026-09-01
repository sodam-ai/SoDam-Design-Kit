#!/usr/bin/env node
// SoDam-Design-Kit — 파이프라인 코드 생성기 (매핑된 컴포넌트 재사용 경로)
// component-map.json에서 Figma 노드에 매핑된 기존 컴포넌트를 찾아 프리뷰 라우트로 연결한다.
// 이 스크립트는 Figma를 호출하지 않는다 — Figma 읽기는 에이전트(Claude Code)가 MCP 도구로
// 수행하고 component-map.json에 매핑을 기록해두면, 이 스크립트는 그 결과만 소비한다.
// (04 ALWAYS DO: "재시도 중 같은 노드 재호출 금지" — 재시도가 이 스크립트만 다시 부르면
// Figma 호출이 자동으로 0회가 되는 구조. 무료 월 6회 예산 보호가 목적)

import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePreviewRoute, ensureGitignored } from './preview-route.mjs';

/** figmaNodeId(우선) 또는 figmaName으로 component-map에서 매핑된 컴포넌트를 찾음 */
export function matchComponent(componentMap, { figmaNodeId, figmaName }) {
  return (
    componentMap.find((c) => figmaNodeId && c.figmaNodeId === figmaNodeId) ||
    componentMap.find((c) => figmaName && c.figmaName === figmaName) ||
    null
  );
}

/** components.json(shadcn 단일 출처)로 codePath를 import 별칭 경로로 변환 — 하드코딩 금지 (setup-wizard.mjs와 동일 원칙) */
export function codePathToImportPath(projectDir, codePath) {
  const componentsJsonPath = path.join(projectDir, 'components.json');
  if (!existsSync(componentsJsonPath)) {
    throw new Error('components.json이 없습니다 — 대상 프로젝트에 shadcn/ui가 설치되어 있는지 확인하세요.');
  }
  const componentsConfig = JSON.parse(readFileSync(componentsJsonPath, 'utf-8'));
  const uiAlias = componentsConfig.aliases?.ui;
  if (!uiAlias) {
    throw new Error('components.json에 aliases.ui가 없습니다.');
  }
  const fileName = path.basename(codePath, path.extname(codePath));
  return `${uiAlias}/${fileName}`;
}

/** "button" → "Button", "alert-dialog" → "AlertDialog" (named export 관례 추정) */
export function guessExportName(codePath) {
  const base = path.basename(codePath, path.extname(codePath));
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * component-map 매핑 → 프리뷰 라우트 생성 (기존 컴포넌트 재사용 — 신규 코드 생성 아님).
 * Figma를 다시 읽지 않는다: 호출자가 이미 component-map.json에 기록해둔 매핑만 사용한다.
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {string} opts.designKitDir - '.design-kit' 절대경로
 * @param {string} [opts.figmaNodeId]
 * @param {string} [opts.figmaName]
 * @param {string|null} [opts.previewChildren] - preview-route.mjs로 그대로 전달 (기본 'Preview')
 */
export async function runCodegen({ projectDir, designKitDir, figmaNodeId, figmaName, previewChildren }) {
  const mapPath = path.join(designKitDir, 'component-map.json');
  const componentMap = JSON.parse(await readFile(mapPath, 'utf-8'));

  const matched = matchComponent(componentMap, { figmaNodeId, figmaName });
  if (!matched) {
    throw new Error(
      `component-map.json에 매핑된 컴포넌트가 없습니다 (figmaNodeId="${figmaNodeId || ''}", figmaName="${figmaName || ''}"). ` +
        `/sodam-design-kit:setup으로 초기 시드를 만들거나 component-map.json에 매핑을 직접 추가하세요.`
    );
  }

  const importPath = codePathToImportPath(projectDir, matched.codePath);
  const exportName = guessExportName(matched.codePath);

  const result = await generatePreviewRoute({
    projectDir,
    componentName: exportName,
    importPath,
    exportName,
    previewChildren: previewChildren === undefined ? 'Preview' : previewChildren,
  });
  const gitignoreUpdated = await ensureGitignored(projectDir, result.appDir);

  return { ...result, gitignoreUpdated, matchedComponent: matched };
}

/**
 * Tailwind 임의값(arbitrary value) 대괄호 `-[...]` 안이 "오직" raw hex 색상이거나 "오직"
 * 숫자+px일 때만 위반으로 잡는다 (2026-07-27 신설 — M4, 04 DO NOT "하드코딩 hex·px 금지,
 * 기존 토큰 우선"의 최초 코드 강제). 지금까지 이 규칙은 순전히 에이전트의 선의에만
 * 의존했고 코드로 검사하는 장치가 전혀 없었다 — 이번 세션에 발견한 다른 결함들(진입점·
 * 포트 검사)과 정확히 같은 패턴("문서엔 규칙이 있는데 강제하는 코드가 없다").
 *
 * 대괄호 안이 CSS 변수·함수를 참조하는 정상 패턴(예: 실제 shadcn button.tsx의
 * `rounded-[min(var(--radius-md),10px)]`·`bg-[color-mix(in_oklch,var(--secondary),...)]`·
 * `text-[0.8rem]`)은 위반으로 잡히면 안 된다 — 대괄호 전체가 순수 hex/px여야만 위반이므로
 * "10px"가 함수 인자로 섞여 있거나 단위가 px가 아니면 이 검사를 통과한다(실제 button.tsx로
 * 대조 확인, tests/pipeline-codegen.test.mjs에 회귀 테스트로 고정).
 */
export function findHardcodedStyleViolations(code) {
  const pattern = /-\[(#[0-9a-fA-F]{3,8}|[\d.]+px)\]/g;
  const violations = [];
  let match;
  while ((match = pattern.exec(code)) !== null) {
    violations.push(match[0]);
  }
  return violations;
}

/**
 * component-map에 매핑이 없는 신규 Figma 노드를 위한 등록 경로 (2026-07-27 신설 — M4,
 * pipeline.md "아직 없는 것" 1번 해소). Figma 원시 데이터를 실제로 읽고 코드로 변환하는
 * 판단은 에이전트(Claude Code)의 몫으로 남긴다 — 이 스크립트는 runCodegen과 같은 원칙으로
 * Figma를 호출하지 않는다. 에이전트가 이미 생성해 디스크에 써둔 .tsx 파일을 받아
 * (1) 하드코딩 값 검사 (2) 프로젝트 경로 정규화 검증(06 신뢰 경계 — 경로 조작 차단)
 * (3) 대상 위치에 배치 (4) component-map에 새 항목 등록 (5) 프리뷰 라우트 생성까지만
 * 담당한다 — 그 다음은 재사용 경로와 동일하게 verify-runner로 이어진다.
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {string} opts.designKitDir - '.design-kit' 절대경로
 * @param {string} [opts.figmaNodeId]
 * @param {string} [opts.figmaName]
 * @param {string} opts.sourceFile - 에이전트가 생성한 컴포넌트 코드가 담긴 파일 경로(스크래치 위치 무관)
 * @param {string} opts.codePath - 프로젝트 안에 배치할 상대 경로 (예: "src/components/ui/badge.tsx")
 */
export async function registerNewComponent({ projectDir, designKitDir, figmaNodeId, figmaName, sourceFile, codePath }) {
  if (!existsSync(sourceFile)) {
    throw new Error(`생성된 컴포넌트 코드 파일을 찾을 수 없습니다: ${sourceFile}`);
  }

  // 06 신뢰 경계: 대상 경로는 반드시 프로젝트 루트 하위로 정규화 검증(경로 조작 차단) —
  // codePath가 "../../etc/passwd" 같은 값이어도 프로젝트 밖으로 못 나가게 막는다.
  const resolvedProjectDir = path.resolve(projectDir);
  const resolvedDest = path.resolve(resolvedProjectDir, codePath);
  if (resolvedDest !== resolvedProjectDir && !resolvedDest.startsWith(resolvedProjectDir + path.sep)) {
    throw new Error(`codePath가 프로젝트 루트 밖을 가리킵니다: ${codePath}`);
  }

  const code = await readFile(sourceFile, 'utf-8');

  const violations = findHardcodedStyleViolations(code);
  if (violations.length > 0) {
    throw new Error(
      `생성된 코드에 하드코딩된 값이 있어 등록을 거부합니다: ${violations.join(', ')} — ` +
        `04_PROJECT_SPEC.md DO NOT "하드코딩 hex·px 금지, 기존 토큰 우선"에 맞춰 기존 Tailwind/shadcn 토큰으로 바꾸세요.`
    );
  }

  const mapPath = path.join(designKitDir, 'component-map.json');
  const componentMap = existsSync(mapPath) ? JSON.parse(await readFile(mapPath, 'utf-8')) : [];
  if (componentMap.some((c) => c.codePath === codePath)) {
    throw new Error(
      `component-map.json에 이미 codePath="${codePath}"가 등록돼 있습니다 — 기존 컴포넌트는 재사용 경로(--figmaNodeId만 지정)를 쓰세요.`
    );
  }

  await mkdir(path.dirname(resolvedDest), { recursive: true });
  await writeFile(resolvedDest, code, 'utf-8');

  componentMap.push({ figmaNodeId: figmaNodeId || '', figmaName: figmaName || '', codePath, propsHint: {}, lastVerified: '' });
  await writeFile(mapPath, JSON.stringify(componentMap, null, 2), 'utf-8');

  const importPath = codePathToImportPath(projectDir, codePath);
  const exportName = guessExportName(codePath);
  const result = await generatePreviewRoute({ projectDir, componentName: exportName, importPath, exportName });
  const gitignoreUpdated = await ensureGitignored(projectDir, result.appDir);

  return { ...result, gitignoreUpdated, registeredComponent: { figmaNodeId: figmaNodeId || '', figmaName: figmaName || '', codePath } };
}

/**
 * registerNewComponent()의 결과를 실제 브라우저로 즉시 재검증까지 연쇄 실행하는 래퍼
 * (2026-09-01 설계·구현, T2B_RISK_REVIEW.md §5-1 — 완화방안 B). registerNewComponent()
 * 자체는 무수정 — dashboard-server.mjs의 reverifyRun()이 이미 쓰는 것과 동일한 5개
 * export 함수(acquireLock·startDevServer·verifyPage·judge·writeReport)를 새 순서로
 * 조합할 뿐, 신규 검증 로직은 없다.
 *
 * 주의: 이 함수는 아직 어떤 MCP 도구·CLI 플래그에도 연결돼 있지 않다 — Claude Desktop에
 * T2b를 실제로 열려면 mcp-server.mjs에 별도 도구 등록이 필요하고, 그건 별도 사용자
 * 승인 사항이다(§5-1 "정직한 한계" 참조).
 *
 * verify-runner.mjs·report-writer.mjs·execution-lock.mjs를 파일 상단이 아니라 여기서
 * 동적 import()하는 이유: verify-runner.mjs는 playwright·@axe-core/playwright를 정적
 * import한다. 이 파일(pipeline-codegen.mjs)을 상단에서 그 체인까지 정적 import하면,
 * 기존 tests/detail-page-pipeline.test.mjs의 "공백·한글 경로" 회귀 테스트처럼 이 파일을
 * 단독 복사해 node_modules 없는 임시 폴더에서 실행하는 모든 곳이 module-load 단계에서
 * 깨진다(실측 발견 — 이 함수 구현 직후 npm test로 재현·확인). 이 함수를 실제로 호출할 때만
 * 무거운 체인을 불러오도록 지연시켜, registerNewComponent() 등 기존 경로의 가벼운 import
 * 특성을 그대로 보존한다.
 */
export async function registerAndVerifyComponent({ projectDir, designKitDir, figmaNodeId, figmaName, sourceFile, codePath, target }) {
  const { startDevServer, verifyPage, judge } = await import('./verify-runner.mjs');
  const { writeReport } = await import('./report-writer.mjs');
  const { acquireLock, releaseLock } = await import('./execution-lock.mjs');

  const registration = await registerNewComponent({ projectDir, designKitDir, figmaNodeId, figmaName, sourceFile, codePath });

  await acquireLock(designKitDir);
  let devServer;
  try {
    devServer = await startDevServer(projectDir);
    const result = await verifyPage({
      baseUrl: devServer.url,
      route: registration.routePath,
      screenshotDir: path.join(designKitDir, 'reports', 'screenshots', `register-${guessExportName(codePath).toLowerCase()}-${Date.now()}`),
    });
    const judgement = judge(result);
    const report = await writeReport({
      designKitDir,
      target: target || `신규 컴포넌트 등록: ${codePath}`,
      generatedFiles: [codePath],
      retryCount: 0,
      route: registration.routePath,
      verifyRunnerOutput: { devServer: { port: devServer.port, autoStarted: true }, ...result, ...judgement },
    });
    return { ...registration, verification: { ...report, verdict: judgement.verdict } };
  } finally {
    if (devServer) await devServer.stop();
    await releaseLock(designKitDir);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const projectDir = path.resolve(getArg('project') || process.cwd());
  // 이 스크립트엔 프로젝트 경로 확인 가드가 아예 없었다 — 존재하지 않거나 파일을 가리키는
  // 경로를 주면 하위 파일 접근에서 Node 내부 에러(ENOENT 등)가 그대로 노출됐다(2026-08-19
  // 실측 발견 — asset-ledger.mjs 등 다른 4개 스크립트에 이미 적용한 것과 동일한 가드를
  // 여기 처음 추가한다).
  if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) {
    console.error(`프로젝트 디렉터리를 찾을 수 없습니다: ${projectDir}`);
    process.exit(1);
  }
  const designKitDir = path.join(projectDir, '.design-kit');
  const figmaNodeId = getArg('figmaNodeId');
  const figmaName = getArg('figmaName');
  const newComponentFile = getArg('newComponentFile');
  const codePath = getArg('codePath');

  if (newComponentFile) {
    if (!codePath) {
      console.error(
        '사용법(신규 컴포넌트): pipeline-codegen.mjs --project <경로> --newComponentFile <생성된 .tsx 경로> --codePath <배치할 상대경로> [--figmaNodeId <ID>] [--figmaName <이름>]'
      );
      process.exit(2);
    }
    const result = await registerNewComponent({ projectDir, designKitDir, figmaNodeId, figmaName, sourceFile: newComponentFile, codePath });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!figmaNodeId && !figmaName) {
    console.error('사용법: pipeline-codegen.mjs --project <경로> --figmaNodeId <ID> | --figmaName <이름>');
    process.exit(2);
  }

  const result = await runCodegen({ projectDir, designKitDir, figmaNodeId, figmaName });
  console.log(JSON.stringify(result, null, 2));
}

// 진입점 판정은 fileURLToPath로 (2026-07-27 실측 발견·수정 — 사유 정본은 hooks/verify-gate.mjs 주석).
// 요약: pathname 기반 비교는 경로에 공백·한글이 있으면 퍼센트 인코딩 때문에 항상 어긋나
// main()이 실행되지 않고 exit 0으로 조용히 끝난다. 되돌리지 말 것.
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[pipeline-codegen] 실패:', err.message);
    process.exitCode = 1;
  });
}
