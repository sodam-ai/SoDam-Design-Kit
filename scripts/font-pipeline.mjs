#!/usr/bin/env node
// SoDam-Design-Kit — 폰트 파이프라인 A(전자동) [Phase 2]
// OFL 화이트리스트 폰트를 공식 출처에서만 다운로드 → 형식 검증(04 DO NOT: 다운로드 후 파일
// 형식 검증·실행 금지) → 라이선스 파일 동반 보존 → ASSET-LEDGER.csv 최초 생성(대장은 이
// 폰트부터 시작 — 02_DATA_MODEL.md) → next/font/local 모듈 생성.
//
// 이번 증분 범위: A(전자동 다운로드+대장+주입 모듈)만. B(반자동 3종 비교 스펙시트)·
// C(폰트 게이트 FAIL)는 의도적으로 범위 밖 — 03_PHASES.md·CHECKPOINT.md에 별도 기록.
//
// 화이트리스트 URL은 실제로 살아있는지 실측 확인 후 고정했다(2026-08-09) — 처음 시도한
// Pretendard 경로(짐작으로 지어낸 packages/.../static/*.woff2)는 실제로 404였고, GitHub
// API로 실제 저장소 구조를 확인해서야 올바른 경로(.otf, releases 태그 v1.3.9로 고정)를
// 찾았다. 짐작으로 URL을 박아넣지 않는다는 원칙을 스스로 지킨 사례.

