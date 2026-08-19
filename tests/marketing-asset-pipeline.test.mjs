import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { downloadFont } from '../scripts/font-pipeline.mjs';
import { renderAsset, validateAsset, writeMarketingAsset, ASSET_SPECS } from '../scripts/marketing-asset-pipeline.mjs';

const execFileAsync = promisify(execFile);
const SCRIPTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');
const PROJECT_ROOT = path.join(SCRIPTS_DIR, '..');

// 실제 네트워크로 Pretendard를 딱 1번만 받아 이후 모든 테스트가 로컬 복사로 재사용한다
// (font-pipeline.test.mjs의 "실제 네트워크 1회 검증" 전례와 같은 패턴 — 매 테스트마다
// 재다운로드하지 않아 결정적이고 빠르다. 외부 Fixture 저장소에 의존하지 않아 이 저장소
// 단독으로도 항상 재현 가능하다).
const FONT_CACHE_ROOT = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-fontcache-'));
await downloadFont('pretendard', FONT_CACHE_ROOT);
const CACHED_FONT_DIR = path.join(FONT_CACHE_ROOT, 'fonts', 'pretendard');
const CACHED_FONT_PATH = path.join(CACHED_FONT_DIR, 'Pretendard-Regular.otf');

async function seedFont(designKitDir) {
  const destDir = path.join(designKitDir, 'fonts', 'pretendard');
  await mkdir(destDir, { recursive: true });
  for (const f of await readdir(CACHED_FONT_DIR)) {
    await copyFile(path.join(CACHED_FONT_DIR, f), path.join(destDir, f));
  }
}

// --- ASSET_SPECS ---

test('ASSET_SPECS: og는 1200x630 (OG 이미지 표준 규격)', () => {
  assert.deepEqual(ASSET_SPECS.og, { width: 1200, height: 630, label: ASSET_SPECS.og.label });
});

test('ASSET_SPECS: poster는 1080x1350 (인스타그램 세로형 4:5)', () => {
  assert.equal(ASSET_SPECS.poster.width, 1080);
  assert.equal(ASSET_SPECS.poster.height, 1350);
});

test('ASSET_SPECS: banner는 1200x400 (og와 구분되는 3:1 가로형)', () => {
  assert.equal(ASSET_SPECS.banner.width, 1200);
  assert.equal(ASSET_SPECS.banner.height, 400);
});

test('ASSET_SPECS: businessCard는 1050x600 (3.5x2인치 @300dpi 실제 명함 인쇄 표준)', () => {
  assert.equal(ASSET_SPECS.businessCard.width, 1050);
  assert.equal(ASSET_SPECS.businessCard.height, 600);
});

// --- renderAsset ---

test('renderAsset: title만으로 지정 규격의 PNG를 실제로 생성한다', async () => {
  const { png, width, height } = await renderAsset({
    title: '테스트 제목',
    fontPath: CACHED_FONT_PATH,
    width: 1200,
    height: 630,
  });
  assert.equal(width, 1200);
  assert.equal(height, 630);
  const meta = await sharp(png).metadata();
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
});

test('renderAsset: subtitle이 있으면 함께 렌더된다(별도 크래시 없음)', async () => {
  const { png } = await renderAsset({
    title: '제목',
    subtitle: '부제입니다',
    fontPath: CACHED_FONT_PATH,
    width: 1200,
    height: 630,
  });
  const meta = await sharp(png).metadata();
  assert.equal(meta.format, 'png');
});

test('renderAsset: 빈 title은 거부', async () => {
  await assert.rejects(
    () => renderAsset({ title: '', fontPath: CACHED_FONT_PATH, width: 1200, height: 630 }),
    /title은/
  );
});

test('renderAsset: title 없이 호출하면 거부', async () => {
  await assert.rejects(
    () => renderAsset({ fontPath: CACHED_FONT_PATH, width: 1200, height: 630 }),
    /title은/
  );
});

test('renderAsset: fontPath 없이 호출하면 거부', async () => {
  await assert.rejects(() => renderAsset({ title: '제목', width: 1200, height: 630 }), /fontPath가 필요/);
});

test('renderAsset: extraLines가 있으면 함께 렌더된다(명함 용도, 별도 크래시 없음)', async () => {
  const { png, width, height } = await renderAsset({
    title: '홍길동',
    subtitle: '대표이사',
    extraLines: ['소담 스튜디오', '010-1234-5678', 'hong@example.com'],
    fontPath: CACHED_FONT_PATH,
    width: 1050,
    height: 600,
  });
  assert.equal(width, 1050);
  assert.equal(height, 600);
  const meta = await sharp(png).metadata();
  assert.equal(meta.format, 'png');
});

