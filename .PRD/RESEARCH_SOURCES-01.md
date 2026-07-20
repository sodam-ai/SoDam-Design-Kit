# RESEARCH_SOURCES

# ✅ 최종 결론

아래는 **2026년 7월 19일 기준**, **Claude Code, Codex 등 AI 코딩 에이전트에서 설치·사용·적용·작동 가능한 UI/UX 디자인 자동화, 상세페이지 자동화, GUI 자동화, 웹페이지·모바일페이지 디자인 자동화, 인터페이스 자동화 관련 사이트·GitHub·문서·자료**를 공식성과 실사용 가능성 기준으로 다시 보완한 목록입니다.

인터넷상의 모든 자료를 문자 그대로 100% 나열하는 것은 불가능합니다. 그래서 아래 기준으로 **공식 문서·공식 GitHub·실제 설치 가능한 MCP/CLI/SDK·대표 오픈소스·검증 도구·상세페이지 자동화 API**를 우선 정리했습니다.

```text
선정 기준:
1. Claude Code / Codex / MCP / CLI / GitHub 프로젝트와 연결 가능
2. UI/UX, 상세페이지, GUI, 웹/모바일 인터페이스 자동화에 직접 관련
3. 공식 문서 또는 공식 GitHub가 존재
4. 실무 적용 가능성이 높은 도구
5. 비공식·상용·주의 항목은 별도 분리
```

핵심 조합은 아래입니다.

```text
Figma MCP
+ Claude Code 또는 Codex
+ shadcn/ui 또는 기존 디자인 시스템
+ Storybook
+ Chromatic
+ Playwright MCP
+ axe-core / Lighthouse
```

