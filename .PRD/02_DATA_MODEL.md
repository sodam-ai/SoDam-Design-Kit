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
    ├── ATTRIBUTION.md        # [P3, 2026-08-18 완료] 출처 표기 자동 생성(scripts/asset-ledger.mjs --generateAttribution — 커밋 대상, .gitignore 아님)
    ├── AI-GENERATION-LOG.md  # [P3, 2026-08-17 완료] AI 생성 이력 자동 append (커밋 대상 — .gitignore 아님, scripts/ai-generation-log.mjs)
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

---

**`AI-GENERATION-LOG.md` 자동 기록이 구현됐다 (2026-08-17, Phase 3 승인된 순서 ②번 — CHECKPOINT.md 1k)**: `scripts/ai-generation-log.mjs` 신설. 착수 전 위험 검토에서 이 파일이 `runs/`·`reports/`·스크린샷과 성격이 근본적으로 다르다는 걸 먼저 확인했다 — **이 파일만 `.gitignore` 대상이 아니라 커밋 대상**(위 파일 트리 참조)이고, 이 킷을 쓰는 프로젝트가 공개 저장소일 수 있다(이 킷 자신의 저장소가 실제로 PUBLIC인 것과 같은 상황). 즉 프롬프트를 시크릿 필터 없이 그대로 적으면 **버그처럼 나중에 고칠 수 있는 실패가 아니라, 커밋되는 순간 영구적으로 공개 노출되는 실패**다 — 04_PROJECT_SPEC.md Must("AI-GENERATION-LOG의 프롬프트 기록에도 시크릿 필터 적용")가 요구만 해두고 실제 구현이 없던 공백이었다. `redactSecrets()`를 먼저 만들고(API 키·GitHub/Slack 토큰·Bearer 토큰·`KEY=value`류 대입·Windows/Unix 절대경로의 사용자명 구간·40자 이상 고엔트로피 토큰 캐치올 — 패턴 기반 최선의 방어이며 100%를 보장하지 않는다고 파일에도 명시), `appendGenerationLog()`가 이걸 거치지 않은 프롬프트는 절대 쓰지 않도록 설계했다(호출자가 필터링을 깜빡할 수 없는 구조 — 함수 내부에서 항상 적용).

**범위를 의도적으로 좁혔다**: 이 로그는 "에이전트가 자유 형식으로 창작하는 콘텐츠"(현재는 상세페이지 카피)만 다룬다. Figma→코드 변환(`pipeline-codegen.mjs`)은 대상이 아니다 — `component-map.json`·`runs/*.json`에 이미 Figma 노드 ID·생성 스크립트·시각이라는 출처가 남는 결정적 변환이라 별도 이력이 필요 없다고 판단했다(01_PRD.md §7 자산표의 "코드·소재·카피" 문구를 문자 그대로 넓게 해석하지 않음 — 넓게 해석하면 이미 완료된 P1 파이프라인 전체를 재설계해야 하는 과잉 대응이 되고, 원래 목적("검증 게이트")과 무관한 범위 확장이 된다).

**이미 완료 선언된 ①상세페이지 파이프라인(1j)이 로그 없이 카피를 생성해온 공백도 확인했다**: `commands/detail-page.md`가 "아직 없는 것"으로 이미 자기 자신을 지목해두고 있었다(이 프로젝트의 정직한 자기 기록 관례). 그 절차에 4b 단계로 편입해 앞으로의 카피 생성부터 기록되게 했다 — **2026-08-10 이전(이 증분 이전)에 이미 생성된 픽스처 상품 카피는 소급 기록하지 않기로 결정**(역사적 산출물, 스크린샷 오배치 사고 때 과거 판정 기록을 보존한 것과 같은 원칙 — 과거를 고쳐 쓰지 않는다).

단위테스트 18건 신설(`npm test` 206→224) — `redactSecrets` 패턴별 검증(7종) + `appendGenerationLog` 기본 동작(헤더 생성·append-only·날짜 주입·필수값 검증) + **실제로 가짜 시크릿을 프롬프트에 넣어 파일에 원문이 남지 않는 것 실측 확인** + 04 ALWAYS DO가 요구하는 CLI 프로세스 회귀 테스트(공백·한글 경로에서 실제 실행). **실제 픽스처(Fixture) 대상 실제 CLI 실행**으로 `.design-kit/AI-GENERATION-LOG.md`가 실제로 생성되고 프롬프트·모델·날짜·생성파일이 정확히 기록되는 것 확인. `npm audit` 0건(새 의존성 없음 — Node 내장 API만 사용).

**이 파일의 시크릿 필터를 제거하거나 우회하지 말 것** — 다른 결함들과 달리 이건 사후 수정이 불가능한 공개 데이터 유출 실패 모드다. Figma→코드 변환까지 이 로그 대상으로 넓히려면(범위 확장) 별도 결정과 근거가 먼저 필요하다.

---

