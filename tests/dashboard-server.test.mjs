import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import {
  isAllowedOrigin,
  timingSafeTokenEqual,
  applySecurityHeaders,
  generateApiToken,
  createRequestHandler,
  startDashboardServer,
  listRuns,
  readReportContent,
  readScreenshotFile,
  extractScreenshotPaths,
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

test('createRequestHandler: 올바른 토큰 + /health → 200 OK', async () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: '/nonexistent' });
  const res = makeMockRes();
  await handler({ method: 'GET', url: '/health', headers: { 'x-design-kit-token': 'good-token' } }, res);
  assert.equal(res._statusCode, 200);
  assert.equal(res._body.ok, true);
});

test('createRequestHandler: 틀린 토큰 → 403 (데이터 라우트 도달 전에 차단)', async () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: '/nonexistent' });
  const res = makeMockRes();
  await handler({ method: 'GET', url: '/health', headers: { 'x-design-kit-token': 'wrong' } }, res);
  assert.equal(res._statusCode, 403);
});

test('createRequestHandler: 토큰 헤더 자체가 없으면 → 403', async () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: '/nonexistent' });
  const res = makeMockRes();
  await handler({ method: 'GET', url: '/health', headers: {} }, res);
  assert.equal(res._statusCode, 403);
});

test('createRequestHandler: 허용되지 않은 Origin이면 토큰이 맞아도 403 (Origin 검사가 먼저)', async () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: '/nonexistent' });
  const res = makeMockRes();
  await handler(
    { method: 'GET', url: '/health', headers: { origin: 'http://evil.example.com', 'x-design-kit-token': 'good-token' } },
    res
  );
  assert.equal(res._statusCode, 403);
  assert.match(res._body.error, /forbidden origin/);
});

test('createRequestHandler: 정의 안 된 경로는 404', async () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: '/nonexistent' });
  const res = makeMockRes();
  await handler({ method: 'GET', url: '/nope', headers: { 'x-design-kit-token': 'good-token' } }, res);
  assert.equal(res._statusCode, 404);
});

test('createRequestHandler: 모든 응답에 보안 헤더가 실제로 붙는다 (403 응답 포함)', async () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: '/nonexistent' });
  const res = makeMockRes();
  await handler({ method: 'GET', url: '/health', headers: {} }, res);
  assert.equal(res._headers['X-Frame-Options'], 'DENY');
});

test('createRequestHandler: POST 등 쓰기 메서드는 항상 405 (이 증분은 GET만)', async () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: '/nonexistent' });
  const res = makeMockRes();
  await handler({ method: 'POST', url: '/api/runs', headers: { 'x-design-kit-token': 'good-token' } }, res);
  assert.equal(res._statusCode, 405);
});

