# T2B_RISK_REVIEW.md — MCP `registerNewComponent`(T2b) 노출 리스크 검토

> 작성: 2026-09-01 (사용자 요청 — "다음 Phase 준비" 중 T2b 리스크 검토서 작성만 승인, T2b 구현 자체는 승인 안 됨)
> 목적: T2b를 지금 만드는 게 아니라, 나중에 사용자가 승인/보류를 판단할 때 필요한 근거를 미리 정리해두는 것.
> **이 문서는 "만들어라/만들지 마라"를 대신 결정하지 않는다 — 판단 재료만 제공한다.**
> 현재 권고: 01_PRD.md §3·02_DATA_MODEL.md 결정 기록과 동일하게 **보류 유지**.

---

## 1. T2b가 정확히 무엇인가

- 함수: `scripts/pipeline-codegen.mjs`의 `registerNewComponent()`
- 하는 일: 에이전트가 이미 디스크에 써둔 `.tsx` 파일(`sourceFile`)을 읽어 → 하드코딩 값 검사 → 프로젝트 경로 정규화 검증 → **실제 프로젝트 코드베이스(`codePath`)에 파일을 쓰고** → `component-map.json`에 등록 → 프리뷰 라우트 생성까지 수행.
- 현재 상태: **Claude Code CLI에서는 이미 사용 가능**(`pipeline-codegen.mjs --newComponentFile ...`, M4에서 완료·실측됨). **MCP 서버(`scripts/mcp-server.mjs`)에는 의도적으로 노출 안 됨** — `import` 문 자체에 없어(코드 확인 완료, 2026-09-01) Claude Desktop에서는 구조적으로 호출이 불가능하다.

## 2. 왜 위험한가 — Claude Code CLI와 무엇이 다른가

| 구분 | Claude Code (CLI, T2b 이미 사용 가능) | Claude Desktop (MCP, T2b 열 경우) |
|---|---|---|
| 완료 차단 훅(T3) | 있음 — `Stop` 이벤트에서 `hooks/verify-gate.mjs`가 FAIL 시 완료 보고를 기계적으로 차단 | **없음** — Claude Desktop엔 이 훅 메커니즘 자체가 없음(01_PRD §3 Parity 매트릭스에 이미 명시된 물리적 한계) |
| FAIL 상태에서 "완료" 보고 | 훅이 완료 보고 자체를 가로막음 — AI가 거짓 보고를 해도 최종적으로 사용자에게 "차단됨" 메시지가 뜬다 | **아무것도 막지 못함** — AI가 검증 FAIL을 알고도(또는 확인을 빠뜨리고) "완료됐습니다"라고 말하면 그대로 전달됨 |
| 결과 | 검증 안 된 코드가 조용히 들어갈 방법이 설계상 원천 차단됨 | 검증 안 된 실제 애플리케이션 코드가 대상 프로젝트에 조용히 들어갈 수 있는 **첫 번째이자 유일한 통로**가 생김 |

이건 이 킷의 §1 핵심 가치("실제 브라우저 검증을 통과해야만 완료가 되는")를 정면으로 우회하는 시나리오이며, 01_PRD.md §3·02_DATA_MODEL.md가 T2를 T2a/T2b로 쪼갠 뒤 T2b만 보류한 이유가 바로 이것이다.

## 3. 이미 있는 방어장치 (코드 레벨 — "위험 0"이 아니라 "완료 차단만 빠진 상태"임을 분명히 함)

`registerNewComponent()` 자체에 이미 구현된 안전장치(2026-09-01 코드 직접 확인):
- **경로 조작 차단**: `codePath`가 프로젝트 루트 밖을 가리키면 즉시 거부 (`resolvedDest.startsWith(resolvedProjectDir + path.sep)` 검증, 06 신뢰 경계 원칙)
- **하드코딩 값 거부**: `findHardcodedStyleViolations()`가 순수 hex/px 값을 발견하면 등록 자체를 거부(04 DO NOT 강제)
- **중복 등록 차단**: 같은 `codePath`가 이미 매핑돼 있으면 거부하고 재사용 경로(T2a)로 유도

