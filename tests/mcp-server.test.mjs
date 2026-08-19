import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createServer } from '../scripts/mcp-server.mjs';

// stdio 전송(StdioServerTransport)은 실제 서브프로세스가 필요해 단위테스트로 재현하기
// 어렵다 — SDK가 정확히 이 문제를 위해 제공하는 InMemoryTransport(같은 프로세스 안에서
// Client·Server를 실제 프로토콜로 연결)를 대신 쓴다. 이건 스텁이 아니라 실제 MCP
// 요청/응답 왕복이 일어난다(도구 목록 조회·스키마 검증·콘텐츠 직렬화 전부 실제 SDK 코드
// 경로를 통과함) — verify-runner.mjs가 createRequestHandler()로 실소켓 없이 라우팅을
// 검증하는 것과 같은 원칙.
async function connectedClient() {
  const server = createServer();
  const client = new Client({ name: 'test-client', version: '0.0.1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

test('createServer: 도구 4개가 정확히 등록된다', async () => {
  const client = await connectedClient();
  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    ['get_report', 'get_screenshot', 'list_runs', 'reverify']
  );
});

test('reverify 도구 설명에 "완료 보고를 기계적으로 차단하지 않는다"는 정직 고지가 포함된다 (01_PRD.md §3 능력 매트릭스 집행 지점)', async () => {
  const client = await connectedClient();
  const { tools } = await client.listTools();
  const reverifyTool = tools.find((t) => t.name === 'reverify');
  assert.match(reverifyTool.description, /완료 보고를 기계적으로 차단하지 않습니다/);
});

// --- list_runs ---

test('list_runs: 실행 이력이 없으면 빈 배열', async () => {
  const client = await connectedClient();
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  try {
    const result = await client.callTool({ name: 'list_runs', arguments: { projectDir } });
    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse(result.content[0].text), []);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('list_runs: 실제 실행 기록을 최신순으로 반환한다', async () => {
  const client = await connectedClient();
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  try {
    const runsDir = path.join(projectDir, '.design-kit', 'runs');
    await mkdir(runsDir, { recursive: true });
    await writeFile(path.join(runsDir, '2026-08-01-001.json'), JSON.stringify({ runId: '2026-08-01-001', status: 'pass' }));
    await writeFile(path.join(runsDir, '2026-08-09-002.json'), JSON.stringify({ runId: '2026-08-09-002', status: 'fail' }));
    const result = await client.callTool({ name: 'list_runs', arguments: { projectDir } });
    const runs = JSON.parse(result.content[0].text);
    assert.equal(runs.length, 2);
    assert.equal(runs[0].runId, '2026-08-09-002'); // 최신순
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('list_runs: 존재하지 않는 projectDir은 isError + Node 내부 에러 미노출', async () => {
  const client = await connectedClient();
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  const nonexistent = path.join(base, 'does-not-exist');
  try {
    const result = await client.callTool({ name: 'list_runs', arguments: { projectDir: nonexistent } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /프로젝트 디렉터리를 찾을 수 없습니다/);
    assert.doesNotMatch(result.content[0].text, /ENOENT|ENOTDIR/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('list_runs: projectDir이 디렉터리가 아니라 파일이면 isError + 같은 안내 문구 (2026-08-19 실측 패턴 재사용)', async () => {
  const client = await connectedClient();
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  const filePath = path.join(base, 'not-a-directory.txt');
  try {
    await writeFile(filePath, '프로젝트 폴더가 아니라 파일입니다', 'utf-8');
    const result = await client.callTool({ name: 'list_runs', arguments: { projectDir: filePath } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /프로젝트 디렉터리를 찾을 수 없습니다/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

// --- get_report ---

test('get_report: 판정서 원문 + 스크린샷 목록을 함께 반환한다', async () => {
  const client = await connectedClient();
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  try {
    const reportsDir = path.join(projectDir, '.design-kit', 'reports');
    await mkdir(reportsDir, { recursive: true });
    await writeFile(
      path.join(reportsDir, '2026-08-20-001.md'),
      '# 판정서\n- 판정: **PASS**\n\n## screenshots\n- 360px: reports/screenshots/2026-08-20-001/360.png\n- 768px: reports/screenshots/2026-08-20-001/768.png\n'
    );
    const result = await client.callTool({ name: 'get_report', arguments: { projectDir, runId: '2026-08-20-001' } });
    assert.equal(result.isError, undefined);
    assert.equal(result.content.length, 2);
    assert.match(result.content[0].text, /PASS/);
    const screenshots = JSON.parse(result.content[1].text.replace('스크린샷 목록: ', ''));
    assert.deepEqual(screenshots, [
      { viewport: '360', path: 'reports/screenshots/2026-08-20-001/360.png' },
      { viewport: '768', path: 'reports/screenshots/2026-08-20-001/768.png' },
    ]);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('get_report: 존재하지 않는 runId는 isError', async () => {
  const client = await connectedClient();
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  try {
    const result = await client.callTool({ name: 'get_report', arguments: { projectDir, runId: '2026-01-01-999' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /판정서를 찾을 수 없습니다/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('get_report: runId에 경로 조작 문자가 섞이면 isError (readReportContent의 기존 방어 그대로 전달)', async () => {
  const client = await connectedClient();
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  try {
    const result = await client.callTool({ name: 'get_report', arguments: { projectDir, runId: '../../etc/passwd' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /잘못된 runId 형식/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

// --- get_screenshot ---

test('get_screenshot: 실제 파일을 base64 image content로 반환한다', async () => {
  const client = await connectedClient();
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  try {
    const shotDir = path.join(projectDir, '.design-kit', 'reports', 'screenshots', 'run-1');
    await mkdir(shotDir, { recursive: true });
    const fakePngBytes = Buffer.from('fake-png-bytes-for-test');
    await writeFile(path.join(shotDir, '360.png'), fakePngBytes);
    const result = await client.callTool({
      name: 'get_screenshot',
      arguments: { projectDir, screenshotPath: 'reports/screenshots/run-1/360.png' },
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.content[0].type, 'image');
    assert.equal(result.content[0].mimeType, 'image/png');
    assert.equal(Buffer.from(result.content[0].data, 'base64').toString(), fakePngBytes.toString());
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('get_screenshot: 존재하지 않는 경로는 isError', async () => {
  const client = await connectedClient();
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  try {
    const result = await client.callTool({
      name: 'get_screenshot',
      arguments: { projectDir, screenshotPath: 'reports/screenshots/nope/360.png' },
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /스크린샷을 찾을 수 없습니다/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('get_screenshot: 스크린샷 폴더 밖으로 나가는 경로는 isError (경로 조작 방어 그대로 전달)', async () => {
  const client = await connectedClient();
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  try {
    const result = await client.callTool({
      name: 'get_screenshot',
      arguments: { projectDir, screenshotPath: '../../../package.json' },
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /잘못된 경로/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

// --- reverify ---
// 성공·동시성 경로는 실제 Next.js dev server가 필요해 mkdtemp로 재현 불가 — 이미
// dashboard-server.test.mjs가 같은 이유로 거부 경로만 단위테스트하는 것과 동일 원칙.
// 성공 경로는 이번 증분에서 실제 픽스처(SoDam-Design-Kit-Fixture) 대상 MCP 왕복으로
// 실측 확인했다(list_runs로 실행 이력 101건 조회, get_report+get_screenshot으로 실제
// 판정서·PNG 조회, reverify로 새 판정서 생성까지 — 상세는 .PRD/README.md 결정 기록).

test('reverify: runId 형식이 틀리면 isError', async () => {
  const client = await connectedClient();
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  try {
    const result = await client.callTool({ name: 'reverify', arguments: { projectDir, runId: '../../etc' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /잘못된 runId 형식/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('reverify: 존재하지 않는 runId는 isError', async () => {
  const client = await connectedClient();
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  try {
    const result = await client.callTool({ name: 'reverify', arguments: { projectDir, runId: '2026-01-01-999' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /원본 실행 기록을 찾을 수 없습니다/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('reverify: route가 없는 구버전 판정서는 명확한 사유와 함께 isError (추측으로 땜질하지 않음)', async () => {
  const client = await connectedClient();
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  try {
    const runsDir = path.join(projectDir, '.design-kit', 'runs');
    await mkdir(runsDir, { recursive: true });
    await writeFile(
      path.join(runsDir, '2026-08-01-001.json'),
      JSON.stringify({ runId: '2026-08-01-001', status: 'pass', target: '구버전', generatedFiles: [], retryCount: 0 })
    );
    const result = await client.callTool({ name: 'reverify', arguments: { projectDir, runId: '2026-08-01-001' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /route 정보가 없어/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('reverify: 존재하지 않는 projectDir은 isError + Node 내부 에러 미노출', async () => {
  const client = await connectedClient();
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-mcp-'));
  const nonexistent = path.join(base, 'does-not-exist');
  try {
    const result = await client.callTool({ name: 'reverify', arguments: { projectDir: nonexistent, runId: '2026-08-01-001' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /프로젝트 디렉터리를 찾을 수 없습니다/);
    assert.doesNotMatch(result.content[0].text, /ENOENT|ENOTDIR/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
