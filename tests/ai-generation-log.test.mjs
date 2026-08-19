import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { redactSecrets, appendGenerationLog } from '../scripts/ai-generation-log.mjs';

const execFileAsync = promisify(execFile);
const SCRIPTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');

// --- redactSecrets ---

test('redactSecrets: 평범한 문장은 그대로 유지', () => {
  const { text, redactionCount } = redactSecrets('머그컵은 보온 12시간을 유지하는 프리미엄 텀블러입니다.');
  assert.equal(text, '머그컵은 보온 12시간을 유지하는 프리미엄 텀블러입니다.');
  assert.equal(redactionCount, 0);
});

test('redactSecrets: OpenAI 스타일 API 키(sk-...)를 제거', () => {
  const { text, redactionCount } = redactSecrets('내 키는 sk-abcd1234EFGH5678ijkl9012MNOP야');
  assert.match(text, /\[REDACTED:api-key\]/);
  assert.doesNotMatch(text, /sk-abcd1234/);
  assert.equal(redactionCount, 1);
});

test('redactSecrets: GitHub 토큰(ghp_...)을 제거', () => {
  const { text } = redactSecrets('토큰: ghp_1234567890abcdefghijklmnopqrstuvwx');
  assert.match(text, /\[REDACTED:github-token\]/);
  assert.doesNotMatch(text, /ghp_1234567890/);
});

test('redactSecrets: Bearer 토큰을 제거', () => {
  const { text } = redactSecrets('Authorization: Bearer abcdefghij1234567890');
  assert.match(text, /\[REDACTED:bearer-token\]/);
  assert.doesNotMatch(text, /abcdefghij1234567890/);
});

test('redactSecrets: .env 스타일 대입(KEY=value)에서 값만 제거, 이름은 보존', () => {
  const { text, redactionCount } = redactSecrets('설정: API_KEY=sup3rs3cr3tvalue123');
  assert.match(text, /API_KEY=\[REDACTED:env-assignment\]/);
  assert.doesNotMatch(text, /sup3rs3cr3tvalue123/);
  assert.equal(redactionCount >= 1, true);
});

test('redactSecrets: Windows 절대경로의 사용자명 구간을 제거(경로 구조는 보존)', () => {
  const { text } = redactSecrets('파일 위치는 C:\\Users\\홍길동\\Documents\\secret.txt 입니다');
  assert.match(text, /C:\\Users\\\[REDACTED:windows-user-path\]/);
  assert.doesNotMatch(text, /홍길동/);
});

test('redactSecrets: 40자 이상 고엔트로피 토큰을 캐치올로 제거', () => {
  const { text } = redactSecrets('임의 문자열: aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW1xY3zA5bC7dE9f');
  assert.match(text, /\[REDACTED:high-entropy-token\]/);
});

test('redactSecrets: 문자열이 아닌 입력은 빈 값으로 안전 처리', () => {
  const { text, redactionCount } = redactSecrets(undefined);
  assert.equal(text, '');
  assert.equal(redactionCount, 0);
});

// --- appendGenerationLog ---

