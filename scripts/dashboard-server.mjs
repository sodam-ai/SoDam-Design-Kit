#!/usr/bin/env node
// SoDam-Design-Kit — open 대시보드 서버 [P2, 2a 증분: 보안 골격만]
// O-Brain(D:\AI_Dev_Work\2026y\26y_06m_21d_SoDam_O-Brain\app\src\server.mjs) 실측 검증된
// 패턴을 이식한다: 127.0.0.1 전용 바인딩·Origin 검사·보안 헤더 세트·실행별 토큰.
// 이 증분은 데이터를 하나도 보여주지 않는다(판정서·스크린샷 열람은 2b, 재검증 트리거는 2c —
// 대시보드는 이 킷이 반복해온 "문서엔 규칙, 코드는 없음" 패턴에 가장 가깝게 서 있는 기능이라
// 보안 primitive만 먼저 독립적으로 증명한다).
//
// express 대신 Node 내장 http만 사용 — 이 킷은 지금 웹 프레임워크 의존성이 0개이고(playwright·
// axe-core만 있음), 라우트 몇 개뿐인 골격에 새 의존성을 들이는 건 04 ALWAYS DO "공급망 최소화"
// 원칙과 맞지 않는다(O-Brain은 express를 쓰지만, 그건 그 프로젝트가 이미 갖춘 의존성이다).

import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAvailablePort, startDevServer, verifyPage, judge } from './verify-runner.mjs';
import { writeReport } from './report-writer.mjs';
import { acquireLock, releaseLock } from './execution-lock.mjs';

// verify-runner.mjs의 dev server 포트 범위(3000~3020)와 절대 겹치지 않도록 별도 대역 사용.
const DASHBOARD_PORT_RANGE_START = 4570;
const DASHBOARD_PORT_RANGE_END = 4590;
const TOKEN_HEADER = 'x-design-kit-token';
const ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const WEB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dashboard-web');
// report-writer.mjs의 nextRunId()가 만드는 형식과 정확히 일치(YYYY-MM-DD-NNN).
// 이 정규식을 먼저 통과해야만 파일 경로 조립에 쓰인다 — `.`·`/`가 섞인 값은 애초에 이 형식에
// 맞을 수 없으므로 경로 조작 문자가 여기서 원천 차단된다(방어의 1차 층).
const RUN_ID_PATTERN = /^\d{4}-\d{2}-\d{2}-\d{3}$/;

/** Origin 헤더가 없는 요청(curl 등 브라우저 아닌 클라이언트)은 통과시키고, 있는데 localhost/127.0.0.1이
 * 아니면 차단한다 — 브라우저가 보내는 교차 출처 요청만 막는 게 목적(O-Brain 패턴 그대로). */
export function isAllowedOrigin(origin) {
  if (!origin) return true;
  return ORIGIN_PATTERN.test(origin);
}

/**
 * 토큰 비교를 타이밍-세이프하게 한다 (Node 내장 `crypto.timingSafeEqual`).
 *
 * O-Brain 원본 서버는 `!==` 직접 문자열 비교였다(01_PRD.md §6 MoSCoW에서 timing-safe 비교는
 * "Should"라 O-Brain에선 생략됐던 것으로 보인다). 이 킷은 Node 내장 함수만으로 비용 없이
 * 추가할 수 있어(신규 의존성 없음 — 공급망 최소화 원칙과 충돌하지 않음) 처음부터 반영한다.
 * "이식하되 그대로 베끼지 않고, 공짜로 되는 개선은 더한다."
 *
 * 길이가 다르면 `timingSafeEqual`이 예외를 던지므로 그 앞에서 길이 비교로 짧게 거른다 — 토큰은
 * 고정 길이(32자 hex)라 실사용에서 길이 불일치는 사실상 전부 악의적/오류 요청이고, 그 지점의
 * 아주 미세한 타이밍 차이가 실질적 위험을 늘리지 않는다(실제 32바이트 비교 자체는 여전히
 * timing-safe). 완벽보다 실질적 방어를 우선한 현실적 절충.
 */