즉 "이상한 위치에 쓰거나 중복 등록하는" 것은 이미 코드로 막혀 있다. **MCP로 열었을 때 새로 생기는 구멍은 정확히 하나 — "검증 실패해도 완료라고 보고되는 것을 막는 장치가 없다"는 것뿐이다.**

## 4. 노출 시 구체적으로 뚫리는 시나리오 (실제로 벌어질 수 있는 흐름)

1. 사용자가 Claude Desktop에서 "이 Figma 컴포넌트 새로 만들어줘"라고 요청한다.
2. AI가 코드를 생성하고, 가상의 `register_new_component`(T2b, 현재는 존재하지 않음) 도구로 실제 프로젝트 코드로 등록한다.
3. AI가 `reverify`를 호출했는데 axe 위반으로 FAIL이 나왔다.
4. AI가 (트랜스크립트가 길어 앞 결과를 놓치거나, 실수로) "컴포넌트 등록을 완료했습니다"라고 보고한다.
5. 사용자가 판정서(`reports/*.md`)를 직접 열어보지 않는 한 이게 FAIL 상태라는 걸 알 방법이 없다 — 특히 이 킷의 기준 사용자(비개발자 바이브코더, 01_PRD §2)에게는 사실상 알 수 없다.

이 시나리오는 "AI가 악의적이어서"가 아니라 "AI가 실수해도 잡아줄 장치가 없어서" 발생한다. 이 킷이 원래 해결하려던 문제(01_PRD §1: "AI가 만든 UI는 검증 없이 완료라고 보고되는 일이 잦다")가 Claude Desktop 경로에서만 그대로 재현되는 셈이다.

## 5. 완화 방안 후보 (구현 안 함 — 향후 판단 재료로만 제시)

실제로 T2b를 열게 될 경우 고려할 수 있는 완화책 후보(완전성 낮은 순):

| 방안 | 완전성 | 비고 |
|---|---|---|
| A. 도구 설명에 "반드시 `reverify`를 먼저 호출하고 PASS 확인 후에만 완료 보고하라"고 강하게 명시 (`reverify` 도구의 기존 정직 고지 패턴 재사용) | 낮음 | AI의 준수 의지에만 의존 — T3(기계적 차단)의 대체가 안 됨. 어디까지나 완화이지 해결이 아님 |
| B. 등록 직후 **자동으로 `reverify`까지 연쇄 실행**하고, FAIL이면 도구 자체가 `isError: true`로 응답 | 중간 | AI가 결과를 무시하고 임의 보고할 가능성은 남지만, 판정 결과가 도구 응답에 강제로 포함된다는 점에서 A보다 강함 |
| C. FAIL 상태 컴포넌트는 `component-map.json`에 `status: "unverified"`로 등록하고 PASS 후에만 `"verified"`로 승격 — 이후 같은 컴포넌트를 다루는 모든 도구 호출에 미검증 상태가 항상 노출됨 | 높음 | 상태 추적 스키마 자체를 바꾸는 설계 변경 — 02_DATA_MODEL.md 스키마 변경 + 회귀 테스트 다수 필요, "준비" 범위를 넘는 별도 작업 |
| D. 아예 열지 않고 T2a(프리뷰 연결)까지만 유지 (**현재 상태**) | 최고 | 위험 자체가 없음. 대신 Claude Desktop에서는 "새 컴포넌트 실제 코드 등록" 기능을 못 씀(Claude Code CLI로는 이미 가능하므로 완전히 막히는 건 아님) |

## 5-1. 완화방안 B 상세 설계 + 구현 (2026-09-01)

