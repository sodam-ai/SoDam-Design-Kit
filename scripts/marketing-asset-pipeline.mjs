#!/usr/bin/env node
// SoDam-Design-Kit — 마케팅 소재 파이프라인 (Phase 3, 03_PHASES.md L104) — 1차 증분
// 범위(2026-08-17 결정, 스파이크 후 착수): OG 이미지 1종만. 포스터·배너·명함·SNS 카드 등
// 나머지 규격과 ASSET-LEDGER.csv 이미지 확장(④번, 별도 증분)은 의도적으로 범위 밖.
//
// 착수 전 실측 스파이크(코드 미포함, 대화 기록 참조): satori(JSX→SVG)+sharp(SVG→PNG)를
// 이 PC에서 실제로 설치·실행해 한글 렌더까지 확인 완료. 이 과정에서 satori의 실제
// license 필드가 MPL-2.0임을 실측 확인(01_PRD.md §7이 이미 "알려짐"으로 적어뒀던 값과
// 일치 — 실측으로 확정). MPL 계열은 04 ALWAYS DO 원칙대로 "무수정 사용만" — 이 파일은
// satori/sharp를 npm 의존성으로만 import하고 그 소스를 전혀 수정하지 않는다.
//
// 데이터 흐름(03_PHASES.md 원문 그대로): 데이터 → Satori(JSX→SVG) → Sharp(PNG 변환).
// 폰트는 P2 폰트 파이프라인(font-pipeline.mjs)의 downloadFont()를 그대로 재사용한다
// (중복 구현 금지 — 03_PHASES.md 명시). Satori는 시스템 폰트를 쓰지 못하므로(공식 README)
// 폰트 파일 명시 로드가 필수이며, 이 재사용이 그 요구사항을 자동으로 충족시킨다.

import satori from 'satori';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadFont } from './font-pipeline.mjs';
import { appendGenerationLog } from './ai-generation-log.mjs';

/**
 * 지원 자산 규격 — 이번 증분은 og 1종뿐. 새 규격을 추가할 땐 여기 항목만 늘리면 된다
 * (렌더·검증 로직은 규격에 의존하지 않는 범용 구조).
 */
export const ASSET_SPECS = {
  og: { width: 1200, height: 630, label: 'OG 이미지 (Open Graph, 1200x630)' },
};

/** registerNewComponent()·writeProductData()와 동일한 경로 탈출 방지 패턴(04 DO NOT). */
function resolveSafePath(projectDir, relativePath) {
  const resolvedProjectDir = path.resolve(projectDir);
  const resolvedDest = path.resolve(resolvedProjectDir, relativePath);
  if (resolvedDest !== resolvedProjectDir && !resolvedDest.startsWith(resolvedProjectDir + path.sep)) {
    throw new Error(`경로가 프로젝트 루트 밖을 가리킵니다: ${relativePath}`);
  }
  return resolvedDest;
}

/**
 * title/subtitle을 Satori로 SVG 렌더 후 Sharp로 PNG 변환한다. Satori는 children을 텍스트
 * 노드로만 다뤄 별도 이스케이프가 필요 없다(dangerouslySetInnerHTML 자체가 존재하지 않는
 * API — 04 "텍스트는 이스케이프" 원칙이 구조적으로 지켜짐).
 * @param {object} opts
 * @param {string} opts.title - 필수, 빈 문자열 금지
 * @param {string} [opts.subtitle]
 * @param {string} opts.fontPath - 로컬 폰트 파일 절대경로(font-pipeline.downloadFont 결과 재사용)
 * @param {string} [opts.fontName] - Satori에 등록할 폰트 이름(기본 'Pretendard')
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {string} [opts.background]
 * @param {string} [opts.foreground]
 */
export async function renderAsset({
  title,
  subtitle = '',
  fontPath,
  fontName = 'Pretendard',
  width,
  height,
  background = '#0f172a',
  foreground = '#ffffff',
}) {
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('title은 비어있지 않은 문자열이어야 합니다.');
  }
  if (!fontPath) {
    throw new Error('fontPath가 필요합니다(font-pipeline.mjs의 downloadFont() 결과를 사용하세요).');
  }

  const fontData = await readFile(fontPath);

  const children = [
    {
      type: 'div',
      props: { style: { fontSize: 56, fontWeight: 700, lineHeight: 1.3 }, children: title },
    },
  ];
  if (subtitle && subtitle.trim().length > 0) {
    children.push({
      type: 'div',
      props: { style: { fontSize: 30, marginTop: 24, opacity: 0.85 }, children: subtitle },
    });
  }

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: `${width}px`,
          height: `${height}px`,
          background,
          color: foreground,
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: fontName,
        },
        children,
      },
    },
    { width, height, fonts: [{ name: fontName, data: fontData, weight: 400, style: 'normal' }] }
  );

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return { png, width, height };
}

/**
 * 생성된 PNG가 규격(정확한 가로·세로)·포맷(png)·용량 한도를 지키는지 검사한다.
 * 이 킷 최초의 비-웹코드 검증 기준(axe·Playwright와 무관) — verify-runner.judge()와 같은
 * 형태({valid, reasons})로 반환해 이 프로젝트의 판정 관례를 그대로 따른다.
 */
