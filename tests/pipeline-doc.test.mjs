import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// 2026-10-11 스파이크: 게이트는 타입 오류가 있어도 PASS를 냈고(--typeCheck 게이트로 해결),
// 그러나 에이전트는 commands/pipeline.md를 글자 그대로 따른다(02 결정 기록: M1 3차 시도에서
// Figma URL을 요구하며 멈춘 사고). 표준 절차의 실제 명령줄에 --typeCheck가 없으면 게이트를
// 만들어도 표준 흐름에서는 한 번도 실행되지 않는다. "주의 문구"는 강제가 아니므로, 문서에
// 적힌 규칙이 조용히 사라지지 않도록 이 테스트가 고정한다.

const PIPELINE_MD = fileURLToPath(new URL('../commands/pipeline.md', import.meta.url));

async function loadLines() {
  return (await readFile(PIPELINE_MD, 'utf-8')).split('\n');
}

test('pipeline.md: 표준 절차의 verify-runner 명령줄에 --typeCheck가 들어 있다', async () => {
  const lines = await loadLines();
  const commandLines = lines.filter((l) => l.includes('scripts/verify-runner.mjs') && l.includes('--target'));
  assert.ok(commandLines.length >= 1, 'verify-runner 명령줄(--target 포함)을 찾지 못했다');
  for (const line of commandLines) {
    assert.ok(line.includes('--typeCheck'), `--typeCheck가 빠진 verify-runner 명령줄: ${line.slice(0, 120)}`);
  }
});

test('detail-page.md: 상세페이지 절차의 verify-runner 명령줄에도 --typeCheck가 들어 있다 (생성되는 [slug]/page.tsx도 TypeScript)', async () => {
  const text = await readFile(fileURLToPath(new URL('../commands/detail-page.md', import.meta.url)), 'utf-8');
  const commandLines = text.split('\n').filter((l) => l.includes('scripts/verify-runner.mjs') && l.includes('--target'));
  assert.ok(commandLines.length >= 1, 'verify-runner 명령줄(--target 포함)을 찾지 못했다');
  for (const line of commandLines) {
    assert.ok(line.includes('--typeCheck'), `--typeCheck가 빠진 verify-runner 명령줄: ${line.slice(0, 120)}`);
  }
});

test('pipeline.md: tsconfig 없는 프로젝트는 이 플래그를 뺀다는 조건이 명시돼 있다', async () => {
  const text = (await loadLines()).join('\n');
  assert.match(text, /tsconfig\.json/, 'tsconfig.json 조건 언급이 없다');
  assert.match(text, /타입 검사 FAIL 처리/, '타입 검사 FAIL 처리 지침 블록이 없다');
});

test('pipeline.md: 타입 오류가 표시 파일 밖(로직 파일)에 있으면 고치지 말고 중단·보고하도록 못박혀 있다 (01 §5 로직 불변경 제약)', async () => {
  const text = (await loadLines()).join('\n');
  const block = text.split('\n').find((l) => l.includes('타입 검사 FAIL 처리')) ?? '';
  assert.match(block, /로직/, '로직 파일 불변경 문구가 없다');
  assert.match(block, /중단/, '중단·보고 문구가 없다');
});

test('pipeline.md: 검사를 못 돌린 FAIL(실행 불가)은 재시도 대상이 아니라 환경 문제로 보고하도록 안내돼 있다', async () => {
  const text = (await loadLines()).join('\n');
  const block = text.split('\n').find((l) => l.includes('타입 검사 FAIL 처리')) ?? '';
  assert.match(block, /실행 불가|실행할 수 없음/, '실행 불가 FAIL 구분 문구가 없다');
});
