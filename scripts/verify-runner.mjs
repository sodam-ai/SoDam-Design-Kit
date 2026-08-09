#!/usr/bin/env node
// SoDam-Design-Kit — 검증 게이트 실행기
// dev server 자동 기동(포트 자동 우회) + Playwright 렌더 + axe-core + 3개 뷰포트 스크린샷
// PASS 조건 4가지(단일 출처: .PRD/02_DATA_MODEL.md) — 여기서 재구현하지 않고 그대로 판정에 사용

import { spawn } from 'node:child_process';
import { Socket } from 'node:net';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { writeReport } from './report-writer.mjs';
import { acquireLock, releaseLock } from './execution-lock.mjs';

export const VIEWPORTS = [
  { width: 360, height: 800, label: '360' },
  { width: 768, height: 1024, label: '768' },
  { width: 1440, height: 900, label: '1440' },
];

const PORT_RANGE_START = 3000;
const PORT_RANGE_END = 3020;
const READY_TIMEOUT_MS = 30000;
const READY_POLL_INTERVAL_MS = 500;

/**
 * 포트가 점유돼 있는지 "실제로 연결해서" 확인한다 (2026-07-27 실측 발견·수정 — 결정 기록).
 *
 * 예전엔 `server.listen(port, '127.0.0.1')`이 성공하는지로 점유 여부를 판정했는데,
 * Windows는 다른 프로세스가 이미 `0.0.0.0:<port>`(모든 인터페이스)로 리슨 중이어도
 * `127.0.0.1:<port>`에 대한 별도 바인드를 별문제 없이 허용해버린다(SO_EXCLUSIVEADDRUSE
 * 미설정 시의 Windows 소켓 특성). 그래서 findAvailablePort()는 실제로는 점유된 포트를
 * "비어있다"고 오판했고, 그 뒤 verify-runner가 실제로 통신하는 상대는 우리가 막 띄운
 * next dev가 아니라 그 자리를 먼저 차지하고 있던 **전혀 다른 프로젝트의 서버**였다.
 *
 * 실측 재현(격리 테스트, 이 킷 코드와 무관하게 순수 node:net으로 확인):
 *   이미 0.0.0.0:3000을 점유 중인 별도 프로세스(다른 프로젝트의 Next.js dev 서버, 실제
 *   BizPick 프로젝트로 확인됨)가 떠 있는 상태에서, `listen(3000, '127.0.0.1')`이 **성공**을
 *   반환했다 — 바인드 기반 점검이 Windows에서 근본적으로 신뢰할 수 없음을 증명.
 *   그 결과 실제 재현된 사고: verify-runner가 우리 픽스처가 아니라 그 다른 프로젝트를
 *   대상으로 검증을 수행하고도(포트만 같았을 뿐) 그럴듯한 PASS/FAIL 판정서를 만들어냈다
 *   (판정서의 target·devServer.port는 우리 것인데 실제로 검사된 화면은 다른 앱의 화면).
 *   이건 01_PRD.md §9 성공 기준의 "판정 근거"를 통째로 무너뜨리는, 이번 라운드에서 발견된
 *   것 중 가장 심각한 결함이다 — 게이트가 차단/통과를 잘못하는 정도가 아니라 **엉뚱한
 *   대상을 검사하고도 진짜인 것처럼 보고**할 수 있었다.
 *
 * 수정: "바인드해서 성공하면 비어있다"가 아니라 "연결해서 성공하면 이미 누가 쓰고 있다"로
 * 뒤집었다. 이건 실제 클라이언트(Playwright·http.get)가 그 포트에 접속할 때 실제로 겪는
 * 것과 정확히 같은 경로라서, Windows의 바인드 허용 특이사항과 무관하게 항상 정확하다.
 * **이 판정 방식을 다시 바인드 기반으로 되돌리지 말 것** — 되돌리면 이 사고가 그대로 재현된다.
 */
function isPortInUse(port, host = '127.0.0.1', timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = new Socket();
    let settled = false;
    const finish = (inUse) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true)); // 연결이 성립됨 = 누군가 이미 듣고 있음
    socket.once('timeout', () => finish(false)); // 응답 없음 = 로컬 루프백에서는 사실상 비어있다고 봄
    socket.once('error', () => finish(false)); // ECONNREFUSED 등 = 듣는 프로세스 없음 = 비어있음
    socket.connect(port, host);
  });
}