**마케팅 소재 파이프라인이 og(OG 이미지) 1종만으로 구현됐다 (2026-08-17, Phase 3 승인 순서 ③번 — 착수 전 실측 스파이크 통과 후 최소 범위로 시작)**: `scripts/marketing-asset-pipeline.mjs` 신설. 착수 전 위험 검토에서 이 기능이 이 킷 역사상 가장 큰 단일 증분(SNS카드·포스터·배너·명함 4종 + 신규 npm 의존성 2개)이 될 뻔했다는 걸 확인했다 — 이 프로젝트가 예외 없이 지켜온 "스파이크 먼저, 최소기능 다음" 방법론(P1의 Figma 스파이크, Phase 2 대시보드의 5단계 분할)과 정면으로 어긋나는 크기였다. **그래서 코드를 쓰기 전에 별도 스파이크를 먼저 돌렸다**: satori(JSX→SVG)+sharp(SVG→PNG)를 이 PC에 실제 설치하고, 실제 Pretendard OTF 폰트로 한글 텍스트를 렌더해 PNG로 저장한 뒤 이미지를 직접 열어 글자가 네모로 깨지지 않는지 눈으로 확인했다(Satori는 시스템 폰트를 못 쓰므로 이 확인이 실질적 성공 기준). **스파이크 도중 뜻밖의 사실을 실측으로 확인했다**: satori의 실제 `package.json` license 필드는 MIT가 아니라 **MPL-2.0**이었다 — 다만 이건 01_PRD.md §7이 14차(2026-07-19)에 이미 "axe-core·Satori는 MPL-2.0로 알려짐"이라고 적어뒀던 값과 정확히 일치했다. "알려짐(추정)"이 "실측 확인"으로 바뀐 것뿐이라 새로운 리스크는 아니지만, 04 ALWAYS DO "MPL 계열은 무수정 사용만" 원칙이 실제로 적용되는 첫 사례가 됐다 — satori를 npm 의존성으로만 import하고 소스를 전혀 수정하지 않는다.

**범위를 의도적으로 og(1200x630) 1종으로만 좁혔다**: `ASSET_SPECS`를 규격별 항목 딕셔너리로 설계해 포스터·배너·명함 추가 시 항목만 늘리면 되는 구조를 만들어뒀지만, 이번 증분은 검증까지 실제로 마친 og 하나만 포함한다. 자산 전용 검증(`validateAsset()` — 규격·포맷·용량, 이 킷 최초의 비-axe/비-Playwright 게이트)이 실패하면 파일을 아예 쓰지 않는다(fail-closed — 이 킷의 다른 게이트들과 같은 원칙). `ASSET-LEDGER.csv`에 생성된 이미지 자체는 등재하지 않기로 결정했다 — 그 대장은 스키마상 "외부 출처를 가진 자산"(폰트 등)을 추적하는 파일이고, 이 파이프라인이 만드는 이미지는 외부 자산이 아니라 이 킷의 코드가 만든 산출물이라 스키마 목적과 안 맞는다(폰트 파이프라인 A 완료 시 이미 한 번 검토된 것과 같은 구분 — `AI-GENERATION-LOG.md`가 이 산출물의 정본 이력 기록 위치다).

**AI-GENERATION-LOG.md의 `image` 타입을 실사용으로 처음 검증했다**: 지난 증분(1k)에서 코드는 열어뒀지만 실사용 사례가 없던 리스크(위 리스크 8번 후속 — CHECKPOINT.md 참조)를 이 증분이 실제로 닫았다 — `writeMarketingAsset()`이 렌더·검증·배치 직후 자동으로 `appendGenerationLog({assetType: 'image', ...})`를 호출하고, 실제 픽스처 대상 CLI 실행으로 `.design-kit/AI-GENERATION-LOG.md`에 이미지 소재의 제목·부제·생성파일 경로가 정확히 기록되는 것을 실측 확인했다.

단위테스트 17건 신설(`npm test` 224→241) — `renderAsset`/`validateAsset`(실제 Pretendard 폰트로 렌더, 규격·포맷·용량 위반 각각 재현) + `writeMarketingAsset`(경로 탈출 방지·slug 변환·멱등성·AI-GENERATION-LOG 연동) + CLI 프로세스 회귀 테스트. **CLI 테스트에서 기존 패턴과 다른 점 하나**: satori/sharp는 npm 의존성이라(상대경로 import가 아님) 스크립트를 OS 임시폴더로 복사하면 node_modules를 못 찾아 조용히 실패한다 — 대신 이 저장소 루트 밑에 임시 폴더를 만들어(Node의 상위 디렉터리 탐색이 실제 `node_modules`를 그대로 찾음) 대상 프로젝트 경로만 공백·한글로 구성해 04 ALWAYS DO 취지(조용한 실패 방지)를 지켰다. **실제 픽스처 CLI 실행**으로 실제 PNG(제목·부제 한글 포함)가 생성되고 1200x630 규격을 정확히 만족하는 것, `AI-GENERATION-LOG.md`에 `image` 항목이 실제로 기록되는 것을 이미지 자체를 열어 육안으로 확인했다. `npm audit` 0건. README.md 의존성 라이선스 표에 satori(MPL-2.0)·sharp(Apache-2.0) 추가 완료(README.en.md·HTML 4종 동기화는 이번 라운드에 안 함 — 알려진 잔여 항목, CHECKPOINT.md에 기록).

**이 증분을 포스터·배너·명함으로 임의로 확장하지 말 것** — 각 규격은 실제 텍스트 오버플로우·레이아웃 요구가 다를 수 있어(예: 명함은 여러 필드가 구조화돼 있음) og 하나의 검증 결과를 근거로 일반화하면 안 된다. 확장할 땐 이번과 같은 방식(스파이크 없이도 되지만 최소 1건은 실제 픽스처 검증)으로 각각 독립적으로 확인할 것.

---