Figma MCP는 AI 에이전트가 Figma 디자인 파일의 구조적 맥락을 읽고 코드 생성에 활용하도록 돕는 공식 경로이며, Code to Canvas와 Write to Canvas를 통해 코드와 Figma 캔버스 양방향 흐름도 지원합니다. Playwright MCP는 LLM이 웹페이지를 구조화된 접근성 스냅샷으로 읽고 조작하게 해 GUI·웹페이지 검증 자동화에 적합합니다. ([Figma 개발자 문서](https://developers.figma.com/docs/figma-mcp-server/?utm_source=chatgpt.com))

------

# 1. 목적별 최우선 추천

```text
실제 개발 코드까지 연결:
https://www.figma.com/mcp-catalog/
https://github.com/figma/mcp-server-guide
https://ui.shadcn.com/
https://v0.dev/
https://storybook.js.org/
https://www.chromatic.com/
https://github.com/microsoft/playwright-mcp
https://github.com/dequelabs/axe-core
https://github.com/GoogleChrome/lighthouse

Figma 디자인 → React/Next.js 코드:
https://www.figma.com/mcp-catalog/
https://site.builder.io/figma-to-code
https://www.builder.io/c/docs/figma-to-code-builder-cli
https://www.animaapp.com/
https://www.locofy.ai/
https://v0.dev/
https://ui.shadcn.com/

상세페이지·랜딩페이지 자동화:
https://v0.dev/
https://www.framer.com/ai/
https://www.builder.io/ai
https://lovable.dev/
https://bolt.new/
https://www.canva.dev/docs/
https://developer.adobe.com/firefly-services/docs/firefly-api/
https://developers.bannerbear.com/v2/
https://placid.app/docs/
https://creatomate.com/docs
https://cloudinary.com/documentation

GUI 자동화·인터페이스 자동화:
https://github.com/microsoft/playwright-mcp
https://playwright.dev/docs/getting-started-mcp
https://www.selenium.dev/
https://www.cypress.io/
https://github.com/puppeteer/puppeteer

모바일 UI 자동화:
https://reactnative.dev/
https://docs.expo.dev/
https://www.nativewind.dev/
https://tamagui.dev/
https://flutter.dev/
https://github.com/mrzachnugent/react-native-reusables

오픈소스 디자인·웹 빌더:
https://penpot.app/
https://github.com/penpot/penpot
https://grapesjs.com/
https://github.com/GrapesJS/grapesjs
https://webstudio.is/
https://github.com/webstudio-is/webstudio
https://github.com/excalidraw/excalidraw
https://github.com/tldraw/tldraw
```

------

# 2. Claude Code·Codex에 직접 연결되는 공식 핵심

```text
https://www.figma.com/mcp-catalog/
https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server
https://github.com/figma/mcp-server-guide
https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server
https://help.figma.com/hc/en-us/articles/39888629089175-Codex-and-Figma-Set-up-the-MCP-server
https://claude.com/plugins/figma
https://claude.com/connectors/figma
https://developers.figma.com/docs/figma-mcp-server/
https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/
https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/
https://www.figma.com/blog/introducing-claude-code-to-figma/
https://www.figma.com/blog/introducing-codex-to-figma/
```

Figma 공식 문서 기준으로 MCP 서버는 디자인 컨텍스트를 AI 에이전트에 제공하고, Claude Code에서는 Figma Plugin 설치가 권장 경로입니다. Codex용 Figma MCP 문서도 components, variables, layout data, FigJam content, Make resources 같은 디자인 맥락을 읽어 코드 생성에 활용할 수 있다고 설명합니다. ([Figma 개발자 문서](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/?utm_source=chatgpt.com))

------

# 3. Figma 기반 UI/UX 자동화

```text
https://www.figma.com/
https://www.figma.com/dev-mode/
https://www.figma.com/mcp-catalog/
https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server
https://developers.figma.com/
https://developers.figma.com/docs/figma-mcp-server/
https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/
https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/
https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/
https://www.figma.com/make/
https://www.figma.com/sites/
```

Figma MCP가 중요한 이유는 AI가 스크린샷만 보고 추측하는 것이 아니라, Figma 파일 안의 레이어·컴포넌트·변수·레이아웃 데이터를 활용할 수 있기 때문입니다. Figma2Code 연구도 Figma 파일에는 이미지뿐 아니라 metadata와 assets가 포함되어 디자인-코드 자동화에 더 풍부한 정보를 제공한다고 설명하지만, 반응형 레이아웃과 유지보수성은 여전히 한계라고 보고합니다. ([Figma 도움말 센터](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server?utm_source=chatgpt.com))

------

# 4. Figma MCP 커뮤니티·실전 자료

```text
https://claudelab.net/en/articles/claude-code/figma-mcp-integration
https://claudelab.net/en/articles/claude-code/figma-mcp-claude-code-design-to-code-2026
https://codex.danielvaughan.com/2026/04/18/codex-cli-figma-mcp-design-to-code/
https://github.com/FlorianBruniaux/claude-code-ultimate-guide/blob/main/guide/workflows/design-to-code.md
```

커뮤니티 실전 자료는 참고 가치가 있지만, 공식 문서보다 우선하면 안 됩니다. 특히 Figma MCP는 디자인 fidelity를 높여주지만, 실제 구현 품질은 디자인 시스템 정리, 컴포넌트 매핑, Storybook/Playwright 검증 여부에 크게 좌우됩니다. ([Creative Bloq](https://www.creativebloq.com/ai/designing-using-claude-code-and-figma-mcp-how-good-are-they?utm_source=chatgpt.com))

------

# 5. Builder.io Visual Copilot / Figma to Code

```text
https://www.builder.io/
https://www.builder.io/ai
https://site.builder.io/figma-to-code
https://site.builder.io/c/docs/figma-to-code-visual-editor
https://www.builder.io/blog/figma-to-code-visual-copilot
https://www.builder.io/c/docs/figma-to-code-builder-cli
https://github.com/BuilderIO/builder
https://github.com/BuilderIO/micro-agent
https://www.npmjs.com/package/@builder.io/html-to-figma
```

Builder.io Visual Copilot은 Figma 디자인을 코드베이스에 넣을 수 있는 코드로 변환하는 design-to-code 도구입니다. Claude Code·Codex 관점에서는 Builder.io가 생성한 초안을 그대로 끝내기보다, 이후 컴포넌트 구조 정리, 반응형, 접근성, 상태관리, 테스트를 보완하는 흐름이 현실적입니다. ([Builder.io](https://site.builder.io/c/docs/figma-to-code-visual-editor?utm_source=chatgpt.com))

------

# 6. v0 / shadcn/ui / Tailwind 기반 UI 자동화

```text
https://v0.dev/
https://v0.dev/docs
https://v0.dev/docs/design-systems
https://v0.app/docs/design-systems-2
https://ui.shadcn.com/
https://ui.shadcn.com/docs/cli
https://ui.shadcn.com/docs/components-json
https://ui.shadcn.com/docs/_v0
https://ui.shadcn.com/docs/registry/open-in-v0
https://github.com/shadcn-ui/ui
https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/cli.md
```

v0는 shadcn/ui를 기본 컴포넌트 시스템으로 사용해 UI를 생성하고, design system skill을 통해 어떤 컴포넌트·토큰·설치 방식을 사용해야 하는지 지정할 수 있습니다. shadcn/ui의 Open in v0 흐름은 컴포넌트를 v0에서 바로 열어 편집하는 공식 워크플로우입니다. ([v0](https://v0.dev/docs/design-systems?utm_source=chatgpt.com))

------

# 7. 21st.dev Magic MCP / UI 컴포넌트 자동 생성

```text
https://21st.dev/
https://github.com/21st-dev
https://github.com/21st-dev/magic-mcp
```

21st.dev Magic MCP는 자연어 기반 UI 컴포넌트 생성을 AI 코딩 에이전트에 연결하는 커뮤니티 MCP 계열입니다. 공식 Figma MCP나 shadcn/ui보다 서드파티 성격이 강하므로, API Key, 외부 통신, 라이선스, 생성 코드 품질을 확인한 뒤 적용하는 것이 안전합니다.

------

# 8. Anima / Locofy / Design-to-Code 자동화

```text
https://www.animaapp.com/
https://www.locofy.ai/
https://www.locofy.ai/figma-to-code-tool-comparison
```

Anima와 Locofy는 디자인을 React, React Native, Flutter, HTML/CSS 등으로 변환하는 design-to-code 계열 도구입니다. 이 계열은 초안 생성에는 유용하지만, Claude Code·Codex로 디자인 토큰, 컴포넌트 재사용성, 상태관리, 접근성, 반응형을 후처리해야 실무 품질에 가까워집니다. Locofy 관련 연구도 디자인 최적화와 UI 요소 태깅, 반복 구조의 컴포넌트화 같은 문제를 별도로 다룹니다. ([arXiv](https://arxiv.org/abs/2409.11667?utm_source=chatgpt.com))

------

# 9. AI 앱 빌더 / 웹페이지·랜딩페이지 자동화

```text
https://lovable.dev/
https://docs.lovable.dev/
https://docs.lovable.dev/integrations/github

https://bolt.new/
https://stackblitz.com/
https://developer.stackblitz.com/

https://replit.com/
https://docs.replit.com/
https://docs.replit.com/replitai/agent

https://base44.com/
https://base44.com/docs

https://www.framer.com/
https://www.framer.com/ai/
https://www.framer.com/solutions/ai-website-builder/
https://www.framer.com/help/
```

이 도구들은 Claude Code·Codex에 직접 “설치”하는 방식이라기보다, 초안을 빠르게 만들고 GitHub·코드·배포 결과물을 Claude Code/Codex로 가져와 보완하는 방식에 적합합니다. 특히 Lovable은 GitHub 연동 문서를 제공하므로 AI 빌더에서 만든 프로젝트를 코드 기반 워크플로우로 넘기기 쉽습니다. ([v0](https://v0.app/docs/api/v2/guides/design-systems?utm_source=chatgpt.com))

추천 흐름은 아래입니다.

```text
Lovable / Bolt / Replit / Framer AI에서 초안 생성
→ GitHub 또는 코드로 export
→ Claude Code / Codex로 구조 정리
→ shadcn/ui, Tailwind, 디자인 토큰 적용
→ Storybook/Chromatic으로 컴포넌트 검증
→ Playwright MCP로 실제 화면 검증
```

------

# 10. 상세페이지·마케팅 이미지 자동화

```text
https://www.canva.com/
https://www.canva.com/developers/
https://www.canva.dev/
https://www.canva.dev/docs/
https://www.canva.dev/docs/apps/design-editing/

https://www.adobe.com/express/
https://developer.adobe.com/
https://developer.adobe.com/express/
https://developer.adobe.com/firefly-services/
https://developer.adobe.com/firefly-services/docs/firefly-api/
https://developer.adobe.com/firefly-services/docs/firefly-api/api/

https://www.bannerbear.com/
https://www.bannerbear.com/docs/
https://developers.bannerbear.com/
https://developers.bannerbear.com/v2/
https://developers.bannerbear.com/v5/

https://placid.app/
https://placid.app/docs/
https://placid.app/docs/2.0/rest/videos

https://creatomate.com/
https://creatomate.com/docs
https://creatomate.com/developers

https://cloudinary.com/
https://cloudinary.com/documentation
```

상세페이지 자동화는 “웹 코드 상세페이지”와 “이미지형 상세페이지 소재 자동 생성”을 분리해야 합니다. Adobe Firefly API는 이미지 생성·수정·업스케일·비디오 생성 같은 기능을 제공하고, Bannerbear·Placid·Creatomate는 템플릿 기반 이미지·영상 자동 생성에 적합합니다. ([Adobe Developer](https://developer.adobe.com/firefly-services/docs/firefly-api/api/?utm_source=chatgpt.com))

권장 파이프라인은 아래입니다.

```text
상품 데이터 CSV / DB / Google Sheets
→ AI가 제목, USP, 상세 카피, FAQ 생성
→ Canva / Adobe Express / Bannerbear / Placid / Creatomate로 이미지·영상 소재 생성
→ v0 / Claude Code / Codex로 상세페이지 코드 생성
→ 모바일·데스크톱 반응형 검증
→ 접근성·SEO·GEO 점검
→ 배포
```

------

# 11. Canva / Claude / MCP 관련

```text
https://www.canva.com/developers/
https://www.canva.dev/docs/
https://www.canva.dev/docs/apps/design-editing/
https://claude.com/
```

Canva는 개발자 문서와 Design Editing API를 제공하고, Claude와 Canva 통합은 사용자가 Claude에서 자연어로 Canva 디자인 작업을 수행할 수 있게 하는 방향으로 소개되었습니다. 다만 Canva API·MCP는 상세페이지 이미지를 완전 자동으로 무제한 생성하는 만능 API로 보면 안 되며, 계정 권한·요금제·템플릿·내보내기 제약을 반드시 확인해야 합니다. ([canva.dev](https://www.canva.dev/docs/apps/design-editing/?utm_source=chatgpt.com))

------

# 12. 디자인 시스템·토큰 자동화

```text
https://tokens.studio/
https://documentation.tokens.studio/
https://github.com/tokens-studio
https://github.com/tokens-studio/figma-plugin
https://github.com/tokens-studio/sd-transforms

https://github.com/style-dictionary/style-dictionary
https://amzn.github.io/style-dictionary/

https://storybook.js.org/
https://storybook.js.org/docs
https://github.com/storybookjs/storybook
https://github.com/storybookjs/design-system
```

Tokens Studio는 디자인 토큰을 중앙에서 관리하는 도구이고, Style Dictionary는 디자인 토큰을 여러 플랫폼·언어의 스타일 파일로 변환하는 빌드 시스템입니다. UI 자동화 품질을 높이려면 색상, 간격, 타이포그래피, radius, shadow 같은 토큰을 Figma와 코드 양쪽에서 동일하게 관리해야 합니다. ([Tokens Studio](https://documentation.tokens.studio/?utm_source=chatgpt.com))

권장 파이프라인은 아래입니다.

```text
Figma Variables / Tokens Studio
→ Token JSON
→ Style Dictionary
→ CSS Variables / Tailwind Config
→ shadcn/ui theme
→ Storybook
→ Chromatic Visual Test
```

------

# 13. Storybook / Chromatic / UI 회귀 테스트

```text
https://storybook.js.org/
https://storybook.js.org/docs
https://storybook.js.org/docs/writing-tests
https://storybook.js.org/docs/writing-tests/visual-testing
https://github.com/storybookjs/storybook

https://www.chromatic.com/
https://www.chromatic.com/storybook
https://www.chromatic.com/docs/
https://www.chromatic.com/docs/quickstart/
https://www.chromatic.com/docs/visual/
https://www.chromatic.com/docs/ci/
https://www.chromatic.com/docs/visual-tests-addon/
https://github.com/chromaui/addon-visual-tests
```

Storybook은 컴포넌트를 상태별로 독립 관리하고 테스트하는 데 좋고, Chromatic은 Storybook 기반으로 시각적 회귀 테스트를 자동화합니다. Storybook 공식 문서도 visual testing을 켜면 각 Story가 테스트가 된다고 설명합니다. ([Storybook](https://storybook.js.org/docs/8/writing-tests/visual-testing?utm_source=chatgpt.com))

------

# 14. GUI 자동화 / 브라우저 검증 / 인터페이스 자동화

```text
https://github.com/microsoft/playwright-mcp
https://playwright.dev/
https://playwright.dev/docs/getting-started-mcp
https://playwright.dev/mcp/introduction
https://playwright.dev/mcp/installation
https://playwright.dev/mcp/snapshots
https://github.com/microsoft/playwright

https://www.selenium.dev/
https://github.com/SeleniumHQ/selenium

https://www.cypress.io/
https://docs.cypress.io/

https://github.com/puppeteer/puppeteer
https://pptr.dev/
```

Playwright MCP는 AI 에이전트가 웹페이지를 열고, 버튼을 누르고, 폼을 입력하고, 구조화된 accessibility snapshot으로 결과를 확인하게 해줍니다. GUI 자동화·웹페이지 자동 테스트·인터페이스 자동화에서는 Playwright MCP가 가장 우선순위가 높습니다. ([GitHub](https://github.com/microsoft/playwright-mcp?utm_source=chatgpt.com))

주의할 점도 있습니다. Playwright MCP의 accessibility snapshot은 매우 유용하지만, 일부 상황에서는 오프스크린 요소나 DOM 전체 맥락 부족으로 AI가 잘못된 테스트를 만들 수 있다는 이슈가 보고되었습니다. 그래서 중요한 화면은 Playwright 테스트 코드, 스크린샷, 접근성 검사, 수동 검토를 함께 쓰는 것이 안전합니다. ([GitHub](https://github.com/microsoft/playwright/issues/39955?utm_source=chatgpt.com))

------

# 15. 접근성·품질 자동화

```text
https://www.deque.com/axe/
https://github.com/dequelabs/axe-core
https://www.w3.org/WAI/
https://www.w3.org/WAI/WCAG22/quickref/
https://web.dev/learn/accessibility
https://developer.chrome.com/docs/lighthouse/overview
https://github.com/GoogleChrome/lighthouse
```

AI가 만든 UI는 접근성 문제가 생기기 쉽습니다. 자동 접근성 도구 하나만으로 모든 문제가 잡히지는 않지만, axe-core, Lighthouse, WCAG 기준, 키보드 테스트를 함께 적용하면 누락을 줄일 수 있습니다. 접근성 테스트 도구 비교 연구도 여러 도구가 서로 다른 문제를 잡기 때문에 단일 도구에만 의존하면 부족하다고 보고합니다. ([arXiv](https://arxiv.org/abs/2304.07591?utm_source=chatgpt.com))

확인 항목:

```text
- semantic HTML
- aria-label
- 키보드 포커스
- 모달 focus trap
- 명도 대비
- 오류 메시지
- 스크린리더 문맥
- 모바일 터치 영역
- Lighthouse 점수
- axe-core 검사
```

------

# 16. 모바일페이지·모바일앱 UI 자동화

```text
https://reactnative.dev/
https://docs.expo.dev/
https://github.com/expo/expo

https://www.nativewind.dev/
https://www.nativewind.dev/docs/getting-started/installation
https://github.com/nativewind/nativewind

https://tamagui.dev/
https://tamagui.dev/docs/intro/installation
https://tamagui.dev/docs/guides/expo
https://github.com/tamagui/tamagui

https://flutter.dev/
https://docs.flutter.dev/
https://github.com/flutter/flutter

https://github.com/mrzachnugent/react-native-reusables
https://www.shadcn.io/template/mobilecn-ui-nativecn-ui
```

모바일 UI 자동화는 웹보다 플랫폼별 차이가 큽니다. NativeWind는 Expo와 React Native 프로젝트에서 Tailwind 스타일 워크플로우를 지원하고, Tamagui는 Expo·Next.js 같은 네이티브·웹 공용 UI 구조를 지원합니다. 모바일 디자인 자동화에서는 Figma MCP로 화면 맥락을 읽고, Expo/React Native/Flutter 코드 생성 후 실제 기기 또는 에뮬레이터 검증을 반드시 해야 합니다. ([Nativewind](https://www.nativewind.dev/docs/getting-started/installation?utm_source=chatgpt.com))

------

# 17. 오픈소스 디자인 도구 / Figma 대안 / 웹 빌더

```text
https://penpot.app/
https://penpot.app/code
https://help.penpot.app/
https://github.com/penpot/penpot
https://github.com/penpot/penpot-files

https://excalidraw.com/
https://github.com/excalidraw/excalidraw

https://www.tldraw.com/
https://github.com/tldraw/tldraw

https://grapesjs.com/
https://grapesjs.github.io/grapesjs/
https://github.com/GrapesJS/grapesjs

https://webstudio.is/
https://github.com/webstudio-is/webstudio
```

Penpot은 오픈소스 디자인·프로토타이핑 플랫폼이고, GrapesJS는 HTML 템플릿·사이트·뉴스레터·모바일 앱 템플릿을 만들기 위한 오픈소스 Web Builder Framework입니다. Webstudio는 오픈소스 Webflow 대안 성격의 비주얼 웹사이트 빌더입니다. ([GitHub](https://github.com/penpot/penpot?utm_source=chatgpt.com))

Penpot은 오픈 표준과 self-hosting 관점에서 Figma 대안으로 의미가 있고, 공식 Help Center에는 MCP 서버 항목도 보입니다. 다만 Figma MCP만큼 Claude Code/Codex 공식 흐름이 성숙한지는 별도 검증이 필요합니다. ([Penpot](https://penpot.app/?utm_source=chatgpt.com))

------

# 18. Claude Code·Codex 적용 워크플로우

## 18-1. Figma → Code

```text
Figma 화면 정리
→ 컴포넌트 이름·오토레이아웃·토큰 정리
→ Figma MCP 연결
→ Claude Code/Codex가 디자인 컨텍스트 읽기
→ 기존 컴포넌트와 매핑
→ React/Next.js 구현
→ Storybook Story 작성
→ Playwright MCP로 실제 페이지 검증
→ axe-core/Lighthouse 접근성 검사
→ Chromatic 시각 회귀 테스트
```

## 18-2. Code → Figma

```text
구현된 UI 실행
→ Figma Code to Canvas / Write to Canvas 활용
→ 편집 가능한 Figma 레이어 생성
→ 디자이너 리뷰
→ 수정사항 다시 코드 반영
```

Figma의 remote MCP는 코드에서 Figma 캔버스로 쓰는 기능과 Code to Canvas를 지원합니다. 즉 디자인→코드뿐 아니라 코드→디자인 방향도 일부 자동화할 수 있습니다. ([Figma 개발자 문서](https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/?utm_source=chatgpt.com))

## 18-3. 상세페이지 자동화

```text
상품 데이터 CSV / DB / Google Sheets
→ AI가 USP, 제목, 상세 카피, FAQ 생성
→ Canva / Adobe Express / Bannerbear / Placid / Creatomate로 이미지·영상 소재 생성
→ v0 / Claude Code / Codex로 상세페이지 코드 생성
→ 반응형 검증
→ 접근성·SEO·GEO 점검
→ 배포
```

## 18-4. GUI·인터페이스 자동화

```text
Claude Code/Codex가 UI 구현
→ Playwright MCP가 페이지 열기
→ 버튼 클릭
→ 폼 입력
→ 모바일 viewport 확인
→ 콘솔 오류 확인
→ 접근성 snapshot 확인
→ 테스트 코드 저장
```

------

# 19. Claude Code·Codex용 AGENTS.md / CLAUDE.md 예시

```text
# UI/UX 자동화 프로젝트 규칙

## 목표
디자인 품질, 접근성, 반응형, 실제 동작을 모두 만족하는 UI를 구현한다.

## 작업 순서
1. 요구사항과 대상 사용자를 먼저 확인한다.
2. 기존 디자인 시스템, 토큰, 컴포넌트를 확인한다.
3. Figma 또는 참고 화면의 구조를 분석한다.
4. 컴포넌트 단위로 구현한다.
5. Storybook Story를 작성한다.
6. Playwright로 핵심 사용자 흐름을 검증한다.
7. axe-core 또는 Lighthouse로 접근성을 검사한다.
8. 모바일, 태블릿, 데스크톱 반응형을 확인한다.
9. 변경 파일과 검증 결과를 보고한다.

## 금지
- 스크린샷만 보고 색상·간격을 추측하지 않는다.
- 기존 디자인 시스템을 무시하지 않는다.
- 접근성 없는 div/button 대체 구현을 하지 않는다.
- 모바일 반응형 확인 없이 완료 처리하지 않는다.
- 임의의 외부 이미지·폰트·아이콘을 사용하지 않는다.
- 저작권 불명 에셋을 사용하지 않는다.
- 실제 브라우저 검증 없이 완료 처리하지 않는다.

## 완료 조건
- lint 통과
- typecheck 통과
- build 통과
- Storybook에서 주요 상태 확인
- Playwright로 핵심 사용자 흐름 통과
- 360px, 768px, 1440px viewport 확인
- 접근성 오류 확인
```

------

# 20. 목적별 추천 조합

```text
비개발자·왕초보·상세페이지:
Canva
Adobe Express
Framer AI
Figma Make
Lovable
v0
Builder.io

Claude Code·Codex로 실제 코드 구현:
Figma MCP
shadcn/ui
Context7
Storybook
Chromatic
Playwright MCP
GitHub MCP

디자인 시스템 자동화:
Figma Variables
Tokens Studio
Style Dictionary
Storybook
Chromatic
shadcn/ui

웹페이지·랜딩페이지:
v0
Framer
Builder.io
Lovable
Next.js
Tailwind CSS
shadcn/ui

모바일 UI:
Figma MCP
Expo
React Native
NativeWind
Tamagui
Flutter

GUI 자동화·검증:
Playwright MCP
Selenium
Cypress
Puppeteer
axe-core
Lighthouse

오픈소스·셀프호스팅:
Penpot
GrapesJS
Webstudio
Excalidraw
tldraw
```

------

# 21. 최종 핵심 URL 압축

```text
# Figma / Claude Code / Codex
https://www.figma.com/mcp-catalog/
https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server
https://github.com/figma/mcp-server-guide
https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server
https://help.figma.com/hc/en-us/articles/39888629089175-Codex-and-Figma-Set-up-the-MCP-server
https://claude.com/plugins/figma
https://claude.com/connectors/figma
https://developers.figma.com/docs/figma-mcp-server/
https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/
https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/
https://www.figma.com/blog/introducing-claude-code-to-figma/
https://www.figma.com/blog/introducing-codex-to-figma/

# Design-to-Code
https://www.builder.io/ai
https://site.builder.io/figma-to-code
https://www.builder.io/c/docs/figma-to-code-builder-cli
https://github.com/BuilderIO/builder
https://github.com/BuilderIO/micro-agent
https://v0.dev/
https://v0.dev/docs
https://v0.dev/docs/design-systems
https://v0.app/docs/design-systems-2
https://ui.shadcn.com/
https://ui.shadcn.com/docs/cli
https://github.com/shadcn-ui/ui
https://github.com/21st-dev/magic-mcp
https://www.animaapp.com/
https://www.locofy.ai/

# AI App / Web Builder
https://lovable.dev/
https://docs.lovable.dev/
https://docs.lovable.dev/integrations/github
https://bolt.new/
https://replit.com/
https://docs.replit.com/
https://base44.com/
https://www.framer.com/ai/
https://www.framer.com/solutions/ai-website-builder/

# 상세페이지 / 마케팅 이미지 자동화
https://www.canva.com/developers/
https://www.canva.dev/docs/
https://www.canva.dev/docs/apps/design-editing/
https://developer.adobe.com/express/
https://developer.adobe.com/firefly-services/
https://developer.adobe.com/firefly-services/docs/firefly-api/
https://developer.adobe.com/firefly-services/docs/firefly-api/api/
https://www.bannerbear.com/docs/
https://developers.bannerbear.com/v2/
https://developers.bannerbear.com/v5/
https://placid.app/docs/
https://placid.app/docs/2.0/rest/videos
https://creatomate.com/docs
https://creatomate.com/developers
https://cloudinary.com/documentation

# Design System / Token
https://tokens.studio/
https://documentation.tokens.studio/
https://github.com/tokens-studio
https://github.com/tokens-studio/figma-plugin
https://github.com/tokens-studio/sd-transforms
https://github.com/style-dictionary/style-dictionary
https://amzn.github.io/style-dictionary/
https://storybook.js.org/
https://github.com/storybookjs/storybook

# UI 검증 자동화
https://github.com/microsoft/playwright-mcp
https://playwright.dev/
https://playwright.dev/docs/getting-started-mcp
https://playwright.dev/mcp/introduction
https://playwright.dev/mcp/installation
https://playwright.dev/mcp/snapshots
https://storybook.js.org/docs/writing-tests
https://storybook.js.org/docs/writing-tests/visual-testing
https://www.chromatic.com/docs/quickstart/
https://www.chromatic.com/docs/visual/
https://www.chromatic.com/docs/ci/
https://github.com/chromaui/addon-visual-tests
https://github.com/dequelabs/axe-core
https://developer.chrome.com/docs/lighthouse/overview
https://github.com/GoogleChrome/lighthouse

# GUI / 인터페이스 자동화
https://www.selenium.dev/
https://github.com/SeleniumHQ/selenium
https://www.cypress.io/
https://docs.cypress.io/
https://github.com/puppeteer/puppeteer
https://pptr.dev/

# 모바일 UI
https://reactnative.dev/
https://docs.expo.dev/
https://github.com/expo/expo
https://www.nativewind.dev/
https://github.com/nativewind/nativewind
https://tamagui.dev/
https://github.com/tamagui/tamagui
https://flutter.dev/
https://docs.flutter.dev/
https://github.com/flutter/flutter
https://github.com/mrzachnugent/react-native-reusables

# 오픈소스 디자인 도구
https://penpot.app/
https://penpot.app/code
https://help.penpot.app/
https://github.com/penpot/penpot
https://github.com/GrapesJS/grapesjs
https://grapesjs.com/
https://webstudio.is/
https://github.com/webstudio-is/webstudio
https://github.com/excalidraw/excalidraw
https://github.com/tldraw/tldraw

# 연구 / 한계 확인
https://arxiv.org/abs/2604.13648
https://arxiv.org/abs/2507.16208
https://arxiv.org/abs/2409.11667
https://arxiv.org/abs/2304.07591
```

------

# 22. 바로 선택하면

```text
1순위:
Figma MCP + Claude Code/Codex

2순위:
shadcn/ui + v0

3순위:
Builder.io Visual Copilot

4순위:
Storybook + Chromatic

5순위:
Playwright MCP

6순위:
Tokens Studio + Style Dictionary

7순위:
Framer AI / Lovable / Bolt / Replit

8순위:
Canva / Adobe Express / Bannerbear / Placid / Creatomate

9순위:
NativeWind / Tamagui / Expo / Flutter

10순위:
axe-core / Lighthouse / 접근성 검증
```

------

# 23. 반드시 주의할 점

```text
- Figma MCP가 있어도 복잡한 디자인을 100% 자동 구현하지는 못함
- 디자인 토큰과 컴포넌트 매핑이 없으면 결과물이 흔한 템플릿처럼 보일 수 있음
- 이미지형 상세페이지는 반응형·접근성·SEO에 약할 수 있음
- AI가 만든 UI는 반드시 실제 브라우저와 모바일 크기에서 확인해야 함
- 저작권 불명 이미지·폰트·아이콘 사용 금지
- 사용자 개인정보가 들어간 Figma 파일은 MCP 연결 전 권한 검토 필요
- 자동 생성 코드는 Storybook/Playwright/Chromatic으로 검증 필요
- GitHub 연동형 AI 빌더는 vendor lock-in과 코드 품질 확인 필요
- Canva, Adobe, Bannerbear, Placid 등 API형 디자인 자동화는 요금제와 이용약관 확인 필요
- MCP·Plugin은 코드와 환경변수 접근 권한을 가질 수 있으므로 설치 전 저장소와 실행 스크립트 확인 필요
- Playwright MCP의 snapshot만 믿지 말고 중요한 화면은 실제 테스트 코드와 수동 검증을 병행해야 함
```

AI 기반 design-to-code는 강력하지만 완전 자동 완성 도구가 아닙니다. 최신 연구 기준으로도 visual fidelity는 좋아지고 있지만, 반응형 레이아웃과 코드 유지보수성은 여전히 어려운 영역입니다. 따라서 Claude Code·Codex에 UI 자동화를 맡길 때는 **생성 → Storybook → Playwright → 접근성 → 시각 회귀 테스트** 순서를 고정하는 것이 가장 안전합니다. ([arXiv](https://arxiv.org/abs/2604.13648?utm_source=chatgpt.com))

------

# 24. 1차 10번 검증 결과

1. **웹 검색 반영**: Figma, Builder.io, v0, shadcn/ui, Storybook, Chromatic, Playwright MCP, Tokens Studio, Canva, Adobe, Bannerbear, Penpot, GrapesJS, Webstudio 공식 자료와 GitHub를 확인했습니다.
2. **Claude Code 적용성 확인**: Figma Claude Plugin, Figma MCP, Playwright MCP, Storybook, shadcn/ui, Context7 계열 적용 흐름을 포함했습니다.
3. **Codex 적용성 확인**: Codex용 Figma MCP 공식 문서와 Codex 기반 디자인 자동화 흐름을 포함했습니다.
4. **UI/UX 디자인 자동화 확인**: 디자인 시스템, 토큰, 컴포넌트, Design-to-Code, Code-to-Canvas, Write-to-Canvas를 포함했습니다.
5. **상세페이지 자동화 확인**: Canva, Adobe Express/Firefly, Bannerbear, Placid, Creatomate, Cloudinary와 웹 상세페이지 코드 흐름을 포함했습니다.
6. **GUI·인터페이스 자동화 확인**: Playwright MCP, Selenium, Cypress, Puppeteer, Lighthouse, axe-core를 포함했습니다.
7. **웹페이지·모바일페이지 확인**: Framer, Lovable, v0, Builder.io, React Native, Expo, NativeWind, Tamagui, Flutter를 포함했습니다.
8. **오픈소스 확인**: shadcn/ui, Storybook, Style Dictionary, Penpot, GrapesJS, Webstudio, Playwright MCP, axe-core를 포함했습니다.
9. **한계·모순 확인**: Figma MCP와 Design-to-Code 도구가 완전 자동 완성 도구가 아니라 반복 검증이 필요한 도구라는 점을 반영했습니다.
10. **복사 편의성 확인**: 핵심 URL을 카테고리별 raw URL 코드블럭으로 정리했습니다.

# 25. 보완 후 2차 10번 검증 결과

1. **보류 방지**: 공식 자료와 확인 가능한 GitHub·문서 중심으로 정리했고, 불확실한 항목은 커뮤니티·서드파티로 분리했습니다.
2. **추측 방지**: 각 도구의 역할을 “공식 MCP”, “Design-to-Code”, “AI 앱 빌더”, “이미지 자동화 API”, “검증 도구”, “오픈소스 대안”으로 구분했습니다.
3. **누락 보완**: 이전 답변에서 빠지기 쉬운 인터페이스 자동화, Playwright MCP 한계, Penpot MCP 가능성, 모바일 declarative UI 연구, Canva/Adobe/Bannerbear API 문서를 보강했습니다.
4. **오류 보완**: Figma MCP가 디자인을 완벽 자동 구현한다고 단정하지 않고, 공식 기능과 연구상 한계를 함께 반영했습니다.
5. **빈틈 보완**: 생성 도구뿐 아니라 Storybook, Chromatic, Playwright MCP, axe-core, Lighthouse까지 검증 단계를 포함했습니다.
6. **모순 방지**: Claude Code/Codex에 직접 설치 가능한 MCP·Skill 계열과 외부 SaaS형 도구를 분리했습니다.
7. **변수 반영**: 요금제, API Key, 개인정보, MCP 권한, vendor lock-in, 저작권, 브라우저 검증 필요성을 포함했습니다.
8. **실전성 확인**: Figma→Code, Code→Figma, 상세페이지, 모바일 UI, GUI·인터페이스 검증 워크플로우를 별도로 작성했습니다.
9. **초보자 맥락 반영**: 비개발자·왕초보는 Canva, Framer, Lovable, v0, Builder.io부터 보고, 실제 코드 구현은 Figma MCP+shadcn/ui+Playwright로 가는 흐름을 제시했습니다.
10. **최종 형식 확인**: 사용자가 선호하는 `# ✅ 최종 결론`, 우선순위, 카테고리별 구분, raw URL 코드블럭, 주의사항, 검증 요약 형식을 반영했습니다.
