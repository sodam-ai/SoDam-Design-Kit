import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  validateProductId,
  parseProductData,
  writeProductData,
  registerPageTemplate,
} from '../scripts/detail-page-pipeline.mjs';

const execFileAsync = promisify(execFile);
const SCRIPTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');

// --- validateProductId ---

test('validateProductId: 소문자·숫자·하이픈은 허용', () => {
  assert.equal(validateProductId('sample-mug-01'), true);
});

test('validateProductId: 대문자·공백·특수문자는 거부', () => {
  assert.equal(validateProductId('Sample Mug'), false);
  assert.equal(validateProductId('mug!'), false);
});

test('validateProductId: 경로 조작 시도는 거부', () => {
  assert.equal(validateProductId('../../etc/passwd'), false);
  assert.equal(validateProductId('a/b'), false);
});

test('validateProductId: 빈 문자열·비문자열은 거부', () => {
  assert.equal(validateProductId(''), false);
  assert.equal(validateProductId(undefined), false);
  assert.equal(validateProductId(123), false);
});

// --- parseProductData ---

test('parseProductData: JSON 배열 파싱', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const file = path.join(dir, 'products.json');
    await writeFile(file, JSON.stringify([{ id: 'mug-01', name: '머그컵' }]), 'utf-8');
    const rows = await parseProductData(file);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'mug-01');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('parseProductData: CSV 헤더 기준 파싱(따옴표 안 콤마 포함)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const file = path.join(dir, 'products.csv');
    await writeFile(file, 'id,name,note\nmug-01,"머그컵, 대"\nmug-02,텀블러,보온\n', 'utf-8');
    const rows = await parseProductData(file);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, '머그컵, 대');
    assert.equal(rows[1].note, '보온');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('parseProductData: id 없는 행은 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const file = path.join(dir, 'products.json');
    await writeFile(file, JSON.stringify([{ name: '머그컵' }]), 'utf-8');
    await assert.rejects(() => parseProductData(file), /id 필드가 필수/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('parseProductData: 중복 id는 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const file = path.join(dir, 'products.json');
    await writeFile(file, JSON.stringify([{ id: 'mug-01' }, { id: 'mug-01' }]), 'utf-8');
    await assert.rejects(() => parseProductData(file), /중복된 상품 id/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('parseProductData: 지원하지 않는 확장자는 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const file = path.join(dir, 'products.txt');
    await writeFile(file, 'id,name\nmug-01,머그컵\n', 'utf-8');
    await assert.rejects(() => parseProductData(file), /지원하지 않는 상품 데이터 형식/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('parseProductData: 빈 CSV는 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const file = path.join(dir, 'products.csv');
    await writeFile(file, '', 'utf-8');
    await assert.rejects(() => parseProductData(file), /비어 있습니다/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- writeProductData ---

test('writeProductData: 정상 기록 시 데이터 파일 생성 + 등록', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await mkdir(path.join(dir, 'src', 'app'), { recursive: true }); // dataPath 기본값(detectAppDir) 계산에 필요
    const result = await writeProductData({
      projectDir: dir,
      designKitDir,
      productId: 'mug-01',
      copy: { title: '프리미엄 머그컵', usp: '보온 12시간' },
    });
    assert.equal(result.dataPath, 'src/data/products/mug-01.json');
    const written = JSON.parse(await readFile(path.join(dir, result.dataPath), 'utf-8'));
    assert.equal(written.title, '프리미엄 머그컵');
    const registry = JSON.parse(await readFile(path.join(designKitDir, 'product-pages.json'), 'utf-8'));
    assert.equal(registry.products.length, 1);
    assert.equal(registry.products[0].productId, 'mug-01');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeProductData: 같은 productId로 재실행하면 갱신(멱등, 중복 등록 없음)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await mkdir(path.join(dir, 'src', 'app'), { recursive: true });
    await writeProductData({ projectDir: dir, designKitDir, productId: 'mug-01', copy: { title: '머그컵 v1' } });
    await writeProductData({ projectDir: dir, designKitDir, productId: 'mug-01', copy: { title: '머그컵 v2' } });
    const registry = JSON.parse(await readFile(path.join(designKitDir, 'product-pages.json'), 'utf-8'));
    assert.equal(registry.products.length, 1);
    const written = JSON.parse(await readFile(path.join(dir, 'src/data/products/mug-01.json'), 'utf-8'));
    assert.equal(written.title, '머그컵 v2');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeProductData: title 없는 카피는 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await assert.rejects(
      () => writeProductData({ projectDir: dir, designKitDir, productId: 'mug-01', copy: { usp: '보온' } }),
      /필수 필드가 없습니다/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeProductData: 유효하지 않은 productId는 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await assert.rejects(
      () => writeProductData({ projectDir: dir, designKitDir, productId: '../escape', copy: { title: 'X' } }),
      /유효하지 않은 productId/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeProductData: dataPath로 프로젝트 밖 탈출 시도는 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await assert.rejects(
      () =>
        writeProductData({
          projectDir: dir,
          designKitDir,
          productId: 'mug-01',
          copy: { title: 'X' },
          dataPath: '../../outside.json',
        }),
      /프로젝트 루트 밖/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- registerPageTemplate ---

const SAFE_TEMPLATE = `export default function Page() { return <div className="p-4">{'ok'}</div>; }`;

test('registerPageTemplate: 정상 템플릿은 배치 + 등록 (src/app 감지 — detectAppDir 재사용)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await mkdir(path.join(dir, 'src', 'app'), { recursive: true });
    const src = path.join(dir, 'scratch.tsx');
    await writeFile(src, SAFE_TEMPLATE, 'utf-8');
    const result = await registerPageTemplate({ projectDir: dir, designKitDir, sourceFile: src });
    assert.equal(result.codePath, 'src/app/products/[slug]/page.tsx');
    const placed = await readFile(path.join(dir, result.codePath), 'utf-8');
    assert.equal(placed, SAFE_TEMPLATE);
    const registry = JSON.parse(await readFile(path.join(designKitDir, 'product-pages.json'), 'utf-8'));
    assert.equal(registry.template.codePath, 'src/app/products/[slug]/page.tsx');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('registerPageTemplate: app/(src 없이 루트) 감지도 정상 동작', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await mkdir(path.join(dir, 'app'), { recursive: true });
    const src = path.join(dir, 'scratch.tsx');
    await writeFile(src, SAFE_TEMPLATE, 'utf-8');
    const result = await registerPageTemplate({ projectDir: dir, designKitDir, sourceFile: src });
    assert.equal(result.codePath, 'app/products/[slug]/page.tsx');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('registerPageTemplate: 이미 등록된 템플릿은 재생성 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await mkdir(path.join(dir, 'src', 'app'), { recursive: true });
    const src = path.join(dir, 'scratch.tsx');
    await writeFile(src, SAFE_TEMPLATE, 'utf-8');
    await registerPageTemplate({ projectDir: dir, designKitDir, sourceFile: src });
    await assert.rejects(
      () => registerPageTemplate({ projectDir: dir, designKitDir, sourceFile: src }),
      /이미 템플릿이 등록/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('registerPageTemplate: 하드코딩 hex 값이 있으면 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    const src = path.join(dir, 'scratch.tsx');
    await writeFile(src, `export default function Page() { return <div className="bg-[#ff0000]" />; }`, 'utf-8');
    await assert.rejects(
      () => registerPageTemplate({ projectDir: dir, designKitDir, sourceFile: src }),
      /하드코딩된 값/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('registerPageTemplate: dangerouslySetInnerHTML 사용 시 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    const src = path.join(dir, 'scratch.tsx');
    await writeFile(
      src,
      `export default function Page({ html }) { return <div dangerouslySetInnerHTML={{ __html: html }} />; }`,
      'utf-8'
    );
    await assert.rejects(
      () => registerPageTemplate({ projectDir: dir, designKitDir, sourceFile: src }),
      /dangerouslySetInnerHTML/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('registerPageTemplate: codePath로 프로젝트 밖 탈출 시도는 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    const src = path.join(dir, 'scratch.tsx');
    await writeFile(src, SAFE_TEMPLATE, 'utf-8');
    await assert.rejects(
      () => registerPageTemplate({ projectDir: dir, designKitDir, sourceFile: src, codePath: '../../outside.tsx' }),
      /프로젝트 루트 밖/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('registerPageTemplate: 존재하지 않는 sourceFile은 명확한 에러', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await assert.rejects(
      () => registerPageTemplate({ projectDir: dir, designKitDir, sourceFile: path.join(dir, 'nope.tsx') }),
      /찾을 수 없습니다/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- writeProductData: copy 타입 가드 경계값 (2026-08-10 검증 라운드 — 실측되지 않았던 분기) ---

test('writeProductData: copy가 null이면 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await assert.rejects(
      () => writeProductData({ projectDir: dir, designKitDir, productId: 'mug-01', copy: null }),
      /copy는 객체여야 합니다/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeProductData: copy가 배열이면 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await assert.rejects(
      () => writeProductData({ projectDir: dir, designKitDir, productId: 'mug-01', copy: ['title'] }),
      /copy는 객체여야 합니다/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeProductData: copy가 문자열이면 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await assert.rejects(
      () => writeProductData({ projectDir: dir, designKitDir, productId: 'mug-01', copy: 'not an object' }),
      /copy는 객체여야 합니다/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- parseProductData: 불규칙한 CSV(열 개수가 헤더와 다른 행) ---

test('parseProductData: 헤더보다 필드가 적은 행은 빈 문자열로 채움, 많은 행은 초과분을 버림(크래시 없음)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const file = path.join(dir, 'ragged.csv');
    await writeFile(file, 'id,name,note\nmug-01,머그컵\nmug-02,텀블러,보온,여분필드\n', 'utf-8');
    const rows = await parseProductData(file);
    assert.equal(rows[0].note, '', '필드가 모자란 행은 빈 문자열로 채워져야 함');
    assert.equal(rows[1].note, '보온');
    assert.equal(Object.keys(rows[1]).length, 3, '헤더에 없는 초과 필드는 조용히 버려져야 함(크래시 없음)');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- CLI: 실제 프로세스 실행 ---
// 위 테스트들은 함수를 직접 import해서 부른다 — 실사용 경로인 "명령이 스크립트를 프로세스로
// 실행하는 구간"(commands/detail-page.md의 `node ".../scripts/detail-page-pipeline.mjs"`)은
// 검증되지 않고 있었다. 04_PROJECT_SPEC.md ALWAYS DO가 새 CLI 스크립트마다 요구하는 회귀
// 테스트(공백·한글 경로에서도 실제로 출력이 나오는가)를 이 스크립트에도 적용한다.
// detail-page-pipeline.mjs는 pipeline-codegen.mjs·font-pipeline.mjs·preview-route.mjs를
// 상대 경로로 import하므로, 실제 배치 형태와 같게 4개 파일을 함께 복사해야 한다.
test('CLI: 경로에 공백·한글이 있어도 detail-page-pipeline 스크립트가 실제로 실행된다 (조용한 실패 방지)', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const weirdDir = path.join(base, 'My 한글 폴더');
    await mkdir(weirdDir, { recursive: true });
    for (const file of ['detail-page-pipeline.mjs', 'pipeline-codegen.mjs', 'font-pipeline.mjs', 'preview-route.mjs']) {
      await copyFile(path.join(SCRIPTS_DIR, file), path.join(weirdDir, file));
    }
    const scriptCopy = path.join(weirdDir, 'detail-page-pipeline.mjs');

    const projectDir = path.join(weirdDir, 'project');
    await mkdir(projectDir, { recursive: true });
    const dataFile = path.join(weirdDir, 'products.json');
    await writeFile(dataFile, JSON.stringify([{ id: 'mug-01', name: '머그컵' }]), 'utf-8');

    // 04 DO NOT "셸 문자열 조합 금지" 준수 — 인자 배열로만 실행(shell:true 없음)
    const { stdout } = await execFileAsync(process.execPath, [scriptCopy, '--project', projectDir, '--dataFile', dataFile]);

    assert.match(
      stdout,
      /mug-01/,
      '스크립트가 아무 출력도 없이 끝나면 main()이 안 돈 것 — 사용자에겐 성공으로 보이는 조용한 실패'
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('CLI: 필수 인자 없이 실행하면 사용법 안내와 함께 exit code 2', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-detailpage-'));
  try {
    const projectDir = path.join(dir, 'project');
    await mkdir(projectDir, { recursive: true });
    await assert.rejects(
      () => execFileAsync(process.execPath, [path.join(SCRIPTS_DIR, 'detail-page-pipeline.mjs'), '--project', projectDir]),
      (err) => {
        assert.equal(err.code, 2);
        assert.match(err.stderr, /사용법/);
        return true;
      }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