**라이선스 게이트가 이미지·아이콘류 자산으로 확장됐다 (2026-08-18, Phase 3 승인 순서 ④번)**: `scripts/asset-ledger.mjs` 신설. `font-pipeline.mjs`가 폰트 게이트(C)를 만들 때 이미 종류(kind) 무관 범용으로 설계해둔 `appendAssetLedger`·`parseCsvLine`을 재사용하고, 스캔→대장 대조→위반 목록(opt-in, 대소문자 무관 비교) 패턴을 이미지에 그대로 미러링했다(`scanProjectImageFiles`·`checkAssetGate`, `verify-runner.mjs --assetGate`). 여기 더해 `generateAttribution()`이 `ASSET-LEDGER.csv` 전체를 종류별로 그룹핑해 사람이 읽는 `ATTRIBUTION.md`를 자동 생성한다(01_PRD.md §7·03_PHASES.md가 요구한 "라이선스 게이트(자산 대장 확장) + ATTRIBUTION.md 자동 생성"의 구현).

**핵심 경계 — 1m 결정과 충돌하지 않도록 설계 단계에서 명시적으로 반영**: `marketing-asset-pipeline.mjs`가 만드는 이미지(`public/design-kit-assets/`)는 이 게이트 대상이 아니다(위 1m 결정문 그대로 — 그건 외부 출처 자산이 아니라 이 킷 코드의 산출물이고 `AI-GENERATION-LOG.md`가 그 정본 이력이다). `.design-kit/`(검증 스크린샷·시각회귀 기준본) 전체도 프로젝트가 가져온 외부 자산이 아니므로 스캔에서 제외한다. `scanProjectImageFiles()`가 이 두 경로를 명시적으로 건너뛴다 — **실제 픽스처로 이 경계 자체를 실측 검증**: 픽스처의 실제 `public/design-kit-assets/og-머그컵-신상품-출시.png`(1m 세션 산출물)와 `.design-kit/reports/screenshots/`가 스캔 결과에 전혀 안 잡히는 것을 확인, 반대로 진짜 미등록 이미지(`create-next-app` 기본 스캐폴딩 SVG 5종 + `favicon.ico`, 픽스처에 원래부터 있던 것 — 합성 테스트 파일이 아님)는 정확히 6건 잡히는 것을 확인했다.

**TDD로 잡은 실제 결함 1건**: 최초 구현이 재사용 원칙을 지나치게 문자 그대로 따라 `font-pipeline.mjs`의 `loadAssetLedgerFilenames()`까지 그대로 재사용했는데, 그 함수는 대장의 filename을 항상 `.design-kit/` 기준으로 재해석한다(폰트가 실제로 `.design-kit/fonts/` 안에 저장되기 때문에 성립하는 폰트 전용 관례). 이미지 자산은 `public/images/` 같은 프로젝트 트리 안에 있지 `.design-kit/` 안에 있지 않아서, 이 함수를 쓰면 정확히 등록된 이미지("public/images/x.jpg")까지 항상 미등록으로 오판했다 — 자체 단위테스트(`checkAssetGate: 등록·미등록이 섞여 있으면 미등록분만 골라낸다`)가 구현 직후 이 결함을 바로 잡아냈다. 수정: 이미지 게이트는 `loadAssetLedgerFilenames`를 쓰지 않고, 신설한 `loadAssetLedgerRows()`(전체 8필드 반환)로 원본 filename을 프로젝트 루트 기준 그대로 비교한다. **재사용 원칙("중복 구현 금지")이 이 케이스에선 함수 시그니처가 아니라 의도까지 재사용하면 안 됐던 사례** — 앞으로 다른 자산 종류를 게이트에 추가할 때도 그 자산이 실제로 어디에 저장되는지(`.design-kit/` 안인지 프로젝트 트리 안인지)부터 확인할 것.

단위테스트 20건 신설(`asset-ledger.test.mjs`, `npm test` 241→246→272 — 246은 1n 검증 라운드 완료 시점, 여기서 26건 추가: asset-ledger 20건 + verify-runner/report-writer 회귀 각 3건) + `verify-runner.mjs`/`report-writer.mjs`에 `--fontGate`와 동일한 하위 호환 패턴(`assetGateViolations` 기본값 `[]`)으로 배선. **실제 픽스처 CLI 왕복 실측**(PowerShell, `--route /design-kit-preview/button`): 등록 전 FAIL(미등록 6건 정확히 나열) → `public/file.svg` 1건 등록 후 재실행 FAIL(5건으로 감소, 등록한 파일만 정확히 빠짐) → `generateAttribution` 실행해 실제 `ATTRIBUTION.md` 생성·육안 확인. 검증 후 픽스처는 등록 테스트용으로 추가한 1행과 생성된 `ATTRIBUTION.md`를 제거해 원래 상태로 원복(드라이런 원칙 — M4/M5와 동일). `e2e-selftest.mjs` 전체 왕복(PASS/FAIL/훅 차단·재개방)으로 `verify-runner.mjs`·`report-writer.mjs` 공유 코드 무회귀 확인(`--assetGate` 미사용 시 완전히 기존과 동일하게 동작). `npm audit` 0건(새 의존성 없음).

**`main` 개념 없음 — 슬래시 명령 없이 CLI 전용**: `font-pipeline.mjs`가 `commands/`에 대응 슬래시 명령이 없는 채로 README 아키텍처 섹션·트러블슈팅에서만 안내되는 기존 관례를 그대로 따랐다(`asset-ledger.mjs`도 동일 — 개발자용 CLI, `--generateAttribution`).

---

