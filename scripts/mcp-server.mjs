#!/usr/bin/env node
// SoDam-Design-Kit — MCP 서버 래퍼 (Phase 3, 03_PHASES.md L111) — Claude Desktop용 .mcpb
//
// 착수 전 스파이크(공식 문서 직접 확인 — claude.com/docs/connectors/building/mcpb,
// github.com/modelcontextprotocol/mcpb)로 PRD 원안의 전제 하나가 틀렸음을 발견했다:
// 01_PRD.md·04_PROJECT_SPEC.md는 "open 대시보드(HTTP, 127.0.0.1)를 MCP와 같은 로컬
// 서버로 공유한다"(O-Brain 동거 구조)를 전제해뒀지만, Claude Desktop의 로컬 .mcpb 확장은
// HTTP가 아니라 **stdio(표준입출력) 전송**으로 동작한다 — Claude Desktop이 이 파일을
// 서브프로세스로 직접 실행하고 stdin/stdout으로 JSON-RPC를 주고받는다. 네트워크 포트를
// 전혀 열지 않으므로 01 §6이 우려한 "유일한 네트워크 면" 위험이 이 경로엔 아예 없다.
// "서버 공유"는 대신 "함수 공유"로 구현한다 — dashboard-server.mjs가 이미 export해둔
// 4개 함수(경로 조작 방어·.lock 동시성 제어가 전부 내장됨)를 HTTP를 거치지 않고 그대로
// in-process import한다(중복 구현 금지 — 02_DATA_MODEL.md 결정 기록 참조).
//
// 범위(2026-08-20 결정, T1만 — T2는 다음 증분): 01_PRD.md §3 Parity 매트릭스가 Claude
// Desktop MCP에 부여한 능력은 T1(코어, 대시보드와 동일)·T2(AI 작업, "판정 제공 범위").
// 이번 증분은 T1만 구현한다 — 이력 열람 + 재검증 트리거. Figma 데이터를 받아 코드를
// 생성하는 T2(pipeline-codegen.mjs의 runCodegen)는 MCP 파라미터 설계가 별도 결정이라
// og 1종만 먼저 검증한 마케팅 소재 파이프라인과 같은 "작게 시작" 원칙으로 의도적으로
// 미룬다.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRuns, readReportContent, readScreenshotFile, reverifyRun, extractScreenshotPaths } from './dashboard-server.mjs';

const RUN_ID_EXAMPLE = '예: 2026-08-20-001';
const PROJECT_DIR_SCHEMA = z.string().describe('대상 프로젝트의 절대경로(.design-kit/이 있는 폴더)');

/**
 * 프로젝트 경로 검증 — 이번 세션에서 6개 스크립트(asset-ledger.mjs 등)에 이미 적용한 것과
 * 동일한 가드다. existsSync만으로는 파일과 디렉터리를 구분하지 못해, 잘못된 경로가 이
 * 가드를 통과하면 Node 내부 에러(ENOTDIR 등)가 MCP 응답에 그대로 노출될 수 있다
 * (2026-08-19 실측 발견 패턴 재사용 — 새로 발명하지 않음).
 *
 * 빈 문자열은 먼저 걸러낸다(2026-08-20 검증 라운드 실측 발견) — CLI 스크립트의
 * `getArg('project') || process.cwd()`와 달리, MCP 도구의 projectDir은 항상 명시돼야
 * 하는 필수 인자다(호출자가 "현재 디렉터리"라는 개념을 가질 이유가 없음 — Claude Desktop이
 * 어느 프로젝트를 말하는지는 매번 명시로만 알 수 있다). 그런데 `path.resolve('')`는 조용히
 * `process.cwd()`(MCP 서버 프로세스 자신의 실행 위치, 사용자가 의도한 프로젝트가 아님)로
 * 풀려버려 existsSync 검사를 항상 통과한다 — 빈 문자열을 주면 엉뚱한 위치(서버 실행 위치)를
 * 조용히 대상으로 삼는 결함이 됐다. `list_runs`에 `projectDir: ''`를 실제로 넘겨 빈 배열이
 * 아무 에러 없이 반환되는 것으로 재현·확인했다.
 */
function assertProjectDir(projectDir) {
  if (!projectDir || typeof projectDir !== 'string' || projectDir.trim().length === 0) {
    throw new Error('projectDir은 비어있지 않은 문자열이어야 합니다.');
  }
  const resolved = path.resolve(projectDir);
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    throw new Error(`프로젝트 디렉터리를 찾을 수 없습니다: ${resolved}`);
  }
  return resolved;
}

function textResult(text) {
  return { content: [{ type: 'text', text }] };
}

/**
 * dashboard-server.mjs의 함수들은 실패 시 { statusCode, message }를 가진 Error를 던진다
 * (02 결정 기록의 statusCode 매핑 관례) — 그 message를 그대로 MCP 에러 텍스트로 전달한다.
 * Node 내부 에러가 여기 새어나오지 않도록 assertProjectDir가 항상 먼저 걸러내는 구조를
 * 유지한다(각 도구 핸들러에서 이 순서를 바꾸지 말 것).
 */
