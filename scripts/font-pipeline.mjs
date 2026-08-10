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
import { mkdir, writeFile, appendFile, readdir, readFile } from 'node:fs/promises';
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

// ---------------------------------------------------------------------------
// 폰트 게이트 C (opt-in, 2026-08-10) — 04_PROJECT_SPEC.md ALWAYS DO가 원래 "상시" 뉘앙스로
// 적어뒀지만, axe(항상 나쁜 것)와 달리 이 검사는 "이미 완료된 P1 픽스처·기존 사용자 프로젝트를
// 아무 예고 없이 FAIL로 뒤집을 수 있다"는 실질적 회귀 위험이 있다 — 폰트 파이프라인 A를 한 번도
// 안 써본 프로젝트는 정의상 ASSET-LEDGER.csv가 없거나 폰트가 하나도 안 실려 있어, 상시 게이트로
// 켜면 프로젝트가 이미 갖고 있던(=이 킷과 무관하게 원래 있던) 폰트 파일까지 전부 "미등록"으로
// FAIL 처리된다. 이는 visual-regression.mjs가 opt-in을 선택한 것과 같은 이유(정상 상태를 갑자기
// FAIL 남발로 뒤집으면 사용자가 게이트 자체를 꺼버리는 최악 시나리오)라 같은 패턴을 그대로 따른다
// — verify-runner.mjs --fontGate 플래그로만 켜지고, 안 쓰면 기존 4조건 판정과 완전히 동일하다.
// ---------------------------------------------------------------------------

const FONT_FILE_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2']);
// PRD 원문은 ".ttf/.otf/.woff2"만 나열하지만 .woff를 빼면 그 확장자만 골라 미등록 폰트를 넣는
// 사각지대가 생겨 게이트의 목적(저작권 불명 폰트 차단)이 무너진다 — 04 DO NOT 원칙 그대로 확장.
const FONT_SCAN_EXCLUDED_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.turbo', '.vercel']);

/**
 * 프로젝트 안의 폰트 파일(.ttf/.otf/.woff/.woff2)을 재귀 스캔한다. node_modules·.next 등
 * 빌드/의존성 산출물 디렉터리는 제외(그 안의 폰트는 사용자 자산이 아니라 잡음이라 스캔하면
 * 오탐만 늘어남). `.design-kit/fonts/`(이 킷이 관리하는 화이트리스트 폰트 보관 위치)는
 * 제외하지 않는다 — 오히려 여기가 "정상적으로 대장에 등록된 폰트"의 표본이라 게이트가
 * 이걸 오탐 없이 통과시키는지 검증하는 게 이 기능의 핵심 사례다.
 * 심볼릭 링크는 따라가지 않는다(순환 참조로 인한 무한 루프 방지).
 * 반환값은 프로젝트 루트 기준 상대경로(posix `/` 구분자)의 정렬된 배열.
 */
export async function scanProjectFontFiles(projectDir) {
  const found = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // 읽을 수 없는 디렉터리는 조용히 건너뜀(권한 문제 등 — 스캔 자체를 죽이지 않음)
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (FONT_SCAN_EXCLUDED_DIRS.has(entry.name)) continue;
        // eslint-disable-next-line no-await-in-loop -- 재귀 스캔이 의도(전체 트리를 순서대로 훑음)
        await walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (FONT_FILE_EXTENSIONS.has(ext)) {
          found.push(path.relative(projectDir, full).split(path.sep).join('/'));
        }
      }
    }
  }
  await walk(projectDir);
  return found.sort();
}

/** CSV 한 줄을 필드 배열로 파싱(csvEscape의 역연산) — 따옴표로 감싼 값 안의 `,`·`\n`·이스케이프된 `""`를 처리.
 * ASSET-LEDGER 전용 로직이 아닌 범용 파서라 detail-page-pipeline.mjs의 상품 데이터 CSV 파싱에도 재사용한다. */
export function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