**마케팅 소재 파이프라인이 포스터·배너·명함 3종으로 확장됐다(2026-08-20, Phase 3 승인 순서 ③번 잔여분 — 사용자 명시 요청으로 착수)**: 56차(og 1종 완료) 자신이 "og 검증 결과를 다른 규격에 일반화하지 말 것 — 명함은 특히 필드 구조가 다름"이라고 남긴 경고를 그대로 지켜 설계했다. `ASSET_SPECS`에 `poster`(1080x1350, 인스타그램 세로형 4:5 비율)·`banner`(1200x400, og와 구분되는 3:1 가로형)·`businessCard`(1050x600, **3.5x2인치 @300dpi라는 실제 인쇄 표준**을 근거로 선택 — 임의 값이 아님) 3개 항목을 추가했다. **명함의 필드 구조 문제 해결**: og/poster/banner는 title(+subtitle)만으로 충분하지만 명함은 회사·전화·이메일 등 여러 항목을 나열해야 한다 — `renderAsset()`에 `extraLines`(문자열 배열, 빈 배열이면 기존과 완전히 동일하게 동작 — 하위 호환) 파라미터를 신설해 title/subtitle보다 작은 글씨로 각 줄을 순서대로 렌더한다. CLI는 `--extraLines "<줄1>|<줄2>|..."`로 받는다 — 회사명·주소에 흔한 콤마(,)와 겹치지 않도록 파이프(|) 구분자를 선택했다. `writeMarketingAsset()`의 AI-GENERATION-LOG 프롬프트 기록에도 extraLines를 "추가 정보: ..." 줄로 포함시켜, 명함 생성 이력도 og·포스터·배너와 동일한 추적성을 갖는다.

단위테스트 10건 신설(`npm test` 279→**289/289**, `npm audit` 0건 — 새 의존성 없음) + **실제 픽스처 CLI 실행으로 3종 전부 개별 검증**: poster(1080x1350)·banner(1200x400)는 title/subtitle만으로 실제 PNG 생성 확인, businessCard(1050x600)는 `--extraLines "소담 스튜디오|010-1234-5678|hong@example.com"`로 실제 CLI 실행해 PNG 생성 + AI-GENERATION-LOG에 "추가 정보: 소담 스튜디오 / 010-1234-5678 / hong@example.com"이 정확히 기록되는 것 확인. 생성된 businessCard·poster PNG를 **육안으로 직접 열어** 한글 텍스트가 깨지거나 잘리지 않고, 명함의 이름·직함·추가 정보 4줄이 시각적 위계(글자 크기 차등)를 가지고 정상 배치된 것을 확인했다. `commands/marketing-asset.md`를 4종 표+`--extraLines` 사용법으로 갱신, "안 한 것" 목록에서 포스터·배너·명함을 제거하고 "명함의 로고 이미지 삽입"(extraLines는 텍스트만 지원)을 새 경계로 명시했다. SNS 카드는 여전히 의도적으로 범위 밖(구조는 동일하게 확장 가능하나 이번 라운드엔 미포함).

**이 설계를 다시 title/subtitle 2개 필드로 좁히지 말 것** — 좁히면 명함처럼 여러 항목이 필요한 규격을 다시 못 만들게 된다. 새 규격을 추가할 땐 이번처럼 그 규격이 실제로 필요로 하는 필드 구조부터 먼저 확인할 것(og 하나의 인터페이스를 무비판적으로 재사용하다 이번에 avoided한 실수 — 56차가 미리 경고해둔 덕분에 처음부터 바르게 설계됨).

---

**MCP 서버 래퍼(⑤)가 T1(코어) 범위로 구현됐다(2026-08-20, Phase 3 마지막 승인 항목 — Plan Mode로 설계 후 구현)**: 착수 전 스파이크(공식 문서 직접 확인)로 이 문서와 `04_PROJECT_SPEC.md`가 전제해온 "open 대시보드(HTTP, 127.0.0.1 바인딩)를 MCP와 같은 로컬 서버로 공유한다"(O-Brain 동거 구조, 01_PRD.md §3·04 기술 스택에 명시돼 있던 전제)가 **실제로는 성립하지 않음을 발견했다** — Claude Desktop의 로컬 `.mcpb` 확장은 HTTP가 아니라 **stdio(표준입출력) 전송**으로 동작한다(Claude Desktop이 서버를 서브프로세스로 직접 실행하고 stdin/stdout으로 JSON-RPC를 주고받음, 공식 문서 claude.com/docs/connectors/building/mcpb·github.com/modelcontextprotocol/mcpb로 확인). 네트워크 포트를 전혀 열지 않으므로 01_PRD.md §6이 "로컬 서버 = 유일한 네트워크 면"으로 지목한 위험 자체가 이 경로엔 없다(오히려 대시보드 HTTP 서버보다 공격면이 작다).

**"서버 공유"를 "함수 공유"로 재설계했다**: `scripts/mcp-server.mjs`를 신설해 `dashboard-server.mjs`가 이미 export해둔 4개 함수(`listRuns`·`readReportContent`·`readScreenshotFile`·`reverifyRun` — 경로 조작 방어·`.design-kit/.lock` 동시성 제어가 전부 함수 내부에 이미 있음)를 HTTP를 거치지 않고 그대로 in-process import해 MCP 도구 4개(`list_runs`·`get_report`·`get_screenshot`·`reverify`)로 노출했다. 새 비즈니스 로직은 사실상 0줄 — 01_PRD.md §3 "모든 표면은 같은 코어 엔진을 호출하는 얇은 래퍼다" 원칙을 가장 문자 그대로 지킨 사례다.

