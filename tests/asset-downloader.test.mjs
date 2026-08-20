import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { downloadAsset, validateSvgContent } from '../scripts/asset-downloader.mjs';

const execFileAsync = promisify(execFile);
const SCRIPTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');

const SAFE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle cx="5" cy="5" r="4" /></svg>';

function fakeFetch(status, body, { url } = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf-8');
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    url,
    arrayBuffer: async () => buf,
  });
}

async function tinyPngBuffer() {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();
}

// --- validateSvgContent ---

test('validateSvgContent: <script> 태그를 위반으로 잡는다', () => {
  const violations = validateSvgContent('<svg><script>alert(1)</script></svg>');
  assert.ok(violations.some((v) => v.includes('script')));
});

test('validateSvgContent: 인라인 이벤트 핸들러를 위반으로 잡는다', () => {
  const violations = validateSvgContent('<svg onload="alert(1)"><rect /></svg>');
  assert.ok(violations.some((v) => v.includes('이벤트 핸들러')));
});

test('validateSvgContent: javascript: 스킴을 위반으로 잡는다', () => {
  const violations = validateSvgContent('<svg><a href="javascript:alert(1)"><rect /></a></svg>');
  assert.ok(violations.some((v) => v.includes('javascript:')));
});

test('validateSvgContent: 정상 SVG는 위반 없음', () => {
  assert.deepEqual(validateSvgContent(SAFE_SVG), []);
});

// --- downloadAsset ---

