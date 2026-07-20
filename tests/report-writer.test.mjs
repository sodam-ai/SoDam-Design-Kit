import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, readdir, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { nextRunId, writeReport } from '../scripts/report-writer.mjs';

const FIXED_DATE = new Date('2026-07-20T00:00:00Z');

test('nextRunId: runs/가 비어 있으면 001부터 시작', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-report-'));
  try {
    const runId = await nextRunId(dir, FIXED_DATE);
    assert.equal(runId, '2026-07-20-001');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('nextRunId: 같은 날짜에 기존 실행이 있으면 순번이 증가', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-report-'));
  try {
    const runsDir = path.join(dir, 'runs');
    await mkdir(runsDir, { recursive: true });
    await writeFile(path.join(runsDir, '2026-07-20-001.json'), '{}', 'utf-8');
    await writeFile(path.join(runsDir, '2026-07-20-002.json'), '{}', 'utf-8');

    const runId = await nextRunId(dir, FIXED_DATE);
    assert.equal(runId, '2026-07-20-003');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('nextRunId: 중간 번호가 삭제돼 있어도(gap) 기존 파일과 충돌하지 않는다 (실측 발견된 데이터 손상 버그 방지)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-report-'));
  try {
    const runsDir = path.join(dir, 'runs');
    await mkdir(runsDir, { recursive: true });
    await writeFile(path.join(runsDir, '2026-07-20-001.json'), '{}', 'utf-8');
    await writeFile(path.join(runsDir, '2026-07-20-002.json'), '{}', 'utf-8');
    // 003번은 삭제된 상태를 재현(의도적으로 안 만듦) — 예전엔 "파일 개수+1"이라 개수=2로 세서
    // 003을 반환했는데, 004는 이미 있으니 그건 안 겹치지만 003과도 실제로 안 겹치는지가
    // 이 테스트의 핵심이 아니라 "004와 충돌 안 하는 값"을 반환하는지가 핵심이라 004를 심어둠.
    await writeFile(path.join(runsDir, '2026-07-20-004.json'), '{}', 'utf-8');

    const runId = await nextRunId(dir, FIXED_DATE);
    assert.equal(runId, '2026-07-20-005', '이미 존재하는 004와 충돌하지 않고 실제 최댓값+1을 반환해야 함');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeReport: 중간 판정 기록이 삭제된 상태에서도 새 판정이 기존 판정을 덮어쓰지 않는다 (실측 발견된 데이터 손상 버그 방지)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-report-'));
  try {
    const runsDir = path.join(dir, 'runs');
    const reportsDir = path.join(dir, 'reports');
    await mkdir(runsDir, { recursive: true });
    await mkdir(reportsDir, { recursive: true });
    await writeFile(path.join(runsDir, '2026-07-20-001.json'), '{}', 'utf-8');
    // 002번은 삭제된 상태를 재현 (건너뜀)
    await writeFile(path.join(runsDir, '2026-07-20-003.json'), JSON.stringify({ target: '기존 실행' }), 'utf-8');
    await writeFile(path.join(reportsDir, '2026-07-20-003.md'), '# 기존 판정서 — 절대 덮어써지면 안 됨', 'utf-8');

    const result = await writeReport({
      designKitDir: dir,
      target: '새 실행',
      verifyRunnerOutput: {
        devServer: { port: 3000, autoStarted: true },
        renderOk: true,
        consoleErrors: [],
        axeCounts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        screenshots: [],
        verdict: 'PASS',
        reasons: [],
      },
    });

    assert.equal(result.runId, '2026-07-20-004', '이미 존재하는 003과 충돌하지 않아야 함');
    const untouchedReport = await readFile(path.join(reportsDir, '2026-07-20-003.md'), 'utf-8');
    assert.match(untouchedReport, /기존 판정서 — 절대 덮어써지면 안 됨/, '003번 기존 판정서가 그대로 보존되어야 함');
    const untouchedRun = JSON.parse(await readFile(path.join(runsDir, '2026-07-20-003.json'), 'utf-8'));
    assert.equal(untouchedRun.target, '기존 실행', '003번 기존 실행 기록이 그대로 보존되어야 함');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeReport: PASS 판정을 runs/*.json + reports/*.md에 일관되게 기록', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-report-'));
  try {
    const result = await writeReport({
      designKitDir: dir,
      target: 'Figma node 421:3078 (Button) -> src/components/ui/button.tsx',
      generatedFiles: ['src/app/design-kit-preview/button/page.tsx'],
      retryCount: 0,
      verifyRunnerOutput: {
        devServer: { port: 3000, autoStarted: true },
        renderOk: true,
        consoleErrors: [],
        axeCounts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        screenshots: [
          { viewport: '360', path: 'a/360.png' },
          { viewport: '768', path: 'a/768.png' },
          { viewport: '1440', path: 'a/1440.png' },
        ],
        verdict: 'PASS',
        reasons: [],
      },
    });

    assert.equal(result.status, 'pass');
    const runRecord = JSON.parse(await readFile(result.runPath, 'utf-8'));
    assert.equal(runRecord.status, 'pass');
    assert.equal(runRecord.retryCount, 0);
    assert.deepEqual(runRecord.generatedFiles, ['src/app/design-kit-preview/button/page.tsx']);

    const reportMd = await readFile(result.reportPath, 'utf-8');
    assert.match(reportMd, /\*\*PASS\*\*/);
    assert.match(reportMd, /360px: a\/360\.png/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeReport: FAIL 판정 시 사유가 runs/*.json과 reports/*.md 둘 다에 남음', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-report-'));
  try {
    const result = await writeReport({
      designKitDir: dir,
      target: '/design-kit-preview/does-not-exist-xyz',
      generatedFiles: [],
      retryCount: 2,
      verifyRunnerOutput: {
        devServer: { port: 3000, autoStarted: true },
        renderOk: false,
        consoleErrors: ['Failed to load resource: 404'],
        axeCounts: { critical: 0, serious: 0, moderate: 2, minor: 0 },
        screenshots: [
          { viewport: '360', path: 'b/360.png' },
          { viewport: '768', path: 'b/768.png' },
          { viewport: '1440', path: 'b/1440.png' },
        ],
        verdict: 'FAIL',
        reasons: ['렌더 실패 (대상 URL 정상 로드 안 됨)', '콘솔 에러 1건'],
      },
    });

    assert.equal(result.status, 'fail');
    const runRecord = JSON.parse(await readFile(result.runPath, 'utf-8'));
    assert.equal(runRecord.status, 'fail');
    assert.equal(runRecord.retryCount, 2);

    const reportMd = await readFile(result.reportPath, 'utf-8');
    assert.match(reportMd, /\*\*FAIL\*\*/);
    assert.match(reportMd, /렌더 실패/);
    assert.match(reportMd, /콘솔 에러 1건/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeReport: 절대경로 스크린샷 경로를 판정서에는 상대경로로 기록한다 (04 DO NOT 절대경로 금지 — 실측 발견 결함 방지)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-report-'));
  try {
    const absoluteScreenshotPath = path.join(dir, 'reports', 'screenshots', 'run-1', '360.png');
    const result = await writeReport({
      designKitDir: dir,
      target: 'test',
      verifyRunnerOutput: {
        devServer: { port: 3000, autoStarted: true },
        renderOk: true,
        consoleErrors: [],
        axeCounts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        screenshots: [{ viewport: '360', path: absoluteScreenshotPath }],
        verdict: 'PASS',
        reasons: [],
      },
    });

    const reportMd = await readFile(result.reportPath, 'utf-8');
    assert.doesNotMatch(reportMd, /360px: [A-Za-z]:[\\\/]/, '절대경로(드라이브 문자 포함)가 판정서에 남으면 안 됨');
    assert.match(reportMd, /360px: reports\/screenshots\/run-1\/360\.png/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeReport: 스크린샷 폴더가 10개를 넘으면 오래된 것부터 정리한다 (02 문서화됐지만 미구현이던 결함 방지)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-report-'));
  try {
    const screenshotsDir = path.join(dir, 'reports', 'screenshots');
    await mkdir(screenshotsDir, { recursive: true });

    for (let i = 0; i < 12; i++) {
      const full = path.join(screenshotsDir, `run-${i}`);
      await mkdir(full);
      const mtime = new Date(2026, 0, 1, 0, i);
      await utimes(full, mtime, mtime);
    }

    await writeReport({
      designKitDir: dir,
      target: 'test',
      verifyRunnerOutput: {
        devServer: { port: 3000, autoStarted: true },
        renderOk: true,
        consoleErrors: [],
        axeCounts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        screenshots: [],
        verdict: 'PASS',
        reasons: [],
      },
    });

    const remaining = await readdir(screenshotsDir);
    assert.equal(remaining.length, 10, '최근 10개까지만 남아야 함');
    assert.ok(!remaining.includes('run-0'), '가장 오래된 폴더는 삭제되어야 함');
    assert.ok(!remaining.includes('run-1'), '두 번째로 오래된 폴더도 삭제되어야 함');
    assert.ok(remaining.includes('run-11'), '가장 최근 폴더는 보존되어야 함');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