test('appendGenerationLog: 파일이 없으면 헤더와 함께 새로 생성', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    const result = await appendGenerationLog({
      designKitDir,
      assetType: 'copy',
      model: 'Claude (Claude Code)',
      prompt: '머그컵 상세페이지 카피를 작성해줘',
      date: new Date('2026-08-17T05:00:00.000Z'),
    });
    const content = await readFile(result.logPath, 'utf-8');
    assert.match(content, /# AI Generation Log/);
    assert.match(content, /2026-08-17T05:00:00\.000Z — copy/);
    assert.match(content, /모델: Claude \(Claude Code\)/);
    assert.match(content, /머그컵 상세페이지 카피를 작성해줘/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendGenerationLog: 기존 항목을 지우지 않고 추가(append-only)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await appendGenerationLog({
      designKitDir,
      assetType: 'copy',
      model: 'Claude',
      prompt: '첫 번째 카피 요청',
      date: new Date('2026-08-17T05:00:00.000Z'),
    });
    await appendGenerationLog({
      designKitDir,
      assetType: 'copy',
      model: 'Claude',
      prompt: '두 번째 카피 요청',
      date: new Date('2026-08-17T06:00:00.000Z'),
    });
    const content = await readFile(path.join(designKitDir, 'AI-GENERATION-LOG.md'), 'utf-8');
    assert.match(content, /첫 번째 카피 요청/, '첫 항목이 남아있어야 함(덮어쓰기 없음)');
    assert.match(content, /두 번째 카피 요청/);
    assert.equal((content.match(/^## /gm) || []).length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendGenerationLog: 프롬프트의 시크릿이 파일에 원문으로 남지 않는다(공개 저장소 유출 방지)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    const result = await appendGenerationLog({
      designKitDir,
      assetType: 'copy',
      model: 'Claude',
      prompt: '이 프로젝트 API_KEY=sk-abcd1234EFGH5678ijkl9012MNOP 참고해서 카피 작성',
    });
    assert.equal(result.redactionCount > 0, true);
    const content = await readFile(result.logPath, 'utf-8');
    assert.doesNotMatch(content, /sk-abcd1234EFGH5678ijkl9012MNOP/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendGenerationLog: humanEdits·generatedFiles 미지정 시 기본값으로 안전하게 기록', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    const result = await appendGenerationLog({
      designKitDir,
      assetType: 'copy',
      model: 'Claude',
      prompt: '카피 요청',
    });
    const content = await readFile(result.logPath, 'utf-8');
    assert.match(content, /사람 편집: \(기록 없음\)/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendGenerationLog: generatedFiles가 있으면 목록으로 기록', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    const result = await appendGenerationLog({
      designKitDir,
      assetType: 'copy',
      model: 'Claude',
      prompt: '카피 요청',
      generatedFiles: ['src/data/products/mug-01.json'],
    });
    const content = await readFile(result.logPath, 'utf-8');
    assert.match(content, /생성\/반영 파일: src\/data\/products\/mug-01\.json/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendGenerationLog: 잘못된 assetType은 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await assert.rejects(
      () => appendGenerationLog({ designKitDir, assetType: 'video', model: 'Claude', prompt: 'x' }),
      /assetType은/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendGenerationLog: 빈 model·빈 prompt는 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await assert.rejects(
      () => appendGenerationLog({ designKitDir, assetType: 'copy', model: '', prompt: 'x' }),
      /model은/
    );
    await assert.rejects(
      () => appendGenerationLog({ designKitDir, assetType: 'copy', model: 'Claude', prompt: '' }),
      /prompt는/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendGenerationLog: 프롬프트 안에 코드블록(```)이 있어도 마크다운 펜스가 깨지지 않는다(2026-08-17 실측 발견 결함 회귀 방지)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    const trickyPrompt = '설명:\n```js\nconsole.log(1)\n```\n뒤에 이어지는 텍스트';
    await appendGenerationLog({ designKitDir, assetType: 'copy', model: 'Claude', prompt: trickyPrompt });
    // 같은 파일에 두 번째 항목을 추가 — 첫 항목이 코드펜스를 깨뜨렸다면 이 두 번째 항목의
    // "## " 헤딩까지 코드블록 안에 갇혀 마크다운 파서가 헤딩으로 인식하지 못하게 된다.
    await appendGenerationLog({ designKitDir, assetType: 'copy', model: 'Claude', prompt: '정상적인 두 번째 프롬프트' });

    const content = await readFile(path.join(designKitDir, 'AI-GENERATION-LOG.md'), 'utf-8');
    // 첫 항목을 감싸는 바깥 펜스는 안쪽 백틱 3개(```js...```)보다 길어야 한다(4개) —
    // 정확히 4개짜리 백틱 줄이 열기·닫기 한 쌍(2줄)만 있어야 함(안쪽 3개짜리는 그대로 보존).
    assert.match(content, /\n````\n설명:/, '바깥 펜스가 안쪽 코드블록보다 길게 감싸야 함');
    const fourBacktickLines = content.match(/^````$/gm) || [];
    assert.equal(fourBacktickLines.length, 2, '4개짜리 바깥 펜스는 열기·닫기 한 쌍만 있어야 함(첫 항목 전용)');
    assert.match(content, /정상적인 두 번째 프롬프트/);
    // 두 번째 항목은 안쪽에 백틱이 없으므로 기본 3개 펜스로 감싸져야 한다(과잉 확장 금지)
    assert.match(content, /\n```\n정상적인 두 번째 프롬프트\n```/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('appendGenerationLog: .design-kit 폴더가 없어도 자동 생성', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    assert.equal(existsSync(designKitDir), false);
    await appendGenerationLog({ designKitDir, assetType: 'copy', model: 'Claude', prompt: '카피' });
    assert.equal(existsSync(designKitDir), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- CLI: 실제 프로세스 실행 ---
// 04_PROJECT_SPEC.md ALWAYS DO — 새 CLI 스크립트마다 공백·한글 경로에서도 실제로 출력이
// 나오는지(조용한 실패 방지) 프로세스로 직접 실행해 검증한다(detail-page-pipeline.test.mjs와 동일 패턴).

test('CLI: 경로에 공백·한글이 있어도 ai-generation-log 스크립트가 실제로 실행된다 (조용한 실패 방지)', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  try {
    const weirdDir = path.join(base, 'My 한글 폴더');
    await mkdir(weirdDir, { recursive: true });
    const scriptCopy = path.join(weirdDir, 'ai-generation-log.mjs');
    await copyFile(path.join(SCRIPTS_DIR, 'ai-generation-log.mjs'), scriptCopy);

    const projectDir = path.join(weirdDir, 'project');
    await mkdir(projectDir, { recursive: true });
    const promptFile = path.join(weirdDir, 'prompt.txt');
    await writeFile(promptFile, '머그컵 카피 작성 요청', 'utf-8');

    // 04 DO NOT "셸 문자열 조합 금지" 준수 — 인자 배열로만 실행(shell:true 없음)
    const { stdout } = await execFileAsync(process.execPath, [
      scriptCopy,
      '--project',
      projectDir,
      '--assetType',
      'copy',
      '--model',
      'Claude',
      '--promptFile',
      promptFile,
    ]);

    assert.match(stdout, /logPath/, '스크립트가 아무 출력도 없이 끝나면 main()이 안 돈 것');
    const logContent = await readFile(path.join(projectDir, '.design-kit', 'AI-GENERATION-LOG.md'), 'utf-8');
    assert.match(logContent, /머그컵 카피 작성 요청/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('CLI: 존재하지 않는 프로젝트 경로는 거부하고 폴더를 만들지 않는다(2026-08-17 실측 발견 결함 회귀 방지)', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  const nonexistent = path.join(base, 'does-not-exist');
  try {
    const promptFile = path.join(base, 'prompt.txt');
    await writeFile(promptFile, '카피 요청', 'utf-8');
    await assert.rejects(
      () =>
        execFileAsync(process.execPath, [
          path.join(SCRIPTS_DIR, 'ai-generation-log.mjs'),
          '--project',
          nonexistent,
          '--assetType',
          'copy',
          '--model',
          'Claude',
          '--promptFile',
          promptFile,
        ]),
      (err) => {
        assert.equal(err.code, 1);
        assert.match(err.stderr, /프로젝트 디렉터리를 찾을 수 없습니다/);
        return true;
      }
    );
    assert.equal(existsSync(nonexistent), false, '존재하지 않던 경로가 조용히 생성되면 안 됨');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('CLI: --project가 디렉터리가 아니라 파일을 가리키면 Node 내부 에러 대신 같은 안내 문구로 거부한다 (2026-08-19 실측 발견 결함 회귀 방지)', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  const filePath = path.join(base, 'not-a-directory.txt');
  try {
    await writeFile(filePath, '이건 프로젝트 폴더가 아니라 파일입니다', 'utf-8');
    const promptFile = path.join(base, 'prompt.txt');
    await writeFile(promptFile, '카피 요청', 'utf-8');
    await assert.rejects(
      () =>
        execFileAsync(process.execPath, [
          path.join(SCRIPTS_DIR, 'ai-generation-log.mjs'),
          '--project',
          filePath,
          '--assetType',
          'copy',
          '--model',
          'Claude',
          '--promptFile',
          promptFile,
        ]),
      (err) => {
        assert.equal(err.code, 1);
        assert.match(err.stderr, /프로젝트 디렉터리를 찾을 수 없습니다/);
        assert.doesNotMatch(err.stderr, /ENOTDIR/, 'Node 내부 에러 메시지가 그대로 노출되면 안 됨');
        return true;
      }
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('CLI: 필수 인자 없이 실행하면 사용법 안내와 함께 exit code 2', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-ailog-'));
  try {
    const projectDir = path.join(dir, 'project');
    await mkdir(projectDir, { recursive: true });
    await assert.rejects(
      () => execFileAsync(process.execPath, [path.join(SCRIPTS_DIR, 'ai-generation-log.mjs'), '--project', projectDir]),
      (err) => {
        assert.equal(err.code, 2);
        assert.match(err.stderr, /사용법/);
        return true;
      }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