export function timingSafeTokenEqual(received, expected) {
  const a = Buffer.from(String(received || ''), 'utf8');
  const b = Buffer.from(String(expected || ''), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** O-Brain server.mjs와 동일한 보안 헤더 세트 (CSP·nosniff·frame-ancestors — 04 ALWAYS DO). */
export function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  );
}

async function ensureApiTokenGitignored(projectDir) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const pattern = '.design-kit/.api-token';
  const content = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : '';
  if (content.includes(pattern)) return false;

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  await writeFile(gitignorePath, `${content}${separator}${pattern}\n`, 'utf-8');
  return true;
}

/**
 * 실행별 API 토큰을 생성해 `.design-kit/.api-token`에 기록한다(0600 권한 시도, Windows는
 * best-effort — O-Brain도 같은 방식). 매 서버 시작마다 새로 생성(02_DATA_MODEL.md 스키마:
 * "실행마다 재생성·0600·gitignore").
 */
export async function generateApiToken(designKitDir) {
  await mkdir(designKitDir, { recursive: true }); // execution-lock.mjs와 동일 이유 — setup 안 거친 경로 지원
  await ensureApiTokenGitignored(path.dirname(designKitDir));
  const token = randomBytes(16).toString('hex');
  const tokenPath = path.join(designKitDir, '.api-token');
  await writeFile(tokenPath, token, { mode: 0o600 });
  return token;
}

