import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { findAvailablePort, judge, summarizeAxeViolations, VIEWPORTS } from '../scripts/verify-runner.mjs';

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

// 2026-07-27 실측 발견 결함의 회귀 테스트. 예전엔 "바인드가 성공하면 비어있다"로 판정했는데,
// Windows는 다른 프로세스가 0.0.0.0(모든 인터페이스)으로 이미 리슨 중이어도 127.0.0.1로의
// 별도 바인드를 허용해버린다(SO_EXCLUSIVEADDRUSE 미설정 시 특성) — 그래서 실제로는 점유된
// 포트를 findAvailablePort가 "비어있다"고 오판했다. 실사용에서 이 오판이 실제로 재현됨:
// 전혀 무관한 다른 프로젝트(BizPick)의 Next.js dev 서버가 0.0.0.0:3000을 점유한 상태에서
// verify-runner가 그 포트를 "가용"으로 판단해, 결과적으로 **우리 프로젝트가 아니라 그 다른
// 프로젝트를 검증하고도 그럴듯한 판정서를 만들어냈다**(target·devServer.port는 우리 것,
// 실제로 검사된 화면은 다른 앱). 01 §9 "판정 근거"를 통째로 무너뜨리는 이번 라운드 최대 결함.
test('findAvailablePort: 다른 프로세스가 0.0.0.0으로 점유한 포트도 건너뛴다 (Windows 바인드 오판 회귀 방지 — 2026-07-27 실측 발견 결함)', async () => {
  const blocker = createServer();
  // 점유 주체를 0.0.0.0(전체 인터페이스)으로 만든다 — 옛 코드의 바인드 검사(127.0.0.1 특정 바인드)가
  // "성공"해버리던 바로 그 조건을 재현. 연결 기반 검사는 호스트 표기와 무관하게 실제 연결
  // 성공 여부만 보므로 이 케이스에서도 정확해야 한다.
  await new Promise((resolve) => blocker.listen(3000, '0.0.0.0', resolve));
  try {
    const port = await findAvailablePort(3000, 3020);
    assert.notEqual(port, 3000, '0.0.0.0으로 점유된 3000이 "비어있다"고 오판되면 안 됨 — 실제로 이렇게 오판되던 결함이 있었음');
    assert.ok(port > 3000 && port <= 3020);
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
  }
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

// summarizeAxeViolations: 2026-07-27 신설(M5) — axe-core 원시 violations를 카운트(기존과 동일)
// + 상세 목록(신규)으로 요약. 실제 axe-core가 돌려주는 violation 객체 모양(id/impact/description/
// nodes[].target)을 그대로 합성 입력으로 사용 — 브라우저 없이도 변환 로직만 정직하게 검증 가능.

test('summarizeAxeViolations: 카운트는 기존 로직과 동일하게 집계', () => {
  const violations = [
    { id: 'image-alt', impact: 'critical', description: 'x', nodes: [{ target: ['img'] }] },
    { id: 'label', impact: 'serious', description: 'y', nodes: [{ target: ['input'] }] },
    { id: 'color-contrast', impact: 'moderate', description: 'z', nodes: [{ target: ['p'] }] },
  ];
  const { counts } = summarizeAxeViolations(violations);
  assert.deepEqual(counts, { critical: 1, serious: 1, moderate: 1, minor: 0 });
});

test('summarizeAxeViolations: 상세 목록에 규칙 id·설명·대상 선택자가 담김 (다음 생성 시도에 주입할 재료)', () => {
  const violations = [
    { id: 'image-alt', impact: 'critical', description: '이미지에 대체 텍스트가 없습니다', nodes: [{ target: ['img.hero'] }] },
  ];
  const { details } = summarizeAxeViolations(violations);
  assert.deepEqual(details, [
    { id: 'image-alt', impact: 'critical', description: '이미지에 대체 텍스트가 없습니다', targets: ['img.hero'] },
  ]);
});

test('summarizeAxeViolations: 위반이 없으면 상세도 빈 배열', () => {
  const { counts, details } = summarizeAxeViolations([]);
  assert.deepEqual(counts, { critical: 0, serious: 0, moderate: 0, minor: 0 });
  assert.deepEqual(details, []);
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

// 상대경로 --screenshotDir 정규화: 2026-08-04 실사용(M1 라이브 재현) 세션에서 실측 발견된 결함의
// 회귀 테스트. 예전엔 --screenshotDir을 받은 그대로(상대경로 포함) 썼는데, 상대경로는 Node
// 프로세스의 실제 cwd에 풀린다 — 에이전트가 Git Bash에서 시작했다가 PowerShell로 도구를 바꾸는
// 등 실행 중 cwd가 프로젝트 폴더와 달라지면, 스크린샷이 프로젝트 밖(실제로는 사용자 홈 폴더 밑)에
// 저장됐다. 판정서는 "PASS, 스크린샷 3장 존재"라고 정확히 적었지만 그 스크린샷이 프로젝트
// 어디에도 없었던 것 — 01 §9 "판정 근거" 자체가 프로젝트 밖으로 새어나가는 결함이었다.
test('CLI: 상대경로 --screenshotDir는 process.cwd()가 아니라 .design-kit/ 기준으로 저장된다 (2026-08-04 실측 발견 결함 회귀 방지)', async () => {
  await withStaticServer(async (port) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'verify-runner-screenshotdir-'));
    const relativeScreenshotDir = '__test_screenshotdir_regression__/x';
    const wrongDir = path.join(process.cwd(), relativeScreenshotDir);
    try {
      const proc = await runCli([
        '--url', `http://127.0.0.1:${port}`,
        '--project', dir,
        '--screenshotDir', relativeScreenshotDir,
      ]);
      const output = JSON.parse(proc.stdout);
      assert.equal(output.verdict, 'PASS');

      const expectedFiles = await readdir(path.join(dir, '.design-kit', relativeScreenshotDir));
      assert.equal(expectedFiles.length, 3, '360/768/1440 스크린샷 3개가 --project/.design-kit/ 안에 저장돼야 함');

      let siblingDirExists = true;
      try {
        await readdir(path.join(dir, relativeScreenshotDir));
      } catch {
        siblingDirExists = false;
      }
      assert.equal(siblingDirExists, false, '.design-kit/ 밖(프로젝트 루트 형제 폴더)에는 생기면 안 됨 — 2차 실측에서 재현된 결함 조건');

      let wrongDirExists = true;
      try {
        await readdir(wrongDir);
      } catch {
        wrongDirExists = false;
      }
      assert.equal(wrongDirExists, false, 'process.cwd() 기준 엉뚱한 위치에는 생기면 안 됨 — 1차 실사용에서 재현된 결함 조건');
    } finally {
      await rm(dir, { recursive: true, force: true });
      await rm(wrongDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

// screenshotDir이 이미 ".design-kit"로 시작하는 상대경로일 때 중복 접두("designKit + designKit")가
// 생기지 않는지 확인 (위 수정의 방어 로직 검증).
test('CLI: --screenshotDir이 이미 .design-kit로 시작하면 중복 접두 없이 그대로 그 자리에 저장된다', async () => {
  await withStaticServer(async (port) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'verify-runner-screenshotdir-dedup-'));
    const relativeScreenshotDir = '.design-kit/reports/screenshots/manual';
    try {
      const proc = await runCli([
        '--url', `http://127.0.0.1:${port}`,
        '--project', dir,
        '--screenshotDir', relativeScreenshotDir,
      ]);
      const output = JSON.parse(proc.stdout);
      assert.equal(output.verdict, 'PASS');

      const expectedFiles = await readdir(path.join(dir, relativeScreenshotDir));
      assert.equal(expectedFiles.length, 3, '중복 접두(.design-kit/.design-kit/...) 없이 그대로 저장돼야 함');

      let duplicatedDirExists = true;
      try {
        await readdir(path.join(dir, '.design-kit', relativeScreenshotDir));
      } catch {
        duplicatedDirExists = false;
      }
      assert.equal(duplicatedDirExists, false, '.design-kit/.design-kit/... 중복 접두 폴더가 생기면 안 됨');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