import { existsSync } from 'node:fs';
import { mkdir, writeFile, appendFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GENERATED_MARKER = '// SoDam-Design-Kit 자동 생성 — 직접 수정하지 마세요 (font-pipeline 재실행 시 덮어써짐)';

/**
 * 공식 출처만 허용(04 DO NOT "허용목록 밖 URL에서 내려받지 마"). Pretendard는 재현성을 위해
 * 브랜치가 아니라 릴리스 태그(v1.3.9)로 고정 — main은 언제든 바뀔 수 있다.
 * Noto Sans KR은 Google의 공식 폰트 배포 저장소(google/fonts)를 그대로 쓴다(구조가
 * 안정적으로 유지되는 라이브 데이터 저장소라 이 저장소 자체가 이미 "고정 지점"의 역할을 함).
 */
export const FONT_WHITELIST = {
  pretendard: {
    displayName: 'Pretendard',
    files: [
      {
        filename: 'Pretendard-Regular.otf',
        url: 'https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf',
      },
    ],
    licenseFilename: 'LICENSE.txt',
    licenseUrl: 'https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/LICENSE',
    licenseName: 'OFL-1.1',
    sourceUrl: 'https://github.com/orioncactus/pretendard',
  },
  'noto-sans-kr': {
    displayName: 'Noto Sans KR',
    files: [
      {
        filename: 'NotoSansKR-Variable.ttf',
        url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf',
      },
    ],
    licenseFilename: 'OFL.txt',
    licenseUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/OFL.txt',
    licenseName: 'OFL-1.1',
    sourceUrl: 'https://fonts.google.com/noto/specimen/Noto+Sans+KR',
  },
};

/** 매직 바이트로 실제 폰트 파일인지 확인(04 DO NOT "다운로드 후 파일 형식 검증·실행 금지"의 구현). */
export function detectFontFormat(buffer) {
  if (!buffer || buffer.length < 4) return null;
  const magic4 = buffer.subarray(0, 4);
  const ascii4 = magic4.toString('latin1');
  if (ascii4 === 'OTTO') return 'otf';
  if (ascii4 === 'wOF2') return 'woff2';
  if (ascii4 === 'wOFF') return 'woff';
  if (magic4.equals(Buffer.from([0x00, 0x01, 0x00, 0x00]))) return 'ttf'; // sfnt TrueType 시그니처(ttf/otf 공용)
  if (ascii4 === 'true' || ascii4 === 'typ1') return 'ttf';
  return null;
}

/** fetchFn 주입 가능 — 테스트가 실제 네트워크를 타지 않고 가짜 응답으로 로직만 검증하기 위함. */
async function downloadBuffer(url, { fetchFn = fetch } = {}) {
  const res = await fetchFn(url);
  if (!res.ok) {
    throw Object.assign(new Error(`다운로드 실패: ${url} (HTTP ${res.status})`), { statusCode: 502 });
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * 화이트리스트 폰트 1종을 다운로드해 `.design-kit/fonts/<fontKey>/`에 저장한다.
 * 이미 저장돼 있으면(멱등성 — setup-wizard.mjs와 같은 원칙) 네트워크를 다시 타지 않고 건너뛴다.
 */
export async function downloadFont(fontKey, designKitDir, { fetchFn = fetch, force = false } = {}) {
  const entry = FONT_WHITELIST[fontKey];
  if (!entry) {
    throw Object.assign(
      new Error(`허용목록에 없는 폰트입니다: ${fontKey} (허용: ${Object.keys(FONT_WHITELIST).join(', ')})`),
      { statusCode: 400 }
    );
  }

  const fontDir = path.join(designKitDir, 'fonts', fontKey);
  await mkdir(fontDir, { recursive: true });

  const savedFiles = [];
  for (const file of entry.files) {
    const dest = path.join(fontDir, file.filename);
    if (!force && existsSync(dest)) {
      savedFiles.push({ filename: file.filename, path: dest, skipped: true });
      continue;
    }
    const buf = await downloadBuffer(file.url, { fetchFn });
    const format = detectFontFormat(buf);
    if (!format) {
      throw Object.assign(
        new Error(`다운로드한 파일이 폰트 형식이 아닙니다 — 저장·실행하지 않음: ${file.filename} (${file.url})`),
        { statusCode: 502 }
      );
    }
    await writeFile(dest, buf);
    savedFiles.push({ filename: file.filename, path: dest, format, bytes: buf.length, sourceUrl: file.url });
  }

  const licenseDest = path.join(fontDir, entry.licenseFilename);
  if (force || !existsSync(licenseDest)) {
    const licenseBuf = await downloadBuffer(entry.licenseUrl, { fetchFn });
    await writeFile(licenseDest, licenseBuf);
  }

  return {
    fontKey,
    displayName: entry.displayName,
    fontDir,
    files: savedFiles,
    licensePath: licenseDest,
    licenseName: entry.licenseName,
    sourceUrl: entry.sourceUrl,
  };
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const ASSET_LEDGER_HEADER = '파일명,종류,출처URL,라이선스,상업이용,출처표시,AI생성여부,날짜';

/**
 * ASSET-LEDGER.csv에 행을 추가한다. 파일이 없으면 헤더와 함께 새로 만든다 — 이 대장은
 * "첫 자산인 폰트부터 시작"한다(02_DATA_MODEL.md·03_PHASES.md 명시).
 */
export async function appendAssetLedger(designKitDir, rows, { date = new Date() } = {}) {
  const ledgerPath = path.join(designKitDir, 'ASSET-LEDGER.csv');
  const exists = existsSync(ledgerPath);
  const dateStr = date.toISOString().slice(0, 10);
  const lines = rows.map((r) =>
    [r.filename, r.kind, r.sourceUrl, r.license, r.commercialUse, r.attribution, r.aiGenerated, dateStr]
      .map(csvEscape)
      .join(',')
  );
  const body = lines.map((l) => `${l}\n`).join('');
  if (exists) {
    await appendFile(ledgerPath, body, 'utf-8');
  } else {
    await mkdir(designKitDir, { recursive: true });
    await writeFile(ledgerPath, `${ASSET_LEDGER_HEADER}\n${body}`, 'utf-8');
  }
  return { ledgerPath, created: !exists, rowsAdded: rows.length };
}

/**
 * 다운로드한 폰트를 next/font/local로 감싼 모듈을 생성한다. **대상 프로젝트의 layout.tsx 등
 * 기존 파일은 건드리지 않는다** — 01_PRD.md §5 "로직 불변경 제약"과 같은 원칙(공유 구조
 * 파일을 자동으로 고치지 않고, 새 파일만 만들어 사용자가 원할 때 직접 연결하게 한다).
 */
export async function generateFontModule({ projectDir, designKitDir, fontKey, files }) {
  const entry = FONT_WHITELIST[fontKey];
  const base = existsSync(path.join(projectDir, 'src')) ? path.join('src', 'lib') : 'lib';
  const outDir = path.join(projectDir, base, 'design-kit-fonts');
  const outPath = path.join(outDir, `${fontKey}.ts`);

  const relFontDir = path.relative(path.dirname(outPath), designKitDir).split(path.sep).join('/') + '/fonts/' + fontKey;
  const varName = fontKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const cssVar = `--font-${fontKey}`;
  const srcLines = files
    .filter((f) => f.filename)
    .map((f) => `    { path: '${relFontDir}/${f.filename}', weight: '400', style: 'normal' },`)
    .join('\n');

  const content = `${GENERATED_MARKER}
// ${entry.displayName} — ${entry.licenseName} 라이선스, 출처: ${entry.sourceUrl}
// 라이선스 원문: ${relFontDir}/${entry.licenseFilename}
// 사용법(직접 연결 — 자동으로 layout에 삽입되지 않음):
//   import { ${varName} } from '${base === 'lib' ? '@/lib' : '@/lib'}/design-kit-fonts/${fontKey}';
//   <html className={${varName}.variable}>
import localFont from 'next/font/local';

export const ${varName} = localFont({
  src: [
${srcLines}
  ],
  variable: '${cssVar}',
  display: 'swap',
});
`;

  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, content, 'utf-8');
  return { modulePath: outPath, varName, cssVar };
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const projectDir = path.resolve(getArg('project') || process.cwd());
  const fontKey = getArg('font');
  const force = args.includes('--force');

  if (!fontKey) {
    console.error(`사용법: font-pipeline.mjs --project <경로> --font <${Object.keys(FONT_WHITELIST).join('|')}> [--force]`);
    process.exit(2);
  }

  const designKitDir = path.join(projectDir, '.design-kit');
  const download = await downloadFont(fontKey, designKitDir, { force });
  const moduleResult = await generateFontModule({ projectDir, designKitDir, fontKey, files: download.files });
  const ledgerRows = download.files
    .filter((f) => f.format) // 이번에 실제로 새로 받은 파일만 대장에 기록 (skipped=true는 이미 이전에 기록됨)
    .map((f) => ({
      filename: `fonts/${fontKey}/${f.filename}`,
      kind: '폰트',
      sourceUrl: f.sourceUrl,
      license: download.licenseName,
      commercialUse: 'O',
      attribution: '불필요(OFL)',
      aiGenerated: 'N',
    }));
  const ledger = ledgerRows.length > 0 ? await appendAssetLedger(designKitDir, ledgerRows) : { created: false, rowsAdded: 0 };

  console.log(JSON.stringify({ download, module: moduleResult, ledger }, null, 2));
}

// 진입점 판정은 fileURLToPath로 (2026-07-27 실측 규칙 승격 — 공백·한글 경로에서 exit 0 무출력 방지).
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[font-pipeline] 실패:', err.message);
    process.exitCode = 1;
  });
}
