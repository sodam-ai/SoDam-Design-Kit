---
description: SoDam-Design-Kit 설정 마법사 — config.json 생성 + shadcn 컴포넌트 스캔으로 component-map 초기 시드
---

# /sodam-design-kit:setup

## 목적
현재 프로젝트에 `.design-kit/` 폴더를 만들고 킷을 사용할 준비를 합니다. 프로젝트당 1회만 실행합니다.

## 실행
```
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-wizard.mjs" --project <현재 프로젝트 경로>
```
- shadcn/ui가 설치되어 있지 않으면(스크립트가 `shadcn/ui가 설치되어 있지 않습니다` 출력) `npx shadcn init` 실행 여부를 **사용자에게 확인 후** 수행하고, 완료되면 setup을 다시 실행하세요.
- 이미 `.design-kit/config.json`이 있으면 스크립트가 자동으로 건너뜁니다(멱등성 — 재실행해도 기존 설정을 덮어쓰지 않음). 재스캔이 필요하면 `--force`를 추가하세요 — **이미 확보한 Figma 매핑(figmaNodeId/figmaName/propsHint/lastVerified)은 보존되고, 코드에 새로 생긴 컴포넌트만 빈 값으로 추가됩니다**(2026-07-20 실측 확인 — 과거엔 매핑이 통째로 초기화되는 결함이 있었음, 수정 완료).
- Figma 파일이 있으면 `--figmaFileUrl <URL>`을 추가할 수 있습니다(선택 — 없어도 정상 동작).

## 동작 (`scripts/setup-wizard.mjs`, 실측 검증 완료 — .PRD/02_DATA_MODEL.md 스키마 그대로)
1. `components.json`(shadcn 자체 설정 — 단일 출처)과 `tsconfig.json`의 경로 별칭을 읽어 실제 UI 컴포넌트 디렉터리를 정확히 찾음(하드코딩 금지)
2. 그 디렉터리의 `.tsx` 파일을 스캔해 `.design-kit/component-map.json` 초기 시드 생성 (figmaNodeId/figmaName은 빈 값 — Figma 매핑은 `/sodam-design-kit:pipeline`이 채움)
3. `.design-kit/config.json` 생성 — framework("nextjs" 고정)·uiLibrary("shadcn")·viewports([360,768,1440])·gateEnabled(true)·maxAutoRetry(3)·a11yLevel("serious")
4. `.design-kit/runs/`, `.design-kit/reports/` 폴더 생성

## 금지 (04_PROJECT_SPEC.md DO NOT)
- 셸 문자열 조합 실행 금지 (spawn+인자 배열만)
- 개인정보·실데이터가 담긴 Figma 파일 연결 금지
