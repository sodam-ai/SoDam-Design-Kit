#!/usr/bin/env node
// SoDam-Design-Kit — 실행 잠금 (.design-kit/.lock)
// "실행 1개" 원칙: 파이프라인·대시보드 재검증·MCP 호출이 동시에 돌면 runs/ 순번·dev
// server 포트가 충돌한다(04_PROJECT_SPEC.md 연결/동기화 스펙 2번). 이 모듈은 그 원칙을
// 코드로 강제하는 첫 구현이다 — Phase 2(open 대시보드)가 재검증 트리거를 추가하기 전에
// 반드시 먼저 있어야 하는 전제조건으로 독립 구현한다(대시보드 자체보다 먼저).

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const LOCK_FILENAME = '.lock';

/**
 * PID가 살아있는지 확인한다. `process.kill(pid, 0)`은 신호를 보내지 않고 존재 여부만
 * 확인하는 표준 기법이며 Windows에서도 동작한다(Node 내장 동작 — 별도 의존성 불필요,
 * 04 ALWAYS DO "공급망 최소화" 원칙 준수).
 *
 * 불확실하면(ESRCH가 아닌 다른 에러, 예: 권한 문제) "살아있다"로 간주한다 — 죽은 프로세스를
 * 오판해 아직 실행 중인 잠금을 뺏는 것이, 살아있는 프로세스를 오판해 잠금 회수를 미루는
 * 것보다 더 위험하다(포트·runs/ 순번 충돌 재발 — 27차 포트 오판과 같은 방향의 안전 원칙).
 */
export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err && err.code === 'ESRCH') return false;
    return true;
  }
}

async function ensureLockGitignored(projectDir) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const pattern = '.design-kit/.lock';
  const content = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : '';
  if (content.includes(pattern)) return false;

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  await writeFile(gitignorePath, `${content}${separator}${pattern}\n`, 'utf-8');
  return true;
}

/**
 * .design-kit/.lock을 획득한다.
 *
 * - 잠금이 없으면 즉시 획득.
 * - 잠금이 있고 기록된 PID가 살아있으면 거부(다른 실행이 진행 중).
 * - 잠금이 있고 기록된 PID가 죽어있으면 stale로 판정해 회수(비정상 종료 대비 — 자동
 *   삭제가 아니라 PID 생존 확인을 거친 뒤에만 회수, 04 스펙의 "오판 방지" 요구 그대로).
 * - 잠금 파일이 손상돼 파싱할 수 없으면 조용히 덮어쓰지 않고 fail-closed로 막는다
 *   (hooks/verify-gate.mjs의 decide()·02_DATA_MODEL.md 결정 기록과 같은 원칙 — 손상
 *   상태를 정상으로 오인해 통과시키지 않는다).
 *
 * @param {string} designKitDir - '.design-kit' 절대경로
 * @param {object} [opts]
 * @param {(pid: number) => boolean} [opts.isAlive] - 테스트 주입용(기본값 = 실제 PID 확인)
 */
export async function acquireLock(designKitDir, { isAlive = isProcessAlive } = {}) {
  // verify-runner.mjs를 setup 없이 --project만으로 직접 실행하는 경로에서는 이 시점에
  // .design-kit/가 아직 없을 수 있다(report-writer.mjs의 writeReport()와 동일한 전제 —
  // "setup을 거치지 않고도 .design-kit를 새로 만들 수 있는 유일한 경로" 주석 참조).
  // 잠금 파일을 쓰기 전에 폴더 존재를 먼저 보장한다.
  await mkdir(designKitDir, { recursive: true });
  await ensureLockGitignored(path.dirname(designKitDir));

  const lockPath = path.join(designKitDir, LOCK_FILENAME);

  if (existsSync(lockPath)) {
    let existing;
    try {
      existing = JSON.parse(readFileSync(lockPath, 'utf-8'));
    } catch (err) {
      throw new Error(
        `[lock] .design-kit/.lock 파일이 손상되어 읽을 수 없습니다 (${err.message}). ` +
          `다른 실행이 진짜로 없는지 확인한 뒤 "${lockPath}" 파일을 직접 삭제하고 다시 시도하세요.`
      );
    }
    if (existing && typeof existing.pid === 'number' && isAlive(existing.pid)) {
      throw new Error(
        `[lock] 다른 실행이 이미 진행 중입니다 (PID ${existing.pid}, 시작: ${existing.acquiredAt}). ` +
          `그 실행이 끝난 뒤 다시 시도하세요.`
      );
    }
    // 기록된 PID가 죽어있음 — 비정상 종료로 남은 stale 잠금으로 판정해 회수
  }

  await writeFile(
    lockPath,
    JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }, null, 2),
    'utf-8'
  );
  return { lockPath, pid: process.pid };
}

/**
 * 자신이 쥔 잠금만 해제한다(PID가 일치할 때만 삭제 — 다른 프로세스가 그 사이 새로
 * 획득한 잠금을 실수로 지우지 않기 위한 방어적 삭제). 정리(cleanup) 경로라 실패해도
 * 조용히 넘어간다(devServer.stop()과 동일한 fail-open — 판정 로직이 아니라 뒷정리이므로
 * hooks/verify-gate.mjs의 fail-closed 원칙과 충돌하지 않는다).
 */
export async function releaseLock(designKitDir) {
  const lockPath = path.join(designKitDir, LOCK_FILENAME);
  if (!existsSync(lockPath)) return;
  try {
    const existing = JSON.parse(readFileSync(lockPath, 'utf-8'));
    if (existing && existing.pid === process.pid) {
      await rm(lockPath, { force: true });
    }
  } catch {
    // 손상됐거나 이미 사라졌으면 해제할 것도 없음
  }
}
