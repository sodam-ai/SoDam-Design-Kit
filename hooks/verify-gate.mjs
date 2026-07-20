#!/usr/bin/env node
// SoDam-Design-Kit — 완료 차단 훅 (Stop 이벤트)
// .design-kit/runs/ 에 최신 실행이 fail 상태일 때만 완료를 차단한다.
// .design-kit/ 자체가 없는 프로젝트(킷 미사용)에서는 즉시 no-op — 오탐 방지 스코핑(.PRD/04_PROJECT_SPEC.md 확정 결정).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** 순수 판정 함수 — cwd 기준 .design-kit/runs/의 최신 실행 상태를 읽어 차단 여부 결정. 테스트 용이성을 위해 분리. */
export function decide(cwd) {
  const runsDir = path.join(cwd, '.design-kit', 'runs');

  if (!existsSync(runsDir)) return {};

  let files;
  try {
    files = readdirSync(runsDir).filter((f) => f.endsWith('.json'));
  } catch (err) {
    // runs/는 있는데 못 읽는 상태(권한 등)는 "실행 기록 없음"과 다른 이상 상태 —
    // 조용히 통과시키면 게이트가 장식이 될 수 있어 fail-closed로 막는다(01 §9 성공 기준 2번과 직결).
    return {
      decision: 'block',
      reason:
        `[SoDam-Design-Kit] .design-kit/runs/ 를 읽을 수 없습니다 (${err.message}). ` +
        `생성된 코드의 문제가 아니라 파일 접근 문제입니다 — 권한을 확인하거나 사용자에게 보고하세요.`,
    };
  }
  if (files.length === 0) return {};

  // runId = 날짜-순번 형식이라 파일명 사전식 정렬이 곧 시간순 정렬
  files.sort();
  const latestFile = files[files.length - 1];
  const latestPath = path.join(runsDir, latestFile);

  let run;
  try {
    run = JSON.parse(readFileSync(latestPath, 'utf-8'));
  } catch {
    // 판정 파일 손상 시 조용히 통과(fail-open)시키지 않는다 — 같은 이유로 fail-closed.
    // 단, 코드 품질 FAIL과 헷갈리지 않도록 원인·조치를 다르게 안내한다(왕초보 눈높이, 01 §8).
    return {
      decision: 'block',
      reason:
        `[SoDam-Design-Kit] 판정 기록 파일이 손상되어 읽을 수 없습니다 (${latestFile}). ` +
        `생성된 코드의 문제가 아니라 기록 파일 자체의 문제입니다 — ` +
        `"${latestPath}" 파일을 지우고 파이프라인을 다시 실행하세요.`,
    };
  }

  if (run && run.status === 'fail') {
    return {
      decision: 'block',
      reason:
        `[SoDam-Design-Kit] 검증 게이트 FAIL 상태입니다 (${latestFile}). ` +
        `.design-kit/reports/의 판정서에서 실패 사유를 확인한 뒤 재시도하거나 사용자에게 보고하세요. ` +
        `PASS 판정서 없이 "완료"라고 보고하지 마세요.`,
    };
  }

  return {};
}

function main() {
  const result = decide(process.cwd());
  process.stdout.write(JSON.stringify(result));
}

// import만 해서 decide()를 재사용할 때(e2e-selftest.mjs, tests/)는 실행되면 안 되고,
// Claude Code가 hooks.json을 통해 `node verify-gate.mjs`로 직접 실행할 때만 동작해야 함.
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMainModule) {
  main();
}