**범위를 T1(코어)으로 의도적으로 좁혔다**: 01_PRD.md §3 Parity 매트릭스가 Claude Desktop MCP에 부여한 능력은 T1(코어, 대시보드와 동일)·T2(AI 작업, "판정 제공 범위"). `pipeline-codegen.mjs`의 `runCodegen`(Figma 데이터를 받아 코드 생성, T2)을 MCP 도구로 노출하는 것은 파라미터 설계가 별도 결정이라 다음 증분으로 미뤘다 — og 1종만 먼저 검증한 마케팅 소재 파이프라인(56차)과 같은 "작게 시작" 원칙.

**정직 고지를 도구 설명(description) 자체에 넣었다**: `reverify` 도구의 description에 "이 도구는 판정을 제공할 뿐 Claude Code 훅과 달리 완료 보고를 기계적으로 차단하지 않습니다"를 명시했다 — 이건 문서 각주가 아니라 Claude Desktop의 AI가 도구 호출 전에 실제로 읽는 텍스트라, 01 §3의 "정직 원칙"을 실질적으로 집행하는 유일한 지점이다.

**개발 중 실제로 잡은 결함 1건**: `get_screenshot`의 파라미터 설명을 처음엔 "판정서 JSON의 screenshots[].path 값"이라고 적었는데, 실제로 `listRuns()`가 읽는 `runs/*.json`에는 `screenshots` 필드가 아예 없다는 걸 실측(실제 픽스처 run 파일을 직접 열어 확인)으로 발견했다 — 스크린샷 목록은 `dashboard-server.mjs`의 `extractScreenshotPaths()`가 판정서 **마크다운**의 "## screenshots" 섹션을 파싱해서만 얻어진다(2b-1 결정 기록에 이미 있던 사실을 이번에 다른 진입점에서 다시 발견한 것). `get_report` 응답에 `extractScreenshotPaths()` 결과를 두 번째 content 블록으로 함께 반환하도록 수정해, AI가 마크다운을 직접 파싱하지 않고도 `get_screenshot`에 바로 넘길 수 있는 정확한 경로를 얻게 했다.

새 의존성 2종 추가: `@modelcontextprotocol/sdk`(공식 SDK, MIT — `npm install` 후 `node_modules`의 실제 `license` 필드로 재확인함, 04 ALWAYS DO), `zod`(MCP SDK가 스키마 정의에 요구, MIT). 단위테스트 16건 신설(`tests/mcp-server.test.mjs`, `npm test` 289→**305/305**) — SDK가 테스트 전용으로 제공하는 `InMemoryTransport`(같은 프로세스 안에서 Client·Server를 실제 MCP 프로토콜로 연결 — 스텁이 아니라 진짜 요청/응답 왕복)로 거부 경로(존재하지 않는 프로젝트·잘못된 runId·경로 조작 등)를 전부 검증. **성공 경로는 실제 픽스처(SoDam-Design-Kit-Fixture, 판정 이력 101건 보유) 대상으로 실측**: `list_runs`로 실제 이력 101건 조회, `get_report`+`get_screenshot`으로 실제 판정서·PNG(29,660바이트) 조회, `reverify`로 실제 새 판정서(`2026-08-20-004`) 생성까지 전부 확인 — `reverifyRun`의 성공·동시성 경로는 실제 dev server가 필요해 mkdtemp 단위테스트로 재현 불가능하다는 `dashboard-server.test.mjs`의 기존 원칙을 그대로 따랐다. `npm audit` 0건. `e2e-selftest.mjs` 무회귀 확인(새 파일 추가뿐, 기존 파이프라인 파일은 import만 하고 수정 안 함).

**MCPB 패키징(2026-08-20 실측)**: `npx @anthropic-ai/mcpb init -y .`로 저장소 루트에 `manifest.json` 생성(자동으로 `package.json`의 name·version·description을 가져옴 — 04 "버전 단일화" 원칙이 도구 차원에서 이미 지켜짐), `author`(SoDam AI Studio)·`license`(Apache-2.0, 자동 생성값 MIT는 이 킷의 실제 라이선스와 달라 수정)·`tools`(4개 선언)·`compatibility.platforms`(`win32`·`darwin` — Claude Desktop이 공식 지원하는 두 플랫폼만, 검증 안 된 linux는 명시 안 함)를 보강. `mcpb validate manifest.json` 통과, `mcpb pack .`으로 실제 `.mcpb` 생성 확인(68.7MB — Playwright·Sharp가 `reverify`의 실제 브라우저 재검증에 필수라 축소 불가, `mcpb clean`으로도 68.3MB까지만 감소). **정직하게 남겨둔 한계**: `reverify`는 내부적으로 실제 Playwright 브라우저를 실행하므로, Claude Desktop에서 이 확장만 단독 설치한 사용자는 별도로 Playwright 브라우저 바이너리가 설치돼 있어야 동작한다(이 킷을 Claude Code로 이미 써본 사용자는 `npm install` 시점에 이미 준비됨 — 신규 단독 설치자는 사전 준비 필요, README에 명시).

**AI 대행 불가로 남겨둔 것**: 실제 Claude Desktop 앱에 `.mcpb`를 더블클릭 설치해 도구 목록이 뜨는지, `list_runs` 등을 실제로 호출했을 때 Claude Desktop UI에서 정상 동작하는지는 이 세션(Claude Desktop 앱 자체가 없음)에서 확인 불가 — `CHECKPOINT.md`에 사용자 확인 대기 항목으로 기록.

---

**검증 라운드에서 MCP 래퍼·마케팅 소재 확장 대상 실제 결함 2건을 발견·수정했다(2026-08-20, 위 MCP 서버 래퍼 완료 직후)**: 사용자 요청으로 이번 세션에서 가장 최근 추가된 두 기능(마케팅 소재 확장·MCP 서버 래퍼)을 정상/예외/경계값/실패 시나리오로 재검증했다.

