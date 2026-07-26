#!/usr/bin/env node
// SoDam-Design-Kit — 파이프라인 코드 생성기 (매핑된 컴포넌트 재사용 경로)
// component-map.json에서 Figma 노드에 매핑된 기존 컴포넌트를 찾아 프리뷰 라우트로 연결한다.
// 이 스크립트는 Figma를 호출하지 않는다 — Figma 읽기는 에이전트(Claude Code)가 MCP 도구로
// 수행하고 component-map.json에 매핑을 기록해두면, 이 스크립트는 그 결과만 소비한다.
// (04 ALWAYS DO: "재시도 중 같은 노드 재호출 금지" — 재시도가 이 스크립트만 다시 부르면
// Figma 호출이 자동으로 0회가 되는 구조. 무료 월 6회 예산 보호가 목적)

import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
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
