import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseTscOutput, isGeneratedFile, checkTypeScript } from '../scripts/typecheck-gate.mjs';
import { judge } from '../scripts/verify-runner.mjs';
import { writeReport } from '../scripts/report-writer.mjs';

// 2026-10-11 스파이크 실측: 게이트가 PASS(exit 0)를 내는 같은 상태에서 `tsc --noEmit`은
// 방문한 화면 자신의 타입 오류(TS2322)로 실패했다 — "검증 통과 = 완료"라는 이 킷의 약속이
// 타입 오류 앞에서 거짓이 될 수 있다는 증거. 이 파일은 그 opt-in 게이트(--typeCheck)의 테스트다.

const VERIFY_RUNNER = fileURLToPath(new URL('../scripts/verify-runner.mjs', import.meta.url));

async function makeProject({ tsconfig = true, fakeTsc = null } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'typecheck-gate-'));
  if (tsconfig) await writeFile(path.join(dir, 'tsconfig.json'), '{}', 'utf-8');
  if (fakeTsc !== null) {
    const binDir = path.join(dir, 'node_modules', 'typescript', 'bin');
    await mkdir(binDir, { recursive: true });
    await writeFile(path.join(binDir, 'tsc'), fakeTsc, 'utf-8');
  }
  return dir;
}

test('parseTscOutput: 파일 진단 줄을 파일·줄·열·코드·메시지로 파싱하고, 이어지는 들여쓰기 줄은 무시한다', () => {
  const text = [
    "src/app/page.tsx(68,7): error TS2322: Type 'string' is not assignable to type 'number'.",
    "  Type 'string' is not assignable to type 'number'.",
    "src/lib/a.ts(1,1): error TS2307: Cannot find module 'x'.",
  ].join('\n');
  const parsed = parseTscOutput(text);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], {
    file: 'src/app/page.tsx',
    line: 68,
    column: 7,
    code: 'TS2322',
    message: "Type 'string' is not assignable to type 'number'.",
  });
  assert.equal(parsed[1].code, 'TS2307');
});

test('parseTscOutput: 파일 없는 전역 진단(error TSxxxx: ...)도 잡는다', () => {
  const parsed = parseTscOutput("error TS5058: The specified path does not exist: 'x'.");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].file, '(전역)');
  assert.equal(parsed[0].code, 'TS5058');
});

test('parseTscOutput: 진단이 아닌 출력·빈 입력은 빈 배열', () => {
  assert.deepEqual(parseTscOutput(''), []);
  assert.deepEqual(parseTscOutput('Found 0 errors.'), []);
});

test('isGeneratedFile: .next/ 아래 생성 파일만 true (역슬래시·중첩·접두 유사 이름 포함)', () => {
  assert.equal(isGeneratedFile('.next/dev/types/validator.ts'), true);
  assert.equal(isGeneratedFile('.next\\types\\routes.d.ts'), true);
  assert.equal(isGeneratedFile('packages/web/.next/types/x.ts'), true);
  assert.equal(isGeneratedFile('src/app/page.tsx'), false);
  assert.equal(isGeneratedFile('src/.nextish/page.tsx'), false);
  assert.equal(isGeneratedFile('src/next/page.tsx'), false);
});