test('createRequestHandler: GET /api/runs → 실행 이력이 없으면 빈 배열(에러 아님)', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir });
    const res = makeMockRes();
    await handler({ method: 'GET', url: '/api/runs', headers: { 'x-design-kit-token': 'good-token' } }, res);
    assert.equal(res._statusCode, 200);
    assert.deepEqual(res._body.runs, []);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('createRequestHandler: GET /api/reports/:runId — 경로 조작 시도(../..)는 400으로 차단, 파일 내용 유출 없음', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    await mkdir(path.join(designKitDir, 'reports'), { recursive: true });
    await writeFile(path.join(projectDir, 'secret.txt'), 'SHOULD NOT LEAK', 'utf-8');
    const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir });
    const res = makeMockRes();
    await handler(
      { method: 'GET', url: `/api/reports/${encodeURIComponent('../../secret.txt')}`, headers: { 'x-design-kit-token': 'good-token' } },
      res
    );
    assert.equal(res._statusCode, 400);
    assert.ok(!JSON.stringify(res._body).includes('SHOULD NOT LEAK'));
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('createRequestHandler: GET /api/screenshots/* — 경로 조작 시도는 차단되고 .png 밖 확장자도 거부', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    await mkdir(path.join(designKitDir, 'reports', 'screenshots'), { recursive: true });
    await writeFile(path.join(projectDir, 'secret.env'), 'API_KEY=leak-me', 'utf-8');
    const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir });

    const traversalRes = makeMockRes();
    await handler(
      { method: 'GET', url: `/api/screenshots/${encodeURIComponent('../../secret.env')}`, headers: { 'x-design-kit-token': 'good-token' } },
      traversalRes
    );
    assert.equal(traversalRes._statusCode, 400);

    const wrongExtRes = makeMockRes();
    await handler(
      { method: 'GET', url: '/api/screenshots/notreal.txt', headers: { 'x-design-kit-token': 'good-token' } },
      wrongExtRes
    );
    assert.equal(wrongExtRes._statusCode, 400);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('listRuns: runs/ 폴더가 없으면 빈 배열', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  try {
    const runs = await listRuns(path.join(projectDir, '.design-kit'));
    assert.deepEqual(runs, []);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('listRuns: 최신 실행이 최상단(runId 사전식 정렬 역순)', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const runsDir = path.join(projectDir, '.design-kit', 'runs');
  try {
    await mkdir(runsDir, { recursive: true });
    await writeFile(path.join(runsDir, '2026-08-01-001.json'), JSON.stringify({ runId: '2026-08-01-001', status: 'pass' }));
    await writeFile(path.join(runsDir, '2026-08-09-002.json'), JSON.stringify({ runId: '2026-08-09-002', status: 'fail' }));
    const runs = await listRuns(path.join(projectDir, '.design-kit'));
    assert.equal(runs.length, 2);
    assert.equal(runs[0].runId, '2026-08-09-002');
    assert.equal(runs[1].runId, '2026-08-01-001');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('listRuns: 손상된 run 파일 1개는 건너뛰고 나머지는 정상 반환', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const runsDir = path.join(projectDir, '.design-kit', 'runs');
  try {
    await mkdir(runsDir, { recursive: true });
    await writeFile(path.join(runsDir, '2026-08-01-001.json'), '{ 깨진 JSON');
    await writeFile(path.join(runsDir, '2026-08-02-001.json'), JSON.stringify({ runId: '2026-08-02-001', status: 'pass' }));
    const runs = await listRuns(path.join(projectDir, '.design-kit'));
    assert.equal(runs.length, 1);
    assert.equal(runs[0].runId, '2026-08-02-001');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('readReportContent: 정상 runId는 판정서 내용을 그대로 반환', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    await mkdir(path.join(designKitDir, 'reports'), { recursive: true });
    await writeFile(path.join(designKitDir, 'reports', '2026-08-09-001.md'), '# 판정서\n- 판정: PASS');
    const content = await readReportContent(designKitDir, '2026-08-09-001');
    assert.match(content, /PASS/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('readReportContent: runId 형식이 틀리면(경로 조작 포함) 400, 파일시스템에 닿지 않는다', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    await assert.rejects(() => readReportContent(designKitDir, '../../secret'), (err) => err.statusCode === 400);
    await assert.rejects(() => readReportContent(designKitDir, '2026-08-09-001/../../../etc'), (err) => err.statusCode === 400);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('readReportContent: 존재하지 않는 runId는 404', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    await assert.rejects(() => readReportContent(designKitDir, '2026-01-01-999'), (err) => err.statusCode === 404);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('readScreenshotFile: 정상 경로는 PNG 바이트를 그대로 반환', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    const dir = path.join(designKitDir, 'reports', 'screenshots', 'pipeline-421-3078');
    await mkdir(dir, { recursive: true });
    const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await writeFile(path.join(dir, '360.png'), fakePng);
    const buf = await readScreenshotFile(designKitDir, 'pipeline-421-3078/360.png');
    assert.deepEqual(buf, fakePng);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('readScreenshotFile: screenshots/ 밖으로 나가는 경로는 400 (핵심 방어 — 04 DO NOT이 이름으로 지목한 위험)', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    await mkdir(path.join(designKitDir, 'reports', 'screenshots'), { recursive: true });
    await writeFile(path.join(designKitDir, 'component-map.json'), '[]', 'utf-8');
    await assert.rejects(
      () => readScreenshotFile(designKitDir, '../component-map.json'),
      (err) => err.statusCode === 400
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('readScreenshotFile: .png가 아닌 확장자는 400 (파일 유형 화이트리스트)', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  const screenshotsDir = path.join(designKitDir, 'reports', 'screenshots');
  try {
    await mkdir(screenshotsDir, { recursive: true });
    await writeFile(path.join(screenshotsDir, 'notes.txt'), 'not a screenshot', 'utf-8');
    await assert.rejects(() => readScreenshotFile(designKitDir, 'notes.txt'), (err) => err.statusCode === 400);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('extractScreenshotPaths: 판정서 마크다운에서 뷰포트별 경로를 뽑아낸다', () => {
  const md = '# 판정서\n## screenshots\n- 360px: pipeline-421-3078/360.png\n- 768px: pipeline-421-3078/768.png\n';
  const shots = extractScreenshotPaths(md);
  assert.deepEqual(shots, [
    { viewport: '360', path: 'pipeline-421-3078/360.png' },
    { viewport: '768', path: 'pipeline-421-3078/768.png' },
  ]);
});

test('extractScreenshotPaths: 스크린샷 섹션이 없으면 빈 배열', () => {
  assert.deepEqual(extractScreenshotPaths('# 판정서\n- 판정: PASS'), []);
});

test('createRequestHandler: GET / 은 토큰 없이도 200 (셸은 공개 — 토큰 순환 문제 회피)', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  try {
    const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: path.join(projectDir, '.design-kit') });
    const res = makeMockRes();
    await handler({ method: 'GET', url: '/', headers: {} }, res);
    assert.equal(res._statusCode, 200);
    assert.match(res._headers['Content-Type'], /text\/html/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('createRequestHandler: GET /dashboard.js 는 토큰 없이도 200이고 인라인 스크립트가 없다(CSP script-src \'self\'만으로 동작 확인)', async () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: '/nonexistent' });
  const res = makeMockRes();
  await handler({ method: 'GET', url: '/dashboard.js', headers: {} }, res);
  assert.equal(res._statusCode, 200);
  assert.match(res._headers['Content-Type'], /javascript/);
});

test('createRequestHandler: GET /api/runs 은 여전히 토큰 없으면 403 (셸만 공개, 데이터는 계속 보호)', async () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: '/nonexistent' });
  const res = makeMockRes();
  await handler({ method: 'GET', url: '/api/runs', headers: {} }, res);
  assert.equal(res._statusCode, 403);
});

test('createRequestHandler: GET /api/reports/:runId 응답에 screenshots 배열이 함께 온다', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    await mkdir(path.join(designKitDir, 'reports'), { recursive: true });
    await writeFile(
      path.join(designKitDir, 'reports', '2026-08-09-001.md'),
      '# 판정서\n- 판정: PASS\n## screenshots\n- 360px: foo/360.png\n'
    );
    const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir });
    const res = makeMockRes();
    await handler({ method: 'GET', url: '/api/reports/2026-08-09-001', headers: { 'x-design-kit-token': 'good-token' } }, res);
    assert.equal(res._statusCode, 200);
    assert.deepEqual(res._body.screenshots, [{ viewport: '360', path: 'foo/360.png' }]);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

// ── XSS 방어 실측 (핵심) ──────────────────────────────────────────────
// mock DOM이나 문자열 검사가 아니라 실제 헤드리스 브라우저(Playwright — 이 킷의 기존
// 의존성, 신규 추가 없음)로 악성 payload가 든 가짜 데이터를 진짜로 렌더해서 스크립트가
// 실행되지 않는지 증명한다. verify-runner.mjs가 생성 코드를 실브라우저로 검증하는 것과
// 정확히 같은 철학 — "코드가 그렇게 생겼으니 안전하다"가 아니라 실제로 안전한지 확인한다.
test('XSS 방어 실측: 악성 payload가 든 run/report를 실제 브라우저로 렌더해도 스크립트가 실행되지 않고 텍스트로만 보인다', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-xss-'));
  let dashboard;
  let browser;
  try {
    const designKitDir = path.join(projectDir, '.design-kit');
    await mkdir(path.join(designKitDir, 'runs'), { recursive: true });
    await mkdir(path.join(designKitDir, 'reports'), { recursive: true });

    const maliciousTarget = '<img src=x onerror="window.__xssFired=(window.__xssFired||0)+1">';
    await writeFile(
      path.join(designKitDir, 'runs', '2026-08-09-999.json'),
      JSON.stringify({ runId: '2026-08-09-999', status: 'fail', target: maliciousTarget, generatedFiles: [], retryCount: 0, startedAt: new Date().toISOString() })
    );
    await writeFile(
      path.join(designKitDir, 'reports', '2026-08-09-999.md'),
      '# 판정서\n<script>window.__xssFired=(window.__xssFired||0)+1;</script>\n- 사유: <b onmouseover="window.__xssFired=(window.__xssFired||0)+1">악성 태그 테스트</b>\n'
    );

    dashboard = await startDashboardServer({ projectDir });
    browser = await chromium.launch();
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto(dashboard.url, { waitUntil: 'networkidle' });
    await page.getByText('판정서 보기').click();
    await page.waitForSelector('.run-report-content');

    // 핵심 증거 1: 페이지 로드+렌더+판정서 열람까지 다 거쳤는데도 payload의 스크립트가
    // 단 한 번도 실행되지 않았다 (innerHTML이었다면 <script>·onerror·onmouseover 중
    // 최소 하나는 실행돼 값이 1 이상이 됐을 것)
    const xssFired = await page.evaluate(() => window.__xssFired);
    assert.equal(xssFired, undefined, 'payload의 스크립트가 실행되면 안 됨(innerHTML 사용 시 실행됨)');

    // 핵심 증거 2: 그래도 데이터 자체는 화면에서 사라지지 않고 "글자 그대로" 보인다
    // (조용히 필터링/삭제된 게 아니라 안전하게 무해한 텍스트로 표시됨을 확인)
    const targetText = await page.locator('.run-target').textContent();
    assert.match(targetText, /<img src=x onerror=/, 'textContent로 렌더돼 원문 그대로 보여야 함');

    const reportText = await page.locator('.run-report-content').textContent();
    assert.match(reportText, /<script>window\.__xssFired/, '판정서 원문도 텍스트 그대로 보여야 함');

    // 핵심 증거 3: 실제로 DOM에 <script> 엘리먼트가 삽입되지 않았다(innerHTML이었다면 파서가
    // 문자열 속 <script> 태그를 실제 엘리먼트로 만들었을 것 — textContent는 그런 파싱을 하지 않음)
    const scriptCount = await page.locator('#runs script').count();
    assert.equal(scriptCount, 0, '#runs 안에 실제 <script> 엘리먼트가 생기면 안 됨');

    assert.deepEqual(consoleErrors, []);
  } finally {
    if (browser) await browser.close();
    if (dashboard) await dashboard.stop();
    await rm(projectDir, { recursive: true, force: true });
  }
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
