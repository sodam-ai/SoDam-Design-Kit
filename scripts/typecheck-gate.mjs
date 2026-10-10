#!/usr/bin/env node
// SoDam-Design-Kit — 타입 검사 게이트 (opt-in: verify-runner.mjs --typeCheck)
//
// 왜 필요한가 (2026-10-11 스파이크 실측): Next dev 서버는 타입 오류가 있어도 화면을 렌더한다.
// 그래서 방문한 화면 자신의 파일에 일부러 `const x: number = "str"`을 넣었더니 게이트는
// PASS(exit 0)를 냈고, 같은 상태에서 `tsc --noEmit`은 TS2322로 실패했다 — "검증을 통과해야만
// 완료"라는 이 킷의 약속이 타입 오류 앞에서 거짓이 될 수 있다는 뜻이다(AGENTS.md는 완료 조건에
// typecheck를 적어두었지만 이를 실행하는 코드가 없었다).
//
// 설계 결정 (opt-in · 제외 · fail-closed):
// 1) opt-in — 폰트·자산 게이트, 시각 회귀와 같은 이유다. 상시로 켜면 타입 오류가 이미 있는
//    기존 프로젝트의 "정상이던 완료 상태"를 예고 없이 FAIL로 뒤집는다(02 결정 기록 선례).
// 2) `.next/` 아래 생성 파일의 오류는 판정에서 제외하고 개수만 기록한다 — dev 서버가 만드는
//    `.next/dev/types/validator.ts`가 e2e 직후 잘린 조각으로 남아 TS1128을 내는 것이 실측으로
//    관찰됐다(원인은 미확정). 사용자 코드가 아닌 것으로 거짓 FAIL을 내면 게이트 신뢰가 깎인다.
// 3) 실행 불가(tsconfig·typescript 없음, 시간 초과, 해석 불가 비정상 종료)는 PASS가 아니라
//    unavailable로 돌려준다 — judge()가 FAIL 처리한다. 사용자가 요청한 검사를 못 돌렸는데
//    조용히 통과시키는 것이 이 킷에서 가장 나쁜 실패 모드다(04 ALWAYS DO).
// 4) `next build`/eslint는 일부러 쓰지 않는다 — build는 `.next`를 건드려 실행 중인 dev 서버와
//    충돌한다. `tsc --noEmit`은 아무것도 쓰지 않는다.
//
// 외부 명령은 spawn + 인자 배열만 사용한다(shell:true·문자열 조합 금지 — 04 DO NOT).

import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const TSC_TIMEOUT_MS = 180000;
const FILE_DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const GLOBAL_DIAGNOSTIC = /^error (TS\d+): (.*)$/;
const REASON_EXCERPT_MAX = 200;

/** tsc 출력 텍스트를 진단 목록으로 파싱한다. 이어지는 들여쓰기 줄(상세 설명)은 무시한다. */
export function parseTscOutput(text) {
  const diagnostics = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const fileMatch = line.match(FILE_DIAGNOSTIC);
    if (fileMatch) {
      diagnostics.push({
        file: fileMatch[1].replace(/\\/g, '/'),
        line: Number(fileMatch[2]),
        column: Number(fileMatch[3]),
        code: fileMatch[4],
        message: fileMatch[5],
      });
      continue;
    }
    const globalMatch = line.match(GLOBAL_DIAGNOSTIC);
    if (globalMatch) {
      diagnostics.push({ file: '(전역)', line: 0, column: 0, code: globalMatch[1], message: globalMatch[2] });
    }
  }
  return diagnostics;
}

/** `.next/` 아래(dev/빌드가 생성하는) 파일인지. `.nextish/`처럼 접두만 닮은 이름은 해당 없음. */
export function isGeneratedFile(file) {
  const normalized = String(file || '').replace(/\\/g, '/');
  return /(^|\/)\.next\//.test(normalized);
}

function runTscDefault({ projectDir, tscBin, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [tscBin, '--noEmit', '--pretty', 'false'], {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: `${stderr}${err.message}`, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code === null ? -1 : code, stdout, stderr, timedOut });
    });
  });
}

/** 판정서·사유에 절대경로(로컬 폴더 구조)가 남지 않도록 프로젝트 경로를 가린다(04 DO NOT). */
function scrubProjectPath(text, projectDir) {
  const forms = new Set([projectDir, projectDir.replace(/\\/g, '/')]);
  let result = String(text);
  for (const form of forms) result = result.split(form).join('<project>');
  return result;
}

/**
 * 대상 프로젝트에서 `tsc --noEmit`을 실행해 타입 오류를 판정한다.
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {object} [deps] - 테스트 주입용(runTsc·timeoutMs)
 * @returns {Promise<{status: 'ok'|'errors'|'unavailable', errors: object[], ignoredGeneratedCount: number, reason?: string, durationMs: number}>}
 */
export async function checkTypeScript({ projectDir }, { runTsc = runTscDefault, timeoutMs = TSC_TIMEOUT_MS } = {}) {
  const started = Date.now();
  const resolvedProjectDir = path.resolve(projectDir);
  const unavailable = (reason) => ({
    status: 'unavailable',
    reason,
    errors: [],
    ignoredGeneratedCount: 0,
    durationMs: Date.now() - started,
  });

  if (!existsSync(path.join(resolvedProjectDir, 'tsconfig.json'))) {
    return unavailable('tsconfig.json이 없어 타입 검사를 할 수 없습니다 (TypeScript 프로젝트가 아니거나 경로가 다릅니다).');
  }
  const tscBin = path.join(resolvedProjectDir, 'node_modules', 'typescript', 'bin', 'tsc');
  if (!existsSync(tscBin)) {
    return unavailable('node_modules/typescript가 없습니다 — 대상 프로젝트에서 npm install을 먼저 실행하세요.');
  }

  const result = await runTsc({ projectDir: resolvedProjectDir, tscBin, timeoutMs });
  if (result.timedOut) {
    return unavailable(`tsc가 ${Math.ceil(timeoutMs / 1000)}초 안에 끝나지 않아 중단했습니다 (시간 초과).`);
  }

  if (result.code === 0) {
    return { status: 'ok', errors: [], ignoredGeneratedCount: 0, durationMs: Date.now() - started };
  }

  const diagnostics = parseTscOutput(`${result.stdout}\n${result.stderr}`);
  if (diagnostics.length === 0) {
    const excerpt = scrubProjectPath(`${result.stderr || result.stdout}`.trim(), resolvedProjectDir).slice(0, REASON_EXCERPT_MAX);
    return unavailable(`tsc가 종료 코드 ${result.code}로 끝났지만 해석 가능한 오류 목록이 없습니다: ${excerpt || '(출력 없음)'}`);
  }

  const errors = diagnostics.filter((d) => !isGeneratedFile(d.file));
  const ignoredGeneratedCount = diagnostics.length - errors.length;
  return {
    status: errors.length > 0 ? 'errors' : 'ok',
    errors,
    ignoredGeneratedCount,
    durationMs: Date.now() - started,
  };
}
