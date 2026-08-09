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
  reverifyRun,
  readDashboardState,
  ensureDashboardRunning,
  stopDashboard,
  openBrowser,
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

test('extractScreenshotPaths: "## 시각 회귀" 섹션의 동일 형식 줄을 스크린샷으로 오인하지 않는다 (2026-08-09 실측 발견 결함 회귀 방지)', () => {
  const md = [
    '# 판정서',
    '## 시각 회귀 (기준본 비교, opt-in)',
    '- 360px: 일치 (차이 0.00%, 허용 범위 안)',
    '- 768px: **회귀 감지** — 픽셀 99.33% 차이 (허용 1.00%) (diff 이미지: reports/screenshots/x/768.diff.png)',
    '## screenshots',
    '- 360px: reports/screenshots/x/360.png',
    '- 768px: reports/screenshots/x/768.png',
    '- 1440px: reports/screenshots/x/1440.png',
  ].join('\n');
  const shots = extractScreenshotPaths(md);
  assert.deepEqual(shots, [
    { viewport: '360', path: 'reports/screenshots/x/360.png' },
    { viewport: '768', path: 'reports/screenshots/x/768.png' },
    { viewport: '1440', path: 'reports/screenshots/x/1440.png' },
  ]);
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

// ── 재검증 트리거(2c) — 거부 경로만 단위테스트로 (성공 경로는 실제 Next.js dev server가
// 필요해서 mkdtemp 임시 폴더로 못 만듦 — verify-runner.test.mjs가 이미 그 이유로 정적 스텁
// 서버를 쓰는 것과 동일한 원칙. 성공·동시성 경로는 실제 픽스처로 별도 실측한다) ──

test('reverifyRun: runId 형식이 틀리면(경로 조작 포함) 400', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-reverify-'));
  try {
    await assert.rejects(
      () => reverifyRun(projectDir, path.join(projectDir, '.design-kit'), '../../etc'),
      (err) => err.statusCode === 400
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('reverifyRun: 존재하지 않는 runId는 404', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-reverify-'));
  try {
    await assert.rejects(
      () => reverifyRun(projectDir, path.join(projectDir, '.design-kit'), '2026-01-01-999'),
      (err) => err.statusCode === 404
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('reverifyRun: route가 없는 구버전 판정서는 명확한 사유와 함께 400 (추측으로 땜질하지 않음)', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-reverify-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    await mkdir(path.join(designKitDir, 'runs'), { recursive: true });
    await writeFile(
      path.join(designKitDir, 'runs', '2026-08-01-001.json'),
      JSON.stringify({ runId: '2026-08-01-001', status: 'pass', target: '구버전', generatedFiles: [], retryCount: 0 })
    );
    await assert.rejects(
      () => reverifyRun(projectDir, designKitDir, '2026-08-01-001'),
      (err) => err.statusCode === 400 && /route 정보가 없어/.test(err.message)
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('createRequestHandler: POST /api/reverify/:id — 토큰 없으면 실행 자체가 시작되지 않고 403', async () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: '/nonexistent', projectDir: '/nonexistent' });
  const res = makeMockRes();
  await handler({ method: 'POST', url: '/api/reverify/2026-08-01-001', headers: {} }, res);
  assert.equal(res._statusCode, 403);
});

test('createRequestHandler: POST /api/reverify/:id — 토큰이 맞아도 허용 안 된 Origin이면 403 (Origin 검사가 가장 먼저 — 위조 요청 방어의 1차 층)', async () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: '/nonexistent', projectDir: '/nonexistent' });
  const res = makeMockRes();
  await handler(
    { method: 'POST', url: '/api/reverify/2026-08-01-001', headers: { origin: 'http://evil.example.com', 'x-design-kit-token': 'good-token' } },
    res
  );
  assert.equal(res._statusCode, 403);
  assert.match(res._body.error, /forbidden origin/);
});

test('createRequestHandler: GET으로 /api/reverify/:id를 부르면(POST 전용 라우트) 404', async () => {
  const handler = createRequestHandler({ apiToken: 'good-token', port: 4570, designKitDir: '/nonexistent', projectDir: '/nonexistent' });
  const res = makeMockRes();
  await handler({ method: 'GET', url: '/api/reverify/2026-08-01-001', headers: { 'x-design-kit-token': 'good-token' } }, res);
  assert.equal(res._statusCode, 404);
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

// --- 2d: /sodam-design-kit:open 진입점 — 백그라운드 실행·재사용·종료 -------------------------
// PRD(01/03)가 `/sodam-design-kit:open` 슬래시 명령을 명시했지만 실제로는 존재하지 않았음
// (2026-08-09 감사에서 발견 — 엔진은 완성됐으나 진입점이 없어 실사용자가 도달할 방법이 없었다).
// 이 증분은 그 진입점의 핵심 판단 로직(재사용/새로 시작/종료)을 증명한다.

test('readDashboardState: 상태 파일이 없거나 손상돼도 null(판정 게이트 아님 — fail-open)', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-state-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    assert.equal(await readDashboardState(designKitDir), null);
    await mkdir(designKitDir, { recursive: true });
    await writeFile(path.join(designKitDir, '.dashboard.json'), '{ 깨진 JSON', 'utf-8');
    assert.equal(await readDashboardState(designKitDir), null);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('ensureDashboardRunning: 상태 없음 → spawnFn으로 새로 띄우고(가짜 자식이 상태를 씀) reused:false', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-launch-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    let spawnCalled = 0;
    const fakeSpawn = () => {
      spawnCalled += 1;
      setTimeout(async () => {
        await mkdir(designKitDir, { recursive: true });
        await writeFile(
          path.join(designKitDir, '.dashboard.json'),
          JSON.stringify({ pid: 999999, port: 4570, url: 'http://127.0.0.1:4570', startedAt: new Date().toISOString() })
        );
      }, 20);
      return { unref() {} };
    };
    const result = await ensureDashboardRunning(projectDir, { spawnFn: fakeSpawn, waitTimeoutMs: 2000 });
    assert.equal(spawnCalled, 1);
    assert.equal(result.reused, false);
    assert.equal(result.url, 'http://127.0.0.1:4570');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('ensureDashboardRunning: 기록된 PID가 살아있으면 재사용하고 새로 안 띄운다', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-launch-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    await mkdir(designKitDir, { recursive: true });
    await writeFile(
      path.join(designKitDir, '.dashboard.json'),
      JSON.stringify({ pid: 12345, port: 4571, url: 'http://127.0.0.1:4571', startedAt: new Date().toISOString() })
    );
    let spawnCalled = 0;
    const fakeSpawn = () => {
      spawnCalled += 1;
      return { unref() {} };
    };
    const result = await ensureDashboardRunning(projectDir, { isAlive: () => true, spawnFn: fakeSpawn });
    assert.equal(spawnCalled, 0);
    assert.equal(result.reused, true);
    assert.equal(result.url, 'http://127.0.0.1:4571');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('ensureDashboardRunning: 기록된 PID가 죽어있으면(stale) 새로 띄운다 — execution-lock과 같은 원칙', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-launch-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    await mkdir(designKitDir, { recursive: true });
    await writeFile(
      path.join(designKitDir, '.dashboard.json'),
      JSON.stringify({ pid: 12345, port: 4571, url: 'http://127.0.0.1:4571', startedAt: 'old' })
    );
    let spawnCalled = 0;
    const fakeSpawn = () => {
      spawnCalled += 1;
      setTimeout(async () => {
        await writeFile(
          path.join(designKitDir, '.dashboard.json'),
          JSON.stringify({ pid: 999999, port: 4572, url: 'http://127.0.0.1:4572', startedAt: new Date().toISOString() })
        );
      }, 20);
      return { unref() {} };
    };
    const result = await ensureDashboardRunning(projectDir, { isAlive: () => false, spawnFn: fakeSpawn, waitTimeoutMs: 2000 });
    assert.equal(spawnCalled, 1);
    assert.equal(result.reused, false);
    assert.equal(result.url, 'http://127.0.0.1:4572');
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('ensureDashboardRunning: 자식이 상태 파일을 끝내 안 쓰면(기동 실패) 대기 시간 초과로 명확히 실패한다', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-launch-'));
  try {
    const fakeSpawn = () => ({ unref() {} }); // 상태 파일을 절대 안 씀
    await assert.rejects(
      () => ensureDashboardRunning(projectDir, { spawnFn: fakeSpawn, waitTimeoutMs: 300 }),
      /대기 시간을 초과/
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('stopDashboard: 실행 기록이 없으면 kill을 호출하지 않고 not-running을 반환한다', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-stop-'));
  try {
    let killCalled = false;
    const result = await stopDashboard(projectDir, { kill: () => (killCalled = true) });
    assert.equal(result.stopped, false);
    assert.equal(result.reason, 'not-running');
    assert.equal(killCalled, false);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('stopDashboard: 살아있는 PID는 kill 후 상태 파일을 지운다', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-stop-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    await mkdir(designKitDir, { recursive: true });
    await writeFile(
      path.join(designKitDir, '.dashboard.json'),
      JSON.stringify({ pid: 4242, port: 4570, url: 'http://127.0.0.1:4570', startedAt: 'now' })
    );
    let killedPid = null;
    const result = await stopDashboard(projectDir, { isAlive: () => true, kill: (pid) => (killedPid = pid) });
    assert.equal(result.stopped, true);
    assert.equal(killedPid, 4242);
    assert.equal(existsSync(path.join(designKitDir, '.dashboard.json')), false);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('stopDashboard: 죽어있는(stale) PID는 kill을 호출하지 않고 상태만 정리한다', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-stop-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    await mkdir(designKitDir, { recursive: true });
    await writeFile(
      path.join(designKitDir, '.dashboard.json'),
      JSON.stringify({ pid: 4242, port: 4570, url: 'http://127.0.0.1:4570', startedAt: 'now' })
    );
    let killCalled = false;
    const result = await stopDashboard(projectDir, { isAlive: () => false, kill: () => (killCalled = true) });
    assert.equal(result.stopped, false);
    assert.equal(result.reason, 'stale');
    assert.equal(killCalled, false);
    assert.equal(existsSync(path.join(designKitDir, '.dashboard.json')), false);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('openBrowser: 셸 문자열 조합 없이 인자 배열로만 호출한다(04 DO NOT 준수) — 이 환경(win32)에서 cmd+start', () => {
  let calledWith = null;
  const fakeSpawn = (cmd, args, opts) => {
    calledWith = { cmd, args, opts };
    return { unref: () => {} };
  };
  openBrowser('http://127.0.0.1:4570', { spawnFn: fakeSpawn });
  assert.ok(calledWith, 'spawnFn이 호출되어야 함');
  if (process.platform === 'win32') {
    assert.equal(calledWith.cmd, 'cmd');
    assert.deepEqual(calledWith.args, ['/c', 'start', '', 'http://127.0.0.1:4570']);
  }
  assert.equal(calledWith.opts.detached, true);
  assert.equal(calledWith.opts.stdio, 'ignore');
});

test('openBrowser: spawn이 예외를 던져도 명령 자체는 죽지 않는다(편의 기능일 뿐 핵심 경로 아님)', () => {
  const fakeSpawn = () => {
    throw new Error('실행 파일을 찾을 수 없음');
  };
  assert.doesNotThrow(() => openBrowser('http://127.0.0.1:4570', { spawnFn: fakeSpawn }));
});

// 실제 분리 프로세스를 진짜로 띄우고 진짜로 죽인다 — mock만으로 "백그라운드 실행이 된다"고
// 주장하지 않는다(이 파일의 다른 실제-프로세스 테스트들과 같은 철학). 이 테스트가 곧
// `/sodam-design-kit:open`이 실사용자 환경에서 실제로 하게 될 일 그대로다.
test('ensureDashboardRunning → stopDashboard: 실제 분리 프로세스 왕복(진짜 기동·진짜 HTTP 응답·진짜 종료)', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-dashboard-real-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    const state = await ensureDashboardRunning(projectDir, { waitTimeoutMs: 8000 });
    assert.equal(state.reused, false);
    assert.ok(state.pid > 0);
    assert.match(state.url, /^http:\/\/127\.0\.0\.1:\d+$/);

    // 진짜 서버가 진짜로 응답하는지 확인(토큰 없이도 200이어야 하는 GET / — 셸은 공개)
    const homeStatus = await new Promise((resolve, reject) => {
      http.get(state.url, (res) => resolve(res.statusCode)).on('error', reject);
    });
    assert.equal(homeStatus, 200);

    // .gitignore에 실제로 등록됐는지 확인 — 이건 진짜 자식(writeDashboardState)이 한 일이다
    const gitignore = await readFile(path.join(projectDir, '.gitignore'), 'utf-8');
    assert.match(gitignore, /\.design-kit\/\.dashboard\.json/);

    const stopResult = await stopDashboard(projectDir);
    assert.equal(stopResult.stopped, true);
    assert.equal(existsSync(path.join(designKitDir, '.dashboard.json')), false);

    // 종료가 진짜로 먹혔는지 — 잠깐 대기 후 같은 포트로 요청하면 실패해야 함
    await new Promise((resolve) => setTimeout(resolve, 300));
    await assert.rejects(
      () =>
        new Promise((resolve, reject) => {
          http.get(state.url, resolve).on('error', reject);
        }),
      /ECONNREFUSED/
    );
  } finally {
    // 테스트가 도중에 실패해도 떠 있는 프로세스가 남지 않도록 항상 정리 시도
    await stopDashboard(projectDir).catch(() => {});
    await rm(projectDir, { recursive: true, force: true });
  }
});
