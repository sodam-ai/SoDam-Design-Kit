import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {
  isAllowedOrigin,
  timingSafeTokenEqual,
  applySecurityHeaders,
  generateApiToken,
  createRequestHandler,
  startDashboardServer,
} from '../scripts/dashboard-server.mjs';

function makeMockRes() {
  const headers = {};
  let statusCode = null;
  let body = null;
  return {
    setHeader(k, v) {
      headers[k] = v;
    },
    writeHead(code, hdrs) {
      statusCode = code;
      Object.assign(headers, hdrs || {});
    },
    end(data) {
      body = data;
    },
    get _headers() {
      return headers;
    },
    get _statusCode() {
      return statusCode;
    },
    get _body() {
      return body ? JSON.parse(body) : null;
    },
  };
}

test('isAllowedOrigin: Origin 헤더가 없으면 통과시킨다 (curl 등)', () => {
  assert.equal(isAllowedOrigin(undefined), true);
});

test('isAllowedOrigin: localhost/127.0.0.1 출처는 허용한다', () => {
  assert.equal(isAllowedOrigin('http://localhost:3000'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:4570'), true);
  assert.equal(isAllowedOrigin('https://127.0.0.1'), true);
});

test('isAllowedOrigin: 교차 출처는 차단한다', () => {
  assert.equal(isAllowedOrigin('http://evil.example.com'), false);
  assert.equal(isAllowedOrigin('http://127.0.0.1.evil.com'), false);
});

test('timingSafeTokenEqual: 같은 토큰은 true', () => {
  assert.equal(timingSafeTokenEqual('abc123', 'abc123'), true);
});

test('timingSafeTokenEqual: 다른 토큰(같은 길이)은 false', () => {
  assert.equal(timingSafeTokenEqual('abc123', 'abc124'), false);
});

test('timingSafeTokenEqual: 길이가 다르면 false (예외 없이)', () => {
  assert.equal(timingSafeTokenEqual('abc', 'abc123'), false);
});

test('timingSafeTokenEqual: undefined/누락된 토큰은 false', () => {
  assert.equal(timingSafeTokenEqual(undefined, 'abc123'), false);
});

test('applySecurityHeaders: CSP·nosniff·frame-ancestors 세트를 전부 설정한다', () => {
  const res = makeMockRes();
  applySecurityHeaders(res);
  assert.equal(res._headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res._headers['X-Frame-Options'], 'DENY');
  assert.match(res._headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(res._headers['Content-Security-Policy'], /object-src 'none'/);
});

test('generateApiToken: .design-kit/.api-token을 32자 hex로 생성하고 gitignore에 등록한다', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    const token = await generateApiToken(designKitDir);
    assert.match(token, /^[0-9a-f]{32}$/);
    const written = await readFile(path.join(designKitDir, '.api-token'), 'utf-8');
    assert.equal(written, token);
    const gitignore = await readFile(path.join(projectDir, '.gitignore'), 'utf-8');
    assert.match(gitignore, /\.design-kit\/\.api-token/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('generateApiToken: 매 호출마다 새 토큰을 생성한다(재생성)', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    const token1 = await generateApiToken(designKitDir);
    const token2 = await generateApiToken(designKitDir);
    assert.notEqual(token1, token2);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('createRequestHandler: 올바른 토큰 + /health → 200 OK', () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570 });
  const res = makeMockRes();
  handler({ method: 'GET', url: '/health', headers: { 'x-design-kit-token': 'good-token' } }, res);
  assert.equal(res._statusCode, 200);
  assert.equal(res._body.ok, true);
});

test('createRequestHandler: 틀린 토큰 → 403 (데이터 라우트 도달 전에 차단)', () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570 });
  const res = makeMockRes();
  handler({ method: 'GET', url: '/health', headers: { 'x-design-kit-token': 'wrong' } }, res);
  assert.equal(res._statusCode, 403);
});

test('createRequestHandler: 토큰 헤더 자체가 없으면 → 403', () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570 });
  const res = makeMockRes();
  handler({ method: 'GET', url: '/health', headers: {} }, res);
  assert.equal(res._statusCode, 403);
});

test('createRequestHandler: 허용되지 않은 Origin이면 토큰이 맞아도 403 (Origin 검사가 먼저)', () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570 });
  const res = makeMockRes();
  handler(
    { method: 'GET', url: '/health', headers: { origin: 'http://evil.example.com', 'x-design-kit-token': 'good-token' } },
    res
  );
  assert.equal(res._statusCode, 403);
  assert.match(res._body.error, /forbidden origin/);
});

test('createRequestHandler: 정의 안 된 경로는 404', () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570 });
  const res = makeMockRes();
  handler({ method: 'GET', url: '/nope', headers: { 'x-design-kit-token': 'good-token' } }, res);
  assert.equal(res._statusCode, 404);
});

test('createRequestHandler: 모든 응답에 보안 헤더가 실제로 붙는다 (403 응답 포함)', () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570 });
  const res = makeMockRes();
  handler({ method: 'GET', url: '/health', headers: {} }, res);
  assert.equal(res._headers['X-Frame-Options'], 'DENY');
});

// 실제 소켓으로 서버를 띄워 fetch/http로 왕복 — 단위테스트 mock이 아니라 진짜 네트워크 요청으로
// 127.0.0.1 바인딩과 토큰 검증이 실제로 작동하는지 증명한다(verify-runner.test.mjs의 CLI 실제
// 프로세스 테스트와 같은 철학 — mock만으로 "동작한다"고 주장하지 않는다).
test('startDashboardServer: 실제 HTTP 왕복 — 올바른 토큰은 200, 틀린 토큰은 403, 종료 후 포트 해제', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-live-'));
  let dashboard;
  try {
    dashboard = await startDashboardServer({ projectDir });
    assert.ok(dashboard.port >= 4570 && dashboard.port <= 4590);

    const okResult = await new Promise((resolve, reject) => {
      http.get(
        `${dashboard.url}/health`,
        { headers: { 'x-design-kit-token': dashboard.apiToken } },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
        }
      ).on('error', reject);
    });
    assert.equal(okResult.status, 200);
    assert.equal(okResult.body.ok, true);

    const forbiddenResult = await new Promise((resolve, reject) => {
      http.get(
        `${dashboard.url}/health`,
        { headers: { 'x-design-kit-token': 'wrong-token' } },
        (res) => resolve({ status: res.statusCode })
      ).on('error', reject);
    });
    assert.equal(forbiddenResult.status, 403);
  } finally {
    if (dashboard) await dashboard.stop();
    await rm(projectDir, { recursive: true, force: true });
  }
});
