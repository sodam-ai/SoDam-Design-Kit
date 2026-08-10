#!/usr/bin/env node
// SoDam-Design-Kit — 상세페이지 파이프라인 (Phase 3 첫 증분: 상품 데이터 → 카피 → 페이지 코드)
// 03_PHASES.md L110 범위: "상품 데이터(CSV/JSON) → 카피 생성 → 페이지 코드 → 동일 검증 게이트".
// 카피 작성·템플릿 작성은 에이전트(Claude Code)의 몫이다 — pipeline-codegen.mjs와 동일한 원칙으로
// 이 스크립트는 파싱·검사·배치·등록 같은 기계적 작업만 담당한다(외부 API 호출 없음, 무료·로컬 원칙).
// 검증은 verify-runner.mjs를 전혀 수정하지 않고 그대로 재사용한다("동일 검증 게이트").

import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findHardcodedStyleViolations } from './pipeline-codegen.mjs';
import { parseCsvLine } from './font-pipeline.mjs';
import { detectAppDir } from './preview-route.mjs';

/** 프로젝트가 src/app이든 app이든(detectAppDir 재사용) 같은 접두어 규칙으로 데이터 폴더 기본값을 정한다. */
function defaultDataDir(projectDir) {
  const appDir = detectAppDir(projectDir);
  return appDir.startsWith('src') ? path.join('src', 'data', 'products') : path.join('data', 'products');
}

const PRODUCT_ID_PATTERN = /^[a-z0-9-]+$/;
const REQUIRED_COPY_FIELDS = ['title'];

/** productId가 안전한 slug 형식인지 검사(영문 소문자·숫자·하이픈만) — 파일 경로에 쓰기 전 첫
 * 관문이다(04_PROJECT_SPEC.md DO NOT "외부 입력을 검증 없이 파일 경로에 넣지 마" 원칙의 이 기능판). */
export function validateProductId(id) {
  return typeof id === 'string' && id.length > 0 && PRODUCT_ID_PATTERN.test(id);
}

/**
 * 상품 데이터 파일(.csv 또는 .json)을 파싱해 객체 배열로 반환한다.
 * CSV는 첫 줄을 헤더(필드명)로 삼고 나머지 줄을 그 필드에 매핑한다(parseCsvLine 재사용 — 따옴표
 * 처리 포함). 각 행/원소는 고유한 id 필드가 필수 — 나머지 필드는 자유 형식으로 그대로 반환한다
 * (카피 작성 재료는 에이전트가 해석).
 */
export async function parseProductData(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const raw = await readFile(filePath, 'utf-8');

  let rows;
  if (ext === '.json') {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('상품 데이터 JSON은 배열이어야 합니다.');
    }
    rows = parsed;
  } else if (ext === '.csv') {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      throw new Error('상품 데이터 CSV가 비어 있습니다.');
    }
    const header = parseCsvLine(lines[0]);
    rows = lines.slice(1).map((line) => {
      const fields = parseCsvLine(line);
      const row = {};
      header.forEach((key, i) => {
        row[key] = fields[i] ?? '';
      });
      return row;
    });
  } else {
    throw new Error(`지원하지 않는 상품 데이터 형식입니다: ${ext} (.csv 또는 .json만 지원)`);
  }

  const seen = new Set();
  for (const row of rows) {
    if (!row.id) {
      throw new Error('상품 데이터의 모든 행/원소는 id 필드가 필수입니다.');
    }
    if (seen.has(row.id)) {
      throw new Error(`중복된 상품 id입니다: ${row.id}`);
    }
    seen.add(row.id);
  }

  return rows;
}

/** registerNewComponent()(pipeline-codegen.mjs)와 동일한 경로 탈출 방지 패턴 — 대상 경로가
 * 반드시 프로젝트 루트 하위여야 한다(외부 입력으로 만든 경로가 프로젝트 밖을 못 나가게 막음). */
