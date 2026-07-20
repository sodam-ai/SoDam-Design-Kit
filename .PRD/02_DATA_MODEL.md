# SoDam-Design-Kit -- 데이터 모델

> 킷이 다루는 핵심 데이터 구조. **전부 로컬 파일, DB 없음.**
> 프로젝트마다 `.design-kit/` 폴더 하나가 생기고, git으로 이력이 관리됩니다.

---

## 전체 구조

```
[KitConfig] --1:N--> [ComponentMap 항목]
     |
     └--1:N--> [PipelineRun] --1:1--> [VerifyReport]

[Phase 2] tokens.json ──> Tailwind/shadcn 테마 (자동 변환 산출물)
[Phase 2] StoryIndex  ──> 컴포넌트별 Story 목록
```

```
프로젝트/
└── .design-kit/
    ├── config.json           # KitConfig (프로젝트당 1개)
    ├── component-map.json    # ComponentMap (매핑 N개)
    ├── runs/                 # PipelineRun (실행 1회당 1개)
    │   └── 2026-07-19-001.json
    ├── reports/              # VerifyReport (실행당 1개)
    │   ├── 2026-07-19-001.md
    │   ├── screenshots/      # 최근 10회만 보관 (gitignore)
    │   └── baseline/         # [P2] 시각 회귀 기준본 (보관 정책 제외·커밋 대상)
    ├── fonts/                # [P2] 폰트 + OFL.txt 라이선스 동반 보존
    ├── ASSET-LEDGER.csv      # [P2] 자산 대장 (첫 자산인 폰트부터 최초 생성)
    ├── ATTRIBUTION.md        # [P3] 출처 표기 자동 생성
    ├── AI-GENERATION-LOG.md  # [P3] AI 생성 이력 자동 append
    ├── .api-token            # [P2] 대시보드 로컬 토큰 — 실행마다 재생성·0600·gitignore (커밋 금지)
    └── .lock                 # [P2] 실행 잠금 — 파이프라인·재검증 동시 실행 방지 (실행 1개 원칙·완료 시 삭제·gitignore)
```

---

## 엔티티 상세

### KitConfig (config.json)
프로젝트의 킷 설정. 설정 마법사가 생성.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| figmaFileUrl | 대상 Figma 파일 주소 | https://figma.com/design/abc... | X (요구사항만으로도 실행 가능) |
| framework | 생성 코드 프레임워크 (P1은 "nextjs" 전용 고정, 타 프레임워크는 백로그) | "nextjs" | O |
| uiLibrary | UI 라이브러리 | "shadcn" | O |
| viewports | 반응형 검사 크기 | [360, 768, 1440] | O |
| gateEnabled | 검증 게이트 켜기/끄기 | true | O |
| maxAutoRetry | FAIL 시 자동 수정 재시도 횟수 | 3 | O |
| a11yLevel | 차단 기준 위반 등급 | "serious" | O |

### ComponentMap 항목 (component-map.json)
Figma 컴포넌트 ↔ 코드 컴포넌트 연결. **재사용 매핑의 핵심** — 이게 있어야 "흔한 템플릿 느낌"(원천 자료 23번 경고)을 피한다.
콜드 스타트 방지: 설정 마법사가 프로젝트의 shadcn/ui 설치 컴포넌트를 스캔해 초기 시드를 자동 생성한다(매핑 0개로 시작하면 P1 매핑 단계가 무의미해지는 문제 차단). shadcn/ui 자체가 미설치인 프로젝트면 마법사가 감지해 `npx shadcn init` 실행을 **사용자 확인 후** 수행한다(전제의 전제까지 끊어 마법사 자립).

**재스캔은 기존 매핑을 보존한다 (2026-07-20 실측 발견·수정 — 결정 기록)**: `/sodam-design-kit:setup --force`로 재실행하면 프로젝트를 다시 스캔해 component-map을 갱신하는데, 이때 이미 확보한 매핑(`figmaNodeId`·`figmaName`·`propsHint`·`lastVerified`)을 통째로 빈 값으로 초기화하는 결함이 실제로 있었다(재현·수정 완료). 원인: 재스캔이 기존 파일을 읽지 않고 항상 새로 생성했기 때문. 수정 후 동작: `codePath`가 같은 기존 항목이 있으면 그대로 보존하고, 스캔에서 새로 발견된 컴포넌트만 빈 값으로 추가한다. **이 동작을 다시 "단순화"하며 되돌리지 말 것** — 위 문단의 "재사용 매핑의 핵심"이라는 원칙과 정확히 이 지점에서 충돌한다.