test('renderAsset: extraLines의 빈 문자열·공백 항목은 건너뛴다(크래시 없음)', async () => {
  const { png } = await renderAsset({
    title: '홍길동',
    extraLines: ['', '   ', '소담 스튜디오'],
    fontPath: CACHED_FONT_PATH,
    width: 1050,
    height: 600,
  });
  const meta = await sharp(png).metadata();
  assert.equal(meta.format, 'png');
});

test('renderAsset: extraLines 없이 호출해도 기존과 동일하게 동작한다(하위 호환)', async () => {
  const { png } = await renderAsset({
    title: '제목만',
    fontPath: CACHED_FONT_PATH,
    width: 1200,
    height: 630,
  });
  const meta = await sharp(png).metadata();
  assert.equal(meta.format, 'png');
});

// --- validateAsset ---

test('validateAsset: 규격·포맷·용량이 전부 맞으면 valid', async () => {
  const { png } = await renderAsset({ title: '제목', fontPath: CACHED_FONT_PATH, width: 1200, height: 630 });
  const result = await validateAsset(png, ASSET_SPECS.og);
  assert.equal(result.valid, true);
  assert.deepEqual(result.reasons, []);
});

test('validateAsset: 규격이 다르면 invalid + 사유 포함', async () => {
  const { png } = await renderAsset({ title: '제목', fontPath: CACHED_FONT_PATH, width: 800, height: 600 });
  const result = await validateAsset(png, ASSET_SPECS.og);
  assert.equal(result.valid, false);
  assert.match(result.reasons.join(', '), /규격 불일치/);
});

