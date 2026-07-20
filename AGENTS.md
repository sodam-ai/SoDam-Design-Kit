# SoDam-Design-Kit — Codex 규칙

Claude Code 플러그인 형태로 지원되지 않는 환경(Codex 등)에서도 이 킷의 핵심 원칙을 규칙 수준으로 지키기 위한 문서입니다.
전체 사양은 `.PRD/01_PRD.md`~`04_PROJECT_SPEC.md`가 정본이며, 이 문서는 그 요약입니다.

## 목표
Figma 디자인을 shadcn/ui 코드로 만들되, **실제 브라우저 검증(Playwright+axe-core+3뷰포트)을 통과해야만 완료**로 본다.

## 작업 순서 (고정)
1. component-map.json에서 기존 컴포넌트 재사용 먼저 검토
2. 컴포넌트 1개 단위로 생성 (페이지 전체 한 번에 금지)
3. dev server 자동 기동(포트 자동 우회) → Playwright 실제 렌더
4. axe-core critical/serious 위반 검사 (판정 기준)
5. 360/768/1440px 3개 뷰포트 스크린샷
6. `.design-kit/runs/`·`reports/`에 판정서 기록
7. FAIL 시 실패 사유를 다음 시도에 주입해 재시도 (최대 3회, 2연속 FAIL만 확정)

## 절대 금지
- 검증 게이트 PASS 판정서 없이 "완료"라고 보고하지 않는다
- 스크린샷만 보고 색상·간격을 추측하지 않는다 (Figma 구조 데이터 사용)
- 기존 component-map을 무시하고 새 컴포넌트를 만들지 않는다
- 모바일 뷰포트(360px) 확인 없이 완료 처리하지 않는다
- 저작권 불명 이미지·폰트·아이콘을 사용하지 않는다
- API 키·토큰을 코드에 직접 쓰지 않는다 (환경변수)
- 외부 명령을 셸 문자열로 조합해 실행하지 않는다 (spawn+인자 배열만)
- FAIL 자동 수정 재시도에서 데이터 흐름·인증·저장·API 로직 파일을 수정하지 않는다 (표시 코드만)

## 완료 조건
- lint 통과 / typecheck 통과 / build 통과
- Playwright로 핵심 화면 렌더 확인, 콘솔 에러 0건
- axe-core critical/serious 위반 0건
- 360px, 768px, 1440px 뷰포트 스크린샷 존재
