#!/usr/bin/env node
// SoDam-Design-Kit — 파이프라인 코드 생성기 (매핑된 컴포넌트 재사용 경로)
// component-map.json에서 Figma 노드에 매핑된 기존 컴포넌트를 찾아 프리뷰 라우트로 연결한다.
// 이 스크립트는 Figma를 호출하지 않는다 — Figma 읽기는 에이전트(Claude Code)가 MCP 도구로
// 수행하고 component-map.json에 매핑을 기록해두면, 이 스크립트는 그 결과만 소비한다.
// (04 ALWAYS DO: "재시도 중 같은 노드 재호출 금지" — 재시도가 이 스크립트만 다시 부르면
// Figma 호출이 자동으로 0회가 되는 구조. 무료 월 6회 예산 보호가 목적)

import { existsSync, readFileSync } from 'node:fs';
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

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const projectDir = path.resolve(getArg('project') || process.cwd());
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
