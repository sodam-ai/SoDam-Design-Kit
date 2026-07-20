# RESEARCH_SOURCES-03

# ✅ 최종 결론

아래는 **2026년 7월 19일 기준**, Claude Code·Codex 등 AI 코딩 에이전트에서 검색·분석·점검·문서화 자동화에 활용할 수 있는 **디자인 관련 저작권, 디자인권, 특허, 상표, 폰트, 이미지·아이콘·스톡, AI 생성 디자인, 오픈소스 라이선스, 인물·개인정보, 광고 표시, 출처·진본성 증명** 관련 공식 사이트·데이터베이스·API·CLI·GitHub 자료입니다.

디자인을 법적으로 검토할 때는 한 종류의 권리만 확인해서는 안 됩니다.

```text
시각적 표현·그래픽·사진·일러스트·영상:
저작권

제품 외관·형태·GUI·아이콘·화면 디자인:
디자인권

로고·브랜드명·심볼·슬로건:
상표권

기술적 기능·처리 방식:
특허·실용신안

폰트·아이콘·스톡·템플릿·코드:
개별 이용약관과 라이선스

인물 사진·AI 얼굴·음성:
초상권·퍼블리시티권·개인정보·디지털 복제물 관련 법률

광고·홍보 디자인:
표시광고·소비자보호·플랫폼 정책
```

Claude Code·Codex가 가장 직접적으로 자동화할 수 있는 것은 다음 범위입니다.

```text
KIPRISPlus API를 이용한 국내 특허·디자인·상표 검색
공식 법령과 판례 자료 수집·요약
라이선스 파일·저작권 고지 자동 탐지
폰트·이미지·아이콘 출처와 이용조건 목록화
SPDX·SBOM·저작권 고지문 생성
AI 생성물과 사람의 창작 부분 기록
C2PA Content Credentials 삽입·검증
디자인 자산별 LICENSES.csv 또는 ATTRIBUTION.md 생성
```

다만 **AI 검토는 법률 자문이나 침해 여부의 확정 판정이 아닙니다.** 유사성, 공정 이용, 창작성, 혼동 가능성, 디자인 신규성처럼 법적 판단이 필요한 문제는 변리사·변호사·저작권 전문가의 최종 검토가 필요합니다.

------

# 1. 대한민국 디자인 관련 핵심 법령

```text
# 국가법령정보센터
https://www.law.go.kr/

# 저작권법
https://www.law.go.kr/법령/저작권법

# 디자인보호법
https://www.law.go.kr/법령/디자인보호법

# 상표법
https://www.law.go.kr/법령/상표법

# 특허법
https://www.law.go.kr/법령/특허법

# 실용신안법
https://www.law.go.kr/법령/실용신안법

# 부정경쟁방지 및 영업비밀보호에 관한 법률
https://www.law.go.kr/법령/부정경쟁방지및영업비밀보호에관한법률

# 콘텐츠산업진흥법
https://www.law.go.kr/법령/콘텐츠산업진흥법

# 개인정보 보호법
https://www.law.go.kr/법령/개인정보보호법

# 표시·광고의 공정화에 관한 법률
https://www.law.go.kr/법령/표시·광고의공정화에관한법률
```

국가법령정보센터에서는 현행 법령뿐 아니라 개정 이력, 시행령·시행규칙, 관련 판례를 함께 확인할 수 있습니다.

------

# 2. 국내 특허·디자인·상표 공식 검색

## KIPRIS

```text
https://www.kipris.or.kr/
https://www.kipris.or.kr/kportal/search/total_search.do
https://www.kipris.or.kr/kportal/link/search_total_target.do
```