export async function validateAsset(pngBuffer, spec, { maxBytes = 5 * 1024 * 1024 } = {}) {
  const reasons = [];
  const meta = await sharp(pngBuffer).metadata();

  if (meta.format !== 'png') reasons.push(`포맷이 png가 아님: ${meta.format}`);
  if (meta.width !== spec.width || meta.height !== spec.height) {
    reasons.push(`규격 불일치: ${meta.width}x${meta.height} (기대: ${spec.width}x${spec.height})`);
  }
  if (pngBuffer.length > maxBytes) {
    reasons.push(`용량 초과: ${pngBuffer.length}바이트 (한도: ${maxBytes}바이트)`);
  }

  return { valid: reasons.length === 0, reasons, width: meta.width, height: meta.height, bytes: pngBuffer.length };
}

/**
 * 렌더 → 검증 → 배치 → AI 생성 이력 기록까지 한 번에 수행한다(pipeline.md 스크립트 단계와
 * 동일한 통합 원칙 — "검증과 기록은 별개"로 만들지 말 것, 02_DATA_MODEL.md 결정 기록 참조).
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {string} opts.assetType - ASSET_SPECS 키 (현재 'og'만)
 * @param {string} opts.title
 * @param {string} [opts.subtitle]
 * @param {string} [opts.outputPath] - 기본값 "public/design-kit-assets/<assetType>-<slug>.png"
 * @param {string} [opts.fontKey] - font-pipeline.FONT_WHITELIST 키, 기본 'pretendard'
 * @param {string} [opts.model] - AI-GENERATION-LOG에 남길 모델명
 */
export async function writeMarketingAsset({
  projectDir,
  assetType,
  title,
  subtitle = '',
  outputPath,
  fontKey = 'pretendard',
  model = 'Claude (Claude Code)',
}) {
  const spec = ASSET_SPECS[assetType];
  if (!spec) {
    throw new Error(`지원하지 않는 assetType입니다: ${assetType} (지원: ${Object.keys(ASSET_SPECS).join(', ')})`);
  }

  const resolvedProjectDir = path.resolve(projectDir);
  // setup-wizard.mjs가 2026-07-20에 이미 겪고 고친 결함과 같은 패턴 방지 — 존재하지 않는
  // 프로젝트 경로(오타 등)를 조용히 새로 만들어버리면 사용자가 "성공"으로 오인할 수 있다.
  if (!existsSync(resolvedProjectDir)) {
    throw new Error(`프로젝트 디렉터리를 찾을 수 없습니다: ${resolvedProjectDir}`);
  }
  const designKitDir = path.join(resolvedProjectDir, '.design-kit');

  // 폰트는 P2 파이프라인 재사용 — 이미 있으면 네트워크 재호출 없이 건너뜀(downloadFont의
  // 기존 멱등성 그대로 재사용).
  const font = await downloadFont(fontKey, designKitDir);
  const fontFile = font.files.find((f) => !f.skipped) || font.files[0];
  const fontPath = fontFile.path;

  const { png, width, height } = await renderAsset({ title, subtitle, fontPath, width: spec.width, height: spec.height });

  const validation = await validateAsset(png, spec);
  if (!validation.valid) {
    throw new Error(`생성된 소재가 검증 기준을 통과하지 못했습니다: ${validation.reasons.join(', ')}`);
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'asset';

  let resolvedOutputPath = outputPath;
  if (!resolvedOutputPath) {
    // 자동 생성 경로만 충돌을 검사한다 — 사용자가 --output을 직접 지정했다면 그 경로에
    // 쓰는 것 자체가 명시적 의도이므로 존중한다(덮어쓰기 여부 판단을 대신하지 않음).
    // 자동 생성일 때는 서로 다른 제목이라도 특수문자만 다르면 같은 slug로 겹칠 수 있다
    // (예: "세일 50%!!!" vs "세일 50%???" — 2026-08-17 실측 발견) — 조용한 덮어쓰기로
    // 이전 이미지 파일이 사라지는 걸 막기 위해, 이미 존재하는 경로면 짧은 구분자를 붙인다.
    const base = `public/design-kit-assets/${assetType}-${slug}`;
    let candidate = `${base}.png`;
    if (existsSync(resolveSafePath(resolvedProjectDir, candidate))) {
      candidate = `${base}-${Date.now().toString(36)}.png`;
    }
    resolvedOutputPath = candidate;
  }
  const dest = resolveSafePath(resolvedProjectDir, resolvedOutputPath);

  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, png);

  const logResult = await appendGenerationLog({
    designKitDir,
    assetType: 'image',
    model,
    prompt: `제목: ${title}${subtitle ? `\n부제: ${subtitle}` : ''}`,
    humanEdits: '',
    generatedFiles: [resolvedOutputPath],
  });

  return { outputPath: resolvedOutputPath, width, height, bytes: validation.bytes, logPath: logResult.logPath };
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const projectDir = path.resolve(getArg('project') || process.cwd());
  const assetType = getArg('assetType');
  const title = getArg('title');

  if (!assetType || !title) {
    console.error(
      `사용법: marketing-asset-pipeline.mjs --project <경로> --assetType <${Object.keys(ASSET_SPECS).join('|')}> --title <제목> [--subtitle <부제>] [--output <상대경로>] [--fontKey <pretendard|noto-sans-kr>]`
    );
    process.exit(2);
  }

  const result = await writeMarketingAsset({
    projectDir,
    assetType,
    title,
    subtitle: getArg('subtitle') || '',
    outputPath: getArg('output'),
    fontKey: getArg('fontKey') || 'pretendard',
  });
  console.log(JSON.stringify(result, null, 2));
}

// 진입점 판정은 fileURLToPath로(04_PROJECT_SPEC.md ALWAYS DO — 이 킷의 다른 스크립트와 동일 규칙).
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[marketing-asset-pipeline] 실패:', err.message);
    process.exitCode = 1;
  });
}
