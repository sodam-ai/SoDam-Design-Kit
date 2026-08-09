import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  FONT_WHITELIST,
  detectFontFormat,
  downloadFont,
  appendAssetLedger,
  generateFontModule,
} from '../scripts/font-pipeline.mjs';

// 실제 네트워크를 타지 않는다 — fetchFn을 주입해 로직만 검증한다(CI·오프라인 환경에서도
// 결정적으로 통과해야 함. 실제 다운로드 실측은 이 세션에서 수동으로 별도 확인함).
function fakeFetchReturning(buffer, { ok = true, status = 200 } = {}) {
  return async () => ({ ok, status, arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) });
}

function otfLikeBuffer() {
  return Buffer.concat([Buffer.from('OTTO', 'latin1'), Buffer.alloc(100, 1)]);
}

test('detectFontFormat: OTF/TTF/WOFF2 매직 바이트를 인식한다', () => {
  assert.equal(detectFontFormat(Buffer.from('OTTO', 'latin1')), 'otf');
  assert.equal(detectFontFormat(Buffer.from('wOF2', 'latin1')), 'woff2');
  assert.equal(detectFontFormat(Buffer.from('wOFF', 'latin1')), 'woff');
  assert.equal(detectFontFormat(Buffer.from([0x00, 0x01, 0x00, 0x00, 0xff])), 'ttf');
});

test('detectFontFormat: 폰트가 아닌 파일(HTML 에러 페이지 등)은 null', () => {
  assert.equal(detectFontFormat(Buffer.from('<!DOCTYPE html>', 'utf-8')), null);
  assert.equal(detectFontFormat(Buffer.from('')), null);
  assert.equal(detectFontFormat(null), null);
});