> 사용자가 먼저 "완화방안 B를 실제 코드 설계 수준까지 구체화"를 승인했고, 이어서 "설계대로 실제 구현"까지 별도 승인했다. **T2b 자체를 여는 것(=Claude Desktop에서 호출 가능하게 만드는 것)만은 여전히 별도 승인 사항**이라 `mcp-server.mjs`는 이번에도 건드리지 않았다 — 아래 함수는 구현·픽스처 실측까지 끝났지만 MCP 도구로 등록되지 않아 Claude Desktop에서 호출할 방법이 없다.
>
> **구현 완료(2026-09-01)**: `scripts/pipeline-codegen.mjs`에 `registerAndVerifyComponent()` 실제 구현 + `tests/pipeline-codegen.test.mjs`에 단위테스트 3건(`npm test` 330→**333/333**) + **실제 픽스처(Fixture) 왕복 실측**: 의도적 axe 위반(alt 없는 `<img>`) 컴포넌트 등록 → **FAIL**(`runId 2026-09-01-005`, 위반 상세까지 판정서에 정확히 기록됨 확인) → 수정 후 재등록 → **PASS**(`runId 2026-09-01-006`) → `component-map.json`·배치 파일·프리뷰 라우트 전부 등록 전 상태로 원상복구 확인. `npm audit` 0건.
>
> **구현 중 발견·수정한 실제 결함 1건**: 최초 구현 시 `verify-runner.mjs`(playwright·@axe-core/playwright를 정적 import)를 `pipeline-codegen.mjs` 파일 상단에서 정적 import했더니, 기존 `tests/detail-page-pipeline.test.mjs`의 "공백·한글 경로" 회귀 테스트(이 파일을 node_modules 없는 임시 폴더에 단독 복사해 서브프로세스로 실행)가 `ERR_MODULE_NOT_FOUND`로 깨지는 것을 `npm test` 재실행으로 즉시 발견 — `verify-runner.mjs`·`report-writer.mjs`·`execution-lock.mjs`를 함수 내부 동적 `import()`로 전환해 해소(아래 코드에 반영됨, 무거운 브라우저 의존성 체인은 이 함수를 실제로 호출할 때만 로드됨).

### 새 함수: `registerAndVerifyComponent()` (`pipeline-codegen.mjs`에 신설, 기존 `registerNewComponent()`는 무수정)

기존 `registerNewComponent()`를 감싸는 **별도 래퍼 함수**로 만든다(기존 함수 자체를 바꾸지 않는 이유: Claude Code CLI의 `--newComponentFile` 경로는 이미 T3 훅이 있어 자동 재검증이 불필요하고, 시그니처를 바꾸면 기존 M4 테스트 8건에 영향을 줄 수 있다 — 최소 변경 원칙).

```
registerAndVerifyComponent({ projectDir, designKitDir, figmaNodeId, figmaName, sourceFile, codePath, target })
  1. registerNewComponent({...})를 그대로 호출 → { routePath, ... } 획득
     (실측 확인: generatePreviewRoute()가 돌려주는 필드명은 route가 아니라 routePath, 예: "/design-kit-preview/badge")
  2. acquireLock(designKitDir)  — dashboard-server.mjs의 reverifyRun()과 동일한 동시성 가드 재사용
  3. startDevServer(projectDir)  — verify-runner.mjs export 함수, 포트 자동 우회 내장
  4. verifyPage({ baseUrl: devServer.url, route: routePath, screenshotDir: <새 경로> })  — verify-runner.mjs export 함수
  5. judge(result)  — verify-runner.mjs export 함수, PASS 조건 4종 기준 불변
  6. writeReport({ designKitDir, target, route: routePath, verifyRunnerOutput: {...}, generatedFiles: [codePath] })
     — report-writer.mjs export 함수, 기존 판정서 포맷·runId 채번 로직 그대로 재사용(신규 로직 없음)
  7. devServer.stop() → 락 해제
  8. return { ...registerNewComponent의 결과, verification: { verdict, runId, reportPath } }
```

**핵심**: 위 5개 함수(`acquireLock`·`startDevServer`·`verifyPage`·`judge`·`writeReport`) 전부 **이미 export돼 있고 다른 경로(`dashboard-server.mjs`의 `reverifyRun()`, `verify-runner.mjs`의 CLI `--target` 모드)에서 이미 검증된 채로 재사용 중**이다 — 이 설계는 새 검증 로직을 만드는 게 아니라 기존 조각을 새 순서로 조립하는 것뿐이라, 04_PROJECT_SPEC.md "코어 엔진 재사용" 원칙과 정합하고 회귀 위험이 낮다.

### MCP 도구 쪽 변경 (`mcp-server.mjs`, T2b 노출 시에만 추가할 코드)

```js
async ({ projectDir, sourceFile, codePath, figmaNodeId, figmaName }) => {
  const result = await registerAndVerifyComponent({ ...resolved 인자... });
  if (result.verification.verdict !== 'PASS') {
    return { content: [{ type: 'text', text: `FAIL — 등록은 됐지만 검증에 실패했습니다.\n${JSON.stringify(result.verification, null, 2)}` }], isError: true };
  }
  return textResult(JSON.stringify(result, null, 2));
}
```