① **`assertProjectDir()`이 빈 문자열을 조용히 받아들였다**: `mcp-server.mjs`의 `assertProjectDir(projectDir)`은 `path.resolve(projectDir)` 후 `existsSync`·`isDirectory()`만 검사했는데, `path.resolve('')`는 Node 표준 동작으로 조용히 `process.cwd()`(MCP 서버 프로세스 자신의 실행 위치, 사용자가 의도한 프로젝트가 아님)로 풀린다. `list_runs`에 `projectDir: ''`을 실제로 넘겨 에러 없이 빈 배열이 반환되는 것으로 재현했다 — 프로젝트 경로가 아니라 서버 자신의 위치를 조용히 대상으로 삼는 결함이었다. **수정**: `path.resolve()` 호출 전에 원시 입력이 비어있는 문자열이거나 문자열이 아닌지 먼저 거부하는 가드를 추가했다. 재검증: `list_runs`·`get_report`·`get_screenshot`·`reverify` 4개 도구 전부 빈 문자열에 동일하게 거부(`isError: true`)하는 것을 실제 MCP 프로토콜 왕복(`InMemoryTransport`)으로 확인, 정상 경로(실제 픽스처, 유효한 `projectDir`)는 영향 없음을 재확인(114건 정상 조회).

② **`extraLines`가 배열이 아니면 조용히 잘못된 이미지를 만들었다**: `marketing-asset-pipeline.mjs`의 `writeMarketingAsset({..., extraLines: '전화번호'})`처럼 배열 대신 문자열을 넘기면, 크래시 대신 자바스크립트 문자열의 문자 단위 순회 특성 때문에 `renderAsset()`의 `for (const line of extraLines)`가 글자 하나하나를 각각 별도 줄로 렌더한 "조용히 잘못된" 이미지를 성공적으로 만들어냈다(`renderAsset()`을 직접 호출해 에러 없이 "성공" 응답이 오는 것까지 추적 확인). 크래시는 그 이후, AI-GENERATION-LOG 기록 단계의 `extraLines.join(' / ')` 호출에서야 뒤늦게 원인을 알 수 없는 형태로 발생했다 — 실제 문제(입력 타입 오류)와 무관해 보이는 지점에서 죽는, 이 프로젝트가 경계해온 "조용한 실패"의 변형이었다. **수정**: `writeMarketingAsset()`의 `assetType` 검증 직후, 렌더링 전에 `Array.isArray(extraLines)` 가드를 추가해 즉시 명확한 메시지로 거부하도록 했다.

두 건 다 회귀 테스트 4건 신설(`npm test` 305→**308/308**, `npm audit` 0건 — 코드 수정만, 새 의존성 없음). **재검증 중 이미 정상 동작으로 확인된 것들(신규 결함 아님, 실측으로 검증)**: MCP 도구 4개의 스키마 필수/타입 검증(SDK 자체 zod 계층이 핸들러 도달 전에 거부), `get_screenshot`의 URL 인코딩(`%2e%2e%2f`)·Windows 역슬래시(`..\\..\\`) 경로 탈출 방어, 5000자 `runId` 방어(정규식이 그대로 거부, 크래시·자원 고갈 없음), 존재하지 않는 도구 이름·예상 밖 추가 필드(SDK가 처리), `extraLines` 20줄·파이프 문자 포함 시 정상 동작, `assetType` 대소문자(`"OG"`)·트레일링 공백(`"og "`) 거부. 커밋 `fad51c6`.

**이 두 가드를 제거하지 말 것** — 특히 ①은 MCP 도구가 `projectDir`을 항상 명시적으로 요구해야 하는 이유(호출자가 "현재 디렉터리"라는 개념을 가질 이유가 없음) 자체와 직결된다.

---

**T2를 T2a/T2b로 쪼개고 T2a만 구현했다(2026-08-20, "다음 Phase 작업" 검토 중 발견 — Plan Mode로 설계 후 구현)**: 01_PRD.md §3 Parity 매트릭스는 T2("Figma 읽기→매핑→코드 생성")를 Claude Desktop MCP의 다음 증분으로 남겨뒀다. 착수 전 `scripts/pipeline-codegen.mjs`를 직접 열어본 결과, 이 원안 전제 자체가 부정확했다는 걸 발견했다 — T1 착수 때 "대시보드 서버 공유" 전제가 스파이크로 틀렸다고 밝혀진 것과 같은 종류의 발견이다.

**발견한 사실**: 이 킷에는 "Figma 데이터를 받아 코드를 생성하는 함수"가 존재하지 않는다. `commands/pipeline.md`도 처음부터 "코드 작성은 에이전트(Claude) 자신의 몫, 스크립트는 검사·배치·등록만"으로 설계돼 있다. `pipeline-codegen.mjs`는 위험 등급이 서로 다른 두 함수를 제공한다:
- `runCodegen({projectDir, designKitDir, figmaNodeId, figmaName})` — **이미 매핑된** 컴포넌트를 dev 전용·gitignore 대상 프리뷰 라우트(`preview-route.mjs`의 `generatePreviewRoute()` 재사용)에 연결만 한다. 신규 코드 0줄, Figma 재호출 0회. 실패 시(매핑 없음) 이미 명확한 에러를 던진다.
- `registerNewComponent({..., sourceFile, codePath})` — 에이전트가 이미 디스크에 써둔 `.tsx` 파일을 받아, 하드코딩 값 검사(`findHardcodedStyleViolations`)·경로 탈출 검증(06 신뢰 경계)·중복 등록 검사를 통과시킨 뒤 **실제 프로젝트 코드 위치(`resolvedDest`)에 파일을 쓴다** — 이게 진짜 "코드 생성·배치"에 해당하는 함수다.