**존재하지 않는 프로젝트 경로도 조용히 "성공" 처리되지 않는다 (2026-07-20 실측 발견·수정 — 결정 기록)**: `setup-wizard.mjs --project`에 오타 등으로 존재하지 않는 경로를 주면, `mkdir(..., {recursive:true})`가 중간 경로까지 다 만들어버려서 예전엔 "0개 컴포넌트 시드됨"으로 조용히 성공 취급됐다. 같은 파이프라인의 `pipeline-codegen.mjs`·`preview-route.mjs`는 이미 존재하지 않는 프로젝트 경로에 명확히 실패(exit 1)하는데 `setup-wizard.mjs`만 그러지 않던 불일치를 실측으로 발견해, `runSetup()` 최상단에 `existsSync(projectDir)` 가드를 추가하고 명확한 에러로 통일했다. **이 가드를 제거하지 말 것** — 없으면 엉뚱한 위치에 빈 `.design-kit/`가 생기는 걸 사용자가 "성공"으로 오인할 수 있다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| figmaNodeId | Figma 노드 ID | "1:234" | O |
| figmaName | Figma 컴포넌트 이름 | "Button/Primary" | O |
| codePath | 코드 파일 경로 | "src/components/ui/button.tsx" | O |
| propsHint | 매핑 시 쓸 props 힌트 | { "variant": "default" } | X |
| lastVerified | 마지막 검증 통과 실행 ID | "2026-07-19-001" | X |

### PipelineRun (runs/*.json)
파이프라인 실행 1회 기록.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| runId | 실행 ID (날짜-순번) | "2026-07-19-001" | O |
| startedAt | 시작 시각 | 2026-07-19T14:30 | O |
| target | 대상 (Figma 노드 or 요구사항 요약) | "Login 화면" | O |
| generatedFiles | 생성/수정된 파일 목록 | ["src/app/login/page.tsx"] | O |
| status | 상태 | generated → verifying → pass / fail | O |
| retryCount | 자동 재시도 횟수 | 1 | O |

### VerifyReport (reports/*.md)
검증 게이트 판정서. 사람이 읽는 문서.

| 필드(섹션) | 설명 | 예시 | 필수 |
|------|------|------|------|
| playwright | 실브라우저 렌더·콘솔 오류 결과 | 렌더 OK, 콘솔 에러 0 | O |
| axe | 접근성 위반 건수 (등급별) | critical 0 / serious 0 / moderate 2 | O |
| lighthouse | 접근성 점수 (참고 지표 — 게이트 판정 불포함, 세션 내 MCP로 기록) | 96 | X |
| devServer | 사용 포트·자동 우회 여부 | 3001 (3000 충돌 → 우회) | O |
| recheck | FAIL 시 자동 재검 결과 (2연속 FAIL만 확정) | 1차 FAIL → 재검 FAIL (확정) | X |
| screenshots | 뷰포트별 스크린샷 경로 | 360/768/1440 각 1장 | O |
| verdict | 최종 판정 | PASS / FAIL (+사유) | O |

**PASS 조건 (게이트 판정의 단일 기준 — 4가지 전부 충족 시에만 PASS)**
1. 렌더 성공 (대상 URL 정상 로드)
2. 콘솔 에러 0건
3. axe critical/serious 위반 0건 (moderate 이하는 판정서에 기록만)
4. 뷰포트 3종(360/768/1440px) 스크린샷 존재

하나라도 미충족이면 FAIL. 이 기준은 여기가 유일한 출처이며 다른 문서는 이를 참조만 한다(구현 편차 방지).

FAIL 확정 전 같은 코드로 1회 자동 재검한다 — **2회 연속 FAIL만 진짜 FAIL**로 확정하고, 판정서에 재검 결과(recheck) 필드를 남긴다(타이밍·폰트 로딩 등 flaky 오탐 분리).

---

## 왜 이 구조인가