/** 포트가 비어 있는지 확인 후 첫 가용 포트를 돌려줌 (PowerShell로 점유 프로세스를 죽이지 않고, 코드가 자동으로 다음 포트로 우회) */
export async function findAvailablePort(start = PORT_RANGE_START, end = PORT_RANGE_END) {
  for (let port = start; port <= end; port += 1) {
    // eslint-disable-next-line no-await-in-loop -- 순차 스캔이 의도(포트 낮은 순 우선 배정)
    const inUse = await isPortInUse(port);
    if (!inUse) return port;
  }
  throw new Error(`포트 ${PORT_RANGE_START}~${PORT_RANGE_END}이 모두 사용 중입니다.`);
}

function waitForReady(url, timeoutMs = READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function attempt() {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`dev server가 ${timeoutMs}ms 안에 준비되지 않았습니다: ${url}`));
          return;
        }
        setTimeout(attempt, READY_POLL_INTERVAL_MS);
      });
      req.setTimeout(READY_POLL_INTERVAL_MS, () => req.destroy());
    }
    attempt();
  });
}

/** Windows에서 좀비 프로세스 없이 프로세스 트리 전체 종료 (spawn 인자 배열만 사용, shell:true 금지) */
function killProcessTree(pid) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
      killer.on('close', () => resolve());
      killer.on('error', () => resolve());
    } else {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // 이미 종료됨
      }
      resolve();
    }
  });
}

/** Next.js dev server를 자동 기동 (포트 충돌 시 다음 포트로 자동 우회). spawn은 인자 배열만 사용, shell 문자열 조합 금지. */
export async function startDevServer(projectDir) {
  const port = await findAvailablePort();
  const nextBin = path.join(projectDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'dev', '-p', String(port)], {
    cwd: projectDir,
    stdio: 'pipe',
    env: { ...process.env, HOSTNAME: '127.0.0.1' },
  });

  const consoleBuffer = [];
  child.stdout.on('data', (d) => consoleBuffer.push(d.toString()));
  child.stderr.on('data', (d) => consoleBuffer.push(d.toString()));

  const url = `http://127.0.0.1:${port}`;
  try {
    await waitForReady(url);
  } catch (err) {
    await killProcessTree(child.pid);
    throw new Error(`${err.message}\n--- dev server 출력 ---\n${consoleBuffer.join('')}`);
  }

  return {
    port,
    url,
    async stop() {
      await killProcessTree(child.pid);
    },
  };
}

/**
 * axe-core의 원시 violations 배열을 판정용 카운트 + 사람이 읽을 상세 목록으로 요약한다
 * (2026-07-27 신설 — M5, pipeline.md "아직 없는 것" 마지막 항목 해소). 예전엔 개수만 세고
 * v.id·v.nodes(어떤 규칙·어느 요소가 위반인지)를 그 자리에서 버렸다 — 판정서엔 "critical
 * 1건"만 남아 사람도 AI도 "무엇을 고쳐야 하는지" 알 수 없었다. pipeline.md의 재시도 절차
 * ("FAIL 사유를 다음 생성 시도에 주입")가 애초에 주입할 재료 자체가 기록되지 않아 성립할 수
 * 없던 상태였다. **judge()의 PASS/FAIL 판정 기준(카운트 기반)은 이 함수와 무관하게 그대로다**
 * — 상세 목록은 판정서에 곁들이는 참고 정보일 뿐, 게이트 판정 로직을 건드리지 않는다.
 */
export function summarizeAxeViolations(violations) {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const details = [];
  for (const v of violations) {
    if (counts[v.impact] !== undefined) counts[v.impact] += 1;
    details.push({
      id: v.id,
      impact: v.impact,
      description: v.description,
      targets: (v.nodes || []).map((n) => (n.target || []).join(' ')).filter(Boolean).slice(0, 5),
    });
  }
  return { counts, details };
}