`isError: true`는 MCP 표준 필드로, 대부분의 MCP 클라이언트(Claude Desktop 포함)가 도구 결과를 에러로 시각적으로 구분해 표시한다 — 현재 T2a(`register_component_preview`)처럼 "판정 결과를 텍스트로만 주고 AI의 자발적 준수에 맡기는" 방식보다 확실히 강하다.

### 정직한 한계 (완화이지 T3 대체가 아님 — 과대포장 금지)

- `isError: true`는 **강한 신호**이지 **기계적 차단**이 아니다. Claude Code의 `Stop` 훅처럼 "완료 보고 자체가 불가능해지는" 구조적 장치가 아니라, AI가 이 신호를 보고도 무시하고 "완료됐습니다"라고 말하는 것을 프로토콜 차원에서 막지는 못한다.
- 따라서 §5 표의 완전성 평가는 **"중간"에서 재조정하지 않는다** — 설계가 구체화됐다고 완전성 등급이 "높음"(C안 수준)으로 올라가는 게 아니다. 여전히 C(상태 추적 스키마 자체를 바꾸는 것)보다 약하다.

### 테스트 계획 (구현 시 그대로 사용 — 실행하지 않음, 설계만)

- 단위: `registerAndVerifyComponent()`를 PASS/FAIL 양쪽 합성 시나리오로 — M5(axe 위반 상세 기록)·M4(하드코딩 거부)가 이미 검증해둔 개별 조각과 겹치지 않게, "조합된 흐름"만 신규 검증
- 픽스처 통합: `/broken`과 같은 패턴으로 의도적 axe 위반이 있는 합성 컴포넌트 등록 → FAIL + `isError: true`가 원문 그대로 응답에 실림을 실측 확인 → 정상 컴포넌트로 재등록해 PASS 경로도 확인 → 두 번의 연속 등록이 `runId` 채번·`component-map.json`을 손상시키지 않는지 확인

---

## 6. 권고

**현재 시점 권고: D(현행 유지)를 계속 추천한다 — 단, 2026-09-01 기준 3개 조건 중 진행 상황이 갱신됨.**

**재검토 체크리스트 갱신 상태(2026-09-01)**:
| 조건 | 상태 |
|---|---|
| (1) T1이 최소 1회 사용자 실사용으로 검증됨 | ✅ **충족** — Claude Desktop `.mcpb` 실제 설치·`list_runs` 실제 호출 성공(CHECKPOINT.md ① 항목) |
| (2) 완화 방안 중 최소 B 이상 구현 | ✅ **구현+픽스처 실측 완료(2026-09-01)** — 위 §5-1 참조. `registerAndVerifyComponent()` 실제 코드 + 단위테스트 3건 + 픽스처 FAIL/PASS 왕복 실측 |
| (3) 사용자의 명시적 승인 | ❌ **미충족** — 유일하게 남은 조건 |

근거(갱신):
- **3개 조건 중 2개(T1 실사용·완화방안 구현)가 이제 전부 충족됐다.** 그럼에도 권고를 D에서 바꾸지 않는 유일한 이유는 **사용자가 아직 "Claude Desktop에서 T2b를 실제로 호출 가능하게 열어도 된다"고 말한 적이 없다는 것**뿐이다 — 이건 기술적 완성도의 문제가 아니라 순수한 승인의 문제다.
- **대안 경로 존재**: 신규 컴포넌트 등록이 급하면 Claude Code CLI(완료 차단 훅 있음)로는 이미 할 수 있다 — T2b가 없다고 이 킷의 핵심 기능이 막히는 게 아니다.
- **다음 재검토를 시작하려면**: 사용자가 위 구현·실측 결과를 보고 "`mcp-server.mjs`에 도구로 등록해 실제로 열어라"고 명시적으로 승인하는 것, 그것 하나만 남았다.

---

> 참고용이며 법적 효력을 보장하지 않음. 이 문서는 기술적 리스크 검토이지 법률·계약 자문이 아니다 — 상업적 활용 시 법률 검토가 필요하면 01_PRD.md §7 원칙을 그대로 따른다.
