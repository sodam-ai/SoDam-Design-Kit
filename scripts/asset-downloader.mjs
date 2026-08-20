#!/usr/bin/env node
// SoDam-Design-Kit — Figma 이미지·SVG 자산 다운로드 (P1 완결 보강, 2026-08-20)
//
// `.PRD/04_PROJECT_SPEC.md` 연결/동기화 스펙 6번(2026-07-20 스파이크 실측 확정)이 "Figma
// get_design_context가 반환하는 자산 URL은 임시(7일)이므로 즉시 로컬 다운로드"를 요구해왔지만,
// 지금까지 이걸 강제하는 코드가 없었다(commands/pipeline.md에 에이전트용 당부로만 존재) —
// 이 파일이 그 공백을 채운다.
//
// 저장 위치는 이 스크립트가 정하지 않는다(--targetPath는 호출자가 지정) — 특히
// public/design-kit-assets/는 쓰지 않는다: 그 폴더는 asset-ledger.mjs --assetGate가
// (02_DATA_MODEL.md 58차 결정으로) 이 킷 자신이 만드는 마케팅 이미지 전용이라 스캔 제외해둔
// 곳이라, Figma에서 내려받은 외부 출처 자산을 거기 두면 01_PRD.md §7 라이선스 게이트의
// 사각지대가 새로 생긴다.

import { existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * SVG는 텍스트라 sharp 디코딩만으로는 악성 콘텐츠를 걸러낼 수 없다 — script 태그·인라인
 * 이벤트 핸들러·javascript: 스킴을 직접 거부한다(pipeline-codegen.mjs의
 * findHardcodedStyleViolations와 같은 "알려진 위험 패턴을 렌더 전에 거부" 원칙).
 */
export function validateSvgContent(text) {
  const violations = [];
  if (/<script[\s>]/i.test(text)) violations.push('<script> 태그 포함');
  if (/\son[a-z]+\s*=/i.test(text)) violations.push('인라인 이벤트 핸들러(on*=) 포함');
  if (/javascript:/i.test(text)) violations.push('javascript: 스킴 포함');
  return violations;
}

/**
 * Figma(또는 다른 출처) URL에서 이미지·SVG 자산 1개를 내려받아 프로젝트 안에 저장한다.
 * fetchFn 주입 가능 — font-pipeline.mjs의 downloadFont()와 같은 이유(테스트가 실네트워크
 * 없이 결정적으로 검증).
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {string} opts.url - https:// 만 허용
 * @param {string} opts.targetPath - 프로젝트 루트 기준 상대경로 (예: "public/images/hero.png")
 */
export async function downloadAsset({ projectDir, url, targetPath }, { fetchFn = fetch, maxBytes = 10 * 1024 * 1024 } = {}) {
  if (!url || !url.startsWith('https://')) {
    throw new Error(`url은 https://로 시작해야 합니다: ${url || '(빈 값)'}`);
  }

  // 06 신뢰 경계: registerNewComponent()와 동일한 경로 조작 방어(pipeline-codegen.mjs 참조).
  const resolvedProjectDir = path.resolve(projectDir);
  const resolvedDest = path.resolve(resolvedProjectDir, targetPath);
  if (resolvedDest !== resolvedProjectDir && !resolvedDest.startsWith(resolvedProjectDir + path.sep)) {
    throw new Error(`targetPath가 프로젝트 루트 밖을 가리킵니다: ${targetPath}`);
  }

  const res = await fetchFn(url);
  if (!res.ok) {
    throw Object.assign(new Error(`다운로드 실패: ${url} (HTTP ${res.status})`), { statusCode: 502 });
  }
  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  if (buffer.length > maxBytes) {
    throw Object.assign(
      new Error(`용량 초과 — 저장하지 않음: ${buffer.length}바이트 (한도: ${maxBytes}바이트)`),
      { statusCode: 502 }
    );
  }

  const isSvg = targetPath.toLowerCase().endsWith('.svg');
  let format;
  if (isSvg) {
    const text = buffer.toString('utf-8');
    const violations = validateSvgContent(text);
    if (violations.length > 0) {
      throw Object.assign(
        new Error(`SVG에 위험한 패턴이 있어 저장을 거부합니다: ${violations.join(', ')}`),
        { statusCode: 502 }
      );
    }
    format = 'svg';
  } else {
    try {
      const meta = await sharp(buffer).metadata();
      format = meta.format;
    } catch {
      throw Object.assign(
        new Error(`다운로드한 파일이 이미지로 디코딩되지 않습니다 — 저장하지 않음: ${targetPath}`),
        { statusCode: 502 }
      );
    }
  }

  await mkdir(path.dirname(resolvedDest), { recursive: true });
  await writeFile(resolvedDest, buffer);

  return { targetPath, bytes: buffer.length, format };
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const projectDir = path.resolve(getArg('project') || process.cwd());
  if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) {
    console.error(`프로젝트 디렉터리를 찾을 수 없습니다: ${projectDir}`);
    process.exit(1);
  }
  const url = getArg('url');
  const targetPath = getArg('targetPath');
  if (!url || !targetPath) {
    console.error('사용법: asset-downloader.mjs --project <경로> --url <https:// 자산 URL> --targetPath <배치할 상대경로>');
    process.exit(2);
  }

  const result = await downloadAsset({ projectDir, url, targetPath });
  console.log(JSON.stringify(result, null, 2));
}

// 진입점 판정은 fileURLToPath로 (04 ALWAYS DO 고정 규칙 — 공백·한글 경로에서도 정확히 동작).
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((err) => {
    console.error('[asset-downloader] 실패:', err.message);
    process.exitCode = 1;
  });
}
