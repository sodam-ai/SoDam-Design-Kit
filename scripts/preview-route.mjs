#!/usr/bin/env node
// SoDam-Design-Kit — 프리뷰 라우트 자동 생성
// 컴포넌트 1개를 dev 전용 /design-kit-preview/{컴포넌트}에 격리 렌더 (검증 스크린샷 노이즈 제거 목적, 01_PRD.md §5)
// 이 킷이 만든 파일만 안전하게 재생성함 — 그 외 기존 파일이 있으면 충돌로 보고 중단(남의 파일 덮어쓰기 방지)

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GENERATED_MARKER = '// SoDam-Design-Kit 자동 생성 — 직접 수정하지 마세요 (pipeline 재실행 시 덮어써짐)';

export function detectAppDir(projectDir) {
  if (existsSync(path.join(projectDir, 'src', 'app'))) return path.join('src', 'app');
  if (existsSync(path.join(projectDir, 'app'))) return 'app';
  throw new Error('Next.js app 디렉터리(app/ 또는 src/app/)를 찾을 수 없습니다.');
}

/**
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {string} opts.componentName - 라우트 슬러그로 쓸 컴포넌트 이름 (예: "Button")
 * @param {string} opts.importPath - 컴포넌트 import 경로 (예: "@/components/ui/button")
 * @param {string} [opts.exportName] - named export 이름 (기본값: componentName)
 * @param {string|null} [opts.previewChildren] - 프리뷰에 넣을 텍스트 자식 (기본값 "Preview").
 *   children 없이 렌더하면 텍스트 버튼류 컴포넌트가 "접근 가능한 이름 없음"(axe critical)으로 항상 FAIL하는
 *   실측 문제가 있어 기본값을 둠. children을 안 받는 컴포넌트는 null로 명시해 self-closing 렌더.
 *   실제 텍스트/props는 pipeline.md의 Figma 매핑 단계에서 채워지는 게 정본 — 이건 P1 최소 안전값일 뿐.
 */
export async function generatePreviewRoute({ projectDir, componentName, importPath, exportName, previewChildren = 'Preview' }) {
  const appDir = detectAppDir(projectDir);
  const routeSlug = componentName.toLowerCase();
  const routeDir = path.join(projectDir, appDir, 'design-kit-preview', routeSlug);
  const pagePath = path.join(routeDir, 'page.tsx');

  if (existsSync(pagePath)) {
    const existing = readFileSync(pagePath, 'utf-8');
    if (!existing.startsWith(GENERATED_MARKER)) {
      throw new Error(
        `${pagePath}가 이미 존재하고 이 킷이 만든 파일이 아닙니다 — 라우트 이름 충돌. 컴포넌트 이름을 바꾸거나 기존 파일을 확인하세요.`
      );
    }
  }

  const namedExport = exportName || componentName;
  const rendered =
    previewChildren === null
      ? `<${namedExport} />`
      : `<${namedExport}>${previewChildren}</${namedExport}>`;
  // axe-core moderate 위반(page-has-heading-one) 해소 — 2026-08-09. 검증을 표방하는 킷 자신의
  // 산출물이 접근성 지적을 남기는 건 이 킷의 정체성과 어긋난다(critical/serious만 게이트 기준이라
  // PASS 자체는 항상 정상이었지만, moderate도 판정서에 그대로 남아 방치되고 있었음).
  // 시각적으로는 숨기되(position:absolute+clip — 표준 sr-only 기법, display:none이 아니므로
  // 접근성 트리·axe 둘 다에서 "존재함"으로 인식됨) 화면엔 안 보이게 해서, 01_PRD.md §5가 요구하는
  // "프리뷰 라우트는 장식 없는 중립 배경 + 대상 컴포넌트만(스크린샷 노이즈 제거가 목적)" 요건과
  // 충돌하지 않는다 — 화면에 텍스트를 추가하는 게 아니라 접근성 트리에만 h1을 채운다.
  const content = `${GENERATED_MARKER}
import { ${namedExport} } from '${importPath}';

export default function DesignKitPreview() {
  return (
    <main style={{ background: '#ffffff', minHeight: '100vh', padding: '2rem' }}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        ${namedExport} 프리뷰
      </h1>
      ${rendered}
    </main>
  );
}
`;

  await mkdir(routeDir, { recursive: true });
  await writeFile(pagePath, content, 'utf-8');

  return { routePath: `/design-kit-preview/${routeSlug}`, filePath: pagePath, appDir };
}

/** 대상 프로젝트의 .gitignore에 프리뷰 라우트 폴더가 없으면 등록 (dev 전용 산출물이 커밋되지 않도록) */
export async function ensureGitignored(projectDir, appDirRelative) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const pattern = `${appDirRelative.split(path.sep).join('/')}/design-kit-preview/`;
  const content = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : '';
  if (content.includes(pattern)) return false;

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  await writeFile(gitignorePath, `${content}${separator}${pattern}\n`, 'utf-8');
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const projectDir = path.resolve(getArg('project') || process.cwd());
  const componentName = getArg('component');
  const importPath = getArg('importPath');
  const exportName = getArg('exportName');

  if (!componentName || !importPath) {
    console.error('사용법: preview-route.mjs --project <경로> --component <이름> --importPath <import경로> [--exportName <이름>]');
    process.exit(2);
  }

  const result = await generatePreviewRoute({ projectDir, componentName, importPath, exportName });
  const gitignoreUpdated = await ensureGitignored(projectDir, result.appDir);

  console.log(JSON.stringify({ ...result, gitignoreUpdated }, null, 2));
}

// 진입점 판정은 fileURLToPath로 (2026-07-27 실측 발견·수정 — 사유 정본은 hooks/verify-gate.mjs 주석).
// 요약: pathname 기반 비교는 경로에 공백·한글이 있으면 퍼센트 인코딩 때문에 항상 어긋나
// main()이 실행되지 않고 exit 0으로 조용히 끝난다. 되돌리지 말 것.
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[preview-route] 실패:', err.message);
    process.exitCode = 1;
  });
}
