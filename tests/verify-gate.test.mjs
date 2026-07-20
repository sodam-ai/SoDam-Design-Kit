import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { decide } from '../hooks/verify-gate.mjs';

test('.design-kit/ 자체가 없으면 즉시 no-op (오탐 방지 스코핑)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-gate-'));
  try {
    assert.deepEqual(decide(dir), {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runs/ 가 비어 있으면 no-op', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-gate-'));
  try {
    await mkdir(path.join(dir, '.design-kit', 'runs'), { recursive: true });
    assert.deepEqual(decide(dir), {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('최신 실행이 pass 면 no-op', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-gate-'));
  try {
    const runsDir = path.join(dir, '.design-kit', 'runs');
    await mkdir(runsDir, { recursive: true });
    await writeFile(path.join(runsDir, '2026-07-19-001.json'), JSON.stringify({ status: 'pass' }));
    assert.deepEqual(decide(dir), {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('최신 실행이 fail 이면 완료를 차단한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-gate-'));
  try {
    const runsDir = path.join(dir, '.design-kit', 'runs');
    await mkdir(runsDir, { recursive: true });
    await writeFile(path.join(runsDir, '2026-07-19-001.json'), JSON.stringify({ status: 'fail' }));
    const result = decide(dir);
    assert.equal(result.decision, 'block');
    assert.match(result.reason, /검증 게이트 FAIL/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('가장 최근 run만 본다 (과거 fail이 있어도 최신이 pass면 통과)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-gate-'));
  try {
    const runsDir = path.join(dir, '.design-kit', 'runs');
    await mkdir(runsDir, { recursive: true });
    await writeFile(path.join(runsDir, '2026-07-19-001.json'), JSON.stringify({ status: 'fail' }));
    await writeFile(path.join(runsDir, '2026-07-19-002.json'), JSON.stringify({ status: 'pass' }));
    assert.deepEqual(decide(dir), {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('최신 판정 파일이 손상되어 있으면 완료를 차단한다 (fail-closed — 조용히 통과시키지 않음)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-gate-'));
  try {
    const runsDir = path.join(dir, '.design-kit', 'runs');
    await mkdir(runsDir, { recursive: true });
    await writeFile(path.join(runsDir, '2026-07-20-001.json'), '{ this is not valid json', 'utf-8');
    const result = decide(dir);
    assert.equal(result.decision, 'block');
    assert.match(result.reason, /손상되어/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runs/ 자체를 읽을 수 없으면 완료를 차단한다 (fail-closed, 디렉터리가 아닌 상태로 재현)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-gate-'));
  try {
    await mkdir(path.join(dir, '.design-kit'), { recursive: true });
    // 권한 조작 없이 readdirSync가 실제로 던지게 만드는 이식 가능한 방법: runs를 디렉터리가 아닌 파일로 생성
    await writeFile(path.join(dir, '.design-kit', 'runs'), 'not a directory', 'utf-8');
    const result = decide(dir);
    assert.equal(result.decision, 'block');
    assert.match(result.reason, /읽을 수 없습니다/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
