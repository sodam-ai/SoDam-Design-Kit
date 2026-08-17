---
description: 상세페이지 파이프라인 — 상품 데이터(CSV/JSON) → 카피 생성 → 페이지 코드 → 동일 검증 게이트 (Phase 3)
---

# /sodam-design-kit:detail-page

> **Phase 3 첫 증분 — 2026-08-10 구현**. `03_PHASES.md` L110 범위: "상품 데이터(CSV/JSON) → 카피 생성 → 페이지 코드 → 동일 검증 게이트". 검증은 `verify-runner.mjs`를 전혀 수정하지 않고 그대로 재사용한다.

## 목적
상품 데이터 파일 1개(CSV 또는 JSON)에서 상품 1건을 골라 카피(제목·USP·설명·FAQ)를 작성하고, 그 카피를 렌더하는 상세페이지 코드로 연결한 뒤 검증 게이트를 통과해야만 완료로 표시합니다.

## 설계 요점 (왜 파일이 1개가 아니라 2종류인가)
- **템플릿 코드는 프로젝트당 1개**: `<app디렉터리>/products/[slug]/page.tsx` — Next.js 동적 라우트. `<app디렉터리>`는 `preview-route.mjs`의 `detectAppDir()`을 재사용해 `src/app/` 또는 `app/` 중 실제 프로젝트 구조에 맞는 쪽을 자동 감지합니다(하드코딩 아님). 상품마다 새 파일을 만들지 않습니다(P3는 이 킷에서 새 파일을 가장 많이 만드는 단계라 회귀 위험이 가장 크다고 PRD가 스스로 지목했습니다 — 파일 수를 늘리지 않는 설계로 그 위험을 낮춥니다).
- **상품 데이터는 상품마다 1개**: `<app디렉터리와 같은 접두어>/data/products/<productId>.json`(예: `src/app`이면 `src/data/products/`, `app`이면 `data/products/`) — 실제 사이트 콘텐츠이므로 `.design-kit/` 밖, 일반 프로젝트 소스 트리에 둡니다.
- **킷의 등록 정보**: `.design-kit/product-pages.json` — 템플릿 1개 + 상품 데이터 목록의 위치만 기록(실제 코드·카피 본문은 안 들어감, component-map.json과 같은 역할).

## 절차 (에이전트가 수행)

