---
description: 디자인→코드 파이프라인 — Figma 읽기 → component-map 매핑 → shadcn/ui 코드 생성 → 검증 게이트
---

# /sodam-design-kit:pipeline

> **재사용(매핑) 경로 — 2026-07-20 실측 완료**: component-map.json에 이미 매핑된 컴포넌트를 재사용하는 경로는 실제 Figma 데이터로 왕복 검증 완료(PASS, 판정서 기록됨). **신규 컴포넌트 생성(매핑 없는 노드)** 경로도 2026-07-27 구현 완료 — 합성 컴포넌트로 등록→프리뷰→검증 전체 왕복 PASS 실측 확인(아래 절차 참조).

## 목적
Figma 노드 1개를 컴포넌트 단위로 shadcn/ui 코드에 연결하고, 검증 게이트를 통과해야만 완료로 표시합니다.

## 절차 — 재사용 경로 (에이전트가 수행)
Figma MCP 도구(`get_metadata`/`get_design_context`)는 이 킷의 Node 스크립트가 아니라 **에이전트(Claude Code)만 호출 가능**합니다. 그래서 이 명령은 스크립트 1개가 아니라 에이전트가 아래 순서로 도구를 조합해 실행합니다.

0. **[에이전트] 먼저 component-map.json부터 확인 (2026-08-04 실측 발견·수정 — 결정 기록)**: 요청받은 Figma 노드 ID(사용자가 Figma 링크 없이 노드 ID만 줬어도 됨)가 `<project>/.design-kit/component-map.json`의 `figmaNodeId`로 이미 등록돼 있고 `codePath`도 채워져 있으면, **이게 바로 "재사용 경로"다 — 1·2번(Figma 읽기·매핑 기록)을 완전히 건너뛰고 바로 3번(코드 생성)으로 간다.** Figma 링크를 요구하거나 `get_metadata`/`get_design_context`를 호출하지 마라. (실측 발견: 이 0번 단계가 없으면 에이전트가 매핑이 있어도 1번을 문자 그대로 따라가 Figma 파일 URL을 요구하며 멈춘다 — "재사용 경로 = Figma 호출 0회"라는 이 문서·`04_PROJECT_SPEC.md` ALWAYS DO "캐시 우선" 원칙과 정면으로 어긋나는 실제 사고가 실사용 새 세션에서 재현됐다. 이 0단계를 다시 지우지 말 것.)
1. **[에이전트] (0번에서 매핑을 못 찾았을 때만) Figma 읽기 — 반드시 페이지/노드 직접 링크로**: 사용자가 준 링크(node-id 포함)로 `get_metadata`(구조 확인)·`get_design_context`(코드+토큰) 호출. **파일 전체 열거(nodeId 생략) 금지** — 무료 Starter 플랜 3페이지 제한에 걸림(실측 확인, `.PRD/04_PROJECT_SPEC.md` 연결/동기화 스펙 5). 링크가 없는데 매핑도 없다면, 진행하지 말고 사용자에게 Figma 링크를 요청한다.
2. **[에이전트] (1번을 거쳤을 때만) component-map.json에 매핑 기록**: 읽은 노드의 `figmaNodeId`·`figmaName`을 기존 항목에 채우거나(재사용) 신규 항목 추가.
3. **[스크립트] 코드 생성**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/pipeline-codegen.mjs" --project <경로> --figmaNodeId <ID>` — component-map에서 매핑된 컴포넌트를 찾아 `/design-kit-preview/{컴포넌트}` 라우트에 연결(`preview-route.mjs` 재사용). **Figma를 호출하지 않음** — 무료 6회 예산 보호.
4. **[스크립트] 검증 + 판정서 기록 (한 명령)**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/verify-runner.mjs" --project <경로> --route /design-kit-preview/{컴포넌트} --screenshotDir <경로> --target "<대상 설명, 예: Figma node 421:3524 (Button) -> src/components/ui/button.tsx>" --generatedFiles <생성/수정 파일, 콤마 구분>` — dev server 자동 기동 → Playwright 렌더 → axe-core → 3뷰포트 → `.design-kit/runs/`·`reports/`에 판정서까지 자동 기록(`--target`을 주면 발동, 결과 JSON에 `runId`·`reportPath` 포함). **접착 스크립트를 직접 짜지 말 것** — 이 옵션이 추가되기 전엔 `report-writer.mjs`에 CLI가 없어 에이전트가 매번 임시 스크립트를 작성해야 했던 실측 결함이 있었음(2026-07-20 수정).
5. **FAIL이면 3번부터 재시도** (최대 `maxAutoRetry`회, 2연속 FAIL만 확정) — **재시도도 3번(코드 생성)부터 시작하고 1번(Figma 읽기)로 돌아가지 않음.** component-map에 이미 매핑이 있으므로 재시도에 Figma 호출이 필요 없음(04 ALWAYS DO 캐시 우선 원칙을 구조로 강제). **[에이전트] 실패 사유 주입(2026-07-27 신설)**: 판정서(`reportPath`)의 "위반 상세" 섹션 또는 `verify-runner`가 돌려준 JSON의 `axeViolations`(규칙 id·설명·대상 선택자)를 읽어 다음 코드 생성 시도에 그대로 반영한다(예: "img.hero에 alt 속성 추가"). 이 상세가 없던 시절엔 "critical 1건"만 보고 무엇을 고쳐야 할지 알 수 없었다 — 이제는 실제 근거가 있으니 같은 실패를 반복하지 않도록 구체적으로 고칠 것.
6. PASS 판정서 없이 "완료" 보고 금지 — `hooks/verify-gate.mjs`가 기계적으로 차단.

