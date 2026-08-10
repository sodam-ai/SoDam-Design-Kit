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
[Phase 3] ProductPageRegistry(product-pages.json) --1--> 템플릿 1개(코드) + --1:N--> 상품 데이터(N개, 프로젝트 소스 트리)
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
    ├── fonts/                # [P2, 2026-08-09 완료] 폰트 + 라이선스 동반 보존 (fonts/<fontKey>/*.otf·LICENSE — 커밋 대상, gitignore 아님)
    ├── ASSET-LEDGER.csv      # [P2, 2026-08-09 완료] 자산 대장 (첫 자산인 폰트부터 최초 생성 — 실제로 이렇게 생성됨)
    ├── product-pages.json    # [P3, 2026-08-10 완료] 상세페이지 템플릿 1개 + 상품 데이터 위치 목록(실제 코드·카피 본문은 대상 프로젝트 소스 트리에 — component-map.json과 같은 "매핑만" 원칙)
    ├── ATTRIBUTION.md        # [P3] 출처 표기 자동 생성
    ├── AI-GENERATION-LOG.md  # [P3] AI 생성 이력 자동 append
    ├── .api-token            # [P2] 대시보드 로컬 토큰 — 실행마다 재생성·0600·gitignore (커밋 금지)
    ├── .lock                 # [P2] 실행 잠금 — 파이프라인·재검증 동시 실행 방지 (실행 1개 원칙·완료 시 삭제·gitignore)
    └── .dashboard.json       # [P2] 대시보드 백그라운드 프로세스 상태(pid·port·url) — 2026-08-09 신설, 토큰은 안 들어감(gitignore, --stop이 이 파일로 서버를 찾음)
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
| route | 검증에 실제로 쓰인 URL 경로 (2026-08-09 2c 신설 — 대시보드 재검증 트리거의 필수 전제) | "/design-kit-preview/button" | O(2026-08-09 이후 기록) / X(그 이전 기록은 없음 — 재검증 불가) |

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

### ProductPageRegistry (product-pages.json) — [Phase 3, 2026-08-10 완료]
상세페이지 템플릿·상품 데이터의 위치만 기록하는 등록 정보. component-map.json과 같은 원칙("매핑만 담고 실제 코드는 대상 프로젝트 소스 트리에") — 실제 코드·카피 본문은 이 파일에 안 들어간다.

```json
{
  "template": { "codePath": "src/app/products/[slug]/page.tsx", "lastVerified": "" },
  "products": [
    { "productId": "sample-mug", "dataPath": "src/data/products/sample-mug.json", "lastVerified": "" }
  ]
}
```

| 필드 | 설명 | 필수 |
|------|------|------|
| template.codePath | 페이지 템플릿 코드 경로(프로젝트당 1개 — 이미 있으면 재생성 거부) | template 존재 시 O |
| products[].productId | 상품 고유 id(slug, `/^[a-z0-9-]+$/`만 허용) | O |
| products[].dataPath | 그 상품의 카피 데이터 파일 경로(`<app디렉터리와 같은 접두어>/data/products/<id>.json`) | O |
| products[].lastVerified | 마지막 검증 통과 실행 ID | X |

**왜 템플릿과 상품 데이터를 분리했나**: `03_PHASES.md` L98이 Phase 3를 "새 파일을 가장 많이 만드는 단계 = 최대 회귀 위험"으로 스스로 지목했다. 상품 행마다 정적 `.tsx` 파일을 만들면 상품이 늘수록 그 위험이 그대로 커진다. 대신 템플릿(Next.js 동적 라우트 `[slug]/page.tsx`, Server Component가 `params.slug` 기준으로 데이터 파일을 `fs.readFileSync`로 읽음)은 1개만 만들고, 상품마다 늘어나는 건 데이터 파일뿐이다 — 폰트 파일과 `next/font/local` 모듈을 분리한 것과 같은 결의 설계.

---

## 왜 이 구조인가

- **파일 기반, DB 없음**: 로컬 개인용 킷이므로 서버가 필요 없고, git 커밋으로 이력·되돌리기가 공짜로 생긴다. 기존 프로젝트들(CHECKPOINT.md, AUDIT.log)과 같은 철학.
- **runs와 reports 분리**: runs는 기계용(JSON, 상태 추적), reports는 사람용(MD, 판정 근거). 훅이 "reports에 PASS가 없으면 완료 차단"을 판단하는 단일 기준점이 된다.
- **component-map이 독립 파일인 이유**: 실행 이력과 달리 프로젝트가 성장할수록 쌓이는 자산이라 수명이 다르다. 유사 사례(Figma Code Connect)도 매핑을 별도 자산으로 관리하며, 매핑이 있을 때 출력 품질이 유의미하게 좋아진다고 보고됨.
- **확장성**: Phase 2의 tokens.json·StoryIndex·`fonts/`(폰트+OFL.txt 동반 보존)·`ASSET-LEDGER.csv`(첫 자산인 폰트부터 최초 생성), Phase 3의 상세페이지·마케팅 소재(assets) 데이터와 라이선스 게이트 확장 파일(`ATTRIBUTION.md`·`AI-GENERATION-LOG.md`)이 같은 `.design-kit/` 아래 파일로 추가될 뿐 구조 변경이 없다. 서비스화 시에도 이 JSON들이 그대로 API 응답 형식이 될 수 있다.
- **[P2] open 대시보드는 상태 파일을 직접 쓰지 않는다 (2026-07-20 18차 정밀 수정)**: runs/·reports/·자산 대장의 **직접 쓰기·수정 금지** — 쓰기 주체는 코어 엔진(파이프라인·verify-runner) 하나뿐. 대시보드가 FAIL을 PASS로 바꾸는 류의 상태 조작이 게이트 우회 통로이므로 데이터 계약으로 금지(04 DO NOT 연동). 단 **재검증 "트리거"는 허용**: 버튼은 코어 엔진을 호출만 하고 판정·기록은 엔진이 수행 — 게이트를 우회하는 게 아니라 실행하는 것(트리거≠쓰기 구분 — 11차 결정의 정신 유지). 동시 실행 충돌은 `.design-kit/.lock`으로 방지(실행 1개 원칙 — 04 연결/동기화 스펙).
- **검증과 판정서 기록은 이제 명령 1개로 묶여 있다 (2026-07-20 실사용 세션에서 실측 발견·수정 — 결정 기록)**: `commands/pipeline.md`의 절차가 "검증(스크립트)"과 "판정서 기록(`writeReport()`)"을 별개 단계처럼 서술하고 있었지만, 실제로는 `report-writer.mjs`에 CLI 진입점이 전혀 없어서(함수만 export) 에이전트가 이 단계를 실행할 방법이 없었다. 실사용자의 새 세션(test11)에서 `/sodam-design-kit:pipeline`을 실제로 실행했을 때 에이전트가 이 공백을 직접 겪고 스크래치패드에 접착 스크립트를 즉흥으로 작성해야 했던 것으로 실측 확인됨. `verify-runner.mjs`의 CLI에 `--target`(주면 발동)·`--generatedFiles`·`--retryCount` 옵션을 추가해 검증 직후 자동으로 `writeReport()`를 호출하도록 통합했다(`--target` 없으면 기존과 동일하게 판정서 미기록 — 하위 호환). PowerShell로 fixture 대상 실제 CLI 실행(PASS, 판정서 생성 확인) + 신규 단위테스트 2건(하위 호환/신규 동작)으로 재검증 완료. **이 통합을 다시 "검증과 기록은 별개"로 되돌리지 말 것** — 에이전트가 매번 즉흥 스크립트를 짜야 하는 상황이 곧 01 §1 "고정 파이프라인" 핵심 가치의 위반이다.

