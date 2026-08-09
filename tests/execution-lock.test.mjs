import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { acquireLock, releaseLock, isProcessAlive } from '../scripts/execution-lock.mjs';

async function makeDesignKitDir() {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-lock-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  await mkdir(designKitDir, { recursive: true });
  return { projectDir, designKitDir };
}

test('acquireLock: .design-kit/가 아직 없어도(setup 안 거친 경우) 자동으로 만들고 획득한다', async () => {
  // report-writer.mjs의 writeReport()와 동일한 전제: verify-runner.mjs를 setup 없이
  // --project만으로 직접 실행하는 경로가 실제 테스트로 이미 존재함(tests/verify-runner.test.mjs
  // CLI 테스트들이 .design-kit 없는 mkdtemp 폴더로 --project를 준다) — 이 경로에서
  // ENOENT로 깨지면 stdout이 비어 CLI 호출 자체가 실패한다(실제 회귀로 재현 후 수정).
  const projectDir = await mkdtemp(path.join(tmpdir(), 'design-kit-lock-nosetup-'));
  const designKitDir = path.join(projectDir, '.design-kit');
  try {
    assert.ok(!existsSync(designKitDir), '전제: .design-kit가 아직 없어야 함');
    const result = await acquireLock(designKitDir);
    assert.equal(result.pid, process.pid);
    assert.ok(existsSync(result.lockPath));
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('acquireLock: 잠금이 없으면 즉시 획득하고 자기 PID를 기록한다', async () => {
  const { projectDir, designKitDir } = await makeDesignKitDir();
  try {
    const result = await acquireLock(designKitDir);
    assert.equal(result.pid, process.pid);
    const content = JSON.parse(await readFile(result.lockPath, 'utf-8'));
    assert.equal(content.pid, process.pid);
    assert.ok(content.acquiredAt);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('acquireLock: 살아있는 PID가 이미 잠금을 쥐고 있으면 거부한다', async () => {
  const { projectDir, designKitDir } = await makeDesignKitDir();
  try {
    await writeFile(
      path.join(designKitDir, '.lock'),
      JSON.stringify({ pid: 999999, acquiredAt: new Date().toISOString() }),
      'utf-8'
    );
    await assert.rejects(
      () => acquireLock(designKitDir, { isAlive: () => true }),
      /다른 실행이 이미 진행 중/
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('acquireLock: 죽은 PID가 남긴 잠금(stale)은 회수해 자기 것으로 덮어쓴다', async () => {
  const { projectDir, designKitDir } = await makeDesignKitDir();
  try {
    await writeFile(
      path.join(designKitDir, '.lock'),
      JSON.stringify({ pid: 999999, acquiredAt: '2026-01-01T00:00:00.000Z' }),
      'utf-8'
    );
    const result = await acquireLock(designKitDir, { isAlive: () => false });
    assert.equal(result.pid, process.pid);
    const content = JSON.parse(await readFile(result.lockPath, 'utf-8'));
    assert.equal(content.pid, process.pid);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('acquireLock: 손상된 잠금 파일은 조용히 덮어쓰지 않고 fail-closed로 막는다', async () => {
  const { projectDir, designKitDir } = await makeDesignKitDir();
  try {
    await writeFile(path.join(designKitDir, '.lock'), '{ 이건 유효한 JSON이 아님', 'utf-8');
    await assert.rejects(() => acquireLock(designKitDir), /손상/);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('acquireLock: 대상 프로젝트 .gitignore에 .design-kit/.lock을 최초 1회만 등록한다', async () => {
  const { projectDir, designKitDir } = await makeDesignKitDir();
  try {
    await acquireLock(designKitDir);
    await releaseLock(designKitDir);
    await acquireLock(designKitDir);

    const content = await readFile(path.join(projectDir, '.gitignore'), 'utf-8');
    const occurrences = content.split('.design-kit/.lock').length - 1;
    assert.equal(occurrences, 1);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('releaseLock: 자기 PID가 기록된 잠금만 삭제한다', async () => {
  const { projectDir, designKitDir } = await makeDesignKitDir();
  try {
    const { lockPath } = await acquireLock(designKitDir);
    assert.ok(existsSync(lockPath));
    await releaseLock(designKitDir);
    assert.ok(!existsSync(lockPath));
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('releaseLock: 다른 PID가 기록된 잠금은 실수로 지우지 않는다 (방어적 삭제)', async () => {
  const { projectDir, designKitDir } = await makeDesignKitDir();
  try {
    const lockPath = path.join(designKitDir, '.lock');
    await writeFile(lockPath, JSON.stringify({ pid: process.pid + 1, acquiredAt: new Date().toISOString() }), 'utf-8');
    await releaseLock(designKitDir);
    assert.ok(existsSync(lockPath));
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('releaseLock: 잠금 파일이 이미 없으면 조용히 넘어간다(정리 경로라 fail-open)', async () => {
  const { projectDir, designKitDir } = await makeDesignKitDir();
  try {
    await assert.doesNotReject(() => releaseLock(designKitDir));
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('isProcessAlive: 현재 프로세스 자신은 살아있다고 판정한다', () => {
  assert.equal(isProcessAlive(process.pid), true);
});

test('isProcessAlive: 존재하지 않는 PID는 죽어있다고 판정한다(ESRCH)', () => {
  // 실제로 존재할 가능성이 거의 없는 매우 큰 PID 값을 사용
  assert.equal(isProcessAlive(999999), false);
});