0. **[에이전트] 먼저 `.design-kit/product-pages.json`부터 확인**: `template` 필드가 이미 채워져 있으면 3번(템플릿 작성)을 건너뛰고 바로 1번으로 갑니다. 없으면 이번 실행에서 3번도 함께 수행합니다(최초 1회만 필요).
1. **[스크립트] 상품 데이터 파싱**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/detail-page-pipeline.mjs" --project <경로> --dataFile <CSV 또는 JSON 경로>` — 각 행/원소를 객체로 반환합니다(각 행은 고유 `id` 필드 필수, 나머지 필드는 자유 형식).
2. **[에이전트] 카피 초안 작성**: 대상 상품 1건의 원본 데이터(1번 결과)를 바탕으로 제목(title)·USP·상세 설명(description)·FAQ를 작성해 스크래치 파일에 JSON으로 저장합니다(예: `<scratchpad>/copy.json`, 최소 `title` 필드 필수). **주의**: 원본 데이터에 없는 사실을 지어내 광고하지 마세요 — 카피는 "생성"이지 "날조"가 아닙니다.
3. **[에이전트, 템플릿 미등록 시에만] 템플릿 작성**: shadcn 컴포넌트를 재사용해(`component-map.json` 우선 검토 — 04 ALWAYS DO) `<app디렉터리>/products/[slug]/page.tsx` 코드를 작성합니다(`<app디렉터리>`는 5번 스크립트 단계가 `detectAppDir()`로 자동 판단 — `src/app` 또는 `app`). Server Component로 `params.slug`를 받아 `src/data/products/<slug>.json`을 `fs.readFileSync`로 읽어 렌더합니다(빌드타임 동적 import 대신 런타임 파일 읽기 — App Router dev server에서 별도 설정 없이 동작). 카피 텍스트는 JSX 텍스트 노드로만 렌더하세요(**`dangerouslySetInnerHTML` 금지** — 스크립트가 기계적으로 거부합니다). 결과를 스크래치 파일에 저장(예: `<scratchpad>/product-page.tsx`).
4. **[스크립트] 카피 배치+등록**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/detail-page-pipeline.mjs" --project <경로> --productId <id> --copyFile <2번 스크래치 파일 경로>` — `src/data/products/<id>.json`에 배치 + `product-pages.json`에 등록(재실행 시 갱신, 멱등).
4b. **[스크립트] AI 생성 이력 기록 (2026-08-17 신설, 필수 — 건너뛰지 마세요)**: 2번에서 실제로 작성한 프롬프트/지시 내용을 스크래치 파일(예: `<scratchpad>/copy-prompt.txt`)에 그대로 저장한 뒤 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-generation-log.mjs" --project <경로> --assetType copy --model "<자신을 설명하는 모델명, 예: Claude (Claude Code)>" --promptFile <그 파일 경로> --generatedFiles <4번에서 배치된 데이터 파일 경로>` 를 실행합니다. `.design-kit/AI-GENERATION-LOG.md`에 시크릿 필터를 거친 프롬프트·모델·날짜가 append됩니다(01_PRD.md §7 "AI 생성물(코드·소재·카피)은 AI-GENERATION-LOG 기록" 요구사항의 이행 — 이 파일은 커밋 대상이므로 프롬프트에 시크릿을 직접 적더라도 스크립트가 자동으로 필터링합니다, 그래도 애초에 민감정보를 프롬프트에 넣지 않는 것이 안전합니다).
5. **[스크립트, 템플릿 미등록 시에만] 템플릿 배치+등록**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/detail-page-pipeline.mjs" --project <경로> --templateFile <3번 스크래치 파일 경로>` — 하드코딩 값·`dangerouslySetInnerHTML` 검사를 통과해야 배치됩니다. **이미 등록된 템플릿을 다시 넘기면 거부됩니다**(손으로 고친 템플릿 보호).
6. **[스크립트] 검증 + 판정서 기록 (한 명령, pipeline.md와 동일 패턴)**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/verify-runner.mjs" --project <경로> --route /products/<id> --screenshotDir <경로> --target "<대상 설명, 예: 상품 sample-mug 상세페이지>" --generatedFiles <배치된 파일, 콤마 구분>` — dev server 자동 기동 → Playwright 렌더 → axe-core → 3뷰포트 → 판정서까지 자동 기록.
7. **FAIL이면 4번(또는 5번)부터 재시도** (최대 `maxAutoRetry`회, 2연속 FAIL만 확정) — pipeline.md와 동일 원칙: 판정서의 실패 사유(axe 위반·콘솔 에러)를 다음 시도에 반영하세요. **재시도 때 4b를 중복 기록할 필요는 없습니다** — 카피 자체를 다시 작성한 경우에만 4b를 다시 실행하세요.
8. PASS 판정서 없이 "완료" 보고 금지 — `hooks/verify-gate.mjs`가 기계적으로 차단.

## 실측 함정 (기존 파이프라인과 동일 — 다시 겪지 않도록)
- Windows/Git Bash에서 `--route /...` 같은 `/`로 시작하는 인자는 경로로 오염될 수 있음 — **PowerShell 사용 권장**
- productId는 영문 소문자·숫자·하이픈만 허용됩니다(`validateProductId()`가 그 외 문자를 거부) — 한글·공백·특수문자는 slug로 변환 후 사용하세요.

## 아직 없는 것 (다음 증분)
- 여러 페이지 레이아웃/카테고리별 템플릿 (템플릿 1개로 시작 — 04 ALWAYS DO "작게 시작" 원칙)
- 마케팅 소재(이미지/SNS) 파이프라인, `ASSET-LEDGER.csv` 이미지 확장 — 이 증분은 텍스트 카피만 다룸

## AI 생성 이력 범위 (2026-08-17 신설 — 결정 근거는 `.PRD/02_DATA_MODEL.md` 참조)
- `ai-generation-log.mjs`는 **에이전트가 자유 형식으로 창작하는 콘텐츠(카피 등)만** 기록합니다. Figma→코드 변환(1~2번 단계가 아닌 `pipeline.md`의 메인 파이프라인)은 대상이 아닙니다 — `component-map.json`·`runs/*.json`에 이미 Figma 노드 ID·생성 스크립트·시각이 남는 결정적 변환이라 별도 이력이 필요 없다고 판단했습니다.
- 이 증분 이전(2026-08-10)에 생성된 픽스처의 기존 상품 카피(`sample-mug` 등)는 **소급 기록하지 않습니다** — 역사적 산출물이며, 새로 카피를 작성/재작성할 때부터 4b가 적용됩니다.
