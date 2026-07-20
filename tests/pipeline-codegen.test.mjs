import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { matchComponent, codePathToImportPath, guessExportName, runCodegen } from '../scripts/pipeline-codegen.mjs';

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
