# RESEARCH_SOURCES-02

# ✅ 최종 결론

아래는 **2026년 7월 19일 기준**, Claude Code·Codex 등 AI 코딩 에이전트에서 API·SDK·CLI·MCP·GitHub 연동 방식으로 사용할 수 있는 다음 디자인 자동화 도구와 공식 자료를 정리한 목록입니다.

```text
소셜 미디어 게시물 디자인 자동화
포스터 디자인 자동화
배너·광고 소재 디자인 자동화
로고·브랜드 이미지 디자인 자동화
명함 디자인 자동화
웹사이트 레이아웃 자동화
랜딩페이지 디자인·코드 자동화
동일 디자인의 크기·문구·이미지 일괄 변형
```

인터넷상의 관련 자료를 문자 그대로 전부 나열하는 것은 불가능합니다. 따라서 **공식 API·공식 SDK·공식 MCP·공식 CLI·공식 GitHub가 존재하며, Claude Code·Codex가 실제 코드와 명령어로 연결할 수 있는 도구**를 우선 정리했습니다.

```text
선정 기준:

1. Claude Code·Codex가 REST API·SDK·CLI·MCP로 실행 가능
2. SNS·포스터·배너·명함·로고·랜딩페이지 제작과 직접 관련
3. 템플릿 기반 대량 생성 또는 생성형 AI 디자인 지원
4. 이미지·SVG·PDF·HTML·React 코드 등 실제 결과물 생성 가능
5. 공식 문서·공식 GitHub·공식 개발자 자료가 존재
6. 디자인 텍스트·이미지·색상·브랜드 요소 자동 교체 가능
7. 웹사이트·랜딩페이지는 코드로 내보내거나 코드베이스에 반영 가능
```

핵심 계열은 다음과 같습니다.

```text
템플릿 기반 디자인 자동화:
Canva Connect APIs
Adobe Express API
Bannerbear
Placid
Creatomate

생성형 디자인·로고 이미지:
Adobe Firefly API
Ideogram API
Recraft API
OpenAI Image API

웹·랜딩페이지:
Figma MCP
v0 Platform API
shadcn/ui Registry MCP
Builder.io Visual Copilot + CLI
Framer
Lovable / Bolt / Replit

코드 기반 이미지 생성:
Satori
Sharp
SVG
Cloudinary
```

------

# 1. 목적별 최우선 자료

```text
SNS 게시물·포스터·배너·명함 자동화:
https://www.canva.dev/
https://www.canva.dev/docs/connect/
https://www.canva.dev/docs/connect/api-reference/designs/create-design/
https://www.canva.dev/docs/connect/autofill-guide/
https://www.canva.dev/docs/connect/api-reference/autofills/

https://developer.adobe.com/firefly-services/docs/express-api/
https://developer.adobe.com/firefly-services/docs/firefly-api/

https://www.bannerbear.com/
https://developers.bannerbear.com/v5/

https://placid.app/
https://placid.app/docs/
https://placid.app/docs/2.0/rest/images
https://placid.app/docs/2.0/rest/templates

https://creatomate.com/
https://creatomate.com/developers
https://creatomate.com/docs/api/reference/introduction
https://creatomate.com/docs/api/reference/create-a-render
로고·브랜드 이미지 생성:
https://www.recraft.ai/docs/api-reference/getting-started
https://www.recraft.ai/docs/api-reference/endpoints

https://developer.ideogram.ai/
https://developer.ideogram.ai/api-reference/api-reference/generate-v4

https://developer.adobe.com/firefly-services/docs/firefly-api/api/

https://platform.openai.com/docs/api-reference/images
웹사이트 레이아웃·랜딩페이지:
https://developers.figma.com/docs/figma-mcp-server/
https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/
https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/

https://v0.dev/
https://api2.v0.dev/docs
https://api2.v0.dev/docs/api/platform/overview
https://v0.dev/docs/design-systems

https://www.builder.io/figma-to-code
https://www.builder.io/c/docs/figma-to-code-visual-editor
https://www.builder.io/c/docs/figma-to-code-builder-cli

https://www.framer.com/
https://www.framer.com/ai/
https://www.framer.com/help/
```

------

# 2. Claude Code·Codex에서 사용하는 연결 방식