function resolveSafePath(projectDir, relativePath) {
  const resolvedProjectDir = path.resolve(projectDir);
  const resolvedDest = path.resolve(resolvedProjectDir, relativePath);
  if (resolvedDest !== resolvedProjectDir && !resolvedDest.startsWith(resolvedProjectDir + path.sep)) {
    throw new Error(`경로가 프로젝트 루트 밖을 가리킵니다: ${relativePath}`);
  }
  return resolvedDest;
}

const EMPTY_REGISTRY = { template: null, products: [] };

async function loadRegistry(designKitDir) {
  const mapPath = path.join(designKitDir, 'product-pages.json');
  if (!existsSync(mapPath)) {
    return { ...EMPTY_REGISTRY, products: [] };
  }
  const parsed = JSON.parse(await readFile(mapPath, 'utf-8'));
  return { template: parsed.template ?? null, products: parsed.products ?? [] };
}

async function saveRegistry(designKitDir, registry) {
  const mapPath = path.join(designKitDir, 'product-pages.json');
  await writeFile(mapPath, JSON.stringify(registry, null, 2), 'utf-8');
}

/**
 * 에이전트가 작성한 상품 카피를 검사·배치·등록한다. 같은 productId로 재실행하면 데이터 파일과
 * 등록 정보를 갱신한다(멱등 — setup-wizard.mjs 재스캔과 동일 원칙).
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {string} opts.designKitDir - '.design-kit' 절대경로
 * @param {string} opts.productId
 * @param {object} opts.copy - {title, usp, description, faq, ...} 최소 title 필수
 * @param {string} [opts.dataPath] - 기본값 "src/data/products/<productId>.json"
 */
export async function writeProductData({ projectDir, designKitDir, productId, copy, dataPath }) {
  if (!validateProductId(productId)) {
    throw new Error(`유효하지 않은 productId입니다(영문 소문자·숫자·하이픈만 허용): ${productId}`);
  }
  if (!copy || typeof copy !== 'object' || Array.isArray(copy)) {
    throw new Error('copy는 객체여야 합니다.');
  }
  for (const field of REQUIRED_COPY_FIELDS) {
    if (!copy[field] || typeof copy[field] !== 'string' || copy[field].trim().length === 0) {
      throw new Error(`카피에 필수 필드가 없습니다: ${field}`);
    }
  }

  const resolvedDataPath = dataPath || path.join(defaultDataDir(projectDir), `${productId}.json`).split(path.sep).join('/');
  const dest = resolveSafePath(projectDir, resolvedDataPath);

  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, JSON.stringify(copy, null, 2), 'utf-8');

  const registry = await loadRegistry(designKitDir);
  const existing = registry.products.find((p) => p.productId === productId);
  if (existing) {
    existing.dataPath = resolvedDataPath;
  } else {
    registry.products.push({ productId, dataPath: resolvedDataPath, lastVerified: '' });
  }
  await saveRegistry(designKitDir, registry);

  return { productId, dataPath: resolvedDataPath };
}

/**
 * 에이전트가 작성한 페이지 템플릿을 검사·배치·등록한다 — 템플릿은 프로젝트당 1개, 이미 등록돼
 * 있으면 재생성하지 않고 거부한다(registerNewComponent()의 codePath 중복 거부와 동일한 원칙 —
 * 손으로 고친 템플릿을 실수로 덮어쓰지 않기 위함). 카피 텍스트는 JSX 텍스트 노드로만 렌더된다는
 * 전제이므로 dangerouslySetInnerHTML 사용은 기계적으로 거부한다(React 기본 이스케이프 유지 — XSS 방지).
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {string} opts.designKitDir
 * @param {string} opts.sourceFile - 에이전트가 작성한 템플릿 코드 파일(스크래치 위치 무관)
 * @param {string} [opts.codePath] - 기본값 "app/products/[slug]/page.tsx"
 */
