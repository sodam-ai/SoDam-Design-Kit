#!/usr/bin/env node
// SoDam-Design-Kit — 라이선스 게이트 확장 [Phase 3, 03_PHASES.md] — ASSET-LEDGER.csv를
// 이미지·아이콘류 자산으로 확장 + ATTRIBUTION.md 자동 생성.
//
// font-pipeline.mjs의 폰트 게이트(C, opt-in)와 정확히 같은 패턴(스캔 → 대장 대조 →
// 위반 목록, 대소문자 무관 비교, opt-in)을 이미지에 그대로 미러링한다. 대장 읽기/쓰기 자체는
// font-pipeline.mjs가 이미 종류(kind)에 무관하게 범용으로 설계해둔 함수
// (appendAssetLedger·parseCsvLine·loadAssetLedgerFilenames)를 그대로 재사용한다 —
// 중복 구현하지 않는다.
//
// ⚠️ 핵심 경계(02_DATA_MODEL.md 1m 결정 기록): marketing-asset-pipeline.mjs가 만드는 이미지
// (public/design-kit-assets/)는 이 게이트의 대상이 아니다 — 그건 외부 출처 자산이 아니라 이
// 킷 코드의 산출물이고, AI-GENERATION-LOG.md가 그 산출물의 정본 이력이다. 이 게이트를 거기까지
// 넓히면 1m 결정을 뒤집는 것이고, 매번 마케팅 이미지를 만들 때마다 "미등록" FAIL이 나는 자기
// 모순적인 게이트가 된다. .design-kit/reports/screenshots·baseline(검증 스크린샷·시각회귀
// 기준본)도 같은 이유로 제외한다 — 프로젝트가 가져온 외부 자산이 아니라 이 킷 자신의 검증
// 산출물이다.

import { existsSync } from 'node:fs';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvLine } from './font-pipeline.mjs';

const IMAGE_FILE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.avif']);
const IMAGE_SCAN_EXCLUDED_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.turbo', '.vercel']);
const MARKETING_ASSET_OUTPUT_DIR = path.join('public', 'design-kit-assets');

/**
 * 프로젝트 안의 이미지·아이콘 파일을 재귀 스캔한다(scanProjectFontFiles와 동일 구조).
 * font-pipeline.mjs의 폰트 스캔과 다른 점 2가지(둘 다 위 파일 상단 경계 설명 참조):
 * (1) `.design-kit/` 전체를 건너뛴다 — 폰트 게이트는 `.design-kit/fonts/`를 "정상 등록된
 *     표본"으로 취급해 일부러 포함시키지만, 이미지는 `.design-kit/` 안이 전부 검증
 *     스크린샷·시각회귀 기준본(이 킷 자신의 산출물)이라 스캔하면 검증할 때마다 수백 건의
 *     가짜 위반이 쌓인다.
 * (2) `public/design-kit-assets/`를 건너뛴다 — marketing-asset-pipeline.mjs의 산출물
 *     전용 경로. 여기 있는 이미지는 AI-GENERATION-LOG.md가 이력을 기록하지 ASSET-LEDGER가
 *     기록하지 않는다(1m 결정).
 */
export async function scanProjectImageFiles(projectDir) {
  const resolvedRoot = path.resolve(projectDir);
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
        if (IMAGE_SCAN_EXCLUDED_DIRS.has(entry.name)) continue;
        if (entry.name === '.design-kit') continue;
        if (full === path.join(resolvedRoot, MARKETING_ASSET_OUTPUT_DIR)) continue;
        // eslint-disable-next-line no-await-in-loop -- 재귀 스캔이 의도(전체 트리를 순서대로 훑음)
        await walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_FILE_EXTENSIONS.has(ext)) {
          found.push(path.relative(resolvedRoot, full).split(path.sep).join('/'));
        }
      }
    }
  }
  await walk(resolvedRoot);
  return found.sort();
}

/**
 * ASSET-LEDGER.csv의 전체 행을 객체 배열로 읽는다. loadAssetLedgerFilenames(파일명만
 * 반환)와 짝을 이루는 함수 — ATTRIBUTION.md 생성에는 전체 필드가 필요해서 신설했다.
 * 대장이 없으면 빈 배열(에러 아님 — generateAttribution이 "등록된 자산 없음"으로 정상 처리).
 */
export async function loadAssetLedgerRows(designKitDir) {
  const ledgerPath = path.join(designKitDir, 'ASSET-LEDGER.csv');
  if (!existsSync(ledgerPath)) return [];
  const content = await readFile(ledgerPath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    // 0번째 줄은 헤더 — 데이터 행만 순회
    const [filename, kind, sourceUrl, license, commercialUse, attribution, aiGenerated, date] = parseCsvLine(lines[i]);
    if (!filename) continue;
    rows.push({ filename, kind, sourceUrl, license, commercialUse, attribution, aiGenerated, date });
  }
  return rows;
}

