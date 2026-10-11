import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeReport } from '../scripts/report-writer.mjs';
import { reverifyRun } from '../scripts/dashboard-server.mjs';

// 2026-10-11 스파이크(88차 후속): `--fontGate --assetGate`로 FAIL한 기록(2026-10-11-017: 미등록 폰트 1건 +
// 미등록 이미지 6건)을 대시보드/MCP가 쓰는 reverifyRun으로 재검증했더니 같은 파일 상태에서 PASS(-018)가
// 나왔다. typeCheck(PR #7)에서 막은 "재검증 세탁"과 같은 구조 — reverifyRun이 옵션 게이트를 judge()에
// 넘기지 않았다(01 §3 Parity "같은 입력 → 같은 판정"). 실제 dev 서버·파일 스캔 없이 의존 함수를 주입해
// 그 계약을 고정한다. 시각 회귀의 기준본 "승격"은 재검증이 절대 하지 않는다(사람의 명시 승인 사항).

const FONT_VIOLATION = { scannedCount: 1, registeredCount: 0, violations: [{ file: 'public/fonts/SpikeUnregistered.ttf' }] };
const ASSET_VIOLATION = { scannedCount: 6, registeredCount: 0, violations: [{ file: 'public/file.svg' }, { file: 'public/next.svg' }] };
const GATE_CLEAN = { scannedCount: 0, registeredCount: 0, violations: [] };
const VISUAL_REGRESSION = [
  { viewport: 360, status: 'regression', diffRatio: 0.5, reason: '픽셀 차이 50.00% (허용 1%)' },
  { viewport: 768, status: 'matched', diffRatio: 0 },
  { viewport: 1440, status: 'matched', diffRatio: 0 },
];
const VISUAL_MATCHED = [360, 768, 1440].map((viewport) => ({ viewport, status: 'matched', diffRatio: 0 }));

async function makeProject(runExtra = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'reverify-gates-'));
  const designKitDir = path.join(dir, '.design-kit');
  await mkdir(path.join(designKitDir, 'runs'), { recursive: true });
  await writeFile(
    path.join(designKitDir, 'runs', '2026-10-11-001.json'),
    JSON.stringify({
      runId: '2026-10-11-001',
      startedAt: '2026-10-11T00:00:00.000Z',
      target: 'spike',
      generatedFiles: [],
      status: 'fail',
      retryCount: 0,
      route: '/',
      ...runExtra,
    }),
    'utf-8'
  );
  return { dir, designKitDir };
}

// 모든 의존 함수를 스텁으로 주입. gates로 각 게이트가 돌려줄 값을 정하고, calls에 호출 기록을 남긴다.
function makeStubs(calls, gates = {}) {
  const { font = GATE_CLEAN, asset = GATE_CLEAN, visual = VISUAL_MATCHED } = gates;
  return {
    checkTypeScript: async () => {
      calls.push('tsc');
      return { status: 'ok', errors: [], ignoredGeneratedCount: 0 };
    },
    checkFontGate: async (args) => {
      calls.push(['font', args.projectDir]);
      return font;
    },
    checkAssetGate: async (args) => {
      calls.push(['asset', args.projectDir]);
      return asset;
    },
    compareRunToBaseline: async (args) => {
      calls.push(['visual', args.route, args.screenshots.length]);
      return visual;
    },
    startDevServer: async () => {
      calls.push('dev');
      return { url: 'http://127.0.0.1:1', port: 1, stop: async () => { calls.push('stop'); } };
    },
    verifyPage: async () => ({
      renderOk: true,
      consoleErrors: [],
      axeCounts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
      axeViolations: [],
      screenshots: [360, 768, 1440].map((viewport) => ({ viewport, path: `reports/screenshots/x/${viewport}.png` })),
    }),
  };
}

const readRecord = async (result) => JSON.parse(await readFile(result.runPath, 'utf-8'));