function sendJson(res, status, body) {
  applySecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sendBinary(res, status, contentType, buffer) {
  applySecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(buffer);
}

function sendText(res, status, contentType, text) {
  applySecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(text);
}

/**
 * 판정서 markdown에서 스크린샷 목록을 뽑아낸다. report-writer.mjs의 renderReportMarkdown()이
 * 만드는 정확한 형식(`- ${viewport}px: ${path}`)만 매칭한다 — 새 마크다운 파서를 들이지
 * 않고(공급망 최소화) 이미 정해진 출력 형식을 그대로 이용한다. 화면(2b-2)이 뷰포트별로
 * 스크린샷을 나란히 보여주려면(01 §5) 구조화된 목록이 필요해서 신설했다.
 */
export function extractScreenshotPaths(markdownContent) {
  const lines = String(markdownContent || '').split('\n');
  const screenshots = [];
  for (const line of lines) {
    const match = line.match(/^- (\d+)px: (.+)$/);
    if (match) screenshots.push({ viewport: match[1], path: match[2].trim() });
  }
  return screenshots;
}

/**
 * .design-kit/runs/*.json을 전부 읽어 최신순으로 반환한다 (01_PRD.md §5 "최신 실행이 최상단").
 * runId가 날짜-순번 형식이라 파일명 사전식 정렬이 곧 시간순 정렬이다 — 이 전제는
 * hooks/verify-gate.mjs의 decide()가 이미 쓰고 있는 것과 동일(새로 발명하지 않음).
 * 손상된(파싱 실패) run 파일은 건너뛰고 계속 진행한다 — 이건 게이트 판정(fail-closed)이
 * 아니라 열람이라, 개별 항목 하나의 손상이 전체 목록 열람을 막아선 안 된다(열람과 판정은
 * 다른 안전 원칙이 적용되는 층위 — 02 결정 기록과 정합).
 */
export async function listRuns(designKitDir) {
  const runsDir = path.join(designKitDir, 'runs');
  let files;
  try {
    files = await readdir(runsDir);
  } catch {
    return [];
  }
  const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse();
  const runs = [];
  for (const file of jsonFiles) {
    try {
      runs.push(JSON.parse(await readFile(path.join(runsDir, file), 'utf-8')));
    } catch {
      // 손상된 개별 실행 기록만 건너뜀 — 전체 목록 열람은 계속됨
    }
  }
  return runs;
}

/**
 * runId로 판정서(reports/<runId>.md) 원문을 읽는다.
 * 04_PROJECT_SPEC.md DO NOT "생성·조회 파일 경로는 프로젝트 루트 하위로 정규화 검증"을 두 겹으로
 * 지킨다: (1) runId를 RUN_ID_PATTERN으로 먼저 검증해 `.`·`/`가 섞인 값을 애초에 통과시키지
 * 않고, (2) 그래도 경로를 한 번 더 resolve+startsWith로 검증한다(pipeline-codegen.mjs의
 * registerNewComponent()가 이미 쓰는 방어 패턴 재사용 — 새로 발명하지 않음).
 */
export async function readReportContent(designKitDir, runId) {
  if (!RUN_ID_PATTERN.test(String(runId))) {
    throw Object.assign(new Error('잘못된 runId 형식'), { statusCode: 400 });
  }
  const reportsDir = path.resolve(path.join(designKitDir, 'reports'));
  const reportPath = path.resolve(path.join(reportsDir, `${runId}.md`));
  if (!reportPath.startsWith(reportsDir + path.sep)) {
    throw Object.assign(new Error('잘못된 경로'), { statusCode: 400 });
  }
  try {
    return await readFile(reportPath, 'utf-8');
  } catch {
    throw Object.assign(new Error('판정서를 찾을 수 없습니다'), { statusCode: 404 });
  }
}

/**
 * 저장된 run 기록으로 같은 화면을 다시 검증한다(2c — 재검증 트리거).
 *
 * verify-runner.mjs의 main()과 정확히 같은 순서(락 획득 → dev server 기동 → 렌더+axe 검사 →
 * 판정서 기록 → dev server 종료 → 락 해제)를, 이미 export된 코어 함수들을 그대로 호출해서
 * 재현한다 — main() 자체를 건드리지 않고 같은 함수를 다른 진입점에서 재사용한다(01_PRD.md
 * §3 Parity Matrix: "모든 표면은 같은 코어 엔진을 호출하는 얇은 래퍼").
 *
 * 코드를 다시 생성하지 않는다 — 이미 만들어진 코드를 다시 검사만 한다(T2 AI 작업은 대시보드
 * 범위 밖, 01 §3). route가 저장돼 있지 않은 오래된 판정서(2026-08-09 이전)는 재검증을
 * 명확히 거부한다(경로를 추측해서 땜질하지 않음 — 02 결정 기록).
 */
export async function reverifyRun(projectDir, designKitDir, runId) {
  if (!RUN_ID_PATTERN.test(String(runId))) {
    throw Object.assign(new Error('잘못된 runId 형식'), { statusCode: 400 });
  }
  const runPath = path.resolve(path.join(designKitDir, 'runs', `${runId}.json`));
  let originalRun;
  try {
    originalRun = JSON.parse(await readFile(runPath, 'utf-8'));
  } catch {
    throw Object.assign(new Error('원본 실행 기록을 찾을 수 없습니다'), { statusCode: 404 });
  }
  if (!originalRun.route) {
    throw Object.assign(
      new Error(
        '이 실행 기록엔 route 정보가 없어 재검증할 수 없습니다(오래된 판정서). 파이프라인을 다시 실행해 새 판정서를 만들어주세요.'
      ),
      { statusCode: 400 }
    );
  }

  await acquireLock(designKitDir); // 실행 중이면 여기서 statusCode 409로 거부됨(execution-lock.mjs)
  let devServer;
  try {
    devServer = await startDevServer(projectDir);
    const result = await verifyPage({
      baseUrl: devServer.url,
      route: originalRun.route,
      screenshotDir: path.join(designKitDir, 'reports', 'screenshots', `reverify-${runId}-${Date.now()}`),
    });
    const judgement = judge(result);
    const report = await writeReport({
      designKitDir,
      target: `${originalRun.target} (대시보드 재검증)`,
      generatedFiles: originalRun.generatedFiles || [],
      retryCount: 0,
      route: originalRun.route,
      verifyRunnerOutput: { devServer: { port: devServer.port, autoStarted: true }, ...result, ...judgement },
    });
    return { ...report, verdict: judgement.verdict };
  } finally {
    if (devServer) await devServer.stop();
    await releaseLock(designKitDir);
  }
}

/**
 * 스크린샷 파일을 서빙한다 — 04_PROJECT_SPEC.md DO NOT이 **이름으로 지목한** 위험
 * ("경로 조작 차단 — 스크린샷 서빙 포함"). 요청 경로에 `..`가 섞여 있어도 반드시
 * `.design-kit/reports/screenshots/` 밖으로 못 나가게 resolve+startsWith로 검증하고,
 * 확장자를 `.png`로만 제한한다(파일 유형 화이트리스트 — 임의 파일 서빙 방지, 01 §6 신뢰 경계).
 */
export async function readScreenshotFile(designKitDir, relativePath) {
  const screenshotsDir = path.resolve(path.join(designKitDir, 'reports', 'screenshots'));
  let decoded;
  try {
    decoded = decodeURIComponent(String(relativePath || ''));
  } catch {
    throw Object.assign(new Error('잘못된 경로 인코딩'), { statusCode: 400 });
  }
  const resolved = path.resolve(path.join(screenshotsDir, decoded));
  if (!resolved.startsWith(screenshotsDir + path.sep) || !resolved.toLowerCase().endsWith('.png')) {
    throw Object.assign(new Error('잘못된 경로'), { statusCode: 400 });
  }
  try {
    return await readFile(resolved);
  } catch {
    throw Object.assign(new Error('스크린샷을 찾을 수 없습니다'), { statusCode: 404 });
  }
}

/**
 * 요청 핸들러를 http.createServer와 분리해서 만든다 — 실제 소켓을 열지 않고도 단위테스트로
 * Origin 차단·토큰 검증·라우팅을 검증할 수 있게 하기 위함(verify-runner.mjs의 judge()/
 * summarizeAxeViolations()가 순수 함수로 분리된 것과 같은 이유).
 *
 * 2b-1 범위: 읽기 전용 데이터 API 3개 추가(`/api/runs`·`/api/reports/:runId`·
 * `/api/screenshots/*`). 대시보드는 `.design-kit/`에 절대 쓰지 않는다(GET만 존재 — 02 결정
 * 기록 "상태 파일 직접 쓰기 금지"). 실제 화면(HTML, XSS 방어가 핵심인 지점)은 2b-2로 미룸 —
 * JSON 응답 단계에서는 브라우저가 실행할 마크업이 없어 XSS 위험이 사실상 없고, 이 단계의
 * 실제 위험은 경로 조작(파일을 실제로 읽는 시점)이라 그것부터 독립적으로 증명한다.
 */
export function createRequestHandler({ apiToken, port, designKitDir, projectDir }) {
  return async function handleRequest(req, res) {
    try {
      const origin = req.headers.origin;
      if (!isAllowedOrigin(origin)) {
        return sendJson(res, 403, { error: 'forbidden origin' });
      }

      let pathname;
      try {
        pathname = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
      } catch {
        return sendJson(res, 400, { error: '잘못된 요청 경로' });
      }

      // 재검증 트리거(2c)만 유일한 예외로 POST를 허용한다 — 부작용(dev server 기동·판정서
      // 생성)이 있는 명령이라 GET으로 만들면 브라우저 프리페치·재시도가 의도치 않게 검증을
      // 반복 트리거할 위험이 있다(HTTP 의미론). "대시보드는 상태를 직접 쓰지 않는다"(02
      // 결정 기록)는 여전히 지켜진다 — 이 라우트도 코어 엔진(reverifyRun → verify-runner
      // 함수들)을 호출만 하고, 판정·기록은 엔진이 한다(트리거≠쓰기).
      const reverifyMatch = pathname.match(/^\/api\/reverify\/([^/]+)$/);
      if (req.method === 'POST' && reverifyMatch) {
        const receivedToken = req.headers[TOKEN_HEADER];
        if (!timingSafeTokenEqual(receivedToken, apiToken)) {
          return sendJson(res, 403, { error: '허용되지 않은 요청 — 토큰이 없거나 틀렸습니다' });
        }
        try {
          const result = await reverifyRun(projectDir, designKitDir, reverifyMatch[1]);
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, err.statusCode || 500, { error: err.message });
        }
      }

      if (req.method !== 'GET') {
        return sendJson(res, 405, { error: '지원하지 않는 메서드입니다' });
      }

      // 셸(HTML·정적 JS)은 토큰 없이 서빙 — 페이지를 열어야 토큰을 얻을 수 있으므로.
      // 실제 데이터는 이 아래 전부 토큰 검사를 거친다.
      if (pathname === '/') {
        try {
          const html = (await readFile(path.join(WEB_DIR, 'index.html'), 'utf-8')).replace(
            '__DESIGN_KIT_TOKEN__',
            apiToken
          );
          return sendText(res, 200, 'text/html; charset=utf-8', html);
        } catch {
          return sendText(res, 500, 'text/plain; charset=utf-8', '대시보드 화면을 불러오지 못했습니다');
        }
      }
      if (pathname === '/dashboard.js') {
        try {
          const js = await readFile(path.join(WEB_DIR, 'dashboard.js'), 'utf-8');
          return sendText(res, 200, 'application/javascript; charset=utf-8', js);
        } catch {
          return sendJson(res, 500, { error: 'dashboard.js 로딩 실패' });
        }
      }

      const receivedToken = req.headers[TOKEN_HEADER];
      if (!timingSafeTokenEqual(receivedToken, apiToken)) {
        return sendJson(res, 403, { error: '허용되지 않은 요청 — 토큰이 없거나 틀렸습니다' });
      }

      if (pathname === '/health') {
        return sendJson(res, 200, { ok: true, port });
      }

      if (pathname === '/api/runs') {
        const runs = await listRuns(designKitDir);
        return sendJson(res, 200, { runs });
      }

      const reportMatch = pathname.match(/^\/api\/reports\/([^/]+)$/);
      if (reportMatch) {
        try {
          const content = await readReportContent(designKitDir, reportMatch[1]);
          const screenshots = extractScreenshotPaths(content);
          return sendJson(res, 200, { runId: reportMatch[1], content, screenshots });
        } catch (err) {
          return sendJson(res, err.statusCode || 500, { error: err.message });
        }
      }

      const screenshotMatch = pathname.match(/^\/api\/screenshots\/(.+)$/);
      if (screenshotMatch) {
        try {
          const buffer = await readScreenshotFile(designKitDir, screenshotMatch[1]);
          return sendBinary(res, 200, 'image/png', buffer);
        } catch (err) {
          return sendJson(res, err.statusCode || 500, { error: err.message });
        }
      }

      return sendJson(res, 404, { error: 'not found' });
    } catch (err) {
      // 전역 안전망 — O-Brain의 마지막 에러 핸들러와 같은 원칙: 스택 트레이스·내부 경로를
      // 응답에 절대 노출하지 않는다(01 §6, aurakit-security.md). 상세는 로컬 콘솔에만.
      console.error('[dashboard-server] 처리되지 않은 에러:', err);
      return sendJson(res, 500, { error: '요청을 처리하지 못했습니다' });
    }
  };
}

