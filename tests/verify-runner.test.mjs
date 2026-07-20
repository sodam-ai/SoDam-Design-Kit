import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { findAvailablePort, judge, VIEWPORTS } from '../scripts/verify-runner.mjs';

const CLI_PATH = fileURLToPath(new URL('../scripts/verify-runner.mjs', import.meta.url));

test('findAvailablePort: 점유된 포트를 자동으로 건너뛴다', async () => {
  const blocker = createServer();
  await new Promise((resolve) => blocker.listen(3000, '127.0.0.1', resolve));
  try {
    const port = await findAvailablePort(3000, 3020);
    assert.notEqual(port, 3000, '점유된 3000은 반환되면 안 됨');
    assert.ok(port > 3000 && port <= 3020);
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
  }
});

test('findAvailablePort: 빈 포트면 시작값 그대로 반환', async () => {
  // 3000이 비어있다는 보장은 없으므로 높은 임시 범위 사용
  const port = await findAvailablePort(38173, 38173);
  assert.equal(port, 38173);
});

const baseResult = () => ({
  renderOk: true,
  consoleErrors: [],
  axeCounts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
  screenshots: VIEWPORTS.map((v) => ({ viewport: v.label, path: `/tmp/${v.label}.png` })),
});

test('judge: 4조건 전부 충족 시 PASS', () => {
  const result = judge(baseResult());
  assert.equal(result.verdict, 'PASS');
  assert.deepEqual(result.reasons, []);
});

test('judge: 렌더 실패면 FAIL', () => {
  const result = judge({ ...baseResult(), renderOk: false });
  assert.equal(result.verdict, 'FAIL');
  assert.ok(result.reasons.some((r) => r.includes('렌더')));
});

test('judge: 콘솔 에러가 있으면 FAIL', () => {
  const result = judge({ ...baseResult(), consoleErrors: ['TypeError: x is not a function'] });
  assert.equal(result.verdict, 'FAIL');
});

test('judge: axe critical/serious가 있으면 FAIL, moderate/minor는 통과 유지', () => {
  const failResult = judge({ ...baseResult(), axeCounts: { critical: 1, serious: 0, moderate: 0, minor: 0 } });
  assert.equal(failResult.verdict, 'FAIL');

  const passResult = judge({ ...baseResult(), axeCounts: { critical: 0, serious: 0, moderate: 5, minor: 3 } });
  assert.equal(passResult.verdict, 'PASS');
});

test('judge: 뷰포트 스크린샷이 3개 미만이면 FAIL', () => {
  const result = judge({ ...baseResult(), screenshots: baseResult().screenshots.slice(0, 2) });
  assert.equal(result.verdict, 'FAIL');
});

// --target CLI 옵션: commands/pipeline.md가 "검증"과 "판정서 기록"을 별개 스크립트 단계처럼
// 서술했지만 report-writer.mjs엔 CLI가 없어 에이전트가 매번 접착 스크립트를 직접 짜야 했던
// 실측 결함(2026-07-20, 실사용 세션에서 재현) 수정. --url(가벼운 정적 페이지)로 실브라우저는
// 그대로 띄우되 Next.js dev server는 건너뛰어 빠르게 검증.
// spawnSync는 부모 프로세스의 이벤트 루프 전체를 블로킹해서, 같은 프로세스 안에 띄운
// 스텁 HTTP 서버가 자식(Playwright)의 요청에 응답을 못 해 타임아웃나는 걸 실측으로 확인
// (verify-runner.mjs 로직 문제가 아니라 테스트 설계 문제) — 비동기 spawn + Promise로 교체.
function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ stdout, stderr, code }));
  });
}

async function withStaticServer(fn) {
  // Connection: close 없이 keep-alive로 두면 Playwright의 networkidle 대기가 소켓이 살아있는 동안
  // 절대 끝나지 않아 15초 타임아웃 남 (verify-runner.mjs 로직 결함이 아니라 이 스텁 서버 문제 — 실측 확인)
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html', Connection: 'close' });
    res.end('<!DOCTYPE html><html lang="en"><head><title>t</title></head><body><h1>ok</h1></body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await fn(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('CLI: --target 없이 실행하면 기존과 동일하게 판정서를 기록하지 않는다 (하위 호환)', async () => {
  await withStaticServer(async (port) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'verify-runner-cli-'));
    try {
      const proc = await runCli(['--url', `http://127.0.0.1:${port}`]);
      const output = JSON.parse(proc.stdout);
      assert.equal(output.runId, undefined, '--target 없으면 runId가 출력에 없어야 함');

      let designKitExists = true;
      try {
        await readdir(path.join(dir, '.design-kit', 'runs'));
      } catch {
        designKitExists = false;
      }
      assert.equal(designKitExists, false, '--target 없으면 .design-kit/runs/가 생기면 안 됨');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

test('CLI: --target을 주면 검증과 동시에 runs/reports에 판정서를 실제로 기록한다', async () => {
  await withStaticServer(async (port) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'verify-runner-cli-'));
    try {
      const proc = await runCli([
        '--url', `http://127.0.0.1:${port}`,
        '--project', dir,
        '--target', 'CLI 옵션 회귀 테스트',
        '--generatedFiles', 'a.tsx,b.tsx',
      ]);
      const output = JSON.parse(proc.stdout);

      assert.ok(output.runId, 'runId가 출력에 포함돼야 함');
      assert.ok(output.reportPath, 'reportPath가 출력에 포함돼야 함');

      const runFiles = await readdir(path.join(dir, '.design-kit', 'runs'));
      const reportFiles = await readdir(path.join(dir, '.design-kit', 'reports'));
      assert.equal(runFiles.length, 1, 'runs/에 판정 기록 1개가 실제로 생겨야 함');
      assert.equal(reportFiles.filter((f) => f.endsWith('.md')).length, 1, 'reports/에 판정서 1개가 실제로 생겨야 함');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
