import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  matchComponent,
  codePathToImportPath,
  guessExportName,
  runCodegen,
  findHardcodedStyleViolations,
  registerNewComponent,
} from '../scripts/pipeline-codegen.mjs';

test('matchComponent: figmaNodeId로 매핑을 찾음', () => {
  const map = [
    { figmaNodeId: '1:1', figmaName: '', codePath: 'src/components/ui/input.tsx' },
    { figmaNodeId: '421:3078', figmaName: 'Button', codePath: 'src/components/ui/button.tsx' },
  ];
  const matched = matchComponent(map, { figmaNodeId: '421:3078' });
  assert.equal(matched.codePath, 'src/components/ui/button.tsx');
});

test('matchComponent: figmaNodeId가 없으면 figmaName으로 폴백', () => {
  const map = [{ figmaNodeId: '', figmaName: 'Button', codePath: 'src/components/ui/button.tsx' }];
  const matched = matchComponent(map, { figmaNodeId: '999:999', figmaName: 'Button' });
  assert.equal(matched.codePath, 'src/components/ui/button.tsx');
});

test('matchComponent: 매칭 없으면 null', () => {
  const map = [{ figmaNodeId: '1:1', figmaName: 'Input', codePath: 'src/components/ui/input.tsx' }];
  assert.equal(matchComponent(map, { figmaNodeId: '404:404', figmaName: 'Nope' }), null);
});

