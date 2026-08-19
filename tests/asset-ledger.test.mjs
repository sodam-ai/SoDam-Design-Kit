import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appendAssetLedger } from '../scripts/font-pipeline.mjs';
import { scanProjectImageFiles, loadAssetLedgerRows, checkAssetGate, generateAttribution } from '../scripts/asset-ledger.mjs';

const execFileAsync = promisify(execFile);
const SCRIPTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');

// --- scanProjectImageFiles ---

test('scanProjectImageFiles: 이미지 확장자를 찾고 node_modules·.next는 제외한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  try {
    await mkdir(path.join(dir, 'public', 'images'), { recursive: true });
    await writeFile(path.join(dir, 'public', 'images', 'hero.png'), Buffer.from('fake'));
    await writeFile(path.join(dir, 'public', 'images', 'icon.SVG'), Buffer.from('fake')); // 대문자 확장자도 인식
    await writeFile(path.join(dir, 'public', 'images', 'notes.txt'), 'not an image');
    await mkdir(path.join(dir, 'node_modules', 'some-pkg'), { recursive: true });
    await writeFile(path.join(dir, 'node_modules', 'some-pkg', 'logo.png'), Buffer.from('fake'));
    await mkdir(path.join(dir, '.next', 'cache'), { recursive: true });
    await writeFile(path.join(dir, '.next', 'cache', 'compiled.webp'), Buffer.from('fake'));

    const found = await scanProjectImageFiles(dir);
    assert.deepEqual(found, ['public/images/hero.png', 'public/images/icon.SVG']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('scanProjectImageFiles: .design-kit/ 전체를 건너뛴다 (검증 스크린샷·시각회귀 기준본은 외부 자산이 아님)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  try {
    await mkdir(path.join(dir, '.design-kit', 'reports', 'screenshots', 'run-1'), { recursive: true });
    await writeFile(path.join(dir, '.design-kit', 'reports', 'screenshots', 'run-1', '360.png'), Buffer.from('fake'));
    await mkdir(path.join(dir, '.design-kit', 'reports', 'baseline', 'home'), { recursive: true });
    await writeFile(path.join(dir, '.design-kit', 'reports', 'baseline', 'home', '360.png'), Buffer.from('fake'));

    const found = await scanProjectImageFiles(dir);
    assert.deepEqual(found, [], '.design-kit/ 안의 스크린샷·기준본은 자산 게이트 대상이 아니어야 함');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('scanProjectImageFiles: public/design-kit-assets/(마케팅 파이프라인 산출물)를 건너뛴다 (1m 결정 경계, 회귀 방지)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  try {
    await mkdir(path.join(dir, 'public', 'design-kit-assets'), { recursive: true });
    await writeFile(path.join(dir, 'public', 'design-kit-assets', 'og-sale.png'), Buffer.from('fake'));
    await mkdir(path.join(dir, 'public', 'images'), { recursive: true });
    await writeFile(path.join(dir, 'public', 'images', 'stock-photo.jpg'), Buffer.from('fake'));

    const found = await scanProjectImageFiles(dir);
    assert.deepEqual(
      found,
      ['public/images/stock-photo.jpg'],
      'marketing-asset-pipeline.mjs 산출물은 AI-GENERATION-LOG.md가 이력을 남기지 ASSET-LEDGER 대상이 아님'
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('scanProjectImageFiles: 이미지가 하나도 없으면 빈 배열', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  try {
    await mkdir(path.join(dir, 'src'), { recursive: true });
    await writeFile(path.join(dir, 'src', 'index.ts'), 'export {}');
    assert.deepEqual(await scanProjectImageFiles(dir), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('scanProjectImageFiles: 존재하지 않는 프로젝트 경로는 크래시 없이 빈 배열을 반환한다', async () => {
  const result = await scanProjectImageFiles(path.join(tmpdir(), 'design-kit-does-not-exist-xyz-123'));
  assert.deepEqual(result, []);
});

// --- loadAssetLedgerRows ---

test('loadAssetLedgerRows: 대장이 없으면 빈 배열', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  try {
    const rows = await loadAssetLedgerRows(path.join(dir, '.design-kit'));
    assert.deepEqual(rows, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadAssetLedgerRows: 전체 8개 필드를 객체로 반환한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await appendAssetLedger(designKitDir, [
      { filename: 'public/images/stock-photo.jpg', kind: '이미지', sourceUrl: 'https://example.com/photo', license: 'CC0', commercialUse: 'O', attribution: '불필요', aiGenerated: 'N' },
    ]);
    const rows = await loadAssetLedgerRows(designKitDir);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].filename, 'public/images/stock-photo.jpg');
    assert.equal(rows[0].kind, '이미지');
    assert.equal(rows[0].license, 'CC0');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- checkAssetGate ---

test('checkAssetGate: 대장에 등록된 이미지는 위반 0건', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await mkdir(path.join(dir, 'public', 'images'), { recursive: true });
    await writeFile(path.join(dir, 'public', 'images', 'stock-photo.jpg'), Buffer.from('fake'));
    await appendAssetLedger(designKitDir, [
      { filename: 'public/images/stock-photo.jpg', kind: '이미지', sourceUrl: 'https://x', license: 'CC0', commercialUse: 'O', attribution: '-', aiGenerated: 'N' },
    ]);

    const result = await checkAssetGate({ projectDir: dir, designKitDir });
    assert.equal(result.scannedCount, 1);
    assert.equal(result.violations.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkAssetGate: 대장에 없는 이미지는 미등록(violation)으로 판정한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await mkdir(path.join(dir, 'public', 'images'), { recursive: true });
    await writeFile(path.join(dir, 'public', 'images', 'unknown.png'), Buffer.from('fake'));

    const result = await checkAssetGate({ projectDir: dir, designKitDir });
    assert.equal(result.scannedCount, 1);
    assert.deepEqual(result.violations, [{ file: 'public/images/unknown.png' }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkAssetGate: 등록·미등록이 섞여 있으면 미등록분만 골라낸다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await mkdir(path.join(dir, 'public', 'images'), { recursive: true });
    await writeFile(path.join(dir, 'public', 'images', 'registered.jpg'), Buffer.from('fake'));
    await writeFile(path.join(dir, 'public', 'images', 'unknown.png'), Buffer.from('fake'));
    await appendAssetLedger(designKitDir, [
      { filename: 'public/images/registered.jpg', kind: '이미지', sourceUrl: 'https://x', license: 'CC0', commercialUse: 'O', attribution: '-', aiGenerated: 'N' },
    ]);

    const result = await checkAssetGate({ projectDir: dir, designKitDir });
    assert.equal(result.scannedCount, 2);
    assert.deepEqual(result.violations, [{ file: 'public/images/unknown.png' }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkAssetGate: 대장과 실제 파일명이 대소문자만 다르면 위반으로 오판하지 않는다 (font-pipeline.mjs와 동일 규칙)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await mkdir(path.join(dir, 'public', 'images'), { recursive: true });
    await writeFile(path.join(dir, 'public', 'images', 'STOCK.JPG'), Buffer.from('fake'));
    await appendAssetLedger(designKitDir, [
      { filename: 'public/images/stock.jpg', kind: '이미지', sourceUrl: 'https://x', license: 'CC0', commercialUse: 'O', attribution: '-', aiGenerated: 'N' },
    ]);

    const result = await checkAssetGate({ projectDir: dir, designKitDir });
    assert.deepEqual(result.violations, [], '대소문자만 다른 등록 항목은 위반이 아니어야 함');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkAssetGate: 마케팅 파이프라인 산출물(public/design-kit-assets/)은 대장 등록 여부와 무관하게 애초에 스캔되지 않는다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await mkdir(path.join(dir, 'public', 'design-kit-assets'), { recursive: true });
    await writeFile(path.join(dir, 'public', 'design-kit-assets', 'og-sale.png'), Buffer.from('fake'));

    const result = await checkAssetGate({ projectDir: dir, designKitDir });
    assert.equal(result.scannedCount, 0);
    assert.deepEqual(result.violations, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkAssetGate: 이미지가 전혀 없으면 대장 유무와 무관하게 위반 0건', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    const result = await checkAssetGate({ projectDir: dir, designKitDir });
    assert.equal(result.scannedCount, 0);
    assert.deepEqual(result.violations, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- generateAttribution ---

test('generateAttribution: 대장이 비어있으면 "등록된 자산 없음"으로 정상 생성한다(에러 아님)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    const result = await generateAttribution(designKitDir);
    assert.equal(result.rowCount, 0);
    const content = await readFile(result.outputPath, 'utf-8');
    assert.match(content, /등록된 자산이 없습니다/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('generateAttribution: 종류(kind)별로 그룹핑해 렌더링한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await appendAssetLedger(designKitDir, [
      { filename: 'fonts/pretendard/Pretendard-Regular.otf', kind: '폰트', sourceUrl: 'https://github.com/orioncactus/pretendard', license: 'OFL-1.1', commercialUse: 'O', attribution: '불필요(OFL)', aiGenerated: 'N' },
      { filename: 'public/images/stock.jpg', kind: '이미지', sourceUrl: 'https://example.com/photo', license: 'CC0', commercialUse: 'O', attribution: '불필요', aiGenerated: 'N' },
    ]);
    const result = await generateAttribution(designKitDir);
    assert.equal(result.rowCount, 2);
    const content = await readFile(result.outputPath, 'utf-8');
    assert.match(content, /## 폰트 \(1건\)/);
    assert.match(content, /## 이미지 \(1건\)/);
    assert.match(content, /Pretendard-Regular\.otf/);
    assert.match(content, /stock\.jpg/);
    assert.match(content, /https:\/\/github\.com\/orioncactus\/pretendard/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('generateAttribution: AI 생성 자산은 출처URL 대신 AI-GENERATION-LOG.md를 안내한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await appendAssetLedger(designKitDir, [
      { filename: 'public/images/ai-banner.png', kind: '이미지', sourceUrl: '', license: '해당없음', commercialUse: 'O', attribution: '불필요', aiGenerated: 'Y' },
    ]);
    const content = await readFile((await generateAttribution(designKitDir)).outputPath, 'utf-8');
    assert.match(content, /AI-GENERATION-LOG\.md`\s*참고/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('generateAttribution: 항상 덮어쓴다(결정론적 산출물 — 대장을 다시 읽어 재생성)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetgate-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await generateAttribution(designKitDir);
    let content = await readFile(path.join(designKitDir, 'ATTRIBUTION.md'), 'utf-8');
    assert.match(content, /등록된 자산이 없습니다/);

    await appendAssetLedger(designKitDir, [
      { filename: 'public/images/new.png', kind: '이미지', sourceUrl: 'https://x', license: 'CC0', commercialUse: 'O', attribution: '-', aiGenerated: 'N' },
    ]);
    await generateAttribution(designKitDir);
    content = await readFile(path.join(designKitDir, 'ATTRIBUTION.md'), 'utf-8');
    assert.match(content, /new\.png/);
    assert.doesNotMatch(content, /등록된 자산이 없습니다/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- CLI: 실제 프로세스 실행 ---
// 04_PROJECT_SPEC.md ALWAYS DO — 새 CLI 스크립트마다 공백·한글 경로에서도 실제로 출력이
// 나오는지(조용한 실패 방지) 프로세스로 직접 실행해 검증한다.

test('CLI: 경로에 공백·한글이 있어도 asset-ledger 스크립트가 실제로 실행된다 (조용한 실패 방지)', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-assetledger-'));
  try {
    const weirdDir = path.join(base, 'My 한글 폴더');
    await mkdir(weirdDir, { recursive: true });
    const scriptCopy = path.join(weirdDir, 'asset-ledger.mjs');
    await copyFile(path.join(SCRIPTS_DIR, 'asset-ledger.mjs'), scriptCopy);
    // asset-ledger.mjs가 상대경로로 import하는 font-pipeline.mjs도 같은 폴더에 있어야 실제로 로드된다.
    await copyFile(path.join(SCRIPTS_DIR, 'font-pipeline.mjs'), path.join(weirdDir, 'font-pipeline.mjs'));

    const projectDir = path.join(weirdDir, 'project');
    await mkdir(projectDir, { recursive: true });

    const { stdout } = await execFileAsync(process.execPath, [scriptCopy, '--project', projectDir, '--generateAttribution']);

    assert.match(stdout, /outputPath/, '스크립트가 아무 출력도 없이 끝나면 main()이 안 돈 것');
    assert.ok(existsSync(path.join(projectDir, '.design-kit', 'ATTRIBUTION.md')));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('CLI: 존재하지 않는 프로젝트 경로는 거부하고 폴더를 만들지 않는다', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-assetledger-'));
  const nonexistent = path.join(base, 'does-not-exist');
  try {
    await assert.rejects(
      () => execFileAsync(process.execPath, [path.join(SCRIPTS_DIR, 'asset-ledger.mjs'), '--project', nonexistent, '--generateAttribution']),
      (err) => {
        assert.equal(err.code, 1);
        assert.match(err.stderr, /프로젝트 디렉터리를 찾을 수 없습니다/);
        return true;
      }
    );
    assert.equal(existsSync(nonexistent), false, '존재하지 않던 경로가 조용히 생성되면 안 됨');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('CLI: --project가 디렉터리가 아니라 파일을 가리키면 Node 내부 에러 대신 같은 안내 문구로 거부한다 (2026-08-19 실측 발견 결함 회귀 방지)', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-assetledger-'));
  const filePath = path.join(base, 'not-a-directory.txt');
  try {
    await writeFile(filePath, '이건 프로젝트 폴더가 아니라 파일입니다', 'utf-8');
    await assert.rejects(
      () => execFileAsync(process.execPath, [path.join(SCRIPTS_DIR, 'asset-ledger.mjs'), '--project', filePath, '--generateAttribution']),
      (err) => {
        assert.equal(err.code, 1);
        assert.match(err.stderr, /프로젝트 디렉터리를 찾을 수 없습니다/);
        assert.doesNotMatch(err.stderr, /ENOTDIR/, 'Node 내부 에러 메시지가 그대로 노출되면 안 됨');
        return true;
      }
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('CLI: --generateAttribution 없이 실행하면 사용법 안내와 함께 exit code 2', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetledger-'));
  try {
    await assert.rejects(
      () => execFileAsync(process.execPath, [path.join(SCRIPTS_DIR, 'asset-ledger.mjs'), '--project', dir]),
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