/** 렌더+콘솔+axe+3뷰포트 스크린샷 검사. dev server는 이미 떠 있다고 가정(수동 --url 모드와 자동 모드 공용). */
export async function verifyPage({ baseUrl, route = '/', screenshotDir }) {
  const targetUrl = new URL(route, baseUrl).toString();
  const browser = await chromium.launch();
  const consoleErrors = [];
  let renderOk = false;
  const axeCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const axeViolations = [];
  const screenshots = [];

  try {
    // AxeBuilder는 browser.newPage() 단축 API가 아니라 newContext()로 만든 page를 요구함
    // (axe-core-npm 알려진 요구사항: https://github.com/dequelabs/axe-core-npm/.../error-handling.md)
    const context = await browser.newContext();
    const page = await context.newPage();
    // next dev의 HMR(핫리로드) 웹소켓은 최초 컴파일 타이밍에 따라 간헐적으로 핸드셰이크가
    // 실패할 수 있음(실측 확인) — 생성된 UI 코드의 결함이 아닌 dev 인프라 잡음이므로 콘솔 에러 집계에서 제외.
    const isHmrNoise = (text) => /_next\/webpack-hmr/.test(text) || /webpack-hmr.*WebSocket/.test(text);
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isHmrNoise(msg.text())) consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
    renderOk = !!response && response.ok();

    const axeResults = await new AxeBuilder({ page }).analyze();
    const axeSummary = summarizeAxeViolations(axeResults.violations);
    for (const impact of Object.keys(axeCounts)) axeCounts[impact] = axeSummary.counts[impact];
    axeViolations.push(...axeSummary.details);

    if (screenshotDir) {
      await mkdir(screenshotDir, { recursive: true });
    }
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(150);
      const filePath = screenshotDir ? path.join(screenshotDir, `${vp.label}.png`) : undefined;
      await page.screenshot({ path: filePath });
      if (filePath) screenshots.push({ viewport: vp.label, path: filePath });
    }
  } finally {
    await browser.close();
  }

  return { targetUrl, renderOk, consoleErrors, axeCounts, axeViolations, screenshots };
}

