#!/usr/bin/env node
// SoDam-Design-Kit — 로컬 시각 회귀 감지 (Phase 2)
// 스크린샷 기준본(.design-kit/reports/baseline/)과 이번 실행 스크린샷을 픽셀 단위로 비교한다.
// 스키마 정본: .PRD/02_DATA_MODEL.md (baseline/ — 보관 정책 제외·커밋 대상)
//
// axe-core와의 결정적 차이: axe 위반은 "항상 나쁜 것"이라 Must·상시 게이트다. 시각 차이는
// 그렇지 않다 — 의도적으로 디자인을 바꾼 결과일 수도 있다(오히려 정상). 그래서 이 게이트는
// 기본 off(opt-in, --visualRegression 플래그)이고, 새 모습을 "정상"으로 받아들이는 건
// 사람이 명시적으로 승인(promoteBaseline)할 때만 일어난다 — 04 DO NOT "게이트를 우회하는
// 옵션을 몰래 켜지 마"의 반대 방향 적용(몰래 끄지도, 몰래 켜지도 않는다).

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

// 전체 픽셀의 1% — 안티앨리어싱·서브픽셀 렌더링 잡음을 흡수하기 위한 허용 오차.
// 04_PROJECT_SPEC.md ALWAYS DO의 "FAIL 확정 전 1회 자동 재검(2연속 FAIL만 확정)" 원칙과
// 같은 결: flaky 오탐이 게이트 신뢰를 깎아 사용자가 게이트를 꺼버리는 최악 시나리오를 막는다.
const DEFAULT_MAX_DIFF_RATIO = 0.01;

/** route 경로를 기준본 폴더명으로 정규화 (예: "/design-kit-preview/button" -> "design-kit-preview-button") */
export function routeToSlug(route) {
  const cleaned = String(route || '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9\-_/]/g, '_')
    .split('/')
    .join('-');
  return cleaned || 'root';
}

function baselineDirFor(designKitDir, routeSlug) {
  return path.join(designKitDir, 'reports', 'baseline', routeSlug);
}

/**
 * 스크린샷 두 장을 픽셀 단위로 비교한다.
 * 크기가 다르면 애초에 같은 화면으로 볼 수 없으므로(pixelmatch는 동일 크기만 비교 가능)
 * 바로 회귀로 판정하고, 실제 픽셀 비교는 시도하지 않는다.
 */
export async function diffScreenshot(candidatePath, baselinePath, { maxDiffRatio = DEFAULT_MAX_DIFF_RATIO } = {}) {
  const [candidateBuf, baselineBuf] = await Promise.all([readFile(candidatePath), readFile(baselinePath)]);

  let candidate;
  let baseline;
  try {
    candidate = PNG.sync.read(candidateBuf);
    baseline = PNG.sync.read(baselineBuf);
  } catch (err) {
    // 2026-08-09 실측 발견·수정: 기준본 또는 이번 실행 스크린샷이 유효한 PNG가 아니면
    // pngjs가 처리되지 않은 예외를 던져 verify-runner.mjs 전체가 크래시했다(재현 확인 —
    // 다른 정상 검증 결과(axe·렌더·콘솔)까지 전부 사용자에게 전달되지 못함). 손상된 파일을
    // "일치"로 조용히 넘기면 실제 회귀를 놓칠 위험이 더 크므로(execution-lock.mjs의
    // "손상 상태를 정상으로 오인해 통과시키지 않는다" fail-closed 원칙과 같은 방향),
    // 크래시 대신 안전하게 회귀로 판정하고 사유를 남긴다.
    return {
      status: 'regression',
      reason: `이미지 파일이 손상되어 비교할 수 없습니다 (${err.message})`,
      diffRatio: 1,
      diffPng: null,
    };
  }

  if (candidate.width !== baseline.width || candidate.height !== baseline.height) {
    return {
      status: 'regression',
      reason: `크기 불일치 (기준본 ${baseline.width}x${baseline.height} vs 이번 실행 ${candidate.width}x${candidate.height})`,
      diffRatio: 1,
      diffPng: null,
    };
  }

  const { width, height } = candidate;
  const diffPng = new PNG({ width, height });
  // 여기 threshold(0.1)는 픽셀 1개 단위의 색상 민감도(pixelmatch 자체 옵션, 기본값 그대로) —
  // 아래 maxDiffRatio(전체 대비 달라진 픽셀 비율 허용치)와는 다른 축이니 혼동하지 말 것.
  const diffPixelCount = pixelmatch(candidate.data, baseline.data, diffPng.data, width, height, { threshold: 0.1 });
  const diffRatio = diffPixelCount / (width * height);
  const matched = diffRatio <= maxDiffRatio;

  return {
    status: matched ? 'matched' : 'regression',
    reason: matched ? null : `픽셀 ${(diffRatio * 100).toFixed(2)}% 차이 (허용 ${(maxDiffRatio * 100).toFixed(2)}%)`,
    diffRatio,
    diffPng: matched ? null : diffPng, // 통과했으면 diff 이미지를 만들 이유가 없음
  };
}

/**
 * 이번 실행의 스크린샷들을 기준본과 비교한다. 기준본이 아직 없는 뷰포트는 "비교 대상 없음"으로
 * 보고할 뿐 회귀로 취급하지 않는다 — 첫 실행은 정의상 비교할 과거가 없다(promoteBaseline으로
 * 승인하기 전까지는 계속 이 상태).
 */
export async function compareRunToBaseline({ designKitDir, route, screenshots, maxDiffRatio = DEFAULT_MAX_DIFF_RATIO }) {
  const routeSlug = routeToSlug(route);
  const baseDir = baselineDirFor(designKitDir, routeSlug);
  const results = [];

  for (const shot of screenshots) {
    const baselinePath = path.join(baseDir, `${shot.viewport}.png`);
    if (!existsSync(baselinePath)) {
      results.push({ viewport: shot.viewport, status: 'no-baseline' });
      continue;
    }
    const diff = await diffScreenshot(shot.path, baselinePath, { maxDiffRatio });
    const entry = { viewport: shot.viewport, status: diff.status, diffRatio: diff.diffRatio, reason: diff.reason };
    if (diff.status === 'regression' && diff.diffPng) {
      const diffImagePath = path.join(path.dirname(shot.path), `${shot.viewport}.diff.png`);
      await writeFile(diffImagePath, PNG.sync.write(diff.diffPng));
      entry.diffImagePath = diffImagePath;
    }
    results.push(entry);
  }
  return results;
}

/** 이번 실행 스크린샷을 기준본으로 승격(복사)한다 — "이 모습을 정상으로 받아들인다"는 사람의 명시적 결정. */
export async function promoteBaseline({ designKitDir, route, screenshots }) {
  const routeSlug = routeToSlug(route);
  const baseDir = baselineDirFor(designKitDir, routeSlug);
  await mkdir(baseDir, { recursive: true });
  const promoted = [];
  for (const shot of screenshots) {
    const dest = path.join(baseDir, `${shot.viewport}.png`);
    await copyFile(shot.path, dest);
    promoted.push({ viewport: shot.viewport, path: dest });
  }
  return { routeSlug, baselineDir: baseDir, promoted };
}