**리스크 판단**: `runCodegen()` 경로는 T1과 같은 등급(사실상 무해)이지만, `registerNewComponent()` 경로를 그대로 MCP로 열면 새로운 종류의 위험이 생긴다 — Claude Desktop엔 Claude Code의 Stop 훅(T3, 완료 차단)이 없으므로, 이 경로가 열리는 순간 **검증 게이트를 한 번도 거치지 않은 실제 애플리케이션 코드가 조용히 프로젝트에 들어갈 수 있는 첫 통로**가 생긴다. 이건 01_PRD.md §1 핵심 가치("실제 브라우저 검증을 통과해야만 완료로 인정")와 정면으로 충돌하는 블라스트 반경이라, T1(읽기+기존 코드 재검증 트리거)이 가졌던 위험과는 질적으로 다르다.

**결정**: 이번 증분은 `runCodegen()`만 `register_component_preview` MCP 도구로 노출한다(T2a). `registerNewComponent()`(T2b)는 별도 리스크 검토·별도 사용자 승인 없이는 노출하지 않는다 — marketing-asset이 og 1종부터 시작하고 폰트 게이트가 opt-in으로 시작한 것과 같은 "작게 시작" 원칙을, 이번엔 "한 함수 안의 두 경로 중 안전한 쪽만 먼저 연다"는 형태로 한 단계 더 정밀하게 적용한 것이다.

**구현**: `scripts/mcp-server.mjs`에 `runCodegen`을 import해 5번째 도구로 등록 — 새 비즈니스 로직 0줄(T1과 같은 "얇은 래퍼" 원칙). 도구 이름을 `register_component_preview`로 정했다(`generate_code`류 이름은 실제로 코드를 생성하지 않으므로 01 §3 정직 원칙 위반) — description에 "Figma를 읽지 않고 새 코드를 작성하지도 않는다", "매핑이 없으면 실패한다", "이 도구만으로는 판정이 나오지 않으니 `reverify`를 호출하라"는 3가지 정직 고지를 `reverify` 도구의 선례와 같은 방식으로 명시했다.

단위테스트 6건 신설(`npm test` 308→**314/314**, `npm audit` 0건 — 새 의존성 없음, 기존 `pipeline-codegen.mjs` re-import뿐) — 도구 개수 5개 갱신, 정직 고지 3종 확인, 실제 매핑으로 프리뷰 라우트 생성 성공 경로, 매핑 없음·`projectDir` 없음/빈 문자열 실패 경로. **실제 픽스처(`SoDam-Design-Kit-Fixture`) 대상 `InMemoryTransport`로 왕복 실측**: `register_component_preview`로 실제 `button` 컴포넌트를 프리뷰 라우트에 재연결 확인 → 이어서 기존 `reverify` 도구를 실제로 호출해 새 PASS 판정서(`2026-08-20-020`) 생성까지 확인 — T2a가 기존 T1 도구와 실제로 연결되는 것을 증명했다. `e2e-selftest.mjs` 무회귀 확인.

**`register_component_preview`에 `registerNewComponent()`(T2b) 경로를 추가하지 말 것** — 추가하려면 위에 적은 "완료 차단 우회" 리스크를 먼저 어떻게 완화할지(예: 별도의 명시적 "미검증" 마킹, 강제 `reverify` 체이닝 등)를 설계하고 사용자 승인을 받아야 한다.

---

**Figma 이미지·SVG 자산 다운로드 스크립트가 구현됐다(2026-08-20, T2a 직후 — P1 자신의 완결성 보강, "다음 Phase" 재검토 중 발견)**: `commands/pipeline.md`가 자기모순 상태였다 — L24는 "자산 URL 7일 후 만료, 다운로드 스크립트는 아직 미구현"이라 적어두고 바로 아래 "아직 없는 것"은 "(현재 없음)"이라 반대로 적혀 있었다. `scripts/` 폴더를 실측 확인한 결과 실제로 다운로드 스크립트가 없었다 — `04_PROJECT_SPEC.md` 연결/동기화 스펙 6번(2026-07-20, Phase 1 착수 첫날 스파이크로 확정)이 요구해온 "즉시 로컬 다운로드 필수, 안 하면 7일 뒤 이미지가 깨지는 실사용 장애" 규칙이 지금까지 코드가 아니라 에이전트용 문서 당부로만 존재했다 — 이 프로젝트가 반복 잡아온 "규칙은 있는데 강제하는 코드가 없다" 패턴이다. M1(P1 완료 판정)은 이미지 없는 Button 컴포넌트로만 검증돼 이 결함이 한 번도 실전에서 걸리지 않았다.

`scripts/asset-downloader.mjs` 신설 — `downloadAsset({projectDir, url, targetPath})`. 설계 결정 3가지:

