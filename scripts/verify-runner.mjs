#!/usr/bin/env node
// SoDam-Design-Kit — 검증 게이트 실행기
// dev server 자동 기동(포트 자동 우회) + Playwright 렌더 + axe-core + 3개 뷰포트 스크린샷
// PASS 조건 4가지(단일 출처: .PRD/02_DATA_MODEL.md) — 여기서 재구현하지 않고 그대로 판정에 사용

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { writeReport } from './report-writer.mjs';

export const VIEWPORTS = [
  { width: 360, height: 800, label: '360' },
  { width: 768, height: 1024, label: '768' },
  { width: 1440, height: 900, label: '1440' },
];

const PORT_RANGE_START = 3000;
const PORT_RANGE_END = 3020;
const READY_TIMEOUT_MS = 30000;
const READY_POLL_INTERVAL_MS = 500;

/** 포트가 비어 있는지 확인 후 첫 가용 포트를 돌려줌 (PowerShell로 점유 프로세스를 죽이지 않고, 코드가 자동으로 다음 포트로 우회) */
export function findAvailablePort(start = PORT_RANGE_START, end = PORT_RANGE_END) {
  return new Promise((resolve, reject) => {
    if (start > end) {
      reject(new Error(`포트 ${PORT_RANGE_START}~${PORT_RANGE_END}이 모두 사용 중입니다.`));
      return;
    }
    const server = createServer();
    server.unref();
    server.on('error', () => {
      findAvailablePort(start + 1, end).then(resolve, reject);
    });
    server.listen(start, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
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

/** 렌더+콘솔+axe+3뷰포트 스크린샷 검사. dev server는 이미 떠 있다고 가정(수동 --url 모드와 자동 모드 공용). */
export async function verifyPage({ baseUrl, route = '/', screenshotDir }) {
  const targetUrl = new URL(route, baseUrl).toString();
  const browser = await chromium.launch();
  const consoleErrors = [];
  let renderOk = false;
  const axeCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
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
    for (const v of axeResults.violations) {
      if (axeCounts[v.impact] !== undefined) axeCounts[v.impact] += 1;
    }

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

  return { targetUrl, renderOk, consoleErrors, axeCounts, screenshots };
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
  const screenshotDir = getArg('screenshotDir');
  // --target이 주어지면 검증 후 판정서(runs/*.json + reports/*.md)까지 이 명령 하나로 기록한다.
  // commands/pipeline.md 4~5단계("검증"과 "판정서 기록")가 문서상 별개 스크립트처럼 서술돼 있었지만
  // report-writer.mjs엔 CLI 진입점이 없어 실제로는 에이전트가 매번 접착 스크립트를 직접 짜야 했다
  // (실사용 세션에서 실측 재현·확인). 이 옵션 없이 호출하면 기존과 동일하게 판정 JSON만 출력한다.
  const target = getArg('target');
  const generatedFiles = getArg('generatedFiles');
  const retryCount = getArg('retryCount');

  let devServer = null;
  let baseUrl = explicitUrl;

  try {
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
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMainModule) {
  main().catch((err) => {
    console.error('[verify-runner] 실패:', err.message);
    process.exitCode = 1;
  });
}