test('checkTypeScript: tsconfig.json이 없으면 통과가 아니라 unavailable (조용한 통과 금지)', async () => {
  const dir = await makeProject({ tsconfig: false });
  try {
    const r = await checkTypeScript({ projectDir: dir });
    assert.equal(r.status, 'unavailable');
    assert.match(r.reason, /tsconfig\.json/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkTypeScript: node_modules/typescript가 없으면 unavailable', async () => {
  const dir = await makeProject({ tsconfig: true, fakeTsc: null });
  try {
    const r = await checkTypeScript({ projectDir: dir });
    assert.equal(r.status, 'unavailable');
    assert.match(r.reason, /typescript/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkTypeScript: 실제 프로세스로 tsc를 실행한다 — 인자 배열(--noEmit)·cwd가 프로젝트이고, 성공(exit 0)이면 ok', async () => {
  const fake = `
const fs = require('fs');
fs.writeFileSync('spawn-evidence.json', JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
process.exit(0);
`;
  const dir = await makeProject({ fakeTsc: fake });
  try {
    const r = await checkTypeScript({ projectDir: dir });
    assert.equal(r.status, 'ok');
    assert.deepEqual(r.errors, []);
    const evidence = JSON.parse(await readFile(path.join(dir, 'spawn-evidence.json'), 'utf-8'));
    assert.ok(evidence.argv.includes('--noEmit'), 'tsc에 --noEmit이 전달돼야 함');
    assert.equal(path.resolve(evidence.cwd), path.resolve(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkTypeScript: 실제 프로세스가 오류를 내면(exit 2) 사용자 코드 오류만 errors로 남고 .next 생성 파일 오류는 제외 개수로만 센다', async () => {
  const fake = `
process.stdout.write("src/app/page.tsx(68,7): error TS2322: Type 'string' is not assignable to type 'number'.\\n");
process.stdout.write(".next/dev/types/validator.ts(92,1): error TS1128: Declaration or statement expected.\\n");
process.exit(2);
`;
  const dir = await makeProject({ fakeTsc: fake });
  try {
    const r = await checkTypeScript({ projectDir: dir });
    assert.equal(r.status, 'errors');
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].file, 'src/app/page.tsx');
    assert.equal(r.errors[0].code, 'TS2322');
    assert.equal(r.ignoredGeneratedCount, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkTypeScript: 오류가 전부 .next 생성 파일뿐이면 ok (dev 서버가 남긴 손상 파일 때문에 거짓 FAIL을 내지 않음) — 제외 개수는 기록', async () => {
  const fake = `
process.stdout.write(".next/dev/types/validator.ts(92,1): error TS1128: Declaration or statement expected.\\n");
process.exit(2);
`;
  const dir = await makeProject({ fakeTsc: fake });
  try {
    const r = await checkTypeScript({ projectDir: dir });
    assert.equal(r.status, 'ok');
    assert.equal(r.ignoredGeneratedCount, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkTypeScript: 비정상 종료인데 해석 가능한 진단이 없으면 ok가 아니라 unavailable (fail-closed)', async () => {
  const fake = `
process.stderr.write("internal compiler crash\\n");
process.exit(1);
`;
  const dir = await makeProject({ fakeTsc: fake });
  try {
    const r = await checkTypeScript({ projectDir: dir });
    assert.equal(r.status, 'unavailable');
    assert.match(r.reason, /crash|종료 코드|해석/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkTypeScript: 시간 초과는 unavailable (프로세스를 종료하고 조용히 통과시키지 않음)', async () => {
  const fake = `setInterval(() => {}, 1000);`;
  const dir = await makeProject({ fakeTsc: fake });
  try {
    const r = await checkTypeScript({ projectDir: dir }, { timeoutMs: 300 });
    assert.equal(r.status, 'unavailable');
    assert.match(r.reason, /시간|초/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('judge: typeCheck 오류가 있으면 FAIL, 사유에 건수와 첫 위치가 들어간다', () => {
  const base = { renderOk: true, consoleErrors: [], axeCounts: { critical: 0, serious: 0, moderate: 0, minor: 0 }, screenshots: [1, 2, 3] };
  const j = judge(base, {
    typeCheck: {
      status: 'errors',
      errors: [{ file: 'src/app/page.tsx', line: 68, column: 7, code: 'TS2322', message: 'x' }],
      ignoredGeneratedCount: 0,
    },
  });
  assert.equal(j.verdict, 'FAIL');
  assert.match(j.reasons.join(' '), /타입 오류 1건/);
  assert.match(j.reasons.join(' '), /src\/app\/page\.tsx:68/);
});

test('judge: typeCheck가 unavailable이면 FAIL (요청한 검사를 못 돌렸는데 PASS를 내지 않음)', () => {
  const base = { renderOk: true, consoleErrors: [], axeCounts: { critical: 0, serious: 0, moderate: 0, minor: 0 }, screenshots: [1, 2, 3] };
  const j = judge(base, { typeCheck: { status: 'unavailable', reason: 'tsconfig.json이 없습니다', errors: [], ignoredGeneratedCount: 0 } });
  assert.equal(j.verdict, 'FAIL');
  assert.match(j.reasons.join(' '), /타입 검사를 실행할 수 없음/);
});

test('judge: typeCheck가 ok이거나 아예 안 넘기면(하위 호환) 기존 판정과 동일하게 PASS', () => {
  const base = { renderOk: true, consoleErrors: [], axeCounts: { critical: 0, serious: 0, moderate: 0, minor: 0 }, screenshots: [1, 2, 3] };
  assert.equal(judge(base).verdict, 'PASS');
  assert.equal(judge(base, { typeCheck: { status: 'ok', errors: [], ignoredGeneratedCount: 2 } }).verdict, 'PASS');
});

test('writeReport: typeCheck 결과가 판정서의 "## 타입 검사" 섹션에 기록된다 (오류 상세·제외 개수 포함)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'typecheck-report-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    const { reportPath } = await writeReport({
      designKitDir,
      target: 'typecheck test',
      verifyRunnerOutput: {
        devServer: { port: 3000, autoStarted: true },
        renderOk: true,
        consoleErrors: [],
        axeCounts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        axeViolations: [],
        screenshots: [{ viewport: '360', path: 'reports/screenshots/x/360.png' }],
        typeCheck: {
          status: 'errors',
          errors: [{ file: 'src/app/page.tsx', line: 68, column: 7, code: 'TS2322', message: "Type 'string' is not assignable to type 'number'." }],
          ignoredGeneratedCount: 1,
        },
        verdict: 'FAIL',
        reasons: ['타입 오류 1건'],
      },
    });
    const md = await readFile(reportPath, 'utf-8');
    assert.match(md, /## 타입 검사/);
    assert.match(md, /src\/app\/page\.tsx\(68,7\) TS2322/);
    assert.match(md, /\.next\/ 생성 파일.*1건/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('CLI: --typeCheck를 --project 없이 쓰면 조용히 무시하지 않고 exit 2로 거부한다 (fail-open 방지)', () => {
  const r = spawnSync(process.execPath, [VERIFY_RUNNER, '--url', 'http://127.0.0.1:1', '--typeCheck'], { encoding: 'utf-8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--project/);
});