test('codePathToImportPath: components.json의 aliases.ui를 그대로 사용 (하드코딩 없음)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-codegen-'));
  try {
    await writeFile(
      path.join(dir, 'components.json'),
      JSON.stringify({ aliases: { ui: '@/components/ui' } }),
      'utf-8'
    );
    const importPath = codePathToImportPath(dir, 'src/components/ui/button.tsx');
    assert.equal(importPath, '@/components/ui/button');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('codePathToImportPath: components.json 없으면 명확한 에러', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-codegen-'));
  try {
    assert.throws(() => codePathToImportPath(dir, 'src/components/ui/button.tsx'), /components\.json/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('guessExportName: 케밥 케이스를 PascalCase로 변환', () => {
  assert.equal(guessExportName('src/components/ui/button.tsx'), 'Button');
  assert.equal(guessExportName('src/components/ui/alert-dialog.tsx'), 'AlertDialog');
});

test('runCodegen: 매핑 없으면 명확한 에러 (Figma 재호출 없이 즉시 실패)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-codegen-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await writeFile(path.join(designKitDir, 'component-map.json'), '[]', 'utf-8');

    await assert.rejects(
      () => runCodegen({ projectDir: dir, designKitDir, figmaNodeId: '999:999' }),
      /매핑된 컴포넌트가 없습니다/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('runCodegen: 매핑된 컴포넌트로 프리뷰 라우트 생성 (전체 왕복)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-codegen-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await mkdir(designKitDir, { recursive: true });
    await mkdir(path.join(dir, 'src', 'app'), { recursive: true });
    await writeFile(
      path.join(dir, 'components.json'),
      JSON.stringify({ aliases: { ui: '@/components/ui' } }),
      'utf-8'
    );
    await writeFile(
      path.join(designKitDir, 'component-map.json'),
      JSON.stringify([{ figmaNodeId: '421:3078', figmaName: 'Button', codePath: 'src/components/ui/button.tsx' }]),
      'utf-8'
    );

    const result = await runCodegen({ projectDir: dir, designKitDir, figmaNodeId: '421:3078' });

    assert.equal(result.routePath, '/design-kit-preview/button');
    assert.equal(result.matchedComponent.figmaNodeId, '421:3078');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// findHardcodedStyleViolations: 04 DO NOT "하드코딩 hex·px 금지, 기존 토큰 우선"의
// 최초 코드 강제(2026-07-27 — M4). 대괄호 전체가 "순수" hex 또는 "순수" 숫자+px일 때만
// 위반으로 잡아야 하고, 기존 토큰(CSS 변수)을 참조하는 정상 패턴은 통과시켜야 한다.

test('findHardcodedStyleViolations: raw hex Tailwind 임의값을 잡아낸다', () => {
  const code = `<div className="bg-[#ffffff] text-black">hi</div>`;
  const violations = findHardcodedStyleViolations(code);
  assert.deepEqual(violations, ['-[#ffffff]']);
});

test('findHardcodedStyleViolations: 고정 px Tailwind 임의값을 잡아낸다', () => {
  const code = `<div className="w-[240px]">hi</div>`;
  const violations = findHardcodedStyleViolations(code);
  assert.deepEqual(violations, ['-[240px]']);
});

test('findHardcodedStyleViolations: 위반 없는 정상 코드는 빈 배열', () => {
  const code = `<div className="bg-primary text-primary-foreground rounded-lg px-2.5">hi</div>`;
  assert.deepEqual(findHardcodedStyleViolations(code), []);
});

test('findHardcodedStyleViolations: 실제 shadcn button.tsx의 CSS 변수 참조 패턴은 오탐 없음 (실측 대조)', () => {
  // 픽스처의 실제 src/components/ui/button.tsx에서 발췌 — 대괄호 안에 함수(min/color-mix)가
  // 기존 토큰(CSS 변수)을 인자로 받는 정상 패턴. "10px"·"12px"가 안에 섞여 있어도
  // 대괄호 전체가 순수 px가 아니므로 위반이 아니다.
  const realShadcnSnippet = `
    xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs",
    sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem]",
    secondary: "bg-secondary hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
  `;
  assert.deepEqual(findHardcodedStyleViolations(realShadcnSnippet), []);
});

// registerNewComponent: component-map에 매핑이 없는 신규 컴포넌트 등록 경로 (2026-07-27 — M4).

async function setupRegisterFixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-register-'));
  const designKitDir = path.join(dir, '.design-kit');
  await mkdir(designKitDir, { recursive: true });
  await mkdir(path.join(dir, 'src', 'app'), { recursive: true });
  await writeFile(path.join(dir, 'components.json'), JSON.stringify({ aliases: { ui: '@/components/ui' } }), 'utf-8');
  await writeFile(path.join(designKitDir, 'component-map.json'), '[]', 'utf-8');
  return { dir, designKitDir };
}

test('registerNewComponent: 정상 코드는 배치+매핑 등록+프리뷰 라우트까지 전체 왕복', async () => {
  const { dir, designKitDir } = await setupRegisterFixture();
  try {
    const sourceFile = path.join(dir, 'scratch-badge.tsx');
    await writeFile(
      sourceFile,
      `export function Badge({ children }) {\n  return <span className="bg-secondary text-secondary-foreground rounded-md px-2">{children}</span>;\n}\n`,
      'utf-8'
    );

    const result = await registerNewComponent({
      projectDir: dir,
      designKitDir,
      figmaNodeId: '500:1',
      figmaName: 'Badge',
      sourceFile,
      codePath: 'src/components/ui/badge.tsx',
    });

    assert.equal(result.routePath, '/design-kit-preview/badge');
    assert.ok(existsSync(path.join(dir, 'src', 'components', 'ui', 'badge.tsx')), '대상 위치에 코드가 배치돼야 함');

    const map = JSON.parse(await readFile(path.join(designKitDir, 'component-map.json'), 'utf-8'));
    assert.equal(map.length, 1);
    assert.equal(map[0].figmaNodeId, '500:1');
    assert.equal(map[0].codePath, 'src/components/ui/badge.tsx');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('registerNewComponent: 하드코딩 hex가 있으면 등록 자체를 거부 (04 DO NOT 코드 강제)', async () => {
  const { dir, designKitDir } = await setupRegisterFixture();
  try {
    const sourceFile = path.join(dir, 'scratch-bad.tsx');
    await writeFile(sourceFile, `export function Bad() {\n  return <div className="bg-[#123456]">x</div>;\n}\n`, 'utf-8');

    await assert.rejects(
      () =>
        registerNewComponent({
          projectDir: dir,
          designKitDir,
          sourceFile,
          codePath: 'src/components/ui/bad.tsx',
        }),
      /하드코딩된 값/
    );
    assert.ok(!existsSync(path.join(dir, 'src', 'components', 'ui', 'bad.tsx')), '거부되면 파일이 배치되면 안 됨');
    const map = JSON.parse(await readFile(path.join(designKitDir, 'component-map.json'), 'utf-8'));
    assert.deepEqual(map, [], '거부되면 component-map도 그대로 보존돼야 함');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('registerNewComponent: codePath가 프로젝트 루트 밖이면 거부 (06 경로 조작 차단)', async () => {
  const { dir, designKitDir } = await setupRegisterFixture();
  try {
    const sourceFile = path.join(dir, 'scratch-ok.tsx');
    await writeFile(sourceFile, `export function Ok() {\n  return <div className="bg-primary">x</div>;\n}\n`, 'utf-8');

    await assert.rejects(
      () =>
        registerNewComponent({
          projectDir: dir,
          designKitDir,
          sourceFile,
          codePath: '../../outside.tsx',
        }),
      /프로젝트 루트 밖/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('registerNewComponent: 이미 등록된 codePath면 거부 (재사용 경로와 혼동 방지)', async () => {
  const { dir, designKitDir } = await setupRegisterFixture();
  try {
    await writeFile(
      path.join(designKitDir, 'component-map.json'),
      JSON.stringify([{ figmaNodeId: '1:1', figmaName: 'Button', codePath: 'src/components/ui/button.tsx' }]),
      'utf-8'
    );
    const sourceFile = path.join(dir, 'scratch-dup.tsx');
    await writeFile(sourceFile, `export function Button() {\n  return <button className="bg-primary">x</button>;\n}\n`, 'utf-8');

    await assert.rejects(
      () => registerNewComponent({ projectDir: dir, designKitDir, sourceFile, codePath: 'src/components/ui/button.tsx' }),
      /등록돼 있습니다/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
