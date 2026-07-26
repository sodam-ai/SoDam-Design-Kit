#!/usr/bin/env node
// SoDam-Design-Kit — 설정 마법사 (Figma 무관, 프로젝트 자체 스캔만으로 완결)
// .design-kit/config.json 생성 + shadcn 설치 컴포넌트 스캔 → component-map.json 초기 시드
// 스키마 정본: .PRD/02_DATA_MODEL.md (KitConfig, ComponentMap)

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * .design-kit/reports/screenshots/를 프로젝트 .gitignore에 등록 (최초 1회만, 멱등).
 * 02_DATA_MODEL.md 결정: "판정서 MD만 커밋, screenshots는 gitignore" — 문서엔 확정으로
 * 적혀 있었지만 실제로 이 등록을 수행하는 코드가 없어 .design-kit/ 전체가 untracked로
 * 방치되던 걸 실측으로 발견(픽스처 프로젝트에서 실제 git status로 확인). preview-route.mjs의
 * ensureGitignored와 같은 패턴(중복 추가 방지)을 이 대상에 맞춰 별도로 구현.
 */
async function ensureScreenshotsGitignored(projectDir) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const pattern = '.design-kit/reports/screenshots/';
  const content = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : '';
  if (content.includes(pattern)) return false;

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  await writeFile(gitignorePath, `${content}${separator}${pattern}\n`, 'utf-8');
  return true;
}

/** tsconfig paths 매핑으로 "@/components/ui" 같은 별칭을 실제 상대경로로 해석 (경로 하드코딩 금지) */
export function resolveAlias(aliasPath, tsconfig) {
  const paths = tsconfig?.compilerOptions?.paths || {};
  for (const [pattern, targets] of Object.entries(paths)) {
    const prefix = pattern.replace(/\*$/, '');
    if (aliasPath.startsWith(prefix) && Array.isArray(targets) && targets[0]) {
      const rest = aliasPath.slice(prefix.length);
      const target = targets[0].replace(/\*$/, '');
      return path.join(target, rest);
    }
  }
  throw new Error(`tsconfig.json의 paths에서 별칭을 해석할 수 없습니다: ${aliasPath}`);
}

/** components.json(shadcn 자체 설정)을 단일 출처로 삼아 실제 UI 컴포넌트 디렉터리를 스캔 */
export async function scanComponents(projectDir) {
  const componentsJsonPath = path.join(projectDir, 'components.json');
  if (!existsSync(componentsJsonPath)) {
    return { installed: false, components: [] };
  }

  const componentsConfig = JSON.parse(readFileSync(componentsJsonPath, 'utf-8'));
  const uiAlias = componentsConfig.aliases?.ui;
  if (!uiAlias) return { installed: true, components: [] };

  const tsconfigPath = path.join(projectDir, 'tsconfig.json');
  const tsconfig = existsSync(tsconfigPath) ? JSON.parse(readFileSync(tsconfigPath, 'utf-8')) : {};
  const uiDirRelative = resolveAlias(uiAlias, tsconfig);
  const uiDirAbsolute = path.join(projectDir, uiDirRelative);

  if (!existsSync(uiDirAbsolute)) return { installed: true, components: [], uiDirRelative };

  const files = await readdir(uiDirAbsolute);
  const components = files
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => ({
      componentName: path.basename(f, '.tsx'),
      codePath: path.join(uiDirRelative, f).split(path.sep).join('/'),
    }));

  return { installed: true, components, uiDirRelative };
}

/**
 * 설정 마법사 실행. 이미 config.json이 있으면 기본적으로 건드리지 않는다(멱등성 —
 * 재실행 시 기존 설정을 실수로 덮어쓰는 사고 방지). --force로만 재생성.
 */
