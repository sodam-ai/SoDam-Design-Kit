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
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAvailablePort } from './verify-runner.mjs';

// verify-runner.mjs의 dev server 포트 범위(3000~3020)와 절대 겹치지 않도록 별도 대역 사용.
const DASHBOARD_PORT_RANGE_START = 4570;
const DASHBOARD_PORT_RANGE_END = 4590;
const TOKEN_HEADER = 'x-design-kit-token';
const ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

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

/**
 * 요청 핸들러를 http.createServer와 분리해서 만든다 — 실제 소켓을 열지 않고도 단위테스트로
 * Origin 차단·토큰 검증·라우팅을 검증할 수 있게 하기 위함(verify-runner.mjs의 judge()/
 * summarizeAxeViolations()가 순수 함수로 분리된 것과 같은 이유).
 *
 * 2a 범위: `/health` 하나만 존재한다. 판정서·스크린샷을 보여주는 실제 데이터 라우트는
 * 다음 증분(2b)에서 추가한다 — 이 증분은 "서버가 안전하게 켜지고 안전하게 거부하는지"만
 * 증명한다.
 */
export function createRequestHandler({ apiToken, port }) {
  return function handleRequest(req, res) {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) {
      return sendJson(res, 403, { error: 'forbidden origin' });
    }

    const receivedToken = req.headers[TOKEN_HEADER];
    if (!timingSafeTokenEqual(receivedToken, apiToken)) {
      return sendJson(res, 403, { error: '허용되지 않은 요청 — 토큰이 없거나 틀렸습니다' });
    }

    let pathname;
    try {
      pathname = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
    } catch {
      return sendJson(res, 400, { error: '잘못된 요청 경로' });
    }

    if (req.method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, { ok: true, port });
    }

    return sendJson(res, 404, { error: 'not found' });
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

  const server = createServer(createRequestHandler({ apiToken, port }));

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

  const { url, port, apiToken } = await startDashboardServer({ projectDir });
  console.log(`[dashboard] 서버 시작: ${url} (2a 증분 — 보안 골격만, 데이터 라우트 없음)`);
  console.log(`[dashboard] 진단용 토큰(로컬 전용 콘솔 출력 — 판정서·로그 파일에는 절대 기록 안 함): ${apiToken}`);
  console.log(`[dashboard] 예: curl -H "${TOKEN_HEADER}: ${apiToken}" http://127.0.0.1:${port}/health`);
}

// 진입점 판정은 fileURLToPath로 (2026-07-27 실측 발견·수정 — 사유 정본은 hooks/verify-gate.mjs 주석).
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[dashboard-server] 실패:', err.message);
    process.exitCode = 1;
  });
}