/**
 * 자산 게이트 판정: 프로젝트를 스캔해 찾은 이미지 파일 중 ASSET-LEDGER.csv에 등록 안 된 것을
 * 미등록(violation)으로 분류한다. checkFontGate와 동일한 원칙 — "등록됐는가/안 됐는가"만
 * 기계적으로 확인하고, 등록 자체(대장에 행 추가)는 사람의 몫으로 남긴다.
 *
 * font-pipeline.mjs의 `loadAssetLedgerFilenames()`는 **재사용하지 않는다** — 그 함수는 대장의
 * filename을 항상 `.design-kit/` 기준 상대경로로 재해석한다(폰트 파일이 실제로
 * `.design-kit/fonts/<key>/...`에 저장되기 때문에 성립하는 폰트 전용 관례). 하지만 이미지
 * 자산(스톡 사진·아이콘 등)은 사용자 프로젝트 트리 안(예: `public/images/`)에 있지
 * `.design-kit/` 안에 있지 않다 — 그 함수를 그대로 쓰면 "public/images/x.jpg"가
 * ".design-kit/public/images/x.jpg"로 잘못 재해석되어 항상 미등록으로 오판된다(실측
 * 발견·수정: 최초 구현이 이 함수를 재사용했다가 등록된 자산까지 위반으로 잘못 판정하는 걸
 * 테스트로 잡아냈다). 이미지는 대장의 filename을 **프로젝트 루트 기준 그대로**(scanProjectImageFiles가
 * 반환하는 값과 같은 기준) 비교해야 한다 — loadAssetLedgerRows로 원본 filename을 그대로 쓴다.
 */
export async function checkAssetGate({ projectDir, designKitDir }) {
  const [scanned, rows] = await Promise.all([scanProjectImageFiles(projectDir), loadAssetLedgerRows(designKitDir)]);
  // font-pipeline.mjs의 checkFontGate와 동일한 이유로 대소문자 무관 비교(2026-08-10 실측 규칙).
  const registeredLower = new Set(rows.map((r) => r.filename.toLowerCase()));
  const violations = scanned.filter((f) => !registeredLower.has(f.toLowerCase())).map((file) => ({ file }));
  return { scannedCount: scanned.length, registeredCount: rows.length, violations };
}

const ATTRIBUTION_MARKER =
  '> `scripts/asset-ledger.mjs --generateAttribution`이 `.design-kit/ASSET-LEDGER.csv`를 읽어 자동 생성합니다. 직접 수정하지 마세요 — 대장을 고친 뒤 다시 생성하세요.';

/**
 * ASSET-LEDGER.csv 전체를 읽어 사람이 읽는 ATTRIBUTION.md를 생성한다(종류별 그룹핑).
 * 결정론적 산출물이라 항상 덮어쓴다 — 수동 편집 문서가 아니다(01_PRD.md §7 "출처 표기 자동
 * 생성" 요구사항의 구현). AI 생성 자산(aiGenerated === 'Y')은 출처URL 대신
 * AI-GENERATION-LOG.md를 참고하라고 안내한다(현재 이 게이트가 등록하는 자산은 전부 사람이
 * 대장에 직접 적는 외부 자산이라 실사용 사례는 아직 없지만, 스키마가 허용하는 값이라 처리는
 * 갖춰둔다).
 */
export async function generateAttribution(designKitDir) {
  const rows = await loadAssetLedgerRows(designKitDir);
  const lines = [];
  lines.push('# ATTRIBUTION.md — 이 프로젝트가 사용하는 외부 자산 출처');
  lines.push('');
  lines.push(ATTRIBUTION_MARKER);
  lines.push('');

  if (rows.length === 0) {
    lines.push('등록된 자산이 없습니다(`.design-kit/ASSET-LEDGER.csv`가 없거나 비어 있음).');
  } else {
    const byKind = new Map();
    for (const row of rows) {
      const kind = row.kind || '기타';
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind).push(row);
    }
    for (const [kind, kindRows] of byKind) {
      lines.push(`## ${kind} (${kindRows.length}건)`);
      for (const row of kindRows) {
        lines.push(
          `- **${row.filename}** — ${row.license || '라이선스 미기재'}, 상업 이용: ${row.commercialUse || '미기재'}, 출처 표시: ${row.attribution || '미기재'}`
        );
        if (row.aiGenerated === 'Y') {
          lines.push(`  - AI 생성 자산 — 출처는 \`AI-GENERATION-LOG.md\` 참고`);
        } else if (row.sourceUrl) {
          lines.push(`  - 출처: ${row.sourceUrl}`);
        }
      }
      lines.push('');
    }
  }

  const designKitDirResolved = path.resolve(designKitDir);
  await mkdir(designKitDirResolved, { recursive: true });
  const outPath = path.join(designKitDirResolved, 'ATTRIBUTION.md');
  await writeFile(outPath, `${lines.join('\n').trimEnd()}\n`, 'utf-8');
  return { outputPath: outPath, rowCount: rows.length };
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const projectDir = path.resolve(getArg('project') || process.cwd());
  if (!existsSync(projectDir)) {
    console.error(`프로젝트 디렉터리를 찾을 수 없습니다: ${projectDir}`);
    process.exit(1);
  }

  if (args.includes('--generateAttribution')) {
    const designKitDir = path.join(projectDir, '.design-kit');
    const result = await generateAttribution(designKitDir);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error('사용법: asset-ledger.mjs --project <경로> --generateAttribution');
  process.exit(2);
}

// 진입점 판정은 fileURLToPath로(04_PROJECT_SPEC.md ALWAYS DO — 공백·한글 경로에서 exit 0 무출력 방지).
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[asset-ledger] 실패:', err.message);
    process.exitCode = 1;
  });
}