test('downloadAsset: https가 아닌 URL은 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetdl-'));
  try {
    await assert.rejects(
      () => downloadAsset({ projectDir: dir, url: 'http://example.com/x.png', targetPath: 'public/x.png' }),
      /https:\/\/로 시작해야 합니다/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('downloadAsset: targetPath가 프로젝트 루트 밖이면 거부 (06 경로 조작 차단)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetdl-'));
  try {
    const png = await tinyPngBuffer();
    await assert.rejects(
      () =>
        downloadAsset(
          { projectDir: dir, url: 'https://example.com/x.png', targetPath: '../../etc/passwd' },
          { fetchFn: fakeFetch(200, png) }
        ),
      /프로젝트 루트 밖을 가리킵니다/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('downloadAsset: https:// URL이어도 리다이렉트 최종 목적지가 https가 아니면 거부 (2026-08-20 검증 라운드 실측 발견 — 실제 로컬 서버로 fetch의 res.url이 최종 도달 주소를 반영함을 확인 후 회귀 방지 추가)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetdl-'));
  try {
    const png = await tinyPngBuffer();
    await assert.rejects(
      () =>
        downloadAsset(
          { projectDir: dir, url: 'https://example.com/redirect-me.png', targetPath: 'public/x.png' },
          { fetchFn: fakeFetch(200, png, { url: 'http://internal.example.com/final.png' }) }
        ),
      /리다이렉트된 최종 주소가 https:\/\/가 아닙니다/
    );
    await assert.rejects(() => readFile(path.join(dir, 'public', 'x.png')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('downloadAsset: HTTP 실패 응답은 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetdl-'));
  try {
    await assert.rejects(
      () =>
        downloadAsset(
          { projectDir: dir, url: 'https://example.com/missing.png', targetPath: 'public/x.png' },
          { fetchFn: fakeFetch(404, 'not found') }
        ),
      /다운로드 실패.*HTTP 404/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('downloadAsset: 용량 상한을 넘으면 거부하고 저장하지 않는다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetdl-'));
  try {
    const big = Buffer.alloc(200);
    await assert.rejects(
      () =>
        downloadAsset(
          { projectDir: dir, url: 'https://example.com/big.png', targetPath: 'public/big.png' },
          { fetchFn: fakeFetch(200, big), maxBytes: 100 }
        ),
      /용량 초과/
    );
    await assert.rejects(() => readFile(path.join(dir, 'public', 'big.png')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('downloadAsset: 이미지로 디코딩되지 않는 응답은 거부 (가짜 PNG)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetdl-'));
  try {
    await assert.rejects(
      () =>
        downloadAsset(
          { projectDir: dir, url: 'https://example.com/fake.png', targetPath: 'public/fake.png' },
          { fetchFn: fakeFetch(200, 'this is not a real png', {}) }
        ),
      /이미지로 디코딩되지 않습니다/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('downloadAsset: 악성 SVG(script 태그)는 거부하고 저장하지 않는다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetdl-'));
  try {
    await assert.rejects(
      () =>
        downloadAsset(
          { projectDir: dir, url: 'https://example.com/evil.svg', targetPath: 'public/evil.svg' },
          { fetchFn: fakeFetch(200, '<svg><script>alert(1)</script></svg>', {}) }
        ),
      /위험한 패턴/
    );
    await assert.rejects(() => readFile(path.join(dir, 'public', 'evil.svg')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('downloadAsset: 정상 PNG는 실제로 저장된다 (전체 왕복)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetdl-'));
  try {
    const png = await tinyPngBuffer();
    const result = await downloadAsset(
      { projectDir: dir, url: 'https://example.com/hero.png', targetPath: 'public/images/hero.png' },
      { fetchFn: fakeFetch(200, png) }
    );
    assert.equal(result.targetPath, 'public/images/hero.png');
    assert.equal(result.format, 'png');
    const written = await readFile(path.join(dir, 'public', 'images', 'hero.png'));
    const meta = await sharp(written).metadata();
    assert.equal(meta.width, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('downloadAsset: 정상 SVG는 실제로 저장된다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-assetdl-'));
  try {
    const result = await downloadAsset(
      { projectDir: dir, url: 'https://example.com/icon.svg', targetPath: 'public/icons/icon.svg' },
      { fetchFn: fakeFetch(200, SAFE_SVG, {}) }
    );
    assert.equal(result.format, 'svg');
    const written = await readFile(path.join(dir, 'public', 'icons', 'icon.svg'), 'utf-8');
    assert.equal(written, SAFE_SVG);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- CLI ---

test('CLI: --project가 존재하지 않으면 거부한다 (59차 가드 패턴)', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-assetdl-cli-'));
  const nonexistent = path.join(base, 'does-not-exist');
  try {
    await assert.rejects(
      () =>
        execFileAsync(process.execPath, [
          path.join(SCRIPTS_DIR, 'asset-downloader.mjs'),
          '--project',
          nonexistent,
          '--url',
          'https://example.com/x.png',
          '--targetPath',
          'public/x.png',
        ]),
      (err) => {
        assert.equal(err.code, 1);
        assert.match(err.stderr, /프로젝트 디렉터리를 찾을 수 없습니다/);
        return true;
      }
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('CLI: --project가 디렉터리가 아니라 파일을 가리키면 거부한다', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-assetdl-cli-'));
  const filePath = path.join(base, 'not-a-directory.txt');
  try {
    await writeFile(filePath, '파일입니다', 'utf-8');
    await assert.rejects(
      () =>
        execFileAsync(process.execPath, [
          path.join(SCRIPTS_DIR, 'asset-downloader.mjs'),
          '--project',
          filePath,
          '--url',
          'https://example.com/x.png',
          '--targetPath',
          'public/x.png',
        ]),
      (err) => {
        assert.equal(err.code, 1);
        assert.match(err.stderr, /프로젝트 디렉터리를 찾을 수 없습니다/);
        assert.doesNotMatch(err.stderr, /ENOENT|ENOTDIR/);
        return true;
      }
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('CLI: --url·--targetPath 없이 실행하면 사용법 안내 후 종료', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-assetdl-cli-'));
  try {
    await assert.rejects(
      () => execFileAsync(process.execPath, [path.join(SCRIPTS_DIR, 'asset-downloader.mjs'), '--project', base]),
      (err) => {
        assert.equal(err.code, 2);
        assert.match(err.stderr, /사용법/);
        return true;
      }
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