```text
REST API:
Canva
Adobe Firefly / Express
Bannerbear
Placid
Creatomate
Ideogram
Recraft
OpenAI Image
Cloudinary
v0 Platform API

MCP:
Figma MCP
shadcn/ui Registry MCP
Placid MCP

CLI:
Builder CLI
shadcn CLI
Cloudinary CLI
Sharp / Node.js
SVG / Satori
v0 SDK

코드·GitHub 연동:
Lovable
Bolt / StackBlitz
Replit
Builder.io
v0
```

Canva는 디자인 생성·내보내기·브랜드 템플릿 Autofill을 Connect APIs로 제공하고, Figma는 Claude Code·Codex가 캔버스에 프레임·컴포넌트·변수·Auto Layout을 직접 생성하도록 공식 MCP를 제공합니다. v0는 자연어 기반 UI·웹앱 생성 기능을 Platform API와 SDK로 외부 자동화에 연결할 수 있습니다. ([canva.dev](https://www.canva.dev/docs/connect/api-reference/designs/create-design/?utm_source=chatgpt.com))

------

# 3. Canva Connect APIs

```text
https://www.canva.com/developers/
https://www.canva.dev/
https://www.canva.dev/docs/connect/
https://www.canva.dev/docs/connect/api-reference/
https://www.canva.dev/docs/connect/api-reference/designs/
https://www.canva.dev/docs/connect/api-reference/designs/create-design/
https://www.canva.dev/docs/connect/api-reference/designs/get-design/
https://www.canva.dev/docs/connect/api-reference/autofills/
https://www.canva.dev/docs/connect/api-reference/autofills/create-design-autofill-job/
https://www.canva.dev/docs/connect/autofill-guide/
https://www.canva.dev/docs/connect/changelog/
```

Canva의 Create Design API는 미리 정의된 디자인 유형 또는 사용자 지정 가로·세로 크기로 새로운 디자인을 만들 수 있습니다. 기존 디자인이나 브랜드 템플릿을 기준으로 새 디자인을 만드는 기능도 제공됩니다. ([canva.dev](https://www.canva.dev/docs/connect/api-reference/designs/create-design/?utm_source=chatgpt.com))

Autofill API는 브랜드 템플릿 안의 텍스트·이미지·영상 데이터 필드를 외부 데이터로 채워 새로운 디자인을 생성합니다. 따라서 동일한 브랜드 양식으로 SNS 게시물, 행사 포스터, 상품 배너, 명함 등을 반복 생성하는 자동화에 사용할 수 있습니다. 단, 공식 Autofill API의 정상 사용에는 Canva Enterprise 조직 조건이 적용되며 개발 중 제한된 시험 사용 조건이 있습니다. ([canva.dev](https://www.canva.dev/docs/connect/api-reference/autofills/?utm_source=chatgpt.com))

------

# 4. Adobe Firefly API

```text
https://developer.adobe.com/firefly-services/
https://developer.adobe.com/firefly-services/docs/firefly-api/
https://developer.adobe.com/firefly-services/docs/firefly-api/api/
https://developer.adobe.com/firefly-services/docs/firefly-api/getting-started/
https://developer.adobe.com/firefly-services/docs/firefly-api/guides/
```

Firefly API는 텍스트 기반 이미지 생성, 기존 이미지 수정, 참조 이미지 기반 스타일·구도 적용, 업스케일과 영상 생성을 제공하는 REST API입니다. SNS 게시물·포스터·배너에 사용할 배경 이미지와 상품·브랜드 비주얼을 Claude Code·Codex에서 API 호출로 생성할 수 있습니다. ([Adobe Developer](https://developer.adobe.com/firefly-services/docs/firefly-api/api/?utm_source=chatgpt.com))

------

# 5. Adobe Express API

```text
https://developer.adobe.com/firefly-services/docs/express-api/
https://developer.adobe.com/firefly-services/docs/express-api/getting-started/
https://developer.adobe.com/express/
```

Adobe Express 계열 API는 디자인 문서를 기반으로 콘텐츠 변형을 만들고 이미지·영상·PDF 형식으로 내보내는 Adobe 디자인 자동화 경로입니다. Firefly가 생성한 비주얼을 Express 디자인 템플릿과 결합해 SNS 크기별 변형, 포스터, 배너와 명함 결과물을 만드는 흐름에 사용할 수 있습니다. ([Adobe Developer](https://developer.adobe.com/firefly-services/docs/firefly-api/api/?utm_source=chatgpt.com))

------

# 6. Bannerbear

```text
https://www.bannerbear.com/
https://www.bannerbear.com/product/image-generation-api/
https://www.bannerbear.com/product/video-generation-api/
https://www.bannerbear.com/help/api/
https://developers.bannerbear.com/v5/
https://developers.bannerbear.com/v2/
```

Bannerbear는 디자인 템플릿 안의 텍스트·이미지·색상 요소를 API 데이터로 교체해 PNG·JPG·PDF·영상 결과물을 반복 생성하는 도구입니다. 소셜 게시물, 광고 배너, Open Graph 이미지, 인증서, 상품 이미지처럼 같은 레이아웃에서 내용만 바뀌는 디자인 자동화에 맞습니다.

```text
Claude Code / Codex
→ 상품·게시물 데이터 읽기
→ 제목·카피 생성
→ Bannerbear API 호출
→ 이미지 또는 영상 생성
```

------

# 7. Placid

```text
https://placid.app/
https://placid.app/docs/
https://placid.app/docs/2.0/introduction
https://placid.app/docs/2.0/rest/images
https://placid.app/docs/2.0/rest/generate-images
https://placid.app/docs/2.0/rest/templates
https://placid.app/docs/2.0/rest/collections
https://placid.app/docs/2.0/url/generate-images
https://placid.app/solutions/api
```

Placid는 템플릿과 구조화된 데이터를 이용해 이미지·PDF·영상을 결정론적으로 생성하는 Creative Automation 서비스입니다. REST API, URL API, MCP와 Editor SDK를 제공하며, n8n·Make·Zapier·Webflow 등과의 연결 경로도 문서화되어 있습니다. ([Placid](https://placid.app/docs/2.0/introduction?utm_source=chatgpt.com))

텍스트·이미지·색상·위치·표시 여부를 레이어별로 변경하고 PNG·JPG·WebP·PDF 결과를 만들 수 있습니다. 템플릿에 `social/instagram` 같은 태그를 붙여 SNS 채널별 템플릿을 관리하는 기능도 제공합니다. ([Placid](https://placid.app/docs/2.0/rest/images?utm_source=chatgpt.com))

Placid URL API는 URL 매개변수만으로 동적 이미지를 생성할 수 있어 웹사이트 Open Graph 이미지와 게시물 미리보기 이미지 자동화에도 사용할 수 있습니다. ([Placid](https://placid.app/docs/2.0/url/generate-images?utm_source=chatgpt.com))

------

# 8. Creatomate

```text
https://creatomate.com/
https://creatomate.com/developers
https://creatomate.com/docs
https://creatomate.com/docs/api/reference/introduction
https://creatomate.com/docs/api/reference/create-a-render
https://creatomate.com/docs/fundamentals/getting-started/what-is-a-template
https://creatomate.com/docs/fundamentals/getting-started/automating-a-template
https://creatomate.com/docs/api/quick-start/create-a-video-by-template
https://creatomate.com/how-to/create-images-by-api
```

Creatomate는 템플릿 또는 JSON 기반 RenderScript를 REST API로 렌더링해 JPEG·PNG·GIF·MP4를 생성합니다. 템플릿을 사용하지 않고 API 요청 안에서 전체 레이아웃을 정의할 수도 있습니다. ([Creatomate](https://creatomate.com/docs/api/reference/introduction?utm_source=chatgpt.com))

공식 자료는 소셜 미디어 이미지, 전자상거래 배너와 이메일 이미지를 Node.js·Python·PHP·Ruby 등의 코드나 자동화 플랫폼으로 대량 생성하는 사용 사례를 안내합니다. ([Creatomate](https://creatomate.com/developers?utm_source=chatgpt.com))

------

# 9. Recraft API — 로고·아이콘·벡터 디자인

```text
https://www.recraft.ai/
https://www.recraft.ai/docs/api-reference/getting-started
https://www.recraft.ai/docs/api-reference/endpoints
https://www.recraft.ai/docs/llms.txt
```

Recraft API는 래스터 이미지뿐 아니라 **벡터 이미지 생성 모델**을 제공하고, 이미지 생성·브랜드 스타일·색상 제어·벡터화·배경 제거를 지원합니다. 로고 초안, 심볼, 아이콘, 브랜드 그래픽과 확장 가능한 SVG 자산 제작에 직접 연결하기 좋습니다. ([Recraft](https://www.recraft.ai/docs/api-reference/getting-started?utm_source=chatgpt.com))

```text
이미지 생성:
POST https://external.api.recraft.ai/v1/images/generations

벡터화:
POST https://external.api.recraft.ai/v1/images/vectorize
```

AI가 만든 로고 초안은 최종 사용 전에 유사 상표·저작권·상표 등록 가능성 검토와 사람의 형태 보정이 필요합니다.

------

# 10. Ideogram API — 텍스트가 들어간 포스터·로고·배너

```text
https://ideogram.ai/
https://developer.ideogram.ai/
https://ideogram.ai/api-generate/
https://developer.ideogram.ai/api-reference/api-reference/generate-v4
https://developer.ideogram.ai/api-reference/api-reference/generate-v3
```

Ideogram API는 이미지 안에 텍스트를 직접 포함하는 타이포그래피 생성 기능을 강조하며, 공식 문서에서 로고·브랜딩·상품 인쇄물·디자인 레이아웃을 사용 사례로 안내합니다. 포스터 제목, 광고 문구, 이벤트 배너처럼 이미지와 문자가 결합된 디자인 초안에 적합합니다. ([Ideogram](https://ideogram.ai/api-generate/?utm_source=chatgpt.com))

```text
POST https://api.ideogram.ai/v1/ideogram-v4/generate
```

------

# 11. OpenAI Image API

```text
https://platform.openai.com/docs/api-reference/images
https://developers.openai.com/
https://developers.openai.com/api/docs/models
```

OpenAI Image API는 Claude Code·Codex가 작성한 프롬프트를 사용해 SNS 소재, 포스터 배경, 배너 이미지, 로고 콘셉트, 랜딩페이지 비주얼을 생성하거나 기존 이미지를 수정하는 데 사용할 수 있습니다.

OpenAI 제품과 API 사용법은 공식 OpenAI 개발자 문서를 기준으로 확인해야 하며, Claude Code·Codex에서는 일반 REST API 또는 공식 SDK 호출 코드로 연결합니다.

------

# 12. Cloudinary — 이미지 변형·리사이즈·텍스트 합성

```text
https://cloudinary.com/
https://cloudinary.com/documentation
https://cloudinary.com/documentation/image_transformations
https://cloudinary.com/documentation/text_overlay
https://cloudinary.com/documentation/image_upload_api_reference
https://github.com/cloudinary
```

Cloudinary는 원본 이미지에 동적 크기 변경, 자르기, 포맷 변환, 텍스트·이미지 오버레이와 배경 처리를 URL 또는 API 방식으로 적용합니다.

```text
하나의 원본 디자인
→ Instagram 정사각형
→ Instagram Story
→ Facebook 게시물
→ LinkedIn 게시물
→ 웹 배너
→ Open Graph 이미지
```

생성형 디자인 도구가 만든 원본 비주얼을 여러 SNS 규격과 웹 배너 규격으로 자동 변환할 때 사용할 수 있습니다.

------

# 13. Satori — 코드 기반 SNS·배너·OG 이미지 생성

```text
https://github.com/vercel/satori
https://vercel.com/docs/functions/og-image-generation
https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image
```

Satori는 HTML·CSS와 유사한 JSX 구조를 SVG로 변환합니다. Claude Code·Codex가 TypeScript 코드로 프로젝트명·제목·작성자·통계·로고를 배치해 Open Graph 이미지, SNS 카드, 블로그 대표 이미지와 배너를 자동 생성할 수 있습니다.

```text
데이터
→ JSX 디자인 템플릿
→ Satori SVG
→ PNG 또는 WebP 변환
```

------

# 14. Sharp — Node.js 이미지 합성·출력 자동화

```text
https://sharp.pixelplumbing.com/
https://sharp.pixelplumbing.com/api-composite
https://sharp.pixelplumbing.com/api-resize
https://github.com/lovell/sharp
```

Sharp는 Node.js에서 이미지 크기 변경·합성·텍스트 SVG 오버레이·포맷 변환·압축을 자동화하는 오픈소스 이미지 처리 라이브러리입니다.

Satori나 SVG로 만든 디자인을 PNG·WebP로 변환하거나, 하나의 템플릿을 여러 SNS 크기로 일괄 출력할 때 사용할 수 있습니다.

------

# 15. Figma MCP — AI Agent가 Figma 디자인 직접 생성

```text
https://developers.figma.com/docs/figma-mcp-server/
https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/
https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/
https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/
https://github.com/figma/mcp-server-guide
https://www.figma.com/mcp-catalog/
```

Figma의 공식 MCP 서버는 Claude Code와 Codex 같은 지원 MCP 클라이언트가 Figma 파일에 프레임·컴포넌트·변수·Auto Layout을 직접 생성하고 수정하도록 합니다. 단순 스크린샷을 만드는 것이 아니라 편집 가능한 Figma 네이티브 구조를 생성합니다. ([Figma 개발자 문서](https://developers.figma.com/docs/figma-mcp-server/?utm_source=chatgpt.com))

이를 통해 다음 디자인을 자연어로 생성하거나 수정할 수 있습니다.

```text
SNS 게시물 프레임
포스터
웹 배너
명함 앞면·뒷면
웹사이트 섹션
랜딩페이지 레이아웃
컴포넌트와 디자인 시스템
```

Code to Canvas는 구현된 웹 화면을 편집 가능한 Figma 프레임으로 가져오는 기능이며, 공식 지원 클라이언트 목록에 Claude Code와 Codex가 포함되어 있습니다. ([Figma 개발자 문서](https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/?utm_source=chatgpt.com))

------

# 16. v0 Platform API — 웹사이트·랜딩페이지 자동 생성

```text
https://v0.dev/
https://api2.v0.dev/docs
https://api2.v0.dev/docs/api/platform/overview
https://api2.v0.dev/docs/api/v2
https://v0.dev/docs/v0-model-api
https://v0.dev/docs/design-systems
https://v0.dev/docs/v0-platform-api/chats/chats.create
https://v0.dev/docs/v0-platform-api/chats/chats.init
```

v0는 자연어로 UI와 웹앱을 생성하며, 랜딩페이지·전자상거래·풀스택 앱 등을 실제 코드와 미리보기 형태로 만들 수 있습니다. Platform API는 프로젝트 생성, 기존 파일·GitHub 저장소 가져오기, 반복 수정과 배포 자동화를 제공합니다. ([V0](https://api2.v0.dev/docs/api/platform/overview?utm_source=chatgpt.com))

```text
SDK 설치:

npm install v0-sdk
API 기본 주소:

https://api.v0.dev
```

v0 디자인 시스템 기능은 Tailwind CSS, CSS 변수, shadcn/ui와 사용자 정의 Registry를 이용해 브랜드 컴포넌트·토큰을 생성 결과에 반영합니다. ([v0](https://v0.dev/docs/design-systems?utm_source=chatgpt.com))

------

# 17. shadcn/ui Registry MCP

```text
https://ui.shadcn.com/
https://ui.shadcn.com/docs
https://ui.shadcn.com/docs/registry
https://ui.shadcn.com/docs/registry/mcp
https://github.com/shadcn-ui/ui
```

shadcn Registry는 컴포넌트·블록·디자인 토큰과 설치 정보를 AI 코딩 도구에 제공하는 구조입니다. v0 공식 디자인 시스템 문서는 Registry MCP를 사용해 AI 코드 편집기에 브랜드 디자인 시스템 문맥을 전달하는 설정을 안내합니다. ([v0](https://v0.dev/docs/design-systems?utm_source=chatgpt.com))

```text
npx -y shadcn@canary registry:mcp
```

Claude Code·Codex에서 브랜드 색상·글꼴·버튼·카드·레이아웃이 적용된 랜딩페이지를 반복 생성할 때 사용할 수 있습니다.

------

# 18. Builder.io Visual Copilot + Builder CLI

```text
https://www.builder.io/
https://www.builder.io/figma-to-code
https://www.builder.io/c/docs/figma-to-code-visual-editor
https://www.builder.io/c/docs/figma-to-code-builder-cli
https://www.builder.io/c/docs/builder-figma-plugin
https://www.builder.io/c/docs/import-from-figma
https://github.com/BuilderIO/builder
```

Builder Visual Copilot은 Figma 디자인을 React·Vue·Angular·Svelte·HTML·Tailwind 등 실제 코드로 변환합니다. Figma 플러그인으로 디자인을 내보낸 뒤 Builder CLI를 사용해 기존 코드베이스에 파일을 생성할 수 있습니다. ([Builder.io](https://site.builder.io/c/docs/figma-to-code-visual-editor?utm_source=chatgpt.com))

```text
Figma 레이아웃
→ Builder Figma Plugin
→ Builder AI 코드 생성
→ Builder CLI
→ 기존 프로젝트 코드베이스
```

------

# 19. Framer

```text
https://www.framer.com/
https://www.framer.com/ai/
https://www.framer.com/solutions/ai-website-builder/
https://www.framer.com/help/
https://www.framer.com/help/articles/using-layout-templates/
```

Framer는 AI 기반 웹사이트·랜딩페이지 제작과 시각 편집, 게시 기능을 제공하며, 공통 내비게이션·푸터·사이드바를 재사용하는 Layout Template 기능을 제공합니다. 하나의 템플릿을 수정하면 해당 템플릿을 사용하는 여러 페이지에 변경 사항이 반영됩니다. ([Framer](https://www.framer.com/help/articles/using-layout-templates/?utm_source=chatgpt.com))

Claude Code·Codex에 직접 설치되는 도구라기보다, AI가 카피·구조·이미지·컴포넌트 아이디어를 생성하고 Framer에서 최종 레이아웃과 게시를 수행하는 방식에 가깝습니다.

------

# 20. Lovable

```text
https://lovable.dev/
https://docs.lovable.dev/
https://docs.lovable.dev/integrations/github
```

Lovable은 자연어로 웹사이트와 앱을 생성하고 GitHub 저장소와 연결할 수 있습니다. Lovable에서 만든 랜딩페이지 코드를 GitHub로 동기화한 뒤 Claude Code·Codex에서 수정·검증·배포하는 흐름에 사용할 수 있습니다.

------

# 21. Bolt / StackBlitz

```text
https://bolt.new/
https://stackblitz.com/
https://developer.stackblitz.com/
https://github.com/stackblitz
```

Bolt는 자연어에서 웹페이지와 앱 코드를 생성하는 브라우저 기반 도구입니다. Claude Code·Codex에 직접 설치하는 도구라기보다 생성된 프로젝트를 GitHub·코드 파일로 넘겨 후속 개발하는 형태입니다.

------

# 22. Replit Agent

```text
https://replit.com/
https://docs.replit.com/
https://docs.replit.com/replitai/agent
```

Replit Agent는 자연어로 웹사이트·랜딩페이지·앱을 생성하고 실행·배포할 수 있습니다. Git 저장소나 내보낸 코드를 Claude Code·Codex로 가져와 디자인과 기능을 보완할 수 있습니다.

------

# 23. 오픈소스 웹 레이아웃·페이지 빌더

```text
# GrapesJS
https://grapesjs.com/
https://grapesjs.com/docs/
https://github.com/GrapesJS/grapesjs

# Webstudio
https://webstudio.is/
https://docs.webstudio.is/
https://github.com/webstudio-is/webstudio

# Penpot
https://penpot.app/
https://help.penpot.app/
https://github.com/penpot/penpot
```

GrapesJS는 HTML 템플릿·랜딩페이지·뉴스레터 편집기를 구축할 수 있는 오픈소스 Web Builder Framework입니다.

Webstudio는 오픈소스 시각적 웹사이트 빌더이며, Penpot은 오픈소스 디자인·프로토타이핑 플랫폼입니다. Claude Code·Codex가 저장소 코드를 수정하거나 플러그인과 자동화 기능을 개발하는 방식으로 연결할 수 있습니다.

------

# 24. 소셜 미디어 크기 변형·일괄 출력

```text
# Canva
https://www.canva.dev/docs/connect/api-reference/designs/
https://www.canva.dev/docs/connect/api-reference/autofills/

# Placid
https://placid.app/docs/2.0/rest/images
https://placid.app/docs/2.0/url/generate-images

# Bannerbear
https://developers.bannerbear.com/v5/

# Creatomate
https://creatomate.com/docs/api/reference/create-a-render

# Cloudinary
https://cloudinary.com/documentation/image_transformations

# Sharp
https://sharp.pixelplumbing.com/api-resize
```

이 계열은 하나의 디자인에서 다음 변형을 자동 생성하는 용도입니다.

```text
Instagram Post
Instagram Story
Facebook Post
Facebook Story
LinkedIn Post
X 게시물
YouTube Thumbnail
웹사이트 배너
Open Graph 이미지
이메일 배너
```

Placid는 템플릿의 출력 너비·높이·파일명·PNG·JPG·WebP 형식을 API로 제어하며, Creatomate는 렌더 크기와 템플릿의 텍스트·이미지·색상·레이아웃을 요청마다 변경할 수 있습니다. ([Placid](https://placid.app/docs/2.0/rest/images?utm_source=chatgpt.com))

------

# 25. 로고 디자인 자동화 관련 핵심 자료

```text
# Recraft 벡터 생성
https://www.recraft.ai/docs/api-reference/getting-started
https://www.recraft.ai/docs/api-reference/endpoints

# Ideogram 타이포그래피
https://developer.ideogram.ai/
https://developer.ideogram.ai/api-reference/api-reference/generate-v4

# Adobe Firefly 이미지
https://developer.adobe.com/firefly-services/docs/firefly-api/api/

# OpenAI 이미지
https://platform.openai.com/docs/api-reference/images

# Figma MCP 편집·정리
https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/
```

로고 자동화는 다음 두 단계를 구분하는 것이 정확합니다.

```text
1. 생성형 AI로 심볼·워드마크·스타일 초안 생성
2. Figma·Illustrator 또는 벡터 API로 형태·간격·색상·SVG 정리
```

Recraft는 공식적으로 벡터 생성과 래스터 이미지의 SVG 변환을 제공하고, Ideogram은 이미지 내부 타이포그래피 생성에 특화된 API를 제공합니다. ([Recraft](https://www.recraft.ai/docs/api-reference/endpoints?utm_source=chatgpt.com))

------

# 26. 명함 디자인 자동화 관련 핵심 자료

```text
https://www.canva.dev/docs/connect/api-reference/designs/create-design/
https://www.canva.dev/docs/connect/autofill-guide/

https://developer.adobe.com/firefly-services/docs/express-api/

https://developers.bannerbear.com/v5/

https://placid.app/docs/2.0/rest/images
https://placid.app/docs/2.0/rest/templates

https://creatomate.com/docs/api/reference/create-a-render

https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/
```

명함은 이름·직책·회사명·전화번호·이메일·QR 코드처럼 구조화된 데이터가 반복되기 때문에 템플릿 Autofill 방식과 잘 맞습니다. Canva Autofill은 브랜드 템플릿의 필드에 외부 데이터를 넣어 새 디자인을 생성하고, Placid 템플릿은 텍스트·이미지·바코드·도형 레이어를 API로 변경할 수 있습니다. ([canva.dev](https://www.canva.dev/docs/connect/autofill-guide/?utm_source=chatgpt.com))

------

# 27. 최종 핵심 URL 압축

```text
# Canva
https://www.canva.dev/
https://www.canva.dev/docs/connect/
https://www.canva.dev/docs/connect/api-reference/designs/create-design/
https://www.canva.dev/docs/connect/api-reference/autofills/
https://www.canva.dev/docs/connect/autofill-guide/

# Adobe
https://developer.adobe.com/firefly-services/docs/firefly-api/
https://developer.adobe.com/firefly-services/docs/firefly-api/api/
https://developer.adobe.com/firefly-services/docs/express-api/

# Template Creative Automation
https://developers.bannerbear.com/v5/
https://placid.app/docs/
https://placid.app/docs/2.0/rest/images
https://placid.app/docs/2.0/rest/templates
https://creatomate.com/developers
https://creatomate.com/docs/api/reference/create-a-render

# Logo / Brand Image
https://www.recraft.ai/docs/api-reference/getting-started
https://www.recraft.ai/docs/api-reference/endpoints
https://developer.ideogram.ai/
https://developer.ideogram.ai/api-reference/api-reference/generate-v4
https://platform.openai.com/docs/api-reference/images

# Image Processing
https://cloudinary.com/documentation
https://cloudinary.com/documentation/image_transformations
https://github.com/vercel/satori
https://sharp.pixelplumbing.com/
https://github.com/lovell/sharp

# Figma MCP
https://developers.figma.com/docs/figma-mcp-server/
https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/
https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/
https://github.com/figma/mcp-server-guide

# v0 / shadcn
https://api2.v0.dev/docs
https://api2.v0.dev/docs/api/platform/overview
https://v0.dev/docs/design-systems
https://ui.shadcn.com/docs/registry
https://ui.shadcn.com/docs/registry/mcp
https://github.com/shadcn-ui/ui

# Builder
https://www.builder.io/figma-to-code
https://www.builder.io/c/docs/figma-to-code-visual-editor
https://www.builder.io/c/docs/figma-to-code-builder-cli
https://github.com/BuilderIO/builder

# Landing Page Builders
https://www.framer.com/ai/
https://lovable.dev/
https://docs.lovable.dev/integrations/github
https://bolt.new/
https://replit.com/
https://docs.replit.com/replitai/agent

# Open Source Builders
https://grapesjs.com/
https://github.com/GrapesJS/grapesjs
https://webstudio.is/
https://github.com/webstudio-is/webstudio
https://penpot.app/
https://github.com/penpot/penpot
```

------

# 28. 1차 10번 검증 결과

1. **SNS 게시물 자동화**: Canva, Adobe, Bannerbear, Placid, Creatomate, Cloudinary를 포함했습니다.
2. **포스터 자동화**: Canva Create Design, Ideogram, Firefly, Creatomate를 포함했습니다.
3. **배너 자동화**: Bannerbear, Placid, Creatomate, Cloudinary, Sharp를 포함했습니다.
4. **로고 자동화**: Recraft Vector, Ideogram Typography, Firefly, OpenAI Image, Figma MCP를 포함했습니다.
5. **명함 자동화**: Canva Autofill, Adobe Express, Placid, Bannerbear, Creatomate를 포함했습니다.
6. **웹사이트 레이아웃**: Figma MCP, v0, Builder.io, Framer를 포함했습니다.
7. **랜딩페이지 자동화**: v0 Platform API, Builder CLI, Framer, Lovable, Bolt, Replit을 포함했습니다.
8. **Claude Code·Codex 연결성**: API·SDK·CLI·MCP·GitHub 연동 방식을 구분했습니다.
9. **오픈소스 보완**: Satori, Sharp, GrapesJS, Webstudio, Penpot을 포함했습니다.
10. **복사 편의성**: 공식 주소를 항목별 코드블록으로 정리했습니다.

# 29. 보완 후 2차 10번 검증 결과

1. **공식성 확인**: 공식 개발자 문서와 공식 GitHub를 우선 사용했습니다.
2. **최신성 확인**: 2026년 7월 Canva·Figma·v0·Recraft·Ideogram 공식 문서를 다시 확인했습니다.
3. **Canva 제약 보완**: Autofill API의 Canva Enterprise 조건을 명시했습니다.
4. **Figma 연동 보완**: Claude Code·Codex 공식 지원과 Write to Canvas·Code to Canvas를 확인했습니다.
5. **로고 영역 보완**: 래스터 생성뿐 아니라 Recraft 벡터 생성·SVG 변환을 포함했습니다.
6. **텍스트 디자인 보완**: Ideogram의 포스터·로고 타이포그래피 API를 포함했습니다.
7. **반복 생성 보완**: Canva Autofill, Placid, Bannerbear, Creatomate의 템플릿 데이터 교체 기능을 포함했습니다.
8. **코드 기반 자동화 보완**: Satori·Sharp·Cloudinary를 추가했습니다.
9. **랜딩페이지 API 보완**: v0 Platform API·SDK와 Builder CLI를 포함했습니다.
10. **요청 형식 확인**: 최종 결론·선정 기준·목적별 URL·도구별 공식 자료·최종 URL 압축·2단계 검증 구조로 작성했습니다.
