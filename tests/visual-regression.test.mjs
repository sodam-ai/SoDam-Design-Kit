import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import {
  routeToSlug,
  diffScreenshot,
  compareRunToBaseline,
  promoteBaseline,
} from '../scripts/visual-regression.mjs';

function makeSolidPngBuffer(width, height, [r, g, b, a] = [255, 255, 255, 255]) {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i += 1) {
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = a;
  }
  return PNG.sync.write(png);
}

function makeVariantPngBuffer(width, height, baseBuffer, diffPixelCount) {
  const png = PNG.sync.read(baseBuffer);
  for (let i = 0; i < diffPixelCount; i += 1) {
    png.data[i * 4] = 0;
    png.data[i * 4 + 1] = 0;
    png.data[i * 4 + 2] = 0;
    png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}

test('routeToSlug: 경로를 안전한 폴더명으로 정규화', () => {
  assert.equal(routeToSlug('/design-kit-preview/button'), 'design-kit-preview-button');
  assert.equal(routeToSlug('/'), 'root');
  assert.equal(routeToSlug(undefined), 'root');
  assert.equal(routeToSlug('/a b/c?d'), 'a_b-c_d');
});

test('diffScreenshot: 완전히 동일한 이미지는 matched, diffRatio 0', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-vr-'));
  try {
    const buf = makeSolidPngBuffer(50, 50);
    await writeFile(path.join(dir, 'a.png'), buf);
    await writeFile(path.join(dir, 'b.png'), buf);
    const result = await diffScreenshot(path.join(dir, 'a.png'), path.join(dir, 'b.png'));
    assert.equal(result.status, 'matched');
    assert.equal(result.diffRatio, 0);
    assert.equal(result.diffPng, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('diffScreenshot: 허용 오차(1%) 이내의 작은 차이는 matched', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-vr-'));
  try {
    // 50x50 = 2500픽셀, 1% = 25픽셀. 10픽셀만 다르면 0.4% — 통과해야 함.
    const base = makeSolidPngBuffer(50, 50);
    const variant = makeVariantPngBuffer(50, 50, base, 10);
    await writeFile(path.join(dir, 'base.png'), base);
    await writeFile(path.join(dir, 'variant.png'), variant);
    const result = await diffScreenshot(path.join(dir, 'variant.png'), path.join(dir, 'base.png'));
    assert.equal(result.status, 'matched');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('diffScreenshot: 허용 오차를 넘는 큰 차이는 regression + diff 이미지 생성', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-vr-'));
  try {
    // 50x50 = 2500픽셀, 500픽셀 차이 = 20% — 명백한 회귀
    const base = makeSolidPngBuffer(50, 50);
    const variant = makeVariantPngBuffer(50, 50, base, 500);
    await writeFile(path.join(dir, 'base.png'), base);
    await writeFile(path.join(dir, 'variant.png'), variant);
    const result = await diffScreenshot(path.join(dir, 'variant.png'), path.join(dir, 'base.png'));
    assert.equal(result.status, 'regression');
    assert.ok(result.diffRatio > 0.01);
    assert.ok(result.diffPng, 'regression이면 diff 이미지 데이터가 있어야 함');
    assert.match(result.reason, /픽셀.*차이/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('diffScreenshot: 손상된(유효하지 않은) PNG는 크래시하지 않고 regression으로 안전하게 판정한다 (2026-08-09 실측 발견 결함 회귀 방지)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-vr-'));
  try {
    await writeFile(path.join(dir, 'corrupt.png'), Buffer.from('이건 PNG가 아닙니다'));
    await writeFile(path.join(dir, 'valid.png'), makeSolidPngBuffer(20, 20));
    // 후보가 손상된 경우
    const r1 = await diffScreenshot(path.join(dir, 'corrupt.png'), path.join(dir, 'valid.png'));
    assert.equal(r1.status, 'regression');
    assert.match(r1.reason, /손상/);
    // 기준본이 손상된 경우
    const r2 = await diffScreenshot(path.join(dir, 'valid.png'), path.join(dir, 'corrupt.png'));
    assert.equal(r2.status, 'regression');
    assert.match(r2.reason, /손상/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('diffScreenshot: 크기가 다르면 픽셀 비교 없이 즉시 regression', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-vr-'));
  try {
    await writeFile(path.join(dir, 'small.png'), makeSolidPngBuffer(30, 30));
    await writeFile(path.join(dir, 'big.png'), makeSolidPngBuffer(60, 60));
    const result = await diffScreenshot(path.join(dir, 'small.png'), path.join(dir, 'big.png'));
    assert.equal(result.status, 'regression');
    assert.match(result.reason, /크기 불일치/);
    assert.equal(result.diffRatio, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('compareRunToBaseline: 기준본이 없으면 no-baseline (회귀로 취급 안 함)', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-vr-project-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    const shotPath = path.join(designKitDir, 'reports', 'screenshots', 'run1', '360.png');
    await mkdir(path.dirname(shotPath), { recursive: true });
    await writeFile(shotPath, makeSolidPngBuffer(20, 20));

    const results = await compareRunToBaseline({
      designKitDir,
      route: '/design-kit-preview/button',
      screenshots: [{ viewport: '360', path: shotPath }],
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'no-baseline');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('promoteBaseline → compareRunToBaseline: 승격 후에는 같은 스크린샷이 matched로 비교된다', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-vr-project-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    const shotPath = path.join(designKitDir, 'reports', 'screenshots', 'run1', '360.png');
    await mkdir(path.dirname(shotPath), { recursive: true });
    await writeFile(shotPath, makeSolidPngBuffer(20, 20, [10, 20, 30, 255]));

    const promotion = await promoteBaseline({
      designKitDir,
      route: '/design-kit-preview/button',
      screenshots: [{ viewport: '360', path: shotPath }],
    });
    assert.equal(promotion.routeSlug, 'design-kit-preview-button');
    assert.ok(existsSync(path.join(designKitDir, 'reports', 'baseline', 'design-kit-preview-button', '360.png')));

    const results = await compareRunToBaseline({
      designKitDir,
      route: '/design-kit-preview/button',
      screenshots: [{ viewport: '360', path: shotPath }],
    });
    assert.equal(results[0].status, 'matched');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('compareRunToBaseline: 승격 후 실제로 다른 화면이 오면 regression + diff 이미지 파일이 실제로 생성된다', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-vr-project-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    const runDir = path.join(designKitDir, 'reports', 'screenshots', 'run1');
    await mkdir(runDir, { recursive: true });
    const originalShot = path.join(runDir, '360.png');
    await writeFile(originalShot, makeSolidPngBuffer(20, 20, [255, 255, 255, 255]));
    await promoteBaseline({ designKitDir, route: '/button', screenshots: [{ viewport: '360', path: originalShot }] });

    const runDir2 = path.join(designKitDir, 'reports', 'screenshots', 'run2');
    await mkdir(runDir2, { recursive: true });
    const changedShotPath = path.join(runDir2, '360.png');
    // 20x20=400픽셀, 200픽셀(50%) 변경 — 명백한 회귀
    await writeFile(changedShotPath, makeVariantPngBuffer(20, 20, makeSolidPngBuffer(20, 20), 200));

    const results = await compareRunToBaseline({
      designKitDir,
      route: '/button',
      screenshots: [{ viewport: '360', path: changedShotPath }],
    });
    assert.equal(results[0].status, 'regression');
    assert.ok(results[0].diffImagePath);
    assert.ok(existsSync(results[0].diffImagePath), 'diff 이미지 파일이 실제로 디스크에 생성돼야 함');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});
