import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectAppDir, generatePreviewRoute, ensureGitignored } from '../scripts/preview-route.mjs';

test('detectAppDir: src/app 우선 감지', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-preview-'));
  try {
    await mkdir(path.join(dir, 'src', 'app'), { recursive: true });
    assert.equal(detectAppDir(dir), path.join('src', 'app'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('detectAppDir: src/app 없으면 app 폴백', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-preview-'));
  try {
    await mkdir(path.join(dir, 'app'), { recursive: true });
    assert.equal(detectAppDir(dir), 'app');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('detectAppDir: 둘 다 없으면 에러', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-preview-'));
  try {
    assert.throws(() => detectAppDir(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('generatePreviewRoute: 라우트 파일 생성 + 생성 마커 포함', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-preview-'));
  try {
    await mkdir(path.join(dir, 'src', 'app'), { recursive: true });
    const result = await generatePreviewRoute({
      projectDir: dir,
      componentName: 'Button',
      importPath: '@/components/ui/button',
    });
    assert.equal(result.routePath, '/design-kit-preview/button');
    const content = await readFile(result.filePath, 'utf-8');
    assert.match(content, /SoDam-Design-Kit 자동 생성/);
    assert.match(content, /import \{ Button \} from '@\/components\/ui\/button'/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('generatePreviewRoute: 우리가 만든 파일은 재생성(덮어쓰기) 허용', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-preview-'));
  try {
    await mkdir(path.join(dir, 'src', 'app'), { recursive: true });
    await generatePreviewRoute({ projectDir: dir, componentName: 'Button', importPath: '@/components/ui/button' });
    // 두 번째 호출도 성공해야 함 (마커가 있으니 우리 파일로 인식)
    const result = await generatePreviewRoute({ projectDir: dir, componentName: 'Button', importPath: '@/components/ui/button' });
    assert.equal(result.routePath, '/design-kit-preview/button');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('generatePreviewRoute: 우리가 안 만든 기존 파일이 있으면 충돌로 에러 (남의 파일 보호)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-preview-'));
  try {
    const routeDir = path.join(dir, 'src', 'app', 'design-kit-preview', 'button');
    await mkdir(routeDir, { recursive: true });
    await writeFile(path.join(routeDir, 'page.tsx'), '// 사용자가 직접 만든 페이지입니다');

    await assert.rejects(
      () => generatePreviewRoute({ projectDir: dir, componentName: 'Button', importPath: '@/components/ui/button' }),
      /충돌/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('generatePreviewRoute: h1이 포함된다 (axe moderate page-has-heading-one 회귀 방지, 2026-08-09) — 화면엔 안 보이게 시각적으로만 숨김(display:none 아님)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-preview-'));
  try {
    await mkdir(path.join(dir, 'src', 'app'), { recursive: true });
    const result = await generatePreviewRoute({
      projectDir: dir,
      componentName: 'Button',
      importPath: '@/components/ui/button',
    });
    const content = await readFile(result.filePath, 'utf-8');
    assert.match(content, /<h1[^>]*>/);
    assert.match(content, /Button 프리뷰/);
    // display:none이면 axe·스크린리더 둘 다 h1을 "없음" 취급한다 — sr-only 기법(clip)인지 확인
    assert.doesNotMatch(content, /display:\s*['"]?none/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('ensureGitignored: 최초 1회만 패턴을 추가한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-preview-'));
  try {
    const first = await ensureGitignored(dir, path.join('src', 'app'));
    assert.equal(first, true);
    const second = await ensureGitignored(dir, path.join('src', 'app'));
    assert.equal(second, false);

    const content = await readFile(path.join(dir, '.gitignore'), 'utf-8');
    const occurrences = content.split('src/app/design-kit-preview/').length - 1;
    assert.equal(occurrences, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