## 실측 함정 (구현 중 확인된 것 — `.PRD/01_PRD.md` §11·04 참조)
- Figma 이미지·SVG 자산 URL은 **7일 후 만료** — 코드에 그대로 박지 말고 즉시 로컬 다운로드(자산 다운로드 스크립트는 아직 미구현 — 이미지 포함 노드 매핑 시 다음 증분)
- Windows/Git Bash에서 `--route /...` 같은 `/`로 시작하는 인자는 경로로 오염될 수 있음 — PowerShell 사용 권장

## 절차 — 신규 컴포넌트 경로 (2026-07-27 구현 — component-map에 매핑이 없을 때)

`matchComponent`가 아무것도 못 찾으면(신규 Figma 노드), 재사용 경로 3번 대신 아래를 따른다.
Figma 원시 코드를 실제 코드로 옮기는 판단은 **에이전트의 몫**이다 — 스크립트는 결과물을 검사·배치·등록만 한다(Figma 호출 없음, 04 ALWAYS DO 원칙 유지).

1. **[에이전트] 코드 생성**: `get_design_context`로 받은 원시 코드(Tailwind 임의값 포함)를 프로젝트의 **기존 Tailwind/shadcn 토큰**으로 옮겨 쓴다(04 DO NOT: 하드코딩 hex·px 금지). 결과를 스크래치 파일(예: `<scratchpad>/badge.tsx`)에 저장.
2. **[스크립트] 검사+배치+등록 (한 명령)**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/pipeline-codegen.mjs" --project <경로> --newComponentFile <스크래치 파일 경로> --codePath <배치할 상대경로, 예: src/components/ui/badge.tsx> --figmaNodeId <ID> --figmaName <이름>` — **하드코딩 hex·px 값이 남아있으면 여기서 자동 거부**(파일 미배치·component-map 미변경, 04 DO NOT 규칙을 코드로 강제하는 첫 지점). 통과하면 배치+component-map 등록+프리뷰 라우트 생성까지 한 번에 끝난다.
3. **[스크립트] 검증 + 판정서 기록**: 재사용 경로 4번과 동일 — `verify-runner.mjs --target ...`.
4. 이후 FAIL 처리·재시도 규칙은 재사용 경로와 동일.

## 아직 없는 것 (다음 증분)
(현재 없음 — Phase 1 계획된 증분은 모두 구현 완료. 03_PHASES.md 참조)