export async function registerPageTemplate({ projectDir, designKitDir, sourceFile, codePath }) {
  if (!existsSync(sourceFile)) {
    throw new Error(`생성된 템플릿 코드 파일을 찾을 수 없습니다: ${sourceFile}`);
  }

  const registry = await loadRegistry(designKitDir);
  if (registry.template) {
    throw new Error(
      `이미 템플릿이 등록돼 있습니다(codePath="${registry.template.codePath}") — 기존 템플릿을 직접 수정하세요. 새로 만들려면 product-pages.json의 template 항목을 먼저 제거하세요.`
    );
  }

  const code = await readFile(sourceFile, 'utf-8');

  const styleViolations = findHardcodedStyleViolations(code);
  if (styleViolations.length > 0) {
    throw new Error(
      `생성된 템플릿에 하드코딩된 값이 있어 등록을 거부합니다: ${styleViolations.join(', ')} — 04_PROJECT_SPEC.md DO NOT "하드코딩 hex·px 금지"에 맞춰 기존 Tailwind/shadcn 토큰으로 바꾸세요.`
    );
  }
  if (code.includes('dangerouslySetInnerHTML')) {
    throw new Error(
      '템플릿에 dangerouslySetInnerHTML을 사용할 수 없습니다 — 상품 카피는 JSX 텍스트 노드로만 렌더해 React 기본 이스케이프를 유지하세요(04_PROJECT_SPEC.md "텍스트는 이스케이프" 원칙).'
    );
  }

  // codePath 기본값(detectAppDir)은 위 검사를 전부 통과한 뒤에만 계산한다 — sourceFile 누락·
  // 하드코딩 값·dangerouslySetInnerHTML처럼 app 디렉터리와 무관한 실패가 "Next.js app 디렉터리를
  // 찾을 수 없습니다"라는 엉뚱한 에러로 가려지는 것을 막기 위함(오인시키는 에러 메시지 방지).
  const resolvedCodePath = codePath || path.join(detectAppDir(projectDir), 'products', '[slug]', 'page.tsx').split(path.sep).join('/');
  const dest = resolveSafePath(projectDir, resolvedCodePath);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, code, 'utf-8');

  registry.template = { codePath: resolvedCodePath, lastVerified: '' };
  await saveRegistry(designKitDir, registry);

  return { codePath: resolvedCodePath };
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const projectDir = path.resolve(getArg('project') || process.cwd());
  const designKitDir = path.join(projectDir, '.design-kit');

  const dataFile = getArg('dataFile');
  if (dataFile) {
    const rows = await parseProductData(path.resolve(dataFile));
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const templateFile = getArg('templateFile');
  if (templateFile) {
    const result = await registerPageTemplate({
      projectDir,
      designKitDir,
      sourceFile: templateFile,
      codePath: getArg('codePath'),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const productId = getArg('productId');
  const copyFile = getArg('copyFile');
  if (!productId || !copyFile) {
    console.error(
      '사용법: detail-page-pipeline.mjs --project <경로> --dataFile <CSV/JSON 경로> | --productId <id> --copyFile <카피 JSON 경로> [--dataPath <경로>] | --templateFile <템플릿 경로> [--codePath <경로>]'
    );
    process.exit(2);
  }

  const copy = JSON.parse(readFileSync(path.resolve(copyFile), 'utf-8'));
  const result = await writeProductData({ projectDir, designKitDir, productId, copy, dataPath: getArg('dataPath') });
  console.log(JSON.stringify(result, null, 2));
}

// 진입점 판정은 fileURLToPath로 (04_PROJECT_SPEC.md ALWAYS DO — pathname 기반 비교는 경로에
// 공백·한글이 있으면 퍼센트 인코딩 때문에 항상 어긋나 main()이 실행되지 않고 exit 0으로 조용히
// 끝난다. 이 킷의 다른 스크립트 4개와 동일한 규칙).
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[detail-page-pipeline] 실패:', err.message);
    process.exitCode = 1;
  });
}