/**
 * ASSET-LEDGER.csv에 등록된 파일명을, 게이트 스캔 결과와 바로 대조할 수 있도록 **프로젝트
 * 루트 기준 상대경로**로 정규화해 Set으로 반환한다. 대장의 파일명 컬럼은 `.design-kit/` 기준
 * 상대경로로 기록된다(font-pipeline.mjs의 기존 관례 — 예: "fonts/pretendard/Pretendard-Regular.otf").
 * 파일이 없으면 빈 Set(= 아무 것도 등록 안 됨, 스캔된 폰트가 있으면 전부 미등록으로 판정됨 —
 * 이게 정확한 동작이다: 대장이 아예 없다는 건 이 킷의 폰트 파이프라인을 한 번도 안 썼다는 뜻).
 */
export async function loadAssetLedgerFilenames(designKitDir) {
  const ledgerPath = path.join(designKitDir, 'ASSET-LEDGER.csv');
  if (!existsSync(ledgerPath)) return new Set();
  const content = await readFile(ledgerPath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const projectDir = path.dirname(designKitDir);
  const registered = new Set();
  for (let i = 1; i < lines.length; i += 1) {
    // 0번째 줄은 헤더("파일명,종류,...") — 데이터 행만 순회
    const [filename] = parseCsvLine(lines[i]);
    if (!filename) continue;
    const absolute = path.join(designKitDir, filename);
    registered.add(path.relative(projectDir, absolute).split(path.sep).join('/'));
  }
  return registered;
}

/**
 * 폰트 게이트 판정: 프로젝트를 스캔해 찾은 폰트 파일 중 ASSET-LEDGER.csv에 등록 안 된 것을
 * 미등록(violation)으로 분류한다. verify-runner.mjs가 --fontGate일 때만 호출한다(opt-in —
 * 파일 최상단 주석 참조). "왜 미등록인지"를 자동으로 판단하지 않는다(허용목록 밖 폰트의 라이선스
 * 적합성·로고 워드마크 여부는 04_PROJECT_SPEC.md가 요구하는 대로 사람의 판단 영역으로 남긴다 —
 * 이 게이트는 "등록됐는가/안 됐는가"만 기계적으로 확인하고, 등록 자체(대장에 행 추가)는 사람이나
 * font-pipeline.mjs 같은 별도 도구가 한다).
 */
export async function checkFontGate({ projectDir, designKitDir }) {
  const [scanned, registered] = await Promise.all([
    scanProjectFontFiles(projectDir),
    loadAssetLedgerFilenames(designKitDir),
  ]);
  // 2026-08-10 실측 발견·수정: 대소문자만 다르고 실제로는 같은 파일을 다른 파일로 오판하던 결함.
  // Windows·macOS 기본 파일시스템은 대소문자를 구분하지 않는다(생성 시 표기는 보존하지만 조회는
  // 대소문자 무관) — 그런데 원래는 문자열을 그대로 비교해서, 대장에 "Brand.ttf"로 적혀 있고
  // 실제 파일이 "BRAND.TTF"면(같은 파일, 대소문자 표기만 다름) "미등록"으로 잘못 판정했다. 특히
  // 04_PROJECT_SPEC.md가 명시한 "화이트리스트 밖 폰트는 대장에 직접 기록해 통과"라는 사람 개입
  // 경로에서 실제로 터지기 쉽다 — 사용자가 대장에 파일명을 손으로 적을 때 대소문자를 실제 파일과
  // 다르게 적기 쉬운데(Windows 탐색기는 대소문자를 사실상 무시해서 보여줌), 그러면 대장을 정확히
  // 채웠는데도 게이트가 계속 FAIL을 내는 혼란스러운 상황이 된다. 비교만 대소문자 무관으로 하고,
  // 위반 목록에 보여주는 파일명은 실제 스캔된 원본 표기를 그대로 쓴다(사용자가 실제 파일을 찾을 수
  // 있어야 하므로 소문자로 뭉개지 않음). **이 비교를 다시 대소문자 구분으로 되돌리지 말 것.**
  const registeredLower = new Set([...registered].map((f) => f.toLowerCase()));
  const violations = scanned.filter((f) => !registeredLower.has(f.toLowerCase())).map((file) => ({ file }));
  return { scannedCount: scanned.length, registeredCount: registered.size, violations };
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