- **파일 기반, DB 없음**: 로컬 개인용 킷이므로 서버가 필요 없고, git 커밋으로 이력·되돌리기가 공짜로 생긴다. 기존 프로젝트들(CHECKPOINT.md, AUDIT.log)과 같은 철학.
- **runs와 reports 분리**: runs는 기계용(JSON, 상태 추적), reports는 사람용(MD, 판정 근거). 훅이 "reports에 PASS가 없으면 완료 차단"을 판단하는 단일 기준점이 된다.
- **component-map이 독립 파일인 이유**: 실행 이력과 달리 프로젝트가 성장할수록 쌓이는 자산이라 수명이 다르다. 유사 사례(Figma Code Connect)도 매핑을 별도 자산으로 관리하며, 매핑이 있을 때 출력 품질이 유의미하게 좋아진다고 보고됨.
- **확장성**: Phase 2의 tokens.json·StoryIndex·`fonts/`(폰트+OFL.txt 동반 보존)·`ASSET-LEDGER.csv`(첫 자산인 폰트부터 최초 생성), Phase 3의 상세페이지·마케팅 소재(assets) 데이터와 라이선스 게이트 확장 파일(`ATTRIBUTION.md`·`AI-GENERATION-LOG.md`)이 같은 `.design-kit/` 아래 파일로 추가될 뿐 구조 변경이 없다. 서비스화 시에도 이 JSON들이 그대로 API 응답 형식이 될 수 있다.
- **[P2] open 대시보드는 상태 파일을 직접 쓰지 않는다 (2026-07-20 18차 정밀 수정)**: runs/·reports/·자산 대장의 **직접 쓰기·수정 금지** — 쓰기 주체는 코어 엔진(파이프라인·verify-runner) 하나뿐. 대시보드가 FAIL을 PASS로 바꾸는 류의 상태 조작이 게이트 우회 통로이므로 데이터 계약으로 금지(04 DO NOT 연동). 단 **재검증 "트리거"는 허용**: 버튼은 코어 엔진을 호출만 하고 판정·기록은 엔진이 수행 — 게이트를 우회하는 게 아니라 실행하는 것(트리거≠쓰기 구분 — 11차 결정의 정신 유지). 동시 실행 충돌은 `.design-kit/.lock`으로 방지(실행 1개 원칙 — 04 연결/동기화 스펙).
- **검증과 판정서 기록은 이제 명령 1개로 묶여 있다 (2026-07-20 실사용 세션에서 실측 발견·수정 — 결정 기록)**: `commands/pipeline.md`의 절차가 "검증(스크립트)"과 "판정서 기록(`writeReport()`)"을 별개 단계처럼 서술하고 있었지만, 실제로는 `report-writer.mjs`에 CLI 진입점이 전혀 없어서(함수만 export) 에이전트가 이 단계를 실행할 방법이 없었다. 실사용자의 새 세션(test11)에서 `/sodam-design-kit:pipeline`을 실제로 실행했을 때 에이전트가 이 공백을 직접 겪고 스크래치패드에 접착 스크립트를 즉흥으로 작성해야 했던 것으로 실측 확인됨. `verify-runner.mjs`의 CLI에 `--target`(주면 발동)·`--generatedFiles`·`--retryCount` 옵션을 추가해 검증 직후 자동으로 `writeReport()`를 호출하도록 통합했다(`--target` 없으면 기존과 동일하게 판정서 미기록 — 하위 호환). PowerShell로 fixture 대상 실제 CLI 실행(PASS, 판정서 생성 확인) + 신규 단위테스트 2건(하위 호환/신규 동작)으로 재검증 완료. **이 통합을 다시 "검증과 기록은 별개"로 되돌리지 말 것** — 에이전트가 매번 즉흥 스크립트를 짜야 하는 상황이 곧 01 §1 "고정 파이프라인" 핵심 가치의 위반이다.

**완료 차단 훅은 판정 기록이 손상됐을 때도 통과시키지 않는다 (fail-closed, 2026-07-20 실측 발견·수정 — 결정 기록)**: `hooks/verify-gate.mjs`의 `decide()`는 `runs/`를 읽을 수 없거나 최신 판정 파일이 손상돼 있으면(파싱 실패 등) 예전엔 조용히 통과(no-op)시켰다. 실제로 재현해보니 이건 01 §9 성공 기준 2번("게이트가 장식이 아님을 증명")을 정면으로 어길 수 있는 지점이라 판단해 **차단(block)으로 수정**했다 — 단, 코드 품질 FAIL과 헷갈리지 않도록 "이건 코드 문제가 아니라 기록 파일 문제, 이 파일을 지우고 다시 실행하라"는 구분된 안내를 준다(01 §8 왕초보 눈높이 원칙과 정합). **이 분기를 다시 조용히 통과(no-op)로 되돌리지 말 것** — 게이트의 근본 목적과 직결된 의도적 안전장치다.

---

## [NEEDS CLARIFICATION]

- [x] **reports/screenshots 용량 관리 (2026-07-19 재감사 확정 · 2026-07-20 실제 구현 완료)** — 최근 10회 실행분만 보관·초과분 자동 삭제 + `.gitignore`에 screenshots 등록(판정서 MD만 커밋). 단 **시각 회귀 기준본은 `reports/baseline/`로 분리해 보관 정책에서 제외**(커밋 대상). 근거: 기준본까지 자동 삭제되면 Phase 2 시각 회귀가 자멸하는 정책 간 충돌이 있었음 — 분리로 해소.
  - **실측 발견(2026-07-20)**: "확정"으로 체크돼 있었지만 실제 코드가 없어 픽스처 프로젝트에 스크린샷 폴더가 16개까지 무제한 누적됐고, `.gitignore`에도 등록되지 않아 `.design-kit/` 전체가 git에 untracked 상태로 방치되고 있었음(둘 다 실측 확인). `report-writer.mjs`에 `pruneScreenshots()`(오래된 폴더부터 삭제, `writeReport()`마다 자동 실행) + `setup-wizard.mjs`에 `ensureScreenshotsGitignored()`(setup 재실행 시 멱등 skip 경로에서도 자가 치유) 추가로 수정 완료. 실제 픽스처에서 16개 → 10개로 정리되고 `.gitignore`에 항목이 추가됨을 확인. **이 두 함수를 다시 제거하지 말 것** — 문서상 결정과 실제 코드를 일치시킨 결과물이다.
