---
name: design-pipeline
description: Figma 디자인을 shadcn/ui 코드로 만들고 실제 브라우저 검증(Playwright+axe-core+3뷰포트)을 통과해야만 완료로 표시하는 파이프라인. "Figma", "디자인 코드로", "컴포넌트 만들어", "shadcn" 등 UI 생성 요청 시 사용.
---

# design-pipeline

`.PRD/04_PROJECT_SPEC.md`의 절대 규칙(DO NOT/ALWAYS DO)을 그대로 따릅니다.

## 핵심 규칙 (요약 — 전문은 04_PROJECT_SPEC.md)
- 컴포넌트 1개 단위로 작게 시작
- component-map.json 재사용 우선, Figma 구조 데이터 사용(스크린샷 추측 금지)
- 검증 순서 고정: 생성 → dev server 자동 기동 → Playwright 렌더 → axe-core → 3뷰포트 → Lighthouse(참고)
- PASS 조건 4가지(02_DATA_MODEL.md 단일 출처): 렌더 성공·콘솔 에러 0·axe critical/serious 0·3뷰포트 스크린샷 존재
- FAIL 시 실패 사유를 다음 시도에 주입, 최대 3회, 2연속 FAIL만 확정
- 표시(presentation) 코드만 수정 — 로직·인증·저장·API 파일 금지

## 관련 명령
- `/sodam-design-kit:setup`
- `/sodam-design-kit:pipeline`