function errorResult(err) {
  return { content: [{ type: 'text', text: err.message }], isError: true };
}

/**
 * MCP 서버를 구성만 하고 전송(transport)에는 연결하지 않는다 — 테스트가 실제 stdio
 * 프로세스 없이도 도구 핸들러를 직접 호출할 수 있게 분리한다(verify-runner.mjs의
 * createRequestHandler()가 실제 소켓과 분리된 것과 같은 이유).
 */
export function createServer() {
  const server = new McpServer({ name: 'sodam-design-kit', version: '0.3.0' });

  server.registerTool(
    'list_runs',
    {
      title: '검증 실행 이력 조회',
      description:
        '지정한 프로젝트의 .design-kit/runs/ 실행 이력을 최신순으로 반환합니다(open 대시보드의 이력 목록과 동일한 데이터). ' +
        '이 도구는 판정을 새로 내리지 않습니다 — 이미 기록된 실행 결과를 그대로 보여줄 뿐입니다.',
      inputSchema: { projectDir: PROJECT_DIR_SCHEMA },
    },
    async ({ projectDir }) => {
      try {
        const resolved = assertProjectDir(projectDir);
        const runs = await listRuns(path.join(resolved, '.design-kit'));
        return textResult(JSON.stringify(runs, null, 2));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    'get_report',
    {
      title: '판정서 원문 조회',
      description:
        '지정한 runId의 판정서(.design-kit/reports/<runId>.md) 원문을 그대로 반환합니다. ' +
        'PASS/FAIL 판정과 그 근거(axe 위반 상세·콘솔 에러 등)가 이 안에 전부 들어 있습니다. ' +
        '스크린샷 목록도 두 번째 항목으로 함께 반환됩니다 — 그 안의 path 값을 get_screenshot의 ' +
        'screenshotPath 인자로 그대로 사용하세요.',
      inputSchema: { projectDir: PROJECT_DIR_SCHEMA, runId: z.string().describe(RUN_ID_EXAMPLE) },
    },
    async ({ projectDir, runId }) => {
      try {
        const resolved = assertProjectDir(projectDir);
        const content = await readReportContent(path.join(resolved, '.design-kit'), runId);
        // dashboard-server.mjs의 /api/reports/:runId가 이미 하는 것과 동일한 방식으로
        // "## screenshots" 섹션만 파싱해 구조화된 목록을 함께 준다(2b-1 결정 기록 재사용 —
        // screenshots는 runs/*.json에 없고 판정서 마크다운에만 있다는 걸 이번에 실측 확인).
        const screenshots = extractScreenshotPaths(content);
        return {
          content: [
            { type: 'text', text: content },
            { type: 'text', text: `스크린샷 목록: ${JSON.stringify(screenshots)}` },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    'get_screenshot',
    {
      title: '검증 스크린샷 조회',
      description:
        'get_report가 함께 반환하는 스크린샷 목록의 path 값으로 실제 PNG 이미지를 반환합니다 ' +
        '(예: reports/screenshots/<run>/360.png).',
      inputSchema: {
        projectDir: PROJECT_DIR_SCHEMA,
        screenshotPath: z.string().describe('get_report가 반환한 스크린샷 목록의 path 값'),
      },
    },
    async ({ projectDir, screenshotPath }) => {
      try {
        const resolved = assertProjectDir(projectDir);
        const buffer = await readScreenshotFile(path.join(resolved, '.design-kit'), screenshotPath);
        return { content: [{ type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' }] };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    'reverify',
    {
      title: '재검증 실행',
      description:
        '저장된 실행 기록(runId)과 같은 화면을 실제 브라우저로 다시 검증하고 PASS/FAIL 판정을 반환합니다. ' +
        '중요: 이 도구는 판정을 제공할 뿐입니다 — Claude Code 훅과 달리 완료 보고를 기계적으로 차단하지 ' +
        '않습니다. FAIL이 나오면 그 사실을 사용자에게 반드시 알리는 것은 이 도구를 호출하는 쪽(AI)의 ' +
        '책임입니다.',
      inputSchema: { projectDir: PROJECT_DIR_SCHEMA, runId: z.string().describe(RUN_ID_EXAMPLE) },
    },
    async ({ projectDir, runId }) => {
      try {
        const resolved = assertProjectDir(projectDir);
        const result = await reverifyRun(resolved, path.join(resolved, '.design-kit'), runId);
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// 진입점 판정은 fileURLToPath로(04_PROJECT_SPEC.md ALWAYS DO — 이 킷의 다른 스크립트와 동일 규칙).
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[mcp-server] 실패:', err.message);
    process.exitCode = 1;
  });
}
