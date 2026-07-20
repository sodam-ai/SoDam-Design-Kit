#!/usr/bin/env node
// SoDam-Design-Kit — 엔드투엔드 셀프테스트
// 대상 프로젝트를 상대로 (1) 정상 페이지 → PASS → 훅 no-op, (2) 접근성 위반 페이지(/broken) → FAIL → 훅 차단
// 을 실제로 재현해 "게이트가 장식이 아님"을 증명한다. .PRD/03_PHASES.md P1 완료 조건.
//
// 사용법: node scripts/e2e-selftest.mjs --fixture <Next.js+shadcn 프로젝트 경로>
// 전제: fixture 프로젝트에 의도적 접근성 위반 페이지가 /broken 경로로 존재해야 함(테스트 전용 자산).

import path from 'node:path';
import { startDevServer, verifyPage, judge } from './verify-runner.mjs';
import { writeReport } from './report-writer.mjs';
import { decide } from '../hooks/verify-gate.mjs';

function getArg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function assert(condition, message) {
  if (!condition) throw new Error(`[e2e-selftest] 실패: ${message}`);
}

async function runCase({ label, devServer, route, designKitDir }) {
  const result = await verifyPage({
    baseUrl: devServer.url,
    route,
    screenshotDir: path.join(designKitDir, 'reports', 'screenshots', `e2e-${Date.now()}`),
  });
  const judgement = judge(result);
  const { runId, status } = await writeReport({
    designKitDir,
    target: `e2e-selftest / ${label}`,
    verifyRunnerOutput: { devServer: { port: devServer.port, autoStarted: true }, ...result, ...judgement },
  });
  const gateResult = decide(path.dirname(designKitDir));
  return { label, runId, status, judgement, gateResult };
}

async function main() {
  const fixtureDir = getArg('fixture');
  if (!fixtureDir) {
    console.error('사용법: node scripts/e2e-selftest.mjs --fixture <경로>');
    process.exit(2);
  }
  const resolvedFixture = path.resolve(fixtureDir);
  const designKitDir = path.join(resolvedFixture, '.design-kit');

  console.log(`[e2e-selftest] dev server 기동 중... (${resolvedFixture})`);
  const devServer = await startDevServer(resolvedFixture);
  console.log(`[e2e-selftest] dev server 준비됨: ${devServer.url}`);

  try {
    console.log('\n--- 케이스 1: 정상 페이지 (/) → PASS 기대 ---');
    const passCase = await runCase({ label: '홈(정상)', devServer, route: '/', designKitDir });
    console.log(`  runId=${passCase.runId} status=${passCase.status} verdict=${passCase.judgement.verdict}`);
    console.log(`  훅 판정: ${JSON.stringify(passCase.gateResult)}`);
    assert(passCase.status === 'pass', `홈 페이지는 PASS여야 하는데 ${passCase.status} (사유: ${passCase.judgement.reasons.join(', ')})`);
    assert(passCase.gateResult.decision === undefined, '홈 페이지 PASS 후 훅이 차단하면 안 됨');

    console.log('\n--- 케이스 2: 접근성 위반 페이지 (/broken) → FAIL 기대 ---');
    const failCase = await runCase({ label: '/broken(의도적 위반)', devServer, route: '/broken', designKitDir });
    console.log(`  runId=${failCase.runId} status=${failCase.status} verdict=${failCase.judgement.verdict}`);
    console.log(`  사유: ${failCase.judgement.reasons.join(', ')}`);
    console.log(`  훅 판정: ${JSON.stringify(failCase.gateResult)}`);
    assert(failCase.status === 'fail', '/broken 페이지는 FAIL이어야 함 (axe 위반이 실제로 감지되지 않음 — 테스트 픽스처 또는 판정 로직 확인 필요)');
    assert(failCase.gateResult.decision === 'block', 'FAIL 직후 훅이 완료를 차단해야 하는데 차단하지 않음 — 게이트가 장식임');

    console.log('\n--- 케이스 3: 재검증 (같은 홈 페이지) → PASS 복귀 시 훅 재개방 확인 ---');
    const recoverCase = await runCase({ label: '홈(재검증)', devServer, route: '/', designKitDir });
    assert(recoverCase.status === 'pass', '재검증 홈 페이지는 다시 PASS여야 함');
    assert(recoverCase.gateResult.decision === undefined, 'PASS로 복귀한 뒤에는 훅이 차단을 풀어야 함');

    console.log('\n✅ [e2e-selftest] 전부 통과: PASS/FAIL 판정, 훅 차단/해제가 모두 실측으로 확인됨');
  } finally {
    await devServer.stop();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