/** PASS 조건 4가지 (단일 출처: .PRD/02_DATA_MODEL.md VerifyReport 섹션) */
export function judge(result) {
  const reasons = [];
  if (!result.renderOk) reasons.push('렌더 실패 (대상 URL 정상 로드 안 됨)');
  if (result.consoleErrors.length > 0) reasons.push(`콘솔 에러 ${result.consoleErrors.length}건`);
  const a11yFail = result.axeCounts.critical + result.axeCounts.serious;
  if (a11yFail > 0) reasons.push(`axe critical/serious 위반 ${a11yFail}건`);
  if (result.screenshots.length !== VIEWPORTS.length) reasons.push('뷰포트 3종 스크린샷 미충족');

  return { verdict: reasons.length === 0 ? 'PASS' : 'FAIL', reasons };
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const explicitUrl = getArg('url');
  const projectDir = getArg('project');
  const route = getArg('route') || '/';
  let screenshotDir = getArg('screenshotDir');
  // 스크린샷 저장 경로는 .design-kit/ 기준으로 정규화한다 (2026-08-04 실측 발견·수정 — 결정 기록,
  // 같은 날 두 번째 라운드). 1차 수정(프로젝트 루트 기준 정규화)으로 "프로젝트 밖(사용자 홈 폴더)으로
  // 탈출"하는 치명적 사고는 막았지만, 그 직후 진행한 실제 새 세션 M1 재시도에서 **같은 회차 안에
  // 두 번째 결함**이 실측 발견됐다: 에이전트가 넘긴 상대경로(예: "reports/screenshots")에 `.design-kit`가
  // 안 들어 있어서, 정규화 결과가 `<프로젝트 루트>/reports/screenshots/`(= `.design-kit/` 밖, 형제 폴더)에
  // 저장됐다. 이 위치는 02_DATA_MODEL.md가 정의한 유일한 정본 위치(`.design-kit/reports/screenshots/`)가
  // 아니라서 ①10회 보관 정리(`pruneScreenshots`) 대상이 아니고 ②`.gitignore`가 `.design-kit/reports/
  // screenshots/`만 등록해뒀으므로 **git에 그대로 추적되는 상태**로 남았다(실측: `git status`에
  // `?? reports/`로 확인). 에이전트가 상대경로를 만들 때 `.design-kit`를 붙이지 않는 경향이 실제
  // 두 차례 라이브 세션에서 전부 재현됐으므로(우연 아님), `.design-kit/` 자체를 기준점으로 못박는다 —
  // 이미 `.design-kit`로 시작하는 상대경로를 주는 경우(중복 접두)만 방어적으로 한 겹 벗겨낸다.
  // **이 정규화를 다시 프로젝트 루트 기준으로 낮추지 말 것** — 그 순간 이 결함이 그대로 재현된다.
  if (screenshotDir && projectDir && !path.isAbsolute(screenshotDir)) {
    const designKitDir = path.join(path.resolve(projectDir), '.design-kit');
    const dedupedRel = screenshotDir.replace(/^[./\\]*\.design-kit[/\\]+/, '');
    screenshotDir = path.join(designKitDir, dedupedRel);
  }
  // --target이 주어지면 검증 후 판정서(runs/*.json + reports/*.md)까지 이 명령 하나로 기록한다.
  // commands/pipeline.md 4~5단계("검증"과 "판정서 기록")가 문서상 별개 스크립트처럼 서술돼 있었지만
  // report-writer.mjs엔 CLI 진입점이 없어 실제로는 에이전트가 매번 접착 스크립트를 직접 짜야 했다
  // (실사용 세션에서 실측 재현·확인). 이 옵션 없이 호출하면 기존과 동일하게 판정 JSON만 출력한다.
  const target = getArg('target');
  const generatedFiles = getArg('generatedFiles');
  const retryCount = getArg('retryCount');

  let devServer = null;
  let baseUrl = explicitUrl;
  // 프로젝트가 주어지면 검증 전체(dev server 포트 점유 ~ 판정서 기록)를 잠근다 —
  // "실행 1개" 원칙(04_PROJECT_SPEC.md 연결/동기화 스펙 2번). 대시보드가 재검증
  // 트리거를 갖기 전에 먼저 갖춰야 하는 전제조건으로 독립 구현했다(scripts/execution-lock.mjs).
  const lockedDesignKitDir = projectDir ? path.join(path.resolve(projectDir), '.design-kit') : null;

  try {
    if (lockedDesignKitDir) {
      await acquireLock(lockedDesignKitDir);
    }

    if (!baseUrl) {
      if (!projectDir) {
        console.error('사용법: verify-runner.mjs --url <URL> | --project <디렉터리> [--route /경로] [--screenshotDir <경로>] [--target <설명> [--generatedFiles a,b,c] [--retryCount N]]');
        process.exit(2);
      }
      devServer = await startDevServer(path.resolve(projectDir));
      baseUrl = devServer.url;
    }

    const result = await verifyPage({ baseUrl, route, screenshotDir });
    const judgement = judge(result);

    const output = {
      devServer: devServer ? { port: devServer.port, autoStarted: true } : { url: baseUrl, autoStarted: false },
      ...result,
      ...judgement,
    };

    if (target) {
      if (!projectDir) {
        console.error('--target으로 판정서를 기록하려면 --project(디렉터리)도 함께 주어야 합니다(.design-kit 위치 계산용).');
        process.exit(2);
      }
      const designKitDir = path.join(path.resolve(projectDir), '.design-kit');
      const report = await writeReport({
        designKitDir,
        target,
        generatedFiles: generatedFiles ? generatedFiles.split(',').map((s) => s.trim()).filter(Boolean) : [],
        retryCount: retryCount ? Number(retryCount) : 0,
        route,
        verifyRunnerOutput: output,
      });
      output.runId = report.runId;
      output.reportPath = report.reportPath;
      output.runPath = report.runPath;
    }

    console.log(JSON.stringify(output, null, 2));
    process.exitCode = judgement.verdict === 'PASS' ? 0 : 1;
  } finally {
    if (devServer) await devServer.stop();
    if (lockedDesignKitDir) await releaseLock(lockedDesignKitDir);
  }
}

// 진입점 판정은 fileURLToPath로 (2026-07-27 실측 발견·수정 — 사유 정본은 hooks/verify-gate.mjs 주석).
// 요약: pathname 기반 비교는 경로에 공백·한글이 있으면 퍼센트 인코딩 때문에 항상 어긋나
// main()이 실행되지 않고 exit 0으로 조용히 끝난다. 되돌리지 말 것.
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[verify-runner] 실패:', err.message);
    process.exitCode = 1;
  });
}
