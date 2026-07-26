import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveAlias, scanComponents, runSetup } from '../scripts/setup-wizard.mjs';

const execFileAsync = promisify(execFile);
const SCRIPTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');

async function readGitignore(dir) {
  try {
    return await readFile(path.join(dir, '.gitignore'), 'utf-8');
  } catch {
    return '';
  }
}

test('resolveAlias: "@/components/ui" → tsconfig paths 기준 상대경로로 해석', () => {
  const tsconfig = { compilerOptions: { paths: { '@/*': ['./src/*'] } } };
  assert.equal(resolveAlias('@/components/ui', tsconfig), path.join('src', 'components', 'ui'));
});

test('resolveAlias: 매칭되는 패턴이 없으면 에러', () => {
  assert.throws(() => resolveAlias('@/components/ui', { compilerOptions: { paths: {} } }));
});

test('scanComponents: components.json이 없으면 shadcn 미설치로 보고', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-setup-'));
  try {
    const result = await scanComponents(dir);
    assert.equal(result.installed, false);
    assert.deepEqual(result.components, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('scanComponents: components.json 별칭을 따라가 실제 .tsx 파일을 시드로 스캔', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-setup-'));
  try {
    await writeFile(
      path.join(dir, 'components.json'),
      JSON.stringify({ aliases: { ui: '@/components/ui' } })
    );
    await writeFile(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } })
    );
    const uiDir = path.join(dir, 'src', 'components', 'ui');
    await mkdir(uiDir, { recursive: true });
    await writeFile(path.join(uiDir, 'button.tsx'), 'export function Button() { return null; }');
    await writeFile(path.join(uiDir, 'card.tsx'), 'export function Card() { return null; }');
    await writeFile(path.join(uiDir, 'utils.ts'), '// .tsx 아님 — 스캔 대상 제외 확인용');

    const result = await scanComponents(dir);
    assert.equal(result.installed, true);
    assert.equal(result.components.length, 2);
    const names = result.components.map((c) => c.componentName).sort();
    assert.deepEqual(names, ['button', 'card']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runSetup: config.json + component-map.json 생성', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-setup-'));
  try {
    await writeFile(
      path.join(dir, 'components.json'),
      JSON.stringify({ aliases: { ui: '@/components/ui' } })
    );
    await writeFile(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } })
    );
    const uiDir = path.join(dir, 'src', 'components', 'ui');
    await mkdir(uiDir, { recursive: true });
    await writeFile(path.join(uiDir, 'button.tsx'), 'export function Button() { return null; }');

    const result = await runSetup(dir);
    assert.equal(result.skipped, false);
    assert.equal(result.seededComponents, 1);

    const config = JSON.parse(await readFile(result.configPath, 'utf-8'));
    assert.equal(config.framework, 'nextjs');
    assert.equal(config.gateEnabled, true);
    assert.equal(config.figmaFileUrl, undefined, 'figmaFileUrl 미지정 시 필드 자체가 없어야 함(선택 필드)');

    const map = JSON.parse(await readFile(result.mapPath, 'utf-8'));
    assert.equal(map.length, 1);
    assert.equal(map[0].codePath, 'src/components/ui/button.tsx');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runSetup: 이미 config.json이 있으면 기본적으로 건드리지 않는다 (멱등성)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-setup-'));
  try {
    await mkdir(path.join(dir, '.design-kit'), { recursive: true });
    await writeFile(path.join(dir, '.design-kit', 'config.json'), JSON.stringify({ marker: 'original' }));

    const result = await runSetup(dir);
    assert.equal(result.skipped, true);

    const stillOriginal = JSON.parse(await readFile(path.join(dir, '.design-kit', 'config.json'), 'utf-8'));
    assert.equal(stillOriginal.marker, 'original');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runSetup: --force면 기존 config.json을 재생성한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-setup-'));
  try {
    await mkdir(path.join(dir, '.design-kit'), { recursive: true });
    await writeFile(path.join(dir, '.design-kit', 'config.json'), JSON.stringify({ marker: 'original' }));

    const result = await runSetup(dir, { force: true });
    assert.equal(result.skipped, false);

    const regenerated = JSON.parse(await readFile(path.join(dir, '.design-kit', 'config.json'), 'utf-8'));
    assert.equal(regenerated.marker, undefined);
    assert.equal(regenerated.framework, 'nextjs');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runSetup: 존재하지 않는 프로젝트 경로면 조용히 성공하지 않고 명확히 실패한다 (재현된 결함 방지)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-setup-'));
  const missingDir = path.join(dir, 'does-not-exist');
  try {
    await assert.rejects(
      () => runSetup(missingDir),
      /프로젝트 디렉터리를 찾을 수 없습니다/
    );
    assert.equal(existsSync(missingDir), false, '존재하지 않던 경로에 폴더가 생성되면 안 됨');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runSetup: .design-kit/reports/screenshots/를 .gitignore에 등록한다 (02 문서화됐지만 미구현이던 결함 방지)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-setup-'));
  try {
    await runSetup(dir);
    const gitignore = await readGitignore(dir);
    assert.match(gitignore, /\.design-kit\/reports\/screenshots\//);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runSetup: 이미 setup이 끝난 프로젝트를 재실행해도(멱등 skip) gitignore는 계속 자가 치유한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-setup-'));
  try {
    await mkdir(path.join(dir, '.design-kit'), { recursive: true });
    await writeFile(path.join(dir, '.design-kit', 'config.json'), JSON.stringify({ marker: 'original' }));

    const result = await runSetup(dir);
    assert.equal(result.skipped, true, '기존 config는 여전히 보존(멱등)돼야 함');

    const gitignore = await readGitignore(dir);
    assert.match(gitignore, /\.design-kit\/reports\/screenshots\//, 'skip 경로에서도 gitignore는 채워져야 함');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runSetup: --force로 재실행해도 이미 확보한 Figma 매핑을 보존한다 (재현된 데이터 유실 방지)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-setup-'));
  try {
    await writeFile(
      path.join(dir, 'components.json'),
      JSON.stringify({ aliases: { ui: '@/components/ui' } })
    );
    await writeFile(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } })
    );
    const uiDir = path.join(dir, 'src', 'components', 'ui');
    await mkdir(uiDir, { recursive: true });
    await writeFile(path.join(uiDir, 'button.tsx'), 'export function Button() { return null; }');
    await writeFile(path.join(uiDir, 'card.tsx'), 'export function Card() { return null; }'); // 매핑 없는 신규 컴포넌트

    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await writeFile(path.join(designKitDir, 'config.json'), JSON.stringify({ marker: 'original' }));
    await writeFile(
      path.join(designKitDir, 'component-map.json'),
      JSON.stringify([
        {
          figmaNodeId: '421:3078',
          figmaName: 'Button',
          codePath: 'src/components/ui/button.tsx',
          propsHint: { variant: 'default' },
          lastVerified: '2026-07-20-001',
        },
      ])
    );

    await runSetup(dir, { force: true });

    const map = JSON.parse(await readFile(path.join(designKitDir, 'component-map.json'), 'utf-8'));
    const button = map.find((c) => c.codePath === 'src/components/ui/button.tsx');
    const card = map.find((c) => c.codePath === 'src/components/ui/card.tsx');

    assert.equal(button.figmaNodeId, '421:3078', '기존 Figma 매핑이 보존되어야 함');
    assert.equal(button.figmaName, 'Button');
    assert.equal(button.lastVerified, '2026-07-20-001');
    assert.equal(card.figmaNodeId, '', '매핑 없던 신규 컴포넌트는 기존과 동일하게 빈 값으로 시드');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// 위 테스트들은 runSetup()을 import해서 직접 부른다 — 실사용 경로인 "명령이 스크립트를 프로세스로
// 실행하는 구간"(commands/setup.md의 `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-wizard.mjs"`)은
// 검증되지 않고 있었다. 그 구간의 진입점 판정이 틀리면 아무 일도 안 일어나고 exit 0이라
// 사용자에겐 "성공한 것처럼" 보인다(가장 나쁜 실패 모드). hooks/verify-gate.mjs와 같은 결함이었다.
test('CLI: 경로에 공백·한글이 있어도 setup 스크립트가 실제로 실행된다 (조용한 실패 방지 — 2026-07-27 실측 발견 결함)', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-setup-'));
  try {
    const weirdDir = path.join(base, 'My 한글 폴더');
    await mkdir(weirdDir, { recursive: true });
    const scriptCopy = path.join(weirdDir, 'setup-wizard.mjs');
    await copyFile(path.join(SCRIPTS_DIR, 'setup-wizard.mjs'), scriptCopy);

    const projectDir = path.join(weirdDir, 'project');
    await mkdir(projectDir, { recursive: true });

    // 04 DO NOT "셸 문자열 조합 금지" 준수 — 인자 배열로만 실행(shell:true 없음)
    const { stdout } = await execFileAsync(process.execPath, [scriptCopy, '--project', projectDir]);

    assert.match(
      stdout,
      /\[setup\]/,
      '스크립트가 아무 출력도 없이 끝나면 main()이 안 돈 것 — 사용자에겐 성공으로 보이는 조용한 실패'
    );
    assert.ok(
      existsSync(path.join(projectDir, '.design-kit', 'config.json')),
      '공백·한글 경로에서도 config.json이 실제로 생성돼야 함'
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