1. **저장 위치는 스크립트가 정하지 않고 호출자가 `--targetPath`로 지정한다.** 특히 `public/design-kit-assets/`는 쓰지 않는다 — 그 폴더는 `asset-ledger.mjs --assetGate`가 58차(1o) 결정으로 이미 스캔 제외해둔 곳(이 킷 자신이 만드는 마케팅 이미지 전용, `AI-GENERATION-LOG.md`가 정본 이력)이다. Figma에서 내려받는 자산은 정반대로 **외부 출처**(디자이너가 Figma에 넣은 사진·아이콘일 수 있어 01 §7 "이미지·아이콘... 자산 대장 등재분만 사용" 대상)라, 그 폴더에 저장하면 라이선스 게이트의 사각지대가 새로 생긴다. `--targetPath`를 `public/images/` 등 일반 위치로 두면 기존 `--assetGate` 스캔이 그대로 커버한다 — 새 코드 없이 기존 게이트의 적용 범위를 지켰다.
2. **콘텐츠 기반 검증, URL이나 확장자를 믿지 않는다.** 래스터 이미지는 이 킷의 기존 의존성 `sharp`로 실제 디코딩을 시도해(`sharp(buffer).metadata()`) 성공해야만 저장 — font-pipeline.mjs의 매직바이트 검증과 같은 "다운로드 후 형식 검증·실행 금지"(04 DO NOT) 원칙이며, `sharp` 재사용이라 새 의존성·새 매직바이트 로직이 필요 없다. SVG는 텍스트라 디코딩 검증이 안 통해 별도로 `<script`·인라인 이벤트 핸들러(`on\w+=`)·`javascript:` 패턴을 거부하는 `validateSvgContent()`를 뒀다 — `pipeline-codegen.mjs`의 `findHardcodedStyleViolations`와 같은 "알려진 위험 패턴을 렌더 전에 거부, fail-closed" 원칙의 새 적용 사례.
3. **SSRF 하드닝(사설 IP·localhost 차단)은 의도적으로 범위 밖으로 뒀다.** 이 킷은 로컬 1인용 도구이고, URL은 호출하는 에이전트(같은 Claude Code 세션)가 Figma MCP 응답에서 그대로 전달하는 값이다 — 이 스크립트 하나만 막아도 같은 세션이 이미 가진 파일시스템 접근권을 넘어서는 방어 효과가 없다(위협 모델이 다중 사용자 웹 서비스가 아니라 사용자 자신의 로컬 세션). `https://` 스킴 강제 + 콘텐츠 검증 + 용량 상한(10MB)으로 "이상한 게 조용히 저장되는" 실패 모드는 막되, DNS 조회 기반 사설 IP 차단 같은 무거운 방어는 이 위협 모델 대비 과설계로 판단했다. **이 판단을 다시 꺼내 "SSRF 방어가 없다"고 지적할 땐 이 문단을 먼저 볼 것** — 빠뜨린 게 아니라 검토 후 제외한 것이다.

단위테스트 15건 신설(`npm test` 314→**329/329**, `npm audit` 0건). `fetchFn` 주입으로 실네트워크 없이: https 아닌 URL·경로 탈출·HTTP 실패·용량 초과·이미지 아닌 콘텐츠·악성 SVG 각각 거부 확인 + 정상 PNG/SVG 저장 성공 확인. **실제 HTTPS 네트워크로 왕복 실측**: 실제 공개 PNG URL을 다운로드해 `sharp` 검증 통과 + 파일 실제 생성(956바이트) 확인, 이미지가 아닌 실제 URL(텍스트 파일)은 "이미지로 디코딩되지 않습니다"로 정확히 거부되는 것 확인(검증 후 픽스처에서 즉시 삭제해 원상복구). `commands/pipeline.md`에 0.5번 단계로 편입 + L24 모순 문구 정정. `e2e-selftest.mjs` 무회귀.

---

**검증 라운드에서 `asset-downloader.mjs`의 https 검사가 리다이렉트로 우회될 수 있음을 발견·수정했다(2026-08-20, 자산 다운로드 스크립트 완료 직후 — 사용자 요청 종합 검증)**: `downloadAsset()`은 fetch 호출 *이전*에 `url.startsWith('https://')`만 검사했다. 그런데 실제 로컬 HTTP 서버로 302 리다이렉트를 만들어 확인한 결과, Node의 `fetch`는 리다이렉트를 자동으로 따라가고 최종 응답의 `res.url`이 실제 도달한 주소를 그대로 반영한다는 걸 실측 확인했다 — 즉 최초 URL이 `https://`였어도 서버가 `http://`나 다른 호스트로 돌려보내면, 그 우회를 지금까지의 검사는 잡아내지 못했다(호출자가 넘긴 문자열만 봤지, 실제로 받아온 응답이 어디서 왔는지는 확인하지 않았음). 자산 다운로드 자체를 노리는 공격 벡터라기보다, "https만 허용"이라는 코드 주석·문서 설명이 실제 동작과 정확히 일치하지 않던 정직성 문제에 더 가깝다.

**수정**: fetch 응답을 받은 직후 `res.url`도 `https://`로 시작하는지 재검사(시작하지 않으면 거부, 저장하지 않음). 같은 스킴 안에서의 정상적인 리다이렉트(예: Figma CDN이 다른 https 호스트로 서명된 URL을 재발급하는 경우)는 계속 허용된다 — 스킴이 바뀌는 경우만 막는다. 회귀 테스트 1건 신설(`npm test` 329→**330/330**, `npm audit` 0건 — 코드 수정만). `e2e-selftest.mjs` 무회귀(첫 시도는 이 환경의 느린 디스크로 dev server 컴파일이 지연돼 시간초과가 났으나 재시도로 정상 통과 — 코드와 무관한 환경 요인임을 확인). 커밋 `69e208c`.

**이 재검사를 빼지 말 것** — "URL 문자열이 https로 시작하는가"와 "실제로 받아온 응답이 https에서 왔는가"는 리다이렉트가 존재하는 한 다른 질문이다.