test('validateAsset: 포맷이 png가 아니면 invalid + 사유 포함', async () => {
  const jpegBuffer = await sharp({
    create: { width: 1200, height: 630, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();
  const result = await validateAsset(jpegBuffer, ASSET_SPECS.og);
  assert.equal(result.valid, false);
  assert.match(result.reasons.join(', '), /포맷이 png가 아님/);
});

test('validateAsset: 용량 한도를 넘으면 invalid + 사유 포함', async () => {
  const { png } = await renderAsset({ title: '제목', fontPath: CACHED_FONT_PATH, width: 1200, height: 630 });
  const result = await validateAsset(png, ASSET_SPECS.og, { maxBytes: 10 });
  assert.equal(result.valid, false);
  assert.match(result.reasons.join(', '), /용량 초과/);
});

// --- writeMarketingAsset ---

test('writeMarketingAsset: 기본 출력 경로에 실제 파일 생성 + AI-GENERATION-LOG 기록', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await seedFont(designKitDir);
    const result = await writeMarketingAsset({ projectDir: dir, assetType: 'og', title: 'Hello World' });

    assert.equal(result.outputPath, 'public/design-kit-assets/og-hello-world.png');
    const written = await readFile(path.join(dir, result.outputPath));
    const meta = await sharp(written).metadata();
    assert.equal(meta.width, 1200);
    assert.equal(meta.height, 630);

    const logContent = await readFile(result.logPath, 'utf-8');
    assert.match(logContent, /— image/);
    assert.match(logContent, /Hello World/);
    assert.match(logContent, /public\/design-kit-assets\/og-hello-world\.png/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeMarketingAsset: 특수문자만 다른 유사 제목이 slug 충돌해도 이전 파일을 덮어쓰지 않는다(2026-08-17 실측 발견 결함 회귀 방지)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await seedFont(designKitDir);
    const r1 = await writeMarketingAsset({ projectDir: dir, assetType: 'og', title: '세일 50%!!!' });
    const r2 = await writeMarketingAsset({ projectDir: dir, assetType: 'og', title: '세일 50%???' });
    assert.notEqual(r1.outputPath, r2.outputPath, '자동 생성 경로가 겹치면 안 됨(조용한 덮어쓰기 방지)');
    // 둘 다 실제로 디스크에 남아있어야 함(하나가 덮어써져 사라지면 안 됨)
    assert.equal(existsSync(path.join(dir, r1.outputPath)), true);
    assert.equal(existsSync(path.join(dir, r2.outputPath)), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeMarketingAsset: outputPath를 명시하면(자동 생성 아님) 충돌 회피 없이 그대로 사용(명시적 의도 존중)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await seedFont(designKitDir);
    const r1 = await writeMarketingAsset({ projectDir: dir, assetType: 'og', title: '첫 버전', outputPath: 'public/design-kit-assets/fixed.png' });
    const r2 = await writeMarketingAsset({ projectDir: dir, assetType: 'og', title: '두번째 버전', outputPath: 'public/design-kit-assets/fixed.png' });
    assert.equal(r1.outputPath, r2.outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeMarketingAsset: 한글 제목은 slug로 안전하게 변환된다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await seedFont(designKitDir);
    const result = await writeMarketingAsset({ projectDir: dir, assetType: 'og', title: '가을 신상품 출시!' });
    assert.match(result.outputPath, /^public\/design-kit-assets\/og-[a-z0-9가-힣-]+\.png$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeMarketingAsset: 재실행해도 폰트는 네트워크를 다시 타지 않는다(멱등성)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await seedFont(designKitDir);
    await writeMarketingAsset({ projectDir: dir, assetType: 'og', title: '첫 실행' });
    // 두 번째 호출도 seedFont로 미리 채워둔 폰트를 그대로 재사용(스킵 경로) — 에러 없이 완료되면 통과
    const result = await writeMarketingAsset({ projectDir: dir, assetType: 'og', title: '두번째 실행' });
    assert.equal(result.width, 1200);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeMarketingAsset: extraLines가 배열이 아니면(문자열 등) 명확히 거부한다 (2026-08-20 검증 라운드 실측 발견 결함 회귀 방지 — 문자열은 순회 가능해 조용히 글자 단위로 렌더된 뒤 로그 기록 단계에서야 원인불명 에러로 죽던 결함)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await seedFont(designKitDir);
    await assert.rejects(
      () => writeMarketingAsset({ projectDir: dir, assetType: 'businessCard', title: '홍길동', extraLines: '전화번호' }),
      /extraLines는 문자열 배열이어야 합니다/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeMarketingAsset: outputPath로 프로젝트 밖 탈출 시도는 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await seedFont(designKitDir);
    await assert.rejects(
      () =>
        writeMarketingAsset({
          projectDir: dir,
          assetType: 'og',
          title: '제목',
          outputPath: '../../outside.png',
        }),
      /프로젝트 루트 밖/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeMarketingAsset: 존재하지 않는 프로젝트 경로는 거부(2026-08-17 실측 발견 결함 회귀 방지 — setup-wizard.mjs와 동일 패턴)', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  const nonexistent = path.join(base, 'does-not-exist');
  try {
    await assert.rejects(
      () => writeMarketingAsset({ projectDir: nonexistent, assetType: 'og', title: '테스트' }),
      /프로젝트 디렉터리를 찾을 수 없습니다/
    );
    assert.equal(existsSync(nonexistent), false, '존재하지 않던 경로가 조용히 생성되면 안 됨');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('writeMarketingAsset: 프로젝트 경로가 디렉터리가 아니라 파일이면 Node 내부 에러 대신 같은 안내 문구로 거부한다 (2026-08-19 실측 발견 결함 회귀 방지)', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  const filePath = path.join(base, 'not-a-directory.txt');
  try {
    await writeFile(filePath, '이건 프로젝트 폴더가 아니라 파일입니다', 'utf-8');
    await assert.rejects(
      () => writeMarketingAsset({ projectDir: filePath, assetType: 'og', title: '테스트' }),
      (err) => {
        assert.match(err.message, /프로젝트 디렉터리를 찾을 수 없습니다/);
        assert.doesNotMatch(err.message, /ENOTDIR/, 'Node 내부 에러 메시지가 그대로 노출되면 안 됨');
        return true;
      }
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('writeMarketingAsset: 지원하지 않는 assetType은 거부', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await seedFont(designKitDir);
    await assert.rejects(
      () => writeMarketingAsset({ projectDir: dir, assetType: 'flyer', title: '제목' }),
      /지원하지 않는 assetType/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- 2차 증분(포스터·배너·명함) 왕복 — 56차 자신의 경고("og 검증 결과를 일반화하지 말 것")를
// 지켜 각 규격을 개별적으로 실제 렌더+검증까지 확인한다 ---

test('writeMarketingAsset: poster는 1080x1350 실제 파일을 생성한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await seedFont(designKitDir);
    const result = await writeMarketingAsset({ projectDir: dir, assetType: 'poster', title: '가을 신상품' });
    assert.equal(result.width, 1080);
    assert.equal(result.height, 1350);
    const written = await readFile(path.join(dir, result.outputPath));
    const meta = await sharp(written).metadata();
    assert.equal(meta.width, 1080);
    assert.equal(meta.height, 1350);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeMarketingAsset: banner는 1200x400 실제 파일을 생성한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await seedFont(designKitDir);
    const result = await writeMarketingAsset({ projectDir: dir, assetType: 'banner', title: '봄맞이 세일' });
    assert.equal(result.width, 1200);
    assert.equal(result.height, 400);
    const written = await readFile(path.join(dir, result.outputPath));
    const meta = await sharp(written).metadata();
    assert.equal(meta.width, 1200);
    assert.equal(meta.height, 400);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeMarketingAsset: businessCard는 1050x600 + extraLines가 AI-GENERATION-LOG에 기록된다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-kit-marketing-'));
  try {
    const designKitDir = path.join(dir, '.design-kit');
    await seedFont(designKitDir);
    const result = await writeMarketingAsset({
      projectDir: dir,
      assetType: 'businessCard',
      title: '홍길동',
      subtitle: '대표이사',
      extraLines: ['소담 스튜디오', '010-1234-5678'],
    });
    assert.equal(result.width, 1050);
    assert.equal(result.height, 600);
    const written = await readFile(path.join(dir, result.outputPath));
    const meta = await sharp(written).metadata();
    assert.equal(meta.width, 1050);
    assert.equal(meta.height, 600);

    const logContent = await readFile(result.logPath, 'utf-8');
    assert.match(logContent, /소담 스튜디오 \/ 010-1234-5678/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- CLI: 실제 프로세스 실행 ---
// satori/sharp는 npm 패키지 의존성이라(상대 경로 import가 아님) 스크립트를 OS 임시폴더로
// 복사하면 그 위치에서 node_modules를 못 찾아 조용히 실패한다(ERR_MODULE_NOT_FOUND).
// 대신 이 저장소 루트 밑에 임시 폴더를 만들면 Node의 상위 디렉터리 탐색이 저장소의 실제
// node_modules를 그대로 찾아낸다 — 스크립트 파일을 복사하지 않고 그 자리(scripts/)에 둔
// 채 **대상 프로젝트 경로만** 공백·한글로 만들어 04 ALWAYS DO 취지(조용한 실패 방지)를
// 지킨다(--project 인자 쪽 경로 처리가 이 스크립트의 실제 신규 위험 지점이기도 하다).
test('CLI: 대상 프로젝트 경로에 공백·한글이 있어도 실제로 실행되고 파일이 생성된다 (조용한 실패 방지)', async () => {
  const base = await mkdtemp(path.join(PROJECT_ROOT, 'tmp-cli-marketing-'));
  try {
    const projectDir = path.join(base, 'My 한글 프로젝트');
    await mkdir(projectDir, { recursive: true });
    const designKitDir = path.join(projectDir, '.design-kit');
    await seedFont(designKitDir);

    const { stdout } = await execFileAsync(process.execPath, [
      path.join(SCRIPTS_DIR, 'marketing-asset-pipeline.mjs'),
      '--project',
      projectDir,
      '--assetType',
      'og',
      '--title',
      'CLI 테스트',
    ]);

    assert.match(stdout, /outputPath/, '스크립트가 아무 출력도 없이 끝나면 main()이 안 돈 것');
    const parsed = JSON.parse(stdout);
    const written = await readFile(path.join(projectDir, parsed.outputPath));
    const meta = await sharp(written).metadata();
    assert.equal(meta.width, 1200);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('CLI: --extraLines가 "|" 구분자로 파싱돼 businessCard에 반영된다', async () => {
  const base = await mkdtemp(path.join(PROJECT_ROOT, 'tmp-cli-marketing-'));
  try {
    const projectDir = path.join(base, 'project');
    await mkdir(projectDir, { recursive: true });
    const designKitDir = path.join(projectDir, '.design-kit');
    await seedFont(designKitDir);

    const { stdout } = await execFileAsync(process.execPath, [
      path.join(SCRIPTS_DIR, 'marketing-asset-pipeline.mjs'),
      '--project',
      projectDir,
      '--assetType',
      'businessCard',
      '--title',
      '홍길동',
      '--subtitle',
      '대표이사',
      '--extraLines',
      '소담 스튜디오|010-1234-5678',
    ]);

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.width, 1050);
    assert.equal(parsed.height, 600);
    const written = await readFile(path.join(projectDir, parsed.outputPath));
    const meta = await sharp(written).metadata();
    assert.equal(meta.width, 1050);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('CLI: 필수 인자 없이 실행하면 사용법 안내와 함께 exit code 2', async () => {
  const dir = await mkdtemp(path.join(PROJECT_ROOT, 'tmp-cli-marketing-'));
  try {
    const projectDir = path.join(dir, 'project');
    await mkdir(projectDir, { recursive: true });
    await assert.rejects(
      () =>
        execFileAsync(process.execPath, [
          path.join(SCRIPTS_DIR, 'marketing-asset-pipeline.mjs'),
          '--project',
          projectDir,
        ]),
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