**완료 차단 훅은 판정 기록이 손상됐을 때도 통과시키지 않는다 (fail-closed, 2026-07-20 실측 발견·수정 — 결정 기록)**: `hooks/verify-gate.mjs`의 `decide()`는 `runs/`를 읽을 수 없거나 최신 판정 파일이 손상돼 있으면(파싱 실패 등) 예전엔 조용히 통과(no-op)시켰다. 실제로 재현해보니 이건 01 §9 성공 기준 2번("게이트가 장식이 아님을 증명")을 정면으로 어길 수 있는 지점이라 판단해 **차단(block)으로 수정**했다 — 단, 코드 품질 FAIL과 헷갈리지 않도록 "이건 코드 문제가 아니라 기록 파일 문제, 이 파일을 지우고 다시 실행하라"는 구분된 안내를 준다(01 §8 왕초보 눈높이 원칙과 정합). **이 분기를 다시 조용히 통과(no-op)로 되돌리지 말 것** — 게이트의 근본 목적과 직결된 의도적 안전장치다.

**그 fail-closed는 훅의 "진입점"이 살아 있을 때만 의미가 있다 (2026-07-27 실측 발견·수정 — 결정 기록)**: 위 `decide()`는 정확했지만, 파일 맨 아래에서 "지금 이 파일이 직접 실행된 것인가"를 판정하던 식이 `new URL(import.meta.url).pathname` 기반이라 **경로에 공백이나 한글이 있으면 항상 어긋났다**. 그 값에는 퍼센트 인코딩(공백 → `%20`, 한글 → `%ED%95%9C…`)이 남는데 `process.argv[1]`은 디코딩된 실경로이기 때문이다. 결과는 `main()` 미실행 → **stdout이 빈 채로 exit 0** — 즉 판정 자체가 사라져 **완료 차단이 통째로 무력화**된다. `decide()`를 fail-closed로 고쳐놓고 정작 그 바깥에서 fail-open이 나던 구조였다. 실측 3케이스로 재현(`"My Projects"`(공백) false / `"한글경로"` false / ASCII true)했고, 같은 파일의 옛 판정식 사본을 한글+공백 경로에서 직접 실행해 **stdout이 비어 있음 → 차단 소멸**을, 수정본은 같은 경로에서 `{"decision":"block",…}` 출력을 확인했다. 이 결함이 여태 안 걸린 이유는 기존 테스트가 전부 `decide()`를 import해서 직접 부르기만 하고 **"프로세스로 실행되는 구간"을 아무도 검증하지 않았기** 때문이다(`tests/verify-gate.test.mjs`·`tests/setup-wizard.test.mjs`에 CLI 회귀 테스트 각 1건 신설로 해소). 판정식은 Node 내장 `fileURLToPath(import.meta.url)`로 통일했다(`scripts/*.mjs` 4개 + `hooks/verify-gate.mjs`). **이 판정식을 다시 `pathname` 기반으로 되돌리지 말 것** — 사용자 PC의 `CLAUDE_PLUGIN_ROOT`에는 공백(`My Projects`·`Program Files`)이나 한글 계정명(`C:\Users\홍길동\…`)이 흔해서, 되돌리는 순간 그 사용자들에게는 게이트가 조용히 사라진다.

**포트 가용성 검사는 "바인드"가 아니라 "연결"로 판정한다 (2026-07-27 실측 발견·수정 — 이번 라운드 최대 결함, 결정 기록)**: `verify-runner.mjs`의 `findAvailablePort()`가 예전엔 `net.createServer().listen(port, '127.0.0.1')`이 성공하는지로 포트 점유 여부를 판정했다. 그런데 Windows는 다른 프로세스가 이미 `0.0.0.0:<port>`(모든 인터페이스)로 리슨 중이어도 `127.0.0.1:<port>`에 대한 별도 바인드를 별문제 없이 성공시켜버린다(SO_EXCLUSIVEADDRUSE 미설정 시 Windows 소켓 특성 — 순수 `node:net` 3줄짜리 격리 스크립트로 이 사실만 따로 재현·확인). 그 결과 **실제로 점유된 포트를 "비어있다"고 오판**했고, 사고가 실사용 조건 그대로 재현됐다: 이 세션 도중 전혀 무관한 다른 프로젝트(BizPick)의 Next.js dev 서버가 마침 `0.0.0.0:3000`을 점유하고 있었는데, `verify-runner`가 그 포트를 "가용"으로 오판해 실제로는 **그 다른 프로젝트를 검증하고도** `target`·`devServer.port`는 우리 것으로 표시된 그럴듯한 PASS 판정서(스크린샷 포함)를 만들어냈다(fixture의 `/broken` 페이지가 의도한 axe 위반이 아니라 엉뚱한 화면의 렌더 실패로 FAIL이 난 것을 실측 발견 → 원인 추적 끝에 확인). **이건 게이트가 차단/통과를 잘못하는 정도가 아니라 "무엇을 검사했는지" 자체가 거짓이 될 수 있다는 뜻이라, 01 §9 성공 기준(판정 근거)을 통째로 무너뜨리는 이번 라운드 최대 결함이다.** 수정: 포트 점유 판정을 "그 포트에 실제로 연결을 시도해 성공하는지"로 뒤집었다(`isPortInUse` — 연결 성공=점유, `ECONNREFUSED`/타임아웃=비어있음). 이 방식은 실제 클라이언트(Playwright·`http.get`)가 그 포트에 접속할 때 겪는 것과 정확히 같은 경로를 그대로 재현하므로 Windows의 바인드 허용 특이사항과 무관하게 항상 정확하다. BizPick 서버를 그대로 켜둔 채 재검증해 `3002`로 정확히 우회하고 `/broken`이 이번엔 **진짜 axe critical 위반**(1건)으로 FAIL 나는 것을 실측 확인했다(무관한 프로세스는 04 DO NOT·범위 원칙상 건드리지 않음 — 종료·조작 없이 우회로만 해결). 회귀 테스트 신설(`tests/verify-runner.test.mjs` — 점유 주체를 `0.0.0.0`으로 만들어 옛 결함 조건을 정확히 재현). **이 판정 방식을 다시 바인드 기반으로 되돌리지 말 것** — 되돌리면 "엉뚱한 대상을 검사하고도 진짜인 것처럼 보고"하는 사고가 그대로 재현된다.