KIPRIS에서는 국내외 특허·실용신안, 디자인, 상표, 심판 자료를 검색할 수 있습니다. 로고·제품 외관·화면 디자인·아이콘·포장 디자인을 제작하기 전 동일하거나 유사한 등록 권리가 있는지 조사하는 기본 검색 도구입니다. ([KIPRIS](https://www.kipris.or.kr/kportal/link/search_total_target.do?utm_source=chatgpt.com))

## KIPRISPlus Open API

```text
https://plus.kipris.or.kr/
https://plus.kipris.or.kr/portal/bbs/view.do?bbsId=B0000001&nttId=1060
https://www.data.go.kr/data/15057631/openapi.do
```

KIPRISPlus는 Claude Code·Codex가 Python·Java·REST 요청으로 국내 지식재산 데이터를 조회할 때 가장 직접적으로 연결할 수 있는 공식 경로입니다. 공식 개발 가이드에는 REST API와 Python·Java 샘플 코드가 포함되어 있습니다. ([KIPRIS Plus](https://plus.kipris.or.kr/portal/bbs/view.do?bbsId=B0000001&menuNo=210149&nttId=638&utm_source=chatgpt.com))

```text
Claude Code / Codex
→ 디자인명·출원인·분류·등록번호 검색식 생성
→ KIPRISPlus REST API 호출
→ 검색 결과 JSON/XML 저장
→ 중복·유사 후보 정리
→ 검토 보고서 생성
```

무료 호출량과 유료 데이터 상품이 구분되므로 사용 전에 현재 상품·호출 조건을 확인해야 합니다. ([KIPRIS Plus](https://plus.kipris.or.kr/portal/bbs/Faq_info.do?buttonIndex=&pageIndex=2&utm_source=chatgpt.com))

------

# 3. 한국 저작권 공식 자료

## 한국저작권위원회

```text
https://www.copyright.or.kr/
https://www.copyright.or.kr/information-materials/
https://www.copyright.or.kr/business/
```

## 공유마당

```text
https://gongu.copyright.or.kr/
https://www.copyright.or.kr/business/gongu/index.do
```

공유마당은 CCL 저작물, 보호기간이 만료된 저작물 등 저작권 처리가 된 콘텐츠를 제공하는 공식 서비스입니다. 각 자산마다 표시된 이용조건을 개별적으로 확인해야 합니다. ([한국저작권위원회](https://www.copyright.or.kr/business/gongu/index.do?utm_source=chatgpt.com))

## 저작권 등록

```text
https://www.cros.or.kr/
```

다음 자료의 창작 과정과 원본을 보존하고 필요하면 등록을 검토할 수 있습니다.

```text
로고 원본
브랜드 그래픽
포스터
패키지 디자인
웹사이트 시안
UI 그래픽
아이콘 세트
사진
일러스트
영상
모션그래픽
디자인 시스템 문서
```

------

# 4. 국제 디자인권 공식 검색

## WIPO Global Design Database

```text
https://www.wipo.int/en/web/global-design-database
https://www.wipo.int/en/web/global-design-database/faqs_designdb
https://www.wipo.int/en/web/global-design-database/terms_and_conditions
```

WIPO Global Design Database는 헤이그 국제등록 디자인과 참여 국가·지역 기관의 디자인 자료를 키워드, 명칭, 분류, 날짜, 국가 등으로 검색할 수 있습니다. WIPO도 이 데이터베이스만으로 모든 권리를 포괄하지 않으므로 각 국가·지역 데이터베이스를 함께 확인하라고 안내합니다. ([세계지식재산기구](https://www.wipo.int/en/web/global-design-database?utm_source=chatgpt.com))

**중요:** 이 데이터베이스의 이용약관은 자동 질의, 대량 다운로드, 스크래핑 등을 금지합니다. 따라서 Claude Code·Codex가 브라우저를 반복 조작하거나 크롤러를 실행하도록 만들면 안 됩니다. 사람이 직접 검색하거나 허용된 공식 데이터·API 경로를 사용해야 합니다. ([세계지식재산기구](https://www.wipo.int/en/web/global-design-database/terms_and_conditions?utm_source=chatgpt.com))

## WIPO Hague System

```text
https://www.wipo.int/hague/
https://www.wipo.int/en/web/hague-system/searching_designs
https://www.wipo.int/en/web/hague-system
```

WIPO는 국제 디자인 출원 전 Global Design Database와 각국 자료, 온라인 잡지 등 다양한 선행 디자인 자료를 확인하도록 안내합니다. 디자인 신규성은 출원·등록 가능성을 판단하는 핵심 요소입니다. ([세계지식재산기구](https://www.wipo.int/en/web/hague-system/searching_designs?utm_source=chatgpt.com))

## Locarno Classification

```text
https://www.wipo.int/classifications/locarno/
https://www.wipo.int/classifications/locarno/locpub/
```

제품·패키지·화면 표시·그래픽 심볼 등 디자인 분야의 국제 분류를 찾는 데 사용합니다.

------

# 5. 국제 상표·로고 검색

## WIPO Global Brand Database

```text
https://www.wipo.int/en/web/global-brand-database
https://branddb.wipo.int/
```

국제상표, 참여 국가·지역 상표, 지리적 표시, 상징 등을 검색할 수 있으며 문자뿐 아니라 이미지 유사성 검색도 제공합니다. 로고·심볼·브랜드명 조사에 중요합니다. ([세계지식재산기구](https://www.wipo.int/en/web/global-brand-database?utm_source=chatgpt.com))

## Madrid Monitor

```text
https://www.wipo.int/madrid/monitor/
https://www.wipo.int/madrid/
```

## Nice Classification

```text
https://www.wipo.int/classifications/nice/
https://nclpub.wipo.int/
```

## Vienna Classification

```text
https://www.wipo.int/classifications/vienna/
```

로고의 도형 요소를 분류하고 비슷한 도형 상표를 조사할 때 사용합니다.

## 미국 USPTO 상표 검색

```text
https://www.uspto.gov/trademarks/search
https://www.uspto.gov/trademarks/search/search
https://www.uspto.gov/trademarks/search/design-search-codes
```

미국 상표 검색에서는 문자상표뿐 아니라 도형 요소를 Design Search Code로 분류해 유사 상표를 조사합니다. 공식 시스템은 현재 일반적인 역이미지 검색을 지원하지 않으므로 코드·키워드·상품 분류를 함께 사용해야 합니다. ([미국 특허청](https://www.uspto.gov/trademarks/search/design-search-codes?utm_source=chatgpt.com))

## EUIPO

```text
https://www.euipo.europa.eu/
https://euipo.europa.eu/eSearch/
https://www.tmdn.org/tmview/
https://www.tmdn.org/tmdsview-web/
```

------

# 6. 특허·기술적 기능 검색

디자인의 시각적 형태만이 아니라 다음과 같은 기능을 직접 구현했다면 특허·실용신안 검토가 필요할 수 있습니다.

```text
자동 레이아웃 생성 방식
이미지 처리 알고리즘
디자인 자동화 처리 과정
GUI 조작 방식
생성형 디자인 파이프라인
사용자 입력에 따른 동적 배치 기술
렌더링·압축·변환 방식
```

## 국내

```text
https://www.kipris.or.kr/
https://plus.kipris.or.kr/
```

## WIPO PATENTSCOPE

```text
https://patentscope.wipo.int/
https://www.wipo.int/patentscope/
```

## Google Patents

```text
https://patents.google.com/
```

## USPTO Patent Center·Patent Search

```text
https://patentscope.uspto.gov/
https://ppubs.uspto.gov/pubwebapp/
https://patentcenter.uspto.gov/
https://developer.uspto.gov/
```

## European Patent Office

```text
https://worldwide.espacenet.com/
https://www.epo.org/en/searching-for-patents
https://www.epo.org/en/searching-for-patents/data/web-services/ops
```

------

# 7. WIPO 국제 법률·판례 데이터베이스

```text
https://www.wipo.int/en/web/wipolex/
https://www.wipo.int/wipolex/
```

WIPO Lex는 국가별 저작권법, 디자인법, 상표법, 특허법, 조약, 관련 판례와 AI·IP 사례를 검색할 수 있는 국제 지식재산 법률 데이터베이스입니다. ([세계지식재산기구](https://www.wipo.int/en/web/wipolex/?utm_source=chatgpt.com))

```text
국가별 디자인보호법 비교
국가별 저작권 보호기간
AI 생성물 관련 판례
상표·도메인 분쟁
헤이그·마드리드·PCT 관련 법률
```

------

# 8. 미국 시각 디자인 저작권 공식 자료

```text
https://www.copyright.gov/
https://www.copyright.gov/registration/visual-arts/
https://www.copyright.gov/engage/visual-artists/
https://www.copyright.gov/registration/other-digital-content/
https://www.copyright.gov/registration/
```

미국 저작권청의 Visual Arts 범위에는 그래픽 디자인, 로고, 포스터, 광고 시각물, 제품 포장, 사진, 일러스트, 웹사이트, 건축 도면 등이 포함됩니다. 단순한 심볼이나 짧은 워드 로고는 저작권 보호가 어려울 수 있지만 상표 보호는 별도로 가능할 수 있습니다. ([저작권청](https://www.copyright.gov/registration/visual-arts/index.html?utm_source=chatgpt.com))

웹사이트·앱·화면 표시·소셜 게시물 등 디지털 콘텐츠 역시 저작물 유형에 따라 등록할 수 있습니다. ([저작권청](https://www.copyright.gov/registration/other-digital-content/?utm_source=chatgpt.com))

------

# 9. AI 생성 디자인 관련 공식 법률 자료

## WIPO AI and IP

```text
https://www.wipo.int/about-ip/en/artificial_intelligence/
https://www.wipo.int/en/web/wipolex/
```

## 미국 저작권청 AI 보고서

```text
https://www.copyright.gov/ai/
https://www.copyright.gov/ai/index.html
https://www.copyright.gov/events/ai-application-process/
```

미국 저작권청은 AI 생성물의 저작권 등록, 인간 창작 기여, 디지털 복제물, 학습 데이터 문제를 별도 보고서와 지침으로 다룹니다. AI 생성 요소를 포함한 등록 신청에서는 AI 생성 부분을 공개해야 한다는 지침도 제시했습니다. ([저작권청](https://www.copyright.gov/ai/index.html?utm_source=chatgpt.com))

AI로 디자인을 제작할 때는 다음 기록을 남기는 편이 안전합니다.

```text
사용한 모델과 버전
생성 날짜
직접 작성한 프롬프트
참조 이미지 출처와 라이선스
AI가 생성한 부분
사람이 직접 선택·편집·배치·합성한 부분
원본과 수정본
PSD·AI·Figma·Blender 등 편집 원본
생성 서비스 당시 이용약관
```

------

# 10. 생성형 AI 서비스별 약관 확인

생성 도구의 결과물이 상업적으로 사용 가능하더라도 **타인의 저작권·상표·초상권을 침해하지 않는다는 보증과는 다릅니다.**

```text
# OpenAI
https://openai.com/policies/
https://openai.com/policies/terms-of-use/
https://openai.com/policies/service-terms/

# Adobe Firefly
https://www.adobe.com/legal/terms.html
https://www.adobe.com/legal/licenses-terms/adobe-gen-ai-user-guidelines.html
https://www.adobe.com/products/firefly/enterprise.html

# Google
https://policies.google.com/terms
https://cloud.google.com/terms
https://cloud.google.com/terms/service-terms

# Canva
https://www.canva.com/policies/terms-of-use/
https://www.canva.com/policies/content-license-agreement/

# Figma
https://www.figma.com/legal/
https://www.figma.com/legal/tos/

# Runway
https://runwayml.com/terms-of-use/
https://runwayml.com/usage-policy/

# Midjourney
https://docs.midjourney.com/docs/terms-of-service
```

Claude Code·Codex가 약관을 자동 수집해 요약할 수는 있지만, 약관은 자주 변경되므로 제작 날짜 기준 원문을 저장해야 합니다.

------

# 11. Creative Commons·공유 라이선스

```text
https://creativecommons.org/
https://creativecommons.org/licenses/
https://creativecommons.org/cc-licenses/
https://creativecommons.org/cc-license-your-work/
https://creativecommons.org/share-your-work/cclicenses/
https://creativecommons.org/choose/
https://search.creativecommons.org/
```

Creative Commons에는 BY, SA, NC, ND 조건 조합이 있으며 라이선스별 상업 이용·수정·동일조건 적용 범위가 다릅니다. 예를 들어 CC BY는 출처를 표시하면 상업적 이용과 수정이 가능하지만, CC BY-NC는 상업 이용이 허용되지 않습니다. ([Creative Commons](https://creativecommons.org/licenses/?utm_source=chatgpt.com))

CC 라이선스는 원칙적으로 철회할 수 없으며, 자신이 저작권을 보유하거나 라이선스를 부여할 권한이 있는 자산에만 적용할 수 있습니다. ([Creative Commons](https://creativecommons.org/cc-license-your-work/?utm_source=chatgpt.com))

```text
BY:
저작자 표시

NC:
비영리 이용만 허용

ND:
변경·2차적 저작물 작성 금지

SA:
변경 결과물을 동일·호환 라이선스로 배포
```

------

# 12. 폰트 저작권·라이선스

## SIL Open Font License

```text
https://openfontlicense.org/
https://software.sil.org/oflt/
https://software.sil.org/fonts/faq/
```

OFL 폰트는 상업 디자인, 인쇄, 로고와 그래픽 제작 등에 사용할 수 있지만, 폰트 파일 자체의 배포·수정·Reserved Font Name 등에는 조건이 있습니다. ([SIL Language Technology](https://software.sil.org/fonts/faq/?utm_source=chatgpt.com))

## Google Fonts 라이선스 자료

```text
https://fonts.google.com/
https://developers.google.com/fonts/faq
https://googlefonts.github.io/gf-guide/license-file.html
https://github.com/google/fonts
```

Google Fonts에 제출되는 프로젝트는 현재 SIL OFL 1.1을 사용하지만, 실제 프로젝트에서는 다운로드한 폰트 패키지 안의 라이선스 파일을 함께 보존해야 합니다. ([Google Fonts](https://googlefonts.github.io/gf-guide/license-file.html?utm_source=chatgpt.com))

## Font Awesome

```text
https://fontawesome.com/license
https://github.com/FortAwesome/Font-Awesome
```

## Material Symbols

```text
https://fonts.google.com/icons
https://github.com/google/material-design-icons
```

## 폰트 점검 시 반드시 구분할 항목

```text
Desktop 사용
Webfont 임베드
앱 임베드
전자책·PDF 임베드
영상·방송 사용
서버 기반 이미지 자동 생성
고객에게 원본 폰트 전달
로고 워드마크 제작
폰트 파일 수정
재배포
```

------

# 13. 아이콘·일러스트·스톡 이미지 라이선스

서비스마다 “무료 다운로드”와 “상업적 재사용 허용”은 같은 뜻이 아닙니다.

```text
# Unsplash
https://unsplash.com/license
https://unsplash.com/terms

# Pexels
https://www.pexels.com/license/
https://www.pexels.com/terms-of-service/

# Pixabay
https://pixabay.com/service/license-summary/
https://pixabay.com/service/terms/

# Freepik
https://www.freepikcompany.com/legal
https://www.freepik.com/legal/terms-of-use

# Adobe Stock
https://stock.adobe.com/license-terms
https://www.adobe.com/legal/terms.html

# Shutterstock
https://www.shutterstock.com/license
https://www.shutterstock.com/terms

# Flaticon
https://www.flaticon.com/legal

# The Noun Project
https://thenounproject.com/legal/
https://thenounproject.com/pricing/

# Iconify
https://iconify.design/
https://iconify.design/docs/icons/license/
https://github.com/iconify/icon-sets
```

점검 항목은 다음과 같습니다.

```text
상업 이용
출처 표시
수정 허용
단독 판매 금지
템플릿 재판매 금지
로고·상표 사용 제한
인쇄 수량 제한
클라이언트 양도
제품 포장 사용
AI 학습·생성 입력 허용 여부
인물·건물·상표가 포함된 사진의 추가 권리
```

------

# 14. 로고·브랜드·상표 관련 추가 법률

로고를 생성할 때는 저작권 검색만으로 부족합니다.

```text
브랜드명:
문자상표 검색

심볼:
도형상표 검색

제품·서비스:
Nice 상품·서비스 분류 확인

도형 요소:
Vienna Classification 확인

국내:
KIPRIS 상표 검색

국제:
WIPO Global Brand Database

미국:
USPTO Trademark Search

유럽:
EUIPO·TMview
```

상표 침해는 완전히 동일한 로고뿐 아니라 **상품·서비스 분야와 외관·호칭·관념의 유사성, 소비자의 출처 혼동 가능성**이 문제될 수 있습니다.

------

# 15. 디자인권과 저작권의 중첩 검토

하나의 결과물에 여러 권리가 동시에 적용될 수 있습니다.

```text
앱 아이콘:
저작권 + 디자인권 + 상표권 가능

제품 패키지:
저작권 + 디자인권 + 상표권 + 부정경쟁방지법 가능

로고:
상표권 + 저작권 가능

웹 UI:
저작권 + 디자인권 + 부정경쟁방지법 가능

제품 외관:
디자인권 + 저작권 + 특허 가능

캐릭터:
저작권 + 상표권 + 부정경쟁방지법 가능

폰트 워드마크:
상표권 + 폰트 이용허락 문제
```

따라서 Claude Code·Codex 검토 보고서도 권리 종류별로 분리해야 합니다.

------

# 16. 초상권·인물·음성·개인정보

AI 이미지·광고·포스터·SNS 디자인에 실제 인물 또는 닮은 얼굴이 들어가면 다음 자료도 확인해야 합니다.

```text
# 개인정보보호위원회
https://www.pipc.go.kr/

# 개인정보보호 종합포털
https://www.privacy.go.kr/

# 개인정보 보호법
https://www.law.go.kr/법령/개인정보보호법

# 미국 저작권청 AI·디지털 복제물
https://www.copyright.gov/ai/
```

검토 대상은 다음과 같습니다.

```text
실제 인물 사진 사용 동의
모델 릴리스
상업 광고 이용 동의
AI 얼굴 합성
유명인 유사 이미지
음성 복제
미성년자 이미지
민감정보 노출
사진 배경의 차량번호·주소·문서
```

------

# 17. 광고·홍보 디자인 법률

```text
# 공정거래위원회
https://www.ftc.go.kr/

# 표시·광고의 공정화에 관한 법률
https://www.law.go.kr/법령/표시·광고의공정화에관한법률

# 전자상거래 등에서의 소비자보호에 관한 법률
https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률

# 식품의약품안전처
https://www.mfds.go.kr/

# 방송통신심의위원회
https://www.kocsc.or.kr/
```

포스터·SNS 광고·배너·랜딩페이지에서는 다음도 법적 문제가 될 수 있습니다.

```text
허위·과장 표현
최고·유일·1위 표현
비교광고
후기·추천 위장
협찬·광고 표시 누락
가격·할인율 표시
의료·건강 효능
투자 수익 보장
타사 로고·제품 이미지 사용
AI로 생성한 가짜 후기·인물
```

------

# 18. 오픈소스·디자인 시스템 라이선스 자동 검사

웹사이트·랜딩페이지·디자인 시스템에는 코드, 아이콘, 폰트, UI 라이브러리가 함께 들어가므로 오픈소스 라이선스 검사도 필요합니다.

## ScanCode Toolkit

```text
https://scancode-toolkit.readthedocs.io/
https://scancode-toolkit.readthedocs.io/en/stable/explanation/scancode-license-detection.html
https://github.com/aboutcode-org/scancode-toolkit
```

ScanCode는 코드베이스에서 라이선스, 저작권 고지, 패키지와 의존성을 탐지하고 JSON·CSV·HTML·SPDX 등의 결과를 생성합니다. Windows·macOS·Linux에서 CLI 또는 라이브러리로 사용할 수 있습니다. ([ScanCode Toolkit Documentation](https://scancode-toolkit.readthedocs.io/en/stable/explanation/scancode-license-detection.html?utm_source=chatgpt.com))

```text
Claude Code / Codex
→ ScanCode 실행
→ 라이선스·저작권 고지 JSON 생성
→ 금지·주의 라이선스 분류
→ ATTRIBUTION.md 생성
```

## FOSSology

```text
https://www.fossology.org/
https://www.fossology.org/get-started/
https://fossology.github.io/
https://github.com/fossology/fossology
https://github.com/fossology/fossology/wiki
```

FOSSology는 CLI, REST API와 웹 UI를 제공하고 라이선스·저작권·수출통제 관련 스캔과 SPDX 보고서를 생성합니다. ([FOSSology](https://www.fossology.org/about/?utm_source=chatgpt.com))

## OSS Review Toolkit

```text
https://oss-review-toolkit.org/
https://github.com/oss-review-toolkit/ort
```

ORT는 의존성 분석, 라이선스 정책 자동화, SPDX·CycloneDX SBOM, 저작권 고지문 생성을 CLI·라이브러리·CI 방식으로 제공합니다. ([GitHub](https://github.com/oss-review-toolkit/ort?utm_source=chatgpt.com))

## SPDX

```text
https://spdx.dev/
https://spdx.org/licenses/
https://spdx.dev/tools/
https://spdx.dev/tools/open-source-tools/
https://github.com/spdx
```

## REUSE

```text
https://reuse.software/
https://reuse.readthedocs.io/
https://github.com/fsfe/reuse-tool
```

------

# 19. GitHub 라이선스·SBOM 관련 자료

```text
https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-the-dependency-graph
https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/exporting-a-software-bill-of-materials-for-your-repository
https://docs.github.com/en/enterprise-cloud@latest/code-security/concepts/supply-chain-security/open-source-license-compliance
```

GitHub의 오픈소스 라이선스 정책 기능은 의존성 라이선스를 정책과 비교하고 비허용 의존성이 추가되는 Pull Request를 차단할 수 있지만, 현재 일부 기능은 Enterprise·GitHub Code Security 조건과 공개 미리보기 상태가 적용됩니다. ([GitHub Docs](https://docs.github.com/en/enterprise-cloud@latest/code-security/concepts/supply-chain-security/open-source-license-compliance?utm_source=chatgpt.com))

------

# 20. 콘텐츠 출처·AI 생성 이력 증명

## C2PA·Content Credentials

```text
https://c2pa.org/
https://c2pa.org/specifications/specifications/
https://contentcredentials.org/
https://contentauthenticity.org/
https://opensource.contentauthenticity.org/
https://opensource.contentauthenticity.org/docs/getting-started/
https://github.com/contentauth
```

Content Credentials는 이미지·영상·오디오의 생성자, 편집 이력, AI 사용 여부 등 출처 정보를 변조 탐지 가능한 메타데이터로 기록하는 기술입니다. ([Experience League](https://experienceleague.adobe.com/en/docs/experience-manager-assets-essentials/help/content-credentials?utm_source=chatgpt.com))

## CLI·SDK

```text
https://github.com/contentauth/c2pa-rs
https://github.com/contentauth/c2pa-python
https://github.com/contentauth/c2pa-js
https://github.com/contentauth/c2pa-node-v2
https://github.com/contentauth/c2pa-cpp
https://github.com/contentauth/c2patool
```

CAI는 Rust, Python, JavaScript, Node.js, C++ SDK와 CLI를 공개하고 있어 Claude Code·Codex가 생성 디자인에 출처 메타데이터를 삽입하거나 검증하는 작업을 자동화할 수 있습니다. ([GitHub](https://github.com/contentauth?utm_source=chatgpt.com))

C2PA는 출처와 편집 이력을 보조하는 기술이지 저작권 소유권·진실성·법적 증거력을 자동으로 보장하는 제도는 아닙니다.

------

# 21. 이미지 메타데이터 검사

```text
# ExifTool
https://exiftool.org/
https://github.com/exiftool/exiftool

# ImageMagick
https://imagemagick.org/
https://github.com/ImageMagick/ImageMagick

# FFmpeg 메타데이터
https://ffmpeg.org/
https://ffmpeg.org/ffprobe.html
```

Claude Code·Codex는 이미지·영상 파일에서 다음을 추출해 자산 목록을 만들 수 있습니다.

```text
제작 프로그램
생성 날짜
작성자
저작권 필드
EXIF·XMP
GPS 정보
C2PA 정보
색상 프로파일
편집 이력
파일 해시
```

------

# 22. Claude Code·Codex용 실제 자동화 도구 묶음

```text
# 국내 IP 검색 API
https://plus.kipris.or.kr/
https://plus.kipris.or.kr/portal/bbs/view.do?bbsId=B0000001&nttId=1060
https://www.data.go.kr/data/15057631/openapi.do

# 라이선스·저작권 스캔
https://github.com/aboutcode-org/scancode-toolkit
https://github.com/fossology/fossology
https://github.com/oss-review-toolkit/ort
https://github.com/fsfe/reuse-tool
https://spdx.dev/

# 자산 출처·진본성
https://github.com/contentauth
https://github.com/contentauth/c2patool
https://opensource.contentauthenticity.org/

# 메타데이터
https://exiftool.org/
https://github.com/exiftool/exiftool

# 공식 법률
https://www.law.go.kr/
https://www.wipo.int/en/web/wipolex/

# 직접 검색
https://www.kipris.or.kr/
https://www.wipo.int/en/web/global-design-database
https://www.wipo.int/en/web/global-brand-database
https://patentscope.wipo.int/
```

------

# 23. 디자인 자산 법률 점검 시 생성할 파일

Claude Code·Codex가 다음 파일을 자동 생성하도록 구성할 수 있습니다.

```text
DESIGN-ASSET-INVENTORY.csv
FONT-LICENSES.md
IMAGE-LICENSES.md
ICON-LICENSES.md
THIRD-PARTY-NOTICES.md
ATTRIBUTION.md
AI-GENERATION-LOG.md
TRADEMARK-SEARCH-NOTES.md
DESIGN-RIGHT-SEARCH-NOTES.md
PATENT-SEARCH-NOTES.md
MODEL-RELEASES.md
LICENSE-POLICY.yml
SBOM.spdx.json
C2PA-REPORT.json
LEGAL-REVIEW.md
```

각 자산 기록에는 최소한 다음 필드가 필요합니다.

```text
파일명
자산 종류
제작자·권리자
원본 URL
다운로드 날짜
라이선스명
라이선스 원문 URL
상업 이용 가능 여부
수정 가능 여부
출처 표시 의무
고객 양도 가능 여부
원본 재배포 가능 여부
AI 생성 여부
사용한 생성 서비스
승인·구매 증빙 경로
비고
```

------

# 24. 최종 핵심 URL 압축

```text
# 대한민국 법령
https://www.law.go.kr/
https://www.law.go.kr/법령/저작권법
https://www.law.go.kr/법령/디자인보호법
https://www.law.go.kr/법령/상표법
https://www.law.go.kr/법령/특허법
https://www.law.go.kr/법령/부정경쟁방지및영업비밀보호에관한법률
https://www.law.go.kr/법령/개인정보보호법
https://www.law.go.kr/법령/표시·광고의공정화에관한법률

# 대한민국 검색·API
https://www.kipris.or.kr/
https://plus.kipris.or.kr/
https://plus.kipris.or.kr/portal/bbs/view.do?bbsId=B0000001&nttId=1060
https://www.data.go.kr/data/15057631/openapi.do
https://www.copyright.or.kr/
https://gongu.copyright.or.kr/
https://www.cros.or.kr/

# 국제 디자인·상표·특허
https://www.wipo.int/en/web/global-design-database
https://www.wipo.int/en/web/global-brand-database
https://patentscope.wipo.int/
https://www.wipo.int/en/web/wipolex/
https://www.wipo.int/hague/
https://www.wipo.int/madrid/
https://www.wipo.int/classifications/locarno/
https://www.wipo.int/classifications/nice/
https://www.wipo.int/classifications/vienna/

# 미국
https://www.copyright.gov/registration/visual-arts/
https://www.copyright.gov/engage/visual-artists/
https://www.copyright.gov/ai/
https://www.uspto.gov/trademarks/search/search
https://www.uspto.gov/trademarks/search/design-search-codes
https://developer.uspto.gov/

# Creative Commons
https://creativecommons.org/licenses/
https://creativecommons.org/cc-licenses/
https://creativecommons.org/cc-license-your-work/
https://creativecommons.org/choose/

# 폰트
https://openfontlicense.org/
https://software.sil.org/fonts/faq/
https://fonts.google.com/
https://developers.google.com/fonts/faq
https://fontawesome.com/license

# 라이선스 자동 점검
https://github.com/aboutcode-org/scancode-toolkit
https://www.fossology.org/
https://github.com/fossology/fossology
https://github.com/oss-review-toolkit/ort
https://spdx.dev/
https://reuse.software/

# 출처·AI 이력
https://c2pa.org/
https://contentcredentials.org/
https://opensource.contentauthenticity.org/
https://github.com/contentauth
https://github.com/contentauth/c2patool

# 메타데이터
https://exiftool.org/
https://github.com/exiftool/exiftool
```

------

# 25. 1차 10번 검증 결과

1. 저작권·디자인권·특허·상표를 분리했습니다.
2. 국내 법령과 KIPRIS·KIPRISPlus를 포함했습니다.
3. WIPO 디자인·상표·특허·법률 데이터베이스를 포함했습니다.
4. 로고·폰트·아이콘·이미지·스톡 라이선스를 포함했습니다.
5. AI 생성 디자인의 저작권·인간 창작 기여 기록을 포함했습니다.
6. 인물·초상·개인정보·음성 복제 문제를 포함했습니다.
7. 광고·랜딩페이지의 표시광고 문제를 포함했습니다.
8. ScanCode·FOSSology·ORT·SPDX 자동 점검 도구를 포함했습니다.
9. C2PA·Content Credentials와 메타데이터 도구를 포함했습니다.
10. Claude Code·Codex에서 사용할 API·CLI·GitHub 경로를 분리했습니다.

# 26. 보완 후 2차 10번 검증 결과

1. WIPO Global Design Database의 자동 검색·스크래핑 금지 조건을 반영했습니다.
2. 자동화는 허용된 KIPRISPlus API 중심으로 구성했습니다.
3. 단순 법률 사이트뿐 아니라 실제 라이선스 스캔 도구를 포함했습니다.
4. 디자인 자산뿐 아니라 웹 코드·UI 라이브러리의 오픈소스 라이선스를 포함했습니다.
5. CC의 BY·NC·ND·SA 조건과 철회 불가능성을 반영했습니다.
6. OFL 폰트의 상업 디자인 사용과 폰트 파일 조건을 구분했습니다.
7. 상표는 문자·도형·상품 분류를 함께 검색하도록 구성했습니다.
8. AI 서비스 약관과 생성 당시 약관 보존 필요성을 포함했습니다.
9. 자동 생성할 증빙·출처·라이선스 문서 파일을 포함했습니다.
10. AI 분석이 법률 자문이나 침해 확정 판정이 아님을 명확히 했습니다.
