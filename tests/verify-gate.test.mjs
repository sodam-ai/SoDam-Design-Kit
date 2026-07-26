import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { decide } from '../hooks/verify-gate.mjs';

const execFileAsync = promisify(execFile);
const HOOKS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks');

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

// 위 테스트들은 전부 decide()를 직접 import해서 부른다 — 즉 "판정 로직"만 검증한다.
// 하지만 실제 운영에서 Claude Code는 hooks.json을 통해 `node verify-gate.mjs`로 이 파일을
// **프로세스로 실행**하고, 그때 main()이 도는지는 파일 맨 아래 isMainModule 판정에 달려 있다.
// 그 판정이 틀리면 decide()가 아무리 정확해도 stdout이 비어 완료 차단이 통째로 사라진다.
// 그 구간이 여태 어떤 테스트에도 안 걸려 있어서 실제로 결함이 잠복해 있었다(2026-07-27 실측).
test('CLI: 경로에 공백·한글이 있어도 훅이 실제로 차단 판정을 출력한다 (조용한 실패 방지 — 2026-07-27 실측 발견 결함)', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-gate-'));
  try {
    // 플러그인이 실제로 놓이는 경로에는 공백("My Projects", "Program Files")이나
    // 한글(한글 Windows 계정명 → C:\Users\홍길동\...)이 흔하다. 옛 진입점 판정식은
    // new URL(import.meta.url).pathname을 썼는데 이 값엔 퍼센트 인코딩(%20, %ED%95%9C…)이
    // 남아 있어 process.argv[1](디코딩된 실경로)과 절대 같아지지 않았다 → main() 미실행 → exit 0.
    const weirdDir = path.join(base, 'My 한글 폴더');
    await mkdir(weirdDir, { recursive: true });
    const hookCopy = path.join(weirdDir, 'verify-gate.mjs');
    await copyFile(path.join(HOOKS_DIR, 'verify-gate.mjs'), hookCopy);

    // 차단돼야 마땅한 상태(최신 실행 = fail)를 갖춘 프로젝트를 만들고 그 안에서 훅을 실행
    const projectDir = path.join(weirdDir, 'project');
    const runsDir = path.join(projectDir, '.design-kit', 'runs');
    await mkdir(runsDir, { recursive: true });
    await writeFile(path.join(runsDir, '2026-01-01-001.json'), JSON.stringify({ status: 'fail' }), 'utf-8');

    // 04 DO NOT "셸 문자열 조합 금지" 준수 — 인자 배열로만 실행(shell:true 없음)
    const { stdout } = await execFileAsync(process.execPath, [hookCopy], { cwd: projectDir });

    assert.notEqual(
      stdout.trim(),
      '',
      '훅이 아무것도 출력하지 않으면 완료 차단이 사라진 것 — 게이트가 장식이 된다(01 §9 성공 기준 2번)'
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.decision, 'block', '공백·한글 경로에서도 FAIL 상태는 반드시 차단돼야 함');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