test('downloadFont: 허용목록에 없는 폰트는 400으로 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-font-'));
  try {
    await assert.rejects(
      () => downloadFont('comic-sans', path.join(dir, '.design-kit')),
      (err) => err.statusCode === 400
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('downloadFont: 정상 폰트 형식이면 저장하고 형식·바이트수를 기록한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-font-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    const fakeBuf = otfLikeBuffer();
    const fetchFn = fakeFetchReturning(fakeBuf);
    const result = await downloadFont('pretendard', designKitDir, { fetchFn });
    assert.equal(result.fontKey, 'pretendard');
    assert.equal(result.files[0].format, 'otf');
    assert.equal(result.files[0].bytes, fakeBuf.length);
    assert.ok(existsSync(result.files[0].path));
    assert.ok(existsSync(result.licensePath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('downloadFont: 폰트 형식이 아닌 응답(예: 404 에러 HTML)은 저장하지 않고 거부한다 (04 DO NOT 실행)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-font-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    const htmlBuf = Buffer.from('<html>404 Not Found</html>', 'utf-8');
    const fetchFn = fakeFetchReturning(htmlBuf);
    await assert.rejects(
      () => downloadFont('pretendard', designKitDir, { fetchFn }),
      /폰트 형식이 아닙니다/
    );
    assert.equal(existsSync(path.join(designKitDir, 'fonts', 'pretendard', 'Pretendard-Regular.otf')), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('downloadFont: HTTP 에러(404 등)는 502로 명확히 실패한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-font-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    const fetchFn = fakeFetchReturning(Buffer.alloc(0), { ok: false, status: 404 });
    await assert.rejects(
      () => downloadFont('pretendard', designKitDir, { fetchFn }),
      (err) => err.statusCode === 502
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('downloadFont: 이미 받아둔 파일이 있으면 네트워크를 다시 안 탄다(멱등성)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-font-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    const fetchFn = fakeFetchReturning(otfLikeBuffer());
    await downloadFont('pretendard', designKitDir, { fetchFn });

    let callCount = 0;
    const countingFetchFn = async (...a) => {
      callCount += 1;
      return fetchFn(...a);
    };
    const second = await downloadFont('pretendard', designKitDir, { fetchFn: countingFetchFn });
    assert.equal(callCount, 0, '두 번째 호출은 네트워크를 안 타야 함');
    assert.equal(second.files[0].skipped, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendAssetLedger: 파일이 없으면 헤더와 함께 새로 생성한다 ("대장은 첫 자산인 폰트부터 시작")', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-font-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    const result = await appendAssetLedger(designKitDir, [
      { filename: 'fonts/pretendard/Pretendard-Regular.otf', kind: '폰트', sourceUrl: 'https://x', license: 'OFL-1.1', commercialUse: 'O', attribution: '불필요(OFL)', aiGenerated: 'N' },
    ]);
    assert.equal(result.created, true);
    const content = await readFile(result.ledgerPath, 'utf-8');
    assert.match(content, /^파일명,종류,출처URL,라이선스,상업이용,출처표시,AI생성여부,날짜/);
    assert.match(content, /Pretendard-Regular\.otf/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendAssetLedger: 기존 파일이 있으면 헤더 중복 없이 이어 붙인다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-font-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await appendAssetLedger(designKitDir, [
      { filename: 'a.otf', kind: '폰트', sourceUrl: 'https://x', license: 'OFL-1.1', commercialUse: 'O', attribution: '-', aiGenerated: 'N' },
    ]);
    const second = await appendAssetLedger(designKitDir, [
      { filename: 'b.otf', kind: '폰트', sourceUrl: 'https://y', license: 'OFL-1.1', commercialUse: 'O', attribution: '-', aiGenerated: 'N' },
    ]);
    assert.equal(second.created, false);
    const content = await readFile(path.join(designKitDir, 'ASSET-LEDGER.csv'), 'utf-8');
    const headerOccurrences = content.split('파일명,종류,출처URL').length - 1;
    assert.equal(headerOccurrences, 1);
    assert.match(content, /a\.otf/);
    assert.match(content, /b\.otf/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendAssetLedger: 쉼표·따옴표가 포함된 값도 CSV로 안전하게 이스케이프된다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-font-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await appendAssetLedger(designKitDir, [
      { filename: 'a.otf', kind: '폰트', sourceUrl: 'https://x', license: 'OFL-1.1', commercialUse: 'O', attribution: '출처: "Foo, Bar"', aiGenerated: 'N' },
    ]);
    const content = await readFile(path.join(designKitDir, 'ASSET-LEDGER.csv'), 'utf-8');
    assert.match(content, /"출처: ""Foo, Bar"""/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('generateFontModule: src/ 디렉터리가 있으면 src/lib/design-kit-fonts/에 생성한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-font-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await mkdir(path.join(dir, 'src'), { recursive: true });
    const result = await generateFontModule({
      projectDir: dir,
      designKitDir,
      fontKey: 'pretendard',
      files: [{ filename: 'Pretendard-Regular.otf' }],
    });
    assert.equal(result.modulePath, path.join(dir, 'src', 'lib', 'design-kit-fonts', 'pretendard.ts'));
    assert.equal(result.varName, 'pretendard');
    const content = await readFile(result.modulePath, 'utf-8');
    assert.match(content, /next\/font\/local/);
    assert.match(content, /Pretendard-Regular\.otf/);
    assert.match(content, /SoDam-Design-Kit 자동 생성/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('generateFontModule: src/ 없으면 lib/design-kit-fonts/에 생성하고, 기존 파일(layout 등)은 안 건드린다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-font-'));
  const designKitDir = path.join(dir, '.design-kit');
  try {
    await mkdir(path.join(dir, 'app'), { recursive: true });
    const layoutPath = path.join(dir, 'app', 'layout.tsx');
    await writeFile(layoutPath, '// 사용자의 기존 레이아웃 — 절대 건드리면 안 됨', 'utf-8');

    const result = await generateFontModule({
      projectDir: dir,
      designKitDir,
      fontKey: 'noto-sans-kr',
      files: [{ filename: 'NotoSansKR-Variable.ttf' }],
    });
    assert.equal(result.modulePath, path.join(dir, 'lib', 'design-kit-fonts', 'noto-sans-kr.ts'));
    assert.equal(result.varName, 'notoSansKr');

    const layoutContent = await readFile(layoutPath, 'utf-8');
    assert.equal(layoutContent, '// 사용자의 기존 레이아웃 — 절대 건드리면 안 됨');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