export async function runSetup(projectDir, opts = {}) {
  const { force = false, figmaFileUrl } = opts;

  // --project 경로 오타 시 엉뚱한 위치에 빈 .design-kit/을 조용히 만들어버리는 걸 막는다
  // (mkdir recursive:true가 없는 경로도 다 만들어버려서, 예전엔 "0개 컴포넌트 시드됨"으로
  // 조용히 "성공" 취급됐다 — pipeline-codegen.mjs/preview-route.mjs는 이미 명확히 실패하는데
  // setup-wizard.mjs만 그러지 않던 불일치를 실측으로 발견·수정).
  if (!existsSync(projectDir)) {
    throw new Error(`프로젝트 디렉터리를 찾을 수 없습니다: ${projectDir}`);
  }

  const designKitDir = path.join(projectDir, '.design-kit');
  const configPath = path.join(designKitDir, 'config.json');
  const mapPath = path.join(designKitDir, 'component-map.json');

  // config.json 존재 여부와 무관하게 항상 자가 치유 — gitignore 등록은 설정을 건드리지
  // 않는 순수 추가 동작이라 멱등성 가드(아래 skip)와 묶일 이유가 없다. 이미 setup을 마친
  // 기존 프로젝트도 다음 setup 재실행 때 누락된 gitignore 항목을 놓치지 않고 채운다.
  await ensureScreenshotsGitignored(projectDir);

  if (existsSync(configPath) && !force) {
    return {
      skipped: true,
      reason: '.design-kit/config.json이 이미 존재합니다. 재생성하려면 --force를 사용하세요.',
    };
  }

  const scan = await scanComponents(projectDir);

  // --force로 재실행해도 이미 확보한 Figma 매핑(figmaNodeId/figmaName/propsHint/lastVerified)을
  // 날리지 않는다 — 스캔은 "코드에 어떤 컴포넌트가 있는지"만 갱신하고, 매핑 데이터는 codePath가
  // 같으면 그대로 보존한다(04 DO NOT: "component-map을 무시하고... 매핑 우선").
  let priorByCodePath = {};
  if (existsSync(mapPath)) {
    try {
      const prior = JSON.parse(readFileSync(mapPath, 'utf-8'));
      for (const entry of prior) {
        if (entry && entry.codePath) priorByCodePath[entry.codePath] = entry;
      }
    } catch {
      // 기존 매핑 파일이 손상됐으면 보존할 게 없으므로 스캔 결과로 새로 시드
    }
  }

  await mkdir(designKitDir, { recursive: true });
  await mkdir(path.join(designKitDir, 'runs'), { recursive: true });
  await mkdir(path.join(designKitDir, 'reports'), { recursive: true });

  const config = {
    framework: 'nextjs',
    uiLibrary: 'shadcn',
    viewports: [360, 768, 1440],
    gateEnabled: true,
    maxAutoRetry: 3,
    a11yLevel: 'serious',
  };
  if (figmaFileUrl) config.figmaFileUrl = figmaFileUrl;

  const componentMap = scan.components.map((c) => priorByCodePath[c.codePath] || {
    figmaNodeId: '',
    figmaName: '',
    codePath: c.codePath,
  });

  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  await writeFile(mapPath, JSON.stringify(componentMap, null, 2), 'utf-8');

  return {
    skipped: false,
    shadcnInstalled: scan.installed,
    seededComponents: componentMap.length,
    configPath,
    mapPath,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const projectDir = path.resolve(getArg('project') || process.cwd());
  const force = args.includes('--force');
  const figmaFileUrl = getArg('figmaFileUrl');

  const result = await runSetup(projectDir, { force, figmaFileUrl });

  if (result.skipped) {
    console.log(`[setup] 건너뜀: ${result.reason}`);
    return;
  }

  if (!result.shadcnInstalled) {
    console.log('[setup] shadcn/ui가 설치되어 있지 않습니다. `npx shadcn init` 실행 여부를 사용자에게 확인하세요.');
  }

  console.log(`[setup] 완료: component-map에 ${result.seededComponents}개 컴포넌트 시드됨`);
  console.log(`  - ${result.configPath}`);
  console.log(`  - ${result.mapPath}`);
}

// 진입점 판정은 fileURLToPath로 (2026-07-27 실측 발견·수정 — 사유 정본은 hooks/verify-gate.mjs 주석).
// 요약: pathname 기반 비교는 경로에 공백·한글이 있으면 퍼센트 인코딩 때문에 항상 어긋나
// main()이 실행되지 않고 exit 0으로 조용히 끝난다. 되돌리지 말 것.
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[setup-wizard] 실패:', err.message);
    process.exitCode = 1;
  });
}