test('writeReport: 옵션 게이트(fontGate·assetGate·visualRegression)를 쓴 실행만 runs/*.json에 해당 플래그가 남고, 안 쓴 실행엔 필드가 없다 (하위 호환)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'writereport-gate-flags-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    const base = {
      devServer: { port: 3000, autoStarted: true },
      renderOk: true,
      consoleErrors: [],
      axeCounts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
      axeViolations: [],
      screenshots: [{ viewport: '360', path: 'reports/screenshots/x/360.png' }],
      verdict: 'PASS',
      reasons: [],
    };
    const date = new Date('2026-10-11T00:00:00Z');
    const withAll = await writeReport({
      designKitDir,
      target: 't',
      date,
      verifyRunnerOutput: { ...base, fontGate: GATE_CLEAN, assetGate: GATE_CLEAN, visualRegression: VISUAL_MATCHED },
    });
    // visualRegression이 빈 배열이어도(스크린샷이 없어 비교를 못 한 경우) 플래그는 "사용했다"로 남아야 한다.
    const emptyVisual = await writeReport({ designKitDir, target: 't', date, verifyRunnerOutput: { ...base, visualRegression: [] } });
    const plain = await writeReport({ designKitDir, target: 't', date, verifyRunnerOutput: base });
    const a = await readRecord(withAll);
    const b = await readRecord(emptyVisual);
    const c = await readRecord(plain);
    assert.equal(a.fontGate, true);
    assert.equal(a.assetGate, true);
    assert.equal(a.visualRegression, true);
    assert.equal(b.visualRegression, true);
    for (const key of ['fontGate', 'assetGate', 'visualRegression', 'typeCheck']) assert.equal(key in c, false, `${key}가 안 쓴 실행에 생겼다`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reverifyRun: 원래 실행이 fontGate였고 미등록 폰트가 남아 있으면 재검증도 FAIL — 스파이크 재현 조건 (-017 FAIL → -018 PASS였다)', async () => {
  const { dir, designKitDir } = await makeProject({ fontGate: true });
  try {
    const calls = [];
    const result = await reverifyRun(dir, designKitDir, '2026-10-11-001', makeStubs(calls, { font: FONT_VIOLATION }));
    assert.equal(result.verdict, 'FAIL');
    const rec = await readRecord(result);
    assert.equal(rec.status, 'fail');
    assert.equal(rec.fontGate, true);
    assert.match(await readFile(result.reportPath, 'utf-8'), /미등록 폰트 1건/);
    assert.ok(calls.some((c) => Array.isArray(c) && c[0] === 'font'), 'checkFontGate가 호출되지 않았다');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reverifyRun: 원래 실행이 assetGate였고 미등록 이미지가 남아 있으면 재검증도 FAIL', async () => {
  const { dir, designKitDir } = await makeProject({ assetGate: true });
  try {
    const result = await reverifyRun(dir, designKitDir, '2026-10-11-001', makeStubs([], { asset: ASSET_VIOLATION }));
    assert.equal(result.verdict, 'FAIL');
    const rec = await readRecord(result);
    assert.equal(rec.assetGate, true);
    assert.match(await readFile(result.reportPath, 'utf-8'), /미등록 이미지 2건/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reverifyRun: 원래 실행이 visualRegression이었고 회귀가 있으면 재검증도 FAIL — 기준본과 같은 route로 비교한다', async () => {
  const { dir, designKitDir } = await makeProject({ visualRegression: true });
  try {
    const calls = [];
    const result = await reverifyRun(dir, designKitDir, '2026-10-11-001', makeStubs(calls, { visual: VISUAL_REGRESSION }));
    assert.equal(result.verdict, 'FAIL');
    const rec = await readRecord(result);
    assert.equal(rec.visualRegression, true);
    assert.match(await readFile(result.reportPath, 'utf-8'), /회귀 감지/);
    assert.deepEqual(calls.find((c) => Array.isArray(c) && c[0] === 'visual'), ['visual', '/', 3]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reverifyRun: 옵션 게이트 없이 실행됐던 기록은 어떤 게이트 함수도 호출하지 않고 기존과 같은 PASS를 낸다 (하위 호환)', async () => {
  const { dir, designKitDir } = await makeProject();
  try {
    const calls = [];
    const result = await reverifyRun(
      dir,
      designKitDir,
      '2026-10-11-001',
      makeStubs(calls, { font: FONT_VIOLATION, asset: ASSET_VIOLATION, visual: VISUAL_REGRESSION })
    );
    assert.equal(result.verdict, 'PASS');
    assert.deepEqual(calls, ['dev', 'stop']);
    const rec = await readRecord(result);
    for (const key of ['fontGate', 'assetGate', 'visualRegression', 'typeCheck']) assert.equal(key in rec, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reverifyRun: 게이트가 통과하면 새 기록도 같은 플래그를 유지한다 (재검증의 재검증도 같은 기준)', async () => {
  const { dir, designKitDir } = await makeProject({ fontGate: true, assetGate: true, visualRegression: true, typeCheck: true });
  try {
    const result = await reverifyRun(dir, designKitDir, '2026-10-11-001', makeStubs([], {}));
    assert.equal(result.verdict, 'PASS');
    const rec = await readRecord(result);
    assert.deepEqual(
      { f: rec.fontGate, a: rec.assetGate, v: rec.visualRegression, t: rec.typeCheck },
      { f: true, a: true, v: true, t: true }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reverifyRun: 재검증은 시각 회귀 기준본을 승격하지 않는다 — 비교 결과만 쓴다 (승격은 사람의 명시 승인 사항)', async () => {
  const { dir, designKitDir } = await makeProject({ visualRegression: true });
  try {
    const stubs = makeStubs([], { visual: VISUAL_MATCHED });
    stubs.promoteBaseline = async () => { throw new Error('재검증이 기준본을 승격하려 했다'); };
    const result = await reverifyRun(dir, designKitDir, '2026-10-11-001', stubs);
    assert.equal(result.verdict, 'PASS');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reverifyRun: 게이트 검사가 예외를 던지면 새 판정서를 쓰지 않고 dev 서버를 종료하며 실행 잠금을 푼다 (fail-closed — 기존 FAIL 기록이 그대로 최신)', async () => {
  const { dir, designKitDir } = await makeProject({ fontGate: true });
  try {
    const calls = [];
    const stubs = makeStubs(calls, {});
    stubs.checkFontGate = async () => { throw new Error('ledger 읽기 실패'); };
    await assert.rejects(() => reverifyRun(dir, designKitDir, '2026-10-11-001', stubs), /ledger 읽기 실패/);
    assert.ok(calls.includes('stop'), 'dev 서버가 종료되지 않았다');
    await assert.rejects(() => access(path.join(designKitDir, '.lock')), 'lock 파일이 남았다');
    await assert.rejects(() => access(path.join(designKitDir, 'runs', '2026-10-11-002.json')), '실패한 재검증이 새 기록을 남겼다');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