**`--screenshotDir`는 프로젝트 루트 기준 절대경로로 정규화한다 (2026-08-04 실사용 M1 라이브 세션에서 실측 발견·수정 — 결정 기록)**: `verify-runner.mjs`가 `--screenshotDir` 인자를 받은 그대로(상대경로 포함) 써서 `mkdir`·`page.screenshot()`에 넘기고 있었다. 상대경로는 Node 프로세스의 실제 `cwd`에 풀리는데, 이 `cwd`는 에이전트가 명령을 실행한 셸/도구에 따라 달라질 수 있다 — 실사용에서 정확히 이 조건이 재현됐다: 새 세션의 에이전트가 Git Bash로 시작했다가 경로 오염 문제(위 04 트러블슈팅 항목)로 PowerShell로 도구를 바꿔 재시도했는데, 그 PowerShell 호출의 실제 `cwd`가 픽스처 프로젝트가 아니라 Claude Code 자체의 실행 위치(`C:\Users\PC`)였다. 결과: 스크린샷 3장은 실제로 정상 촬영됐지만 **프로젝트 밖(`C:\Users\PC\reports\screenshots\pipeline-421-3078\`)에 저장**됐고, 판정서는 "PASS, 스크린샷 3장 존재"라고 정확히 기록했지만 그 경로 자체가 프로젝트 어디에도 없었다. **이건 판정이 틀린 게 아니라 판정 근거(01 §9)가 프로젝트 밖으로 새어나간 것**이라 27차 포트 오판과 같은 등급의 신뢰 붕괴다 — 다만 재현 조건이 훨씬 넓다(포트 오판은 특정 포트 점유 상황에서만 발생하지만, 이건 에이전트가 절대경로를 안 쓰면 사실상 항상 발생). 원인은 04 DO NOT "경로는 프로젝트 루트 하위로 정규화 검증" 원칙이 `--project`에는 적용돼 있었는데(`path.resolve(projectDir)`) `--screenshotDir`에는 빠져 있었던 것. 수정: `--screenshotDir`가 상대경로이고 `--project`가 주어졌으면 `path.resolve(projectDir)` 기준으로 절대경로화한다(이미 절대경로면 그대로 — 하위 호환). 다른 cwd(`C:\Users\PC`)에서 상대경로로 재현 테스트해 프로젝트 안(`...Fixture\reports\screenshots\...`)에 정확히 저장되고 엉뚱한 위치엔 아무것도 안 생기는 것을 실측 확인, 회귀 테스트 신설(`tests/verify-runner.test.mjs` — cwd 위장 조건 재현). **이 정규화를 제거하지 말 것** — 없으면 에이전트가 절대경로를 빠뜨릴 때마다 판정 근거가 프로젝트 밖으로 새어나가는 사고가 그대로 재현된다.

**"재사용 경로"라는 이름을 걸어놓고 정작 절차 1번이 항상 Figma를 읽으라고 시키고 있었다 (2026-08-04, 3차 M1 라이브 세션에서 실측 발견·수정 — 결정 기록)**: `commands/pipeline.md`의 "절차 — 재사용 경로" 섹션은 제목과 3번 스크립트 단계("Figma를 호출하지 않음 — 무료 6회 예산 보호")까지는 "매핑이 있으면 Figma 호출 0회"를 명시하고 있었지만, 정작 그 앞의 1번 단계("[에이전트] Figma 읽기")가 **매핑 존재 여부를 확인하는 분기 없이 무조건 실행하도록** 적혀 있었다. 사용자가 실제로 새 세션에서 "Figma 노드: 421:3078"만 주고(이미 매핑돼 있으므로 CHECKPOINT.md M1 실행서가 명시한 대로 링크 없이) 파이프라인을 실행하자, 에이전트가 이 문자 그대로의 1번 지시를 따라 `get_metadata`/`get_design_context` 호출에 필요한 Figma 파일 URL을 사용자에게 요구하며 멈췄다 — component-map.json에 이미 완전한 매핑이 있었는데도. 이건 `pipeline-codegen.mjs` 스크립트 자체는 정확히 문서대로 동작한다는 걸 여러 차례(2026-07-20·07-27 예행연습) 확인해온 것과 별개로, **에이전트가 그 스크립트에 도달하기도 전에 절차 문서의 빈 분기 때문에 멈춰버리는 상위 레벨 결함**이었다 — `04_PROJECT_SPEC.md` ALWAYS DO "생성 전 component-map.json에서 기존 컴포넌트 재사용 먼저 검토" 원칙이 원칙으로는 존재했지만 `pipeline.md`의 구체적 단계 순서에는 강제돼 있지 않았던 것이다. 수정: `pipeline.md`에 "0번" 단계를 신설해 — component-map.json에 해당 노드가 이미 매핑돼 있으면 1·2번(Figma 읽기·매핑 기록)을 건너뛰고 바로 3번(코드 생성)으로 가도록 명시하고, 1·2번 제목에 "(0번에서 매핑을 못 찾았을 때만)"을 못박았다. 이건 Node 스크립트가 아니라 에이전트용 절차 문서 수정이라 `npm test`로 회귀 검증은 불가능하다(에이전트가 마크다운 지시를 따르는 행동 자체를 자동 테스트할 수 없음) — 대신 새 세션에서의 4번째 M1 시도가 이 수정의 유일한 실증 방법이다. **이 0번 단계를 다시 지우지 말 것** — 지우면 "재사용 경로"라는 이름이 다시 거짓이 된다.

**위 수정은 "프로젝트 밖 탈출"만 막았지 ".design-kit/ 밖"은 못 막았다 (2026-08-04, 같은 날 실제 새 세션 M1 재시도 중 실측 발견·수정 — 결정 기록)**: 위 수정 직후 사용자가 실제로 새 세션에서 M1을 재시도했는데(`runId 2026-08-04-005`), 판정서의 스크린샷 경로가 `../reports/screenshots/360.png`처럼 `..`로 시작하는 것을 발견해 추적한 결과, 에이전트가 넘긴 상대경로(`.design-kit`를 안 포함한 형태)가 프로젝트 루트 기준으로는 정규화됐지만 **`.design-kit/` 밖의 형제 폴더**(`Fixture\reports\screenshots\`)에 저장돼 있었다. 이 위치는 02가 정의한 정본 위치(`.design-kit/reports/screenshots/`)가 아니라서 `pruneScreenshots()` 보관 정리 대상도 아니고, `.gitignore`가 `.design-kit/reports/screenshots/`만 등록해뒀으므로 **git에 그대로 추적되는 상태**(실측: `git status`에 `?? reports/`)로 남았다. 에이전트가 상대경로에 `.design-kit`를 안 붙이는 경향이 서로 다른 두 라이브 세션에서 전부 재현됐으므로(우연이 아님), 기준점을 프로젝트 루트에서 **`.design-kit/`** 자체로 올렸다 — 이미 `.design-kit`로 시작하는 상대경로를 주는 드문 경우만 중복 접두 방지로 한 겹 벗겨낸다. 다른 cwd에서 원래 사고와 동일한 상대경로(`reports\screenshots`)로 재현 테스트해 이번엔 `.design-kit\reports\screenshots\` 안에 정확히 저장되는 것을 실측 확인, 회귀 테스트 2건 신설(정상 케이스 + 중복 접두 방지 케이스, `tests/verify-runner.test.mjs`). 잘못 놓였던 스크린샷 파일들은 정리하되, 실제 라이브 판정 기록(`2026-08-04-005.json`/`.md`)은 그 순간의 정직한 역사적 기록이라 보존했다. **`.design-kit/` 기준을 다시 프로젝트 루트로 낮추지 말 것** — 낮추는 순간 이 결함이 그대로 재현된다.

---

**`.design-kit/.lock` 실행 잠금이 구현됐다 (2026-08-09, Phase 2 첫 증분 — 대시보드 자체보다 먼저 독립 구현한 전제조건)**: 04 연결/동기화 스펙 2번("실행 1개" 원칙)이 그동안 문서로만 존재하고 코드가 0줄이었다 — 이 프로젝트가 반복해온 "문서엔 규칙이 있는데 강제하는 코드가 없다" 패턴(22차·26차·28차·34차와 동일 구조)의 10번째 후보였다. `scripts/execution-lock.mjs`에 `acquireLock()`/`releaseLock()`을 구현하고 `verify-runner.mjs`의 `main()`(dev server 포트 점유~판정서 기록 전체 구간)에 배선했다. 살아있는 PID가 잠금을 쥐고 있으면 거부, 죽은 PID가 남긴 stale 잠금은 PID 생존 확인 후에만 회수(자동 삭제 아님 — 04 스펙의 오판 방지 요구 그대로), 잠금 파일 손상 시 조용히 덮어쓰지 않고 fail-closed(`hooks/verify-gate.mjs` `decide()`와 동일 원칙). 단위테스트 11건 신설(`npm test` 79/79) + **실제 프로세스 2개로 동시 실행 실측**: 픽스처 대상 CLI 2개를 거의 동시에 실행해 1번째는 PASS로 완료·2번째는 `[lock] 다른 실행이 이미 진행 중입니다 (PID ...)`로 정확히 거부되는 것을 확인, 거부된 실행은 `runs/`에 파일을 전혀 남기지 않음(순번 오염 없음)까지 실측 확인. `.design-kit/.lock`은 대상 프로젝트 `.gitignore`에 자동 등록(스크린샷·`.api-token`과 동일 패턴). **범위를 의도적으로 좁혔다**: 대시보드 자체(읽기 화면·재검증 트리거 버튼)는 이번 증분에 포함하지 않음 — `.lock`은 대시보드가 재검증 트리거를 갖기 **전에** 반드시 있어야 하는 전제조건이라 먼저 독립적으로 완결했다(대시보드는 이 프로젝트가 가장 취약한 패턴에 가장 가깝게 서 있는 기능이라, 한 번에 통째로 만들지 않고 쪼개어 검증하는 전략).

---

**대시보드 서버 골격(2a)이 구현됐다 (2026-08-09, `.lock`과 동일 전략 — 통째로 만들지 않고 보안 primitive만 먼저 독립 증명)**: `scripts/dashboard-server.mjs` 신설. O-Brain(`26y_06m_21d_SoDam_O-Brain/app/src/server.mjs`)의 실측 검증된 패턴(127.0.0.1 전용 바인딩·Origin 검사·CSP/nosniff/frame-ancestors 헤더·`crypto.randomBytes` 실행별 토큰)을 실제로 읽고 이식했다(추측 재발명이 아님). O-Brain 원본과 다른 점 1가지: 토큰 비교를 `crypto.timingSafeEqual`로 강화(O-Brain은 `!==` 직접 비교 — 01 §6에서 Should 항목이라 생략된 것으로 보임, Node 내장 함수라 비용 없이 반영). express 대신 Node 내장 `http`만 사용(이 킷은 웹 프레임워크 의존성이 0개라 신규 의존성 없이 골격만으로 충분 — 공급망 최소화 원칙). 포트는 `verify-runner.mjs`의 `findAvailablePort()`를 그대로 재사용하되 대역만 분리(4570~4590, dev server 3000~3020과 무충돌). **범위 — `/health` 라우트 1개뿐, 데이터 0건**: 판정서·스크린샷 열람은 2b, 재검증 트리거는 2c로 의도적으로 미룸. 단위테스트 17건 신설(`npm test` 79→96) + 실제 HTTP 왕복 테스트 1건(mock 아닌 진짜 소켓) + **실제 CLI로 픽스처 대상 기동해 실측**: `Get-NetTCPConnection`으로 127.0.0.1 단독 바인딩 확인(0.0.0.0 아님), 올바른 토큰 200/틀린 토큰 403/토큰 없음 403/CSP 헤더 응답에 실제로 포함까지 전부 확인. `.api-token`은 `.lock`과 동일 패턴으로 대상 프로젝트 `.gitignore`에 자동 등록. `npm audit` 0건 유지.

---

**대시보드 데이터 API(2b-1)가 구현됐다 (2026-08-09, 2a 다음 증분 — 경로 조작 방어만 독립 증명)**: `/api/runs`(목록)·`/api/reports/:runId`(판정서 원문)·`/api/screenshots/*`(PNG 서빙) 3개 GET 라우트를 `scripts/dashboard-server.mjs`에 추가했다. 04_PROJECT_SPEC.md DO NOT가 **이름으로 지목한** "스크린샷 서빙" 경로 조작 위험을 정면으로 다뤘다 — runId는 정규식(`^\d{4}-\d{2}-\d{2}-\d{3}$`)으로 먼저 걸러 조작 문자가 애초에 통과할 수 없게 하고, 스크린샷 경로는 `path.resolve`+`startsWith` 검증(`registerNewComponent()`와 동일 패턴 재사용) + `.png` 확장자 화이트리스트 두 겹으로 막았다. HTML 렌더(XSS 위험이 실제로 발생하는 지점)는 의도적으로 2b-2로 미뤘다 — JSON 전송 단계엔 브라우저가 실행할 마크업이 없어 이 단계의 진짜 위험은 경로 조작뿐이라고 판단했기 때문. 대시보드는 여전히 GET만 존재(쓰기 0개 — 02 결정 기록 계약 유지). 단위테스트 13건 신설(96→109, 경로 조작·확장자 화이트리스트·손상 파일 skip·빈 이력 케이스 포함) + **실제 픽스처(진짜 실행 이력 50건) 대상 실측**: `/api/runs` 200(50건, 최신순)·`/api/reports/<실ID>` 200(실제 내용)·`/api/screenshots/pipeline-421-3078/360.png` 200(진짜 PNG 3469바이트, `image/png`)·`/api/reports/..%2f..%2fpackage`와 `/api/screenshots/..%2f..%2fpackage.json` 둘 다 400으로 차단됨을 확인. `npm audit` 0건 유지.

---

**대시보드 실제 화면(2b-2)이 구현됐다 (2026-08-09, 2b-1 다음 증분 — XSS 방어 독립 증명)**: `scripts/dashboard-web/index.html`+`dashboard.js` 신설, `dashboard-server.mjs`의 `GET /`·`GET /dashboard.js`를 토큰 검사 밖에 뒀다(페이지를 열어야 토큰을 얻을 수 있는 순환 문제 회피 — O-Brain과 동일 전제, `/api/*` 데이터는 계속 토큰 보호). 착수 전 설계 검토에서 실제로 터졌을 결함 2건을 미리 잡았다: ① `<img src>`는 커스텀 헤더를 못 보내 스크린샷이 403으로 깨질 뻔함 → `fetch()`+토큰 헤더+`Blob`→`URL.createObjectURL()`로 해결(토큰을 URL 파라미터에 넣지 않음 — 히스토리·referrer 노출 방지) ② 인라인 `<script>`를 쓰면 2a에서 O-Brain보다 엄격하게 만든 CSP(`script-src 'self'`, unsafe-inline 없음)에 자기 스크립트가 막힐 뻔함 → `dashboard.js`를 완전히 외부 파일로 분리해 해결(CSP 완화 안 함). `/api/reports/:runId` 응답에 `screenshots` 배열 신설(`extractScreenshotPaths()` — report-writer.mjs가 이미 만드는 마크다운 형식을 그대로 파싱, 새 마크다운 파서 안 들임). `dashboard.js`는 전체 파일에서 `innerHTML`을 단 한 번도 쓰지 않고 `textContent`/`createElement`만 사용. 단위테스트 7건 신설(109→116) 중 하나가 **실제 헤드리스 브라우저(Playwright — 기존 의존성, 신규 추가 없음)로 악성 payload를 실제 렌더한 XSS 방어 실측**: `<script>`·`onerror`·`onmouseover` 3종 공격 벡터를 담은 가짜 run/report를 만들어 실제 페이지 로드+클릭까지 거치고 `window.__xssFired`가 여전히 `undefined`임을 확인(코드 형태가 아니라 실행 결과로 증명) + 원문 텍스트가 화면에서 사라지지 않고 그대로 보임(조용히 필터링된 게 아님)까지 확인. 실제 픽스처(실행 이력 50건) 대상으로 `GET /`이 토큰 없이 200 + 토큰이 `data-token` 속성에 정확히 주입됨을 실측 확인. `npm audit` 0건 유지. 01_PRD.md §3 설치 확인 기준("대시보드=127.0.0.1 페이지 로드")이 이제 실제로 충족된다.

---

**재검증 트리거(2c)가 구현됐다 (2026-08-09, 2b-2 다음 증분 — Phase 2 대시보드 4단계 전부 완료)**: 대시보드에 "재검증" 버튼이 생겼다. 착수 전 설계 검토에서 실제로 막혔을 문제 2가지를 먼저 해결했다: ① `PipelineRun`에 `route` 필드가 저장된 적이 없어(위 스키마 표 참조) 재검증이 애초에 불가능했음 → `report-writer.mjs`·`verify-runner.mjs`에 배선해 이제부터 저장됨(2026-08-09 이전 판정서는 route가 없어 재검증 명확히 거부 — 경로를 추측해서 땜질하지 않음). ② "대시보드는 GET만"이라는 전제가 틀렸다는 걸 재확인 — 02가 금지한 건 "직접 쓰기"이지 "POST"가 아니었다(트리거≠쓰기). `POST /api/reverify/:runId` 1개만 예외로 허용, 나머지는 여전히 GET-only. `reverifyRun()`은 `verify-runner.mjs`의 `main()`을 건드리지 않고 이미 export된 코어 함수(`acquireLock`·`startDevServer`·`verifyPage`·`judge`·`writeReport`·`releaseLock`)를 그대로 호출해 재현(01 §3 Parity Matrix 원칙 그대로). `execution-lock.mjs`의 잠금 거부 에러에 `statusCode: 409`를 부여해 화면이 "이미 다른 검증이 진행 중" 문구로 번역해 보여줄 수 있게 함. 단위테스트 6건 신설(거부 경로만 — 성공 경로는 실제 Next.js dev server가 필요해 자기완결적 테스트 스위트엔 안 맞음, verify-runner.test.mjs가 정적 스텁 서버를 쓰는 것과 같은 이유로 실제 픽스처 실측으로 대체) + **실제 픽스처(실제 Next.js dev server) 대상 실측**: `--route` 포함한 진짜 run 시드 생성 → 토큰 없는 POST 403 / 허용 안 된 Origin+정상 토큰 POST 403(위조 요청 방어) / **진짜 동시 POST 2건 발사 — 하나는 200(PASS 새 판정서 생성), 하나는 409(거부, 파일 생성 없음)** 확인. 기존 판정서 50건 전부 보존(52건 = 50+시드1+성공1, 거부분은 파일 0개). `npm audit` 0건. **Phase 2 대시보드가 이걸로 4단계(`.lock`→2a→2b-1→2b-2→2c) 전부 완료됐다.**

---

**독립 검증 라운드(2026-08-09, 2c 직후 — 문서 감사가 아닌 실제 테스트·재현·수정)**: 이번 세션에서 구현한 전체(`.lock`·대시보드 4단계)를 처음부터 다시 실제로 검증했다. 단위테스트 123/123·`npm audit` 0건·E2E 셀프테스트(PASS/FAIL/재검증) 전부 통과 확인, CLI↔대시보드 교차 `.lock`(서로 다른 진입점 간 동시성) 신규 실측 확인, 극단적 입력(5000자 runId·유니코드·잘못된 URL 인코딩)에도 서버가 크래시 없이 400을 내는 것 확인. **실제 브라우저(Playwright)로 실 픽스처를 열어보다가 진짜 결함 1건 발견**: `--screenshotDir`에 `reports/` 접두가 빠진 상대경로(예: `"screenshots/foo"`)를 주면 정규화 규칙(32/33차 결정)에 따라 `.design-kit/screenshots/`에 저장되는데, 이 위치는 `.gitignore`에 등록돼 있지 않아 `git add`로 스크린샷이 커밋될 수 있는 상태였다(실측: `git status`에 노출 확인). 22차·32차·33차와 같은 계열의 결함. **수정**: `report-writer.mjs`·`setup-wizard.mjs`의 `ensureScreenshotsGitignored()`가 이제 정본 위치(`.design-kit/reports/screenshots/`)와 이 경로(`.design-kit/screenshots/`) 둘 다 등록한다. 회귀 테스트 1건 신설(`npm test` 122→123), 실제 픽스처에 자가 치유 적용해 `git status`로 노출 해소 재확인. **의도적으로 안 한 것**: `readScreenshotFile()`이 정본 위치 밖 파일을 서빙하도록 넓히지 않음 — 그건 경로 조작 방어(04 DO NOT)를 약화시키는 방향이라, 정본 위치 밖 스크린샷은 대시보드가 계속 정확히 거부하는 게 맞는 설계(UI는 "(로드 실패)"로 우아하게 처리, 크래시 없음).

---

**대시보드 진입점(`/sodam-design-kit:open`)이 구현됐다 (2026-08-09, 독립 검증 직후 — 새로 발견된 공백 해소)**: 위 독립 검증 라운드 도중 PRD(01 §3·03 Phase 2)가 명시한 `/sodam-design-kit:open` 슬래시 명령이 실제로는 어디에도 존재하지 않는다는 걸 발견했다 — `commands/` 폴더엔 `setup.md`·`pipeline.md`뿐이었고, `startDashboardServer()` 엔진은 이미 완성돼 있었지만 사용자가 그걸 실행할 방법이 없었다(엔진은 있는데 문이 없는 상태). 착수 전 검토에서 진짜 걸림돌 하나를 미리 잡았다: 슬래시 명령은 실행 후 바로 반환돼야 하는데 HTTP 서버는 계속 떠 있어야 한다 — `spawn(..., {detached:true}).unref()`로 자기 자신을 `--serve` 플래그로 분리 실행해 해결. 새 상태 파일 `.design-kit/.dashboard.json`(pid·port·url만, 토큰은 절대 안 넣음)을 신설해 "이미 떠 있으면 재사용"(포트 낭비·중복 프로세스 방지, execution-lock.mjs의 stale PID 판정과 동일 원칙)과 `--stop` 종료를 가능하게 했다. 브라우저 자동 실행은 OS별 바이너리를 인자 배열로 직접 호출(Windows `cmd /c start "" <url>`)해 04 DO NOT("셸 문자열 조합 금지")를 지켰다. 개발 중 실제로 잡은 버그 1건: `ensureDashboardRunning()`이 stale 상태를 확인하고도 그 파일을 안 지운 채 새 자식을 기다리면, 대기 로직이 "파일이 존재함"만 보고 옛 정보를 새 정보로 착각해 반환했다(테스트로 재현·확인 후 즉시 수정 — stale 판정 시 파일을 먼저 지우고 기다리도록). 단위테스트 12건 신설(재사용/새로시작/stale회수/대기시간초과/종료 3가지 경로/브라우저 호출 형태, `isAlive`·`kill`·`spawnFn` 전부 주입 가능해 테스트가 실제 시스템 프로세스를 건드리지 않음) + **진짜 분리 프로세스로 왕복하는 테스트 1건**(가짜 함수 없이 실제 자식 프로세스를 진짜로 띄우고 진짜 HTTP 200을 받고 진짜로 종료시킴, `npm test` 123→134) + **실제 픽스처 대상 수동 실측**: 기동→HTTP 200 실응답→Chrome이 실제로 새로 열림(프로세스 생성 시각이 서버 시작 시각과 정확히 일치하는 것으로 확인)→재실행 시 재사용(중복 기동 없음)→`--stop`으로 실제 PID 종료→포트 응답 중단(ECONNREFUSED)까지 전 구간 확인. `npm audit` 0건 유지. **이걸로 대시보드가 "엔진은 완성, 문은 없음" 상태에서 실제로 도달 가능한 기능이 됐다.**

---

**로컬 시각 회귀 감지가 구현됐다 (2026-08-09, Phase 2 대시보드+진입점 완료 다음 증분)**: `scripts/visual-regression.mjs` 신설. 핵심 설계 결정 — axe-core는 위반이 "항상 나쁜 것"이라 상시 Must 게이트지만, 스크린샷 diff는 의도적 디자인 변경도 항상 "다름"으로 나오므로 같은 방식으로 상시 게이트화하면 정상 작업마다 FAIL이 남발된다. 그래서 **opt-in**(`--visualRegression` 플래그, config.json 미소비 — 이 킷은 현재 config.json의 gateEnabled/a11yLevel도 어디서도 안 읽는 기존 공백이 있어 이번 증분에서 그 공백을 넓히지 않고 기존 --target류 CLI 플래그 패턴을 그대로 따름)으로 설계했고, 새 화면을 "정상"으로 받아들이는 것도 `--promoteBaseline`(PASS일 때만 허용)으로 사람이 명시 승인해야 한다. 허용오차 1%(픽셀 비율)로 안티앨리어싱 잡음을 흡수 — 04 ALWAYS DO의 "2연속 FAIL만 확정" flaky 방지 원칙과 같은 결. 기준본은 `.design-kit/reports/baseline/<routeSlug>/<viewport>.png`(02 파일 트리에 이미 예약돼 있던 위치, 커밋 대상). 새 의존성 `pixelmatch`(ISC)·`pngjs`(MIT) 둘 다 초경량·permissive. 단위테스트 8건(routeToSlug·동일이미지·허용오차 안/밖·크기불일치·기준본없음·승격 왕복·diff이미지 생성) + **실제 픽스처로 진짜 회귀 1건을 고의로 만들어 실측**: 기준본 승격(PASS, no-baseline→matched 전환) → 무변경 재실행 matched(diffRatio 0) → 프리뷰 배경색을 흰색→마젠타로 고의 변경 후 재실행 **3개 뷰포트 전부 regression(99%+ 차이) + verdict FAIL** 실측(exit code 1 확인) + diff PNG 3장 실제 생성 확인 → 원상복구 후 matched/PASS 복귀 재확인. 이 과정 중 Bash(Git Bash)로 `preview-route.mjs`를 재실행했다가 `@/` import 경로가 `@C:/Program Files/Git/...`로 오염되는 걸 실측 재현(이 프로젝트가 이미 알고 있던 Windows/Git Bash `/`-인자 오염 함정의 새 사례 — `--route` 뿐 아니라 `--importPath` 값도 영향받음이 이번에 처음 확인됨) — 즉시 Edit 도구로 직접 수정해 복구, PowerShell로 재검증해 정상 확인. **의도적으로 안 한 것**: `commands/pipeline.md` 표준 흐름에 자동 편입하지 않음(매 실행마다 기본 on으로 할지는 별도 UX 결정, 이번 범위는 코어 엔진+CLI 플래그까지).

---

**폰트 파이프라인 A(전자동)가 구현됐다 (2026-08-09, 시각 회귀 다음 증분 — Phase 2 남은 3개 중 첫 착수)**: `scripts/font-pipeline.mjs` 신설. 범위는 A(자동 다운로드+라이선스 보존+ASSET-LEDGER.csv 최초 생성+`next/font/local` 모듈 생성)만 — B(반자동 3종 비교)·C(폰트 게이트 FAIL)는 의도적으로 이번 범위 밖(03_PHASES.md에 별도 기록). 핵심 설계: (1) **화이트리스트 URL을 짐작으로 박지 않고 전부 실측 확인** — 처음 시도한 Pretendard 경로(`packages/.../static/*.woff2`)는 실제로 404였고, GitHub API로 실제 저장소 구조를 조회해서야 올바른 경로(`.otf`, 릴리스 태그 `v1.3.9`로 고정해 재현성 확보)를 찾았다. Noto Sans KR은 `google/fonts` 공식 저장소 경로가 처음부터 맞았다(HEAD 요청 200 확인). (2) **04 DO NOT "다운로드 후 파일 형식 검증·실행 금지"를 매직 바이트 검사로 구현** — OTF(`OTTO`)·WOFF2(`wOF2`)·WOFF(`wOFF`)·TTF(`sfnt` 시그니처) 인식, 폰트가 아닌 응답(예: 404 에러 HTML)은 저장하지 않고 즉시 거부. (3) **대상 프로젝트의 기존 파일(layout.tsx 등)은 자동으로 안 건드림** — 01 §5 "로직 불변경 제약"과 같은 원칙, `next/font/local` 모듈만 새로 생성하고 실제 연결은 사용자 몫(모듈 파일에 사용법 주석 포함). (4) **멱등성** — 이미 받아둔 폰트는 재실행해도 네트워크를 다시 안 탐(setup-wizard.mjs와 같은 원칙). 단위테스트 12건 신설(143→155, 실제 네트워크 없이 fetchFn 주입으로 결정적 검증 — CI·오프라인 환경에서도 항상 통과해야 하므로) + **실제 네트워크로 Pretendard 진짜 다운로드 실측**: 실제 픽스처 대상 1.5MB 진짜 OTF 파일 저장 확인, `ASSET-LEDGER.csv`가 실제로 처음 생성되며 헤더+행 정확히 기록됨을 확인, 생성된 `next/font/local` 모듈의 상대경로가 실제로 올바르게 계산됨(`src/lib/design-kit-fonts/pretendard.ts`에서 `../../../.design-kit/fonts/...`) 확인, 재실행 시 네트워크 재호출·대장 중복 행 없음(멱등성) 실측 확인. `npm audit` 0건(새 의존성 없음 — Node 내장 `fetch`만 사용).

---

**독립 검증 라운드에서 실제 결함 2건을 발견·수정했다 (2026-08-09, 폰트 파이프라인 A 직후 — 사용자 요청으로 정상/예외/경계값/실패 시나리오까지 포함한 종합 검증, 이 감사 이력 갱신을 당시 누락했다가 아래 폰트 게이트 C 착수 전 재검토에서 발견해 소급 기록)**: ① `dashboard-server.mjs`의 `extractScreenshotPaths()`가 문서 전체를 구간 구분 없이 훑어, 시각 회귀가 추가한 "## 시각 회귀" 섹션의 동일 형식 줄(`- 360px: ...`)을 진짜 스크린샷으로 오인했다 — `## ` 헤딩을 지날 때마다 "지금 screenshots 섹션 안인가"를 재판정하는 구간 인식 파서로 수정, 실제 픽스처의 PASS·FAIL 판정서 둘 다로 재확인, 회귀 테스트 신설. **이 구간 스코핑을 다시 문서 전체 스캔으로 되돌리지 말 것** — 새 `## ` 섹션이 추가될 때마다(실제로 바로 다음 라운드에 "## 폰트 게이트" 섹션이 추가됨) 같은 오인식이 재현된다. ② `visual-regression.mjs`의 `diffScreenshot()`이 손상된 PNG를 받으면 처리되지 않은 예외를 던져, 이미 계산된 axe·렌더 등 다른 결과까지 포함해 `verify-runner.mjs` 전체를 크래시시켰다 — `execution-lock.mjs`의 fail-closed 원칙과 같은 방향으로, 크래시 대신 안전하게 `regression`으로 판정하도록 수정(사유 필드에 손상 사실 기록). 두 결함 다 손상된 입력을 만들어 재현 후 수정하는 순서를 지켰다. `npm test` 155→157.

---

**폰트 게이트 C가 구현됐다 (2026-08-10, opt-in으로 정밀화 — 04_PROJECT_SPEC.md ALWAYS DO 원문과의 의도적 차이)**: `font-pipeline.mjs`에 `scanProjectFontFiles()`(node_modules·.git·.next·dist·build·out·.turbo·.vercel 제외 재귀 스캔, .ttf/.otf/.woff/.woff2 — 원문은 .woff2만 나열했지만 .woff를 빼면 그 확장자로 미등록 폰트를 넣는 사각지대가 생겨 게이트 목적이 무너지므로 확장)·`loadAssetLedgerFilenames()`(ASSET-LEDGER.csv를 파싱해 파일명을 프로젝트 루트 기준 상대경로로 정규화)·`checkFontGate()`(둘을 대조해 미등록분만 골라냄) 3개 함수를 신설했다. **핵심 설계 결정 — 원문의 "상시" 뉘앙스를 그대로 구현하지 않았다**: 이 검사를 상시 게이트로 켜면, 폰트 파이프라인 A를 한 번도 안 써본 프로젝트(ASSET-LEDGER.csv가 없거나 비어 있는 모든 프로젝트 — 2026-08-09 이전에 완료된 P1 픽스처 포함)가 원래 갖고 있던 폰트 파일이 전부 "미등록"으로 갑자기 FAIL 처리된다. 이는 axe(위반이 항상 나쁜 것이라 상시 Must)와 다르다 — axe와 달리 이 검사는 "이미 정상이던 완료 상태"를 예고 없이 뒤집을 수 있는 성격이라, 시각 회귀(2026-08-09)가 opt-in을 택한 것과 정확히 같은 이유로 `verify-runner.mjs --fontGate` 플래그 뒤에 뒀다(안 쓰면 `judge()`가 기존 4조건과 완전히 동일하게 동작 — `fontGateViolations` 기본값 `[]`). "10항 점검 답변"·"로고 워드마크 수동 확인"(원문이 요구하는 화이트리스트 밖 폰트의 세부 판단)은 이번 범위 밖으로 남겼다 — 이 게이트는 "대장에 등록됐는가/안 됐는가"만 기계적으로 확인하고, 등록 자체(출처·라이선스·10항 답변을 대장에 기록하는 행위)는 사람이나 별도 도구의 몫이다. 단위테스트 15건 신설(157→172, 대문자 확장자 인식·node_modules 제외·빈 프로젝트·정상 등록/미등록 혼재 케이스 포함) + **실제 픽스처로 왕복 실측**: 정상 등록된 pretendard만 있을 때 위반 0건(PASS) → `public/fonts/MysteryBrand.ttf`(미등록) 추가 후 재실행 FAIL(`runId 2026-08-10-001`, 판정서에 파일 경로가 프로젝트 루트 기준 상대경로로 정확히 기록됨을 확인) → 파일 제거 후 재실행 PASS 복귀(`2026-08-10-002`) → `--fontGate` 미사용 시 출력 JSON에 `fontGate` 키 자체가 없음(하위 호환)까지 확인. `report-writer.mjs`에 "## 폰트 게이트" 섹션을 추가하면서, 위 46차가 고친 대시보드 구간 파서가 "## 시각 회귀"·"## 폰트 게이트"·"## screenshots" 세 섹션이 동시에 있어도 정확히 동작하는지 회귀 테스트로 재확인했다(구간 스코핑 수정이 신규 섹션에도 일반화됨을 실측 증명). `npm audit` 0건(새 의존성 없음). **이 opt-in 설계를 다시 상시 게이트로 되돌리지 말 것** — 되돌리면 이 문단이 막으려 한 회귀(기존 프로젝트의 정상 상태가 예고 없이 FAIL로 뒤집힘)가 그대로 재현된다.

---

**대시보드 스크린샷이 실제 브라우저에서 한 번도 제대로 보인 적이 없었다는 게 실측으로 드러났다 (2026-08-10 — 2b-2 완료 선언 이후 처음으로 "이미지가 실제로 뜨는가"를 헤드리스 브라우저로 직접 확인)**: 지금까지의 대시보드 검증(2b-2 XSS 방어 실측 포함)은 전부 "페이지가 로드되는가"·"악성 스크립트가 실행 안 되는가"만 확인했지, "스크린샷 `<img>`가 실제로 픽셀을 갖고 렌더되는가"는 아무도 직접 본 적이 없었다. 이번에 처음으로 실제 판정서를 열어 확인한 결과 **두 결함이 겹쳐서 항상 조용히 실패하고 있었다**: ① `dashboard.js`가 요청 URL을 `/api/screenshots/` + `report.screenshots[].path`로 만드는데, 이 `path` 값은 `report-writer.mjs`가 이미 `.design-kit/` 기준으로 상대화해둔 값(`reports/screenshots/<run>/<file>.png`)이라 `readScreenshotFile()`이 기대하는 "screenshots 폴더 기준 상대경로"와 접두어가 겹쳐 요청이 늘 404였다. ② 이 접두어를 벗겨내 200을 받아도, `loadScreenshotInto()`가 인증 헤더를 붙이려고 fetch+Blob+`URL.createObjectURL()`로 만든 `blob:` URL을 CSP의 `img-src`가 `data:`만 허용하고 `blob:`은 안 넣어둬서 브라우저가 조용히 차단했다(콘솔 에러만 남고 페이지는 안 죽어서 지금까지 발견되지 않음). 화면엔 그저 "(로드 실패)"만 표시돼 있었을 뿐이라, 눈으로 스크롤만 봐서는 "판정서는 열리네" 정도로 지나치기 쉬웠던 결함이다. **수정**: `readScreenshotFile()`이 알려진 접두어(`reports/screenshots/`)를 정규화해서 벗겨내되(경로 조작 방어의 resolve+startsWith 검증은 정규화 *이후*에 그대로 적용 — 방어 약화 없음, `../`를 접두어 뒤에 숨긴 케이스로 회귀 테스트 추가) `img-src`에 `blob:`을 추가(다른 CSP 지시어는 그대로). 회귀 테스트 4건 신설(175→178) + **실제 헤드리스 브라우저로 실제 픽스처의 실제 판정서(폰트게이트+시각회귀 동시 opt-in)를 열어 재검증**: 수정 전 콘솔 에러 3건(404) → 수정 1단계 후 콘솔 에러 3건(CSP 위반, 다른 에러로 전환) → 수정 2단계 후 콘솔 에러 0건 + `<img>` 3개의 `naturalWidth`/`naturalHeight`가 설정된 3개 뷰포트(360×800·768×1024·1440×900)와 정확히 일치함을 확인(빈 이미지가 아니라 진짜 픽셀이 들어있다는 증거). **이 두 곳(경로 정규화·CSP img-src)을 다시 되돌리지 말 것** — 되돌리면 스크린샷이 다시 조용히 안 보이는 상태로 돌아간다.

---

**사용자가 실제로 새 세션에서 라이브 테스트를 하다가 e2e-selftest.mjs 판정서가 재검증이 안 되는 걸 발견했다 (2026-08-10)**: 대시보드에서 e2e-selftest.mjs가 만든 판정서의 "재검증" 버튼을 눌렀더니 "이 실행 기록엔 route 정보가 없어 재검증할 수 없습니다(오래된 판정서)"라는, 방금 막 생성된 기록인데도 "오래된"이라고 오인시키는 문구가 떴다. 이 거부 자체는 정상 설계(위 2c 결정 기록 — route 없는 판정서는 추측 없이 거부)이지만, `e2e-selftest.mjs`의 `runCase()`가 `route`를 `verifyPage()`에는 넘기면서 `writeReport()`에는 빠뜨려서(당시 export 시그니처엔 이미 있었는데 이 호출부만 안 채워짐) **이 자기점검 도구가 만드는 판정서는 전부 영구히 재검증 불가 상태로 남아있었다.** route는 이미 로컬 변수로 있어 그대로 전달하는 한 줄 수정. 재실행해 `runs/*.json`에 `"route": "/"`가 실제로 들어가는 것 확인 + `reverifyRun()`을 직접 호출해 수정 전엔 400이던 게 수정 후 실제로 재검증까지 완료(새 PASS 판정서 생성)되는 것 실측 확인. **이 route 누락을 다시 방치하지 말 것** — `writeReport()`를 새로 호출하는 곳이 생기면 매번 route를 실제로 채우는지 확인할 것.

**상세페이지 파이프라인이 구현됐다 (2026-08-10, Phase 3 첫 착수 항목)**: `scripts/detail-page-pipeline.mjs` 신설. 착수 전 설계 검토에서 실제로 걸렸을 문제 1건을 미리 잡았다 — `registerPageTemplate()`이 codePath 기본값을 계산할 때(`detectAppDir()` 호출) 이 계산을 함수 맨 앞에 둘 뻔했는데, 그러면 sourceFile 누락·하드코딩 값·`dangerouslySetInnerHTML` 같은 app 디렉터리와 무관한 실패가 전부 "Next.js app 디렉터리를 찾을 수 없습니다"라는 엉뚱한 에러로 가려진다(오인시키는 에러 메시지 — 이 프로젝트가 반복 경계해온 패턴, 51차 "오래된 판정서" 문구와 같은 종류). 구현 단계에서 이 순서를 바로잡아 detectAppDir 계산을 모든 검사를 통과한 뒤로 옮겼다. 단위테스트 22건 신설(178→200, 이 순서 결함을 잡아낸 테스트 포함) + **실제 픽스처로 왕복 실측**: `sample-products.csv`(더미 상품 2건)로 CLI 체인 실행 → `detectAppDir()`이 픽스처의 실제 구조(`src/app`)를 정확히 감지해 `src/app/products/[slug]/page.tsx`·`src/data/products/sample-mug.json`에 배치 → `verify-runner.mjs`(수정 없이 그대로 재사용) 실행 PASS(스크린샷 3장) → 배치된 페이지에 `alt` 없는 `<img>`를 의도적으로 주입해 재실행 → 실제 axe critical 위반(`image-alt`) 1건으로 FAIL 실측 → 원상복구 후 PASS 복귀 확인. `npm audit` 0건(새 의존성 없음 — 카피 생성은 에이전트 자신이 하므로 외부 API 불필요). **이 검사 순서(존재성·중복등록·하드코딩·XSS 검사 → codePath 계산)를 다시 앞뒤로 바꾸지 말 것** — 바꾸면 무관한 실패가 엉뚱한 에러 메시지로 가려지는 문제가 재현된다.

## [NEEDS CLARIFICATION]

- [x] **reports/screenshots 용량 관리 (2026-07-19 재감사 확정 · 2026-07-20 실제 구현 완료)** — 최근 10회 실행분만 보관·초과분 자동 삭제 + `.gitignore`에 screenshots 등록(판정서 MD만 커밋). 단 **시각 회귀 기준본은 `reports/baseline/`로 분리해 보관 정책에서 제외**(커밋 대상). 근거: 기준본까지 자동 삭제되면 Phase 2 시각 회귀가 자멸하는 정책 간 충돌이 있었음 — 분리로 해소.
  - **실측 발견(2026-07-20)**: "확정"으로 체크돼 있었지만 실제 코드가 없어 픽스처 프로젝트에 스크린샷 폴더가 16개까지 무제한 누적됐고, `.gitignore`에도 등록되지 않아 `.design-kit/` 전체가 git에 untracked 상태로 방치되고 있었음(둘 다 실측 확인). `report-writer.mjs`에 `pruneScreenshots()`(오래된 폴더부터 삭제, `writeReport()`마다 자동 실행) + `setup-wizard.mjs`에 `ensureScreenshotsGitignored()`(setup 재실행 시 멱등 skip 경로에서도 자가 치유) 추가로 수정 완료. 실제 픽스처에서 16개 → 10개로 정리되고 `.gitignore`에 항목이 추가됨을 확인. **이 두 함수를 다시 제거하지 말 것** — 문서상 결정과 실제 코드를 일치시킨 결과물이다.