/**
 * 대시보드 서버를 실제로 기동한다. 포트는 verify-runner.mjs의 findAvailablePort()를 그대로
 * 재사용해(01 §3 "표면이 코어를 우회해 자체 판정을 하지 않는다") dev server 포트 판정과 동일한
 * "연결 시도" 방식(바인드 방식 아님 — 27차 교훈)으로 자동 우회한다. 범위만 dev server(3000~3020)와
 * 겹치지 않게 분리(4570~4590).
 */
export async function startDashboardServer({
  projectDir,
  portRangeStart = DASHBOARD_PORT_RANGE_START,
  portRangeEnd = DASHBOARD_PORT_RANGE_END,
} = {}) {
  const resolvedProjectDir = path.resolve(projectDir);
  const designKitDir = path.join(resolvedProjectDir, '.design-kit');
  const apiToken = await generateApiToken(designKitDir);
  const port = await findAvailablePort(portRangeStart, portRangeEnd);

  const server = createServer(createRequestHandler({ apiToken, port, designKitDir, projectDir: resolvedProjectDir }));

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    apiToken,
    async stop() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const projectDir = path.resolve(getArg('project') || process.cwd());

  const { url, apiToken } = await startDashboardServer({ projectDir });
  console.log(`[dashboard] 브라우저에서 열기: ${url}`);
  console.log(`[dashboard] 진단용 토큰(로컬 전용 콘솔 출력 — 판정서·로그 파일에는 절대 기록 안 함): ${apiToken}`);
}

// 진입점 판정은 fileURLToPath로 (2026-07-27 실측 발견·수정 — 사유 정본은 hooks/verify-gate.mjs 주석).
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[dashboard-server] 실패:', err.message);
    process.exitCode = 1;
  });
}
