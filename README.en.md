# SoDam-Design-Kit

A Claude Code design-automation kit that turns Figma designs into shadcn/ui code — and **will not call the work "done" unless it passes real-browser verification (Playwright + axe-core + 3 viewport sizes).**

[한국어 (Korean)](./README.md) | [English (current document)](./README.en.md)

> ✅ **Current status (as of 2026-08-18, confirmed by direct testing)**: **Phase 1 (MVP)** and **Phase 2 (dashboard, automatic visual-change detection, Korean font automation)** are officially complete, and **Phase 3 (advanced) is also complete through the detail-page pipeline, AI-generation history logging, marketing-image generation, and the license-gate extension**. All **272 automated tests pass**, and there are **0 known security vulnerabilities** (per `npm audit`). There are **5 commands** in total (`setup`, `pipeline`, `open`, `detail-page`, `marketing-asset`), and every one of them has been round-trip verified (PASS) against a real project. See [Section 7](#7-update-summary) for the full history.
>
> ⚠️ This kit is still **version 0.1.0 (pre-release, actively under development)**. Command names, behavior, and file structure may still change — this document will be updated whenever they do.

---

## Table of Contents

0. [Before you start: key terms in 5 minutes](#0-before-you-start-key-terms-in-5-minutes)
1. [What this tool is](#1-what-this-tool-is)
2. [Prerequisites & Required Software (with download instructions)](#2-prerequisites--required-software-with-download-instructions)
3. [Download & Installation](#3-download--installation)
4. [Quick Start (first success in 5 minutes)](#4-quick-start-first-success-in-5-minutes)
5. [How to Run, Use, and Operate It](#5-how-to-run-use-and-operate-it)
6. [Command Reference](#6-command-reference)
7. [Update Summary](#7-update-summary)
8. [Workflow](#8-workflow)
9. [Architecture & File/Document Locations](#9-architecture--filedocument-locations)
10. [Security & Data Flow](#10-security--data-flow)
11. [Troubleshooting](#11-troubleshooting)
12. [FAQ](#12-faq)
13. [Legal, Copyright, License & Commercial Use](#13-legal-copyright-license--commercial-use)

---

## 0. Before you start: key terms in 5 minutes

This document is written so that **someone who has barely used a computer, an AI tool, or a messaging app** can still follow it. A handful of words show up again and again throughout the document, so it's worth skimming this list once before you begin. If you're already comfortable with these, skip ahead to [Section 1](#1-what-this-tool-is).

| Term | Plain-language explanation |
|---|---|
| **AI (artificial intelligence)** | Software that understands plain human language and does the work for you. In this document, "AI" always means "Claude Code." |
| **Claude Code** | A program by Anthropic that you talk to, in a chat window, to get computer work done (like writing code) on your behalf. It has a "chat window" much like a messaging app — you type what you want in plain sentences. |
| **Terminal** | A text-based window where you type commands instead of clicking things. Once Claude Code is installed, the same chat window you type into *is* the terminal — there's nothing extra to learn or install. |
| **Command / slash command** | A pre-defined instruction that starts with `/` (a "slash"). If you've ever used a `/`-prefixed command in a chat app like Discord or Slack (e.g. `/remind`), it's the exact same idea. This kit uses 4 such commands, e.g. `/sodam-design-kit:setup`. |
| **Plugin** | An "add-on bundle" you attach to an existing program (here, Claude Code). It's similar to installing a new app on your phone — this kit itself is one such plugin. |
| **Folder / path** | A "folder" is a drawer that holds files; a "path" is the address that says where that drawer lives inside your computer (e.g. `D:\MyDocuments\Project`). |
| **Download / install** | "Download" means bringing a file from the internet onto your computer; "install" means setting that file up so your computer can actually use it. |
| **Browser** | A program like Chrome or Edge that displays web pages. This kit doesn't open a visible browser window for you to look at — it uses an **invisible, automated browser** to check the screen on its own. |
| **Server (dev server)** | A program whose job is to actually "serve up" a website's screen so it can be viewed. This kit starts and stops this server automatically every time it verifies something — you never need to start it yourself. |
| **Code / file / extension** | "Code" is the text that tells a computer how to behave; a "file" is one document where that text is stored. The part after the dot in a filename — like `.tsx`, `.json`, or `.md` — is called the "extension," and it identifies the file's type. |
| **Repository** | A whole bundle of related files grouped together. This kit's own project, and the project you're porting designs into, are each one repository. |
| **Kit** | Short for "toolkit." Whenever this document says "this kit," it always means SoDam-Design-Kit itself. |
| **Figma** | A widely used online design tool where designers draw screens (buttons, app layouts, etc.). This kit reads designs that live in Figma. |
| **Component** | A small, reusable piece of a screen — like a button or a text field — that shows up in multiple places. |
| **Report** | The file this kit writes after finishing a check, recording either "passed (PASS)" or "failed (FAIL)." |
| **Toggle (expand/collapse)** | A UI element that expands or collapses when you click it. [Section 7](#7-update-summary) of this document uses this — try clicking one of its headings. |
| **License** | A document that spells out whether other people are allowed to use this software, and under what conditions. Covered in detail in [Section 13](#13-legal-copyright-license--commercial-use). |

> 💬 **Truly new to all of this?**: To use this kit, you'll need at least the experience of "having opened Claude Code and typed a message into its chat window." If you're at the stage of turning on a computer for the very first time, start with the official guide at [claude.com/claude-code](https://claude.com/claude-code), install Claude Code, and have a short conversation with it — then come back to this document. (This kit is a developer tool that also needs Node.js and a Figma account, so it isn't the kind of thing you can use after installing just one single app — [Section 2](#2-prerequisites--required-software-with-download-instructions) lists everything you actually need.)

---

## 1. What this tool is

In one sentence: **it automatically turns a Figma design into working code, and mechanically refuses to let you call it "done" until that code has actually been checked in a real browser.**

- It reads a screen you drew in Figma (e.g., a single button).
- It generates code that matches that design, styled with [shadcn/ui](https://ui.shadcn.com) (a React component library).
- It launches the generated code with an invisible, automated browser and automatically checks: does the screen render without breaking? Are there accessibility problems (e.g., for screen-reader users)? Does it look right at phone (360px), tablet (768px), and desktop (1440px) widths?
- If it passes, a "report" record is written. If it fails, the tool mechanically blocks any report of "done" — even if a human (or an AI) forgets or tries to skip the check.

```
Figma design ──▶ Code generation ──▶ Real-browser check ──▶ Only then: "done"
```

**Why a tool like this exists**: if you simply tell an AI "build this to match the design," the AI can generate code and then say "all done." But whether that code **actually renders correctly on screen, doesn't have broken text, and works for screen-reader users** might just be something the AI *claimed* was true, without anyone actually checking. This kit forces that final check to be done mechanically by a **real browser program**, not just asserted in words — so "it said it worked, but it actually didn't" simply can't happen.

**Who this is for**: Anyone who designs in Figma and uses Claude Code to turn that design into code (the same person can do both) — especially anyone uneasy about "the AI says it made the code, but did anyone actually check it renders?"

**Who this is *not* for (an honest limitation)**: this is not a tool that builds an entire website from scratch for someone with zero coding background. What it generates is **individual screen pieces** inside a project that already exists (Next.js + Tailwind + shadcn/ui) — [Section 2](#2-prerequisites--required-software-with-download-instructions) explains this requirement in detail.

---

## 2. Prerequisites & Required Software (with download instructions)

All 4 of the following must be ready. If even one is missing, you cannot proceed to Section 3 (Installation).

| # | Requirement | Why it's needed | Download / Check |
|---|---|---|---|
| 1 | **Claude Code** | This kit is itself a Claude Code "plugin" — it cannot run without Claude Code | Install per the official guide at [claude.com/claude-code](https://claude.com/claude-code) |
| 2 | **Node.js 18 or newer** | Every verification script in this kit is written in Node.js (a JavaScript runtime) | Download the "LTS" version from [nodejs.org](https://nodejs.org). After installing, type `node -v` in a terminal — if a version number appears, you're set (this kit was built and verified on v22.19.0) |
| 3 | **Target project**: Next.js + Tailwind CSS + shadcn/ui | The code this kit generates assumes exactly this combination (other frameworks are not yet supported) | You need a project already built with this stack. If you don't have one, create one with `npx create-next-app@latest` (official Next.js method) and follow the [official shadcn/ui install guide](https://ui.shadcn.com/docs/installation) |
| 4 | **Figma file access** | The original design you're porting to code must live in Figma | Use the **Figma connector** already linked to claude.ai, or log in via the official **Figma MCP** (`https://mcp.figma.com/mcp`). A free (Starter) Figma plan works, but is limited to **6 reads per month** (see [Section 10](#10-security--data-flow)) |

> **Not sure what a term means?** Check the [glossary in Section 0](#0-before-you-start-key-terms-in-5-minutes) first. In particular, if "terminal" is unfamiliar: it's a text-based window where you type commands instead of clicking. Once Claude Code is installed, the window you type commands into *is* the terminal — nothing extra to install.

> **Don't have prerequisite #3 yet?**: this kit assumes there's already a "somewhat-built website project" to work with. It isn't designed for "build me a whole website from nothing." If you don't have such a project yet, you can ask Claude Code in plain language to set one up first (e.g., "create an empty Next.js + Tailwind + shadcn/ui project for me").

---

## 3. Download & Installation

> The steps below assume this kit **is not on a GitHub marketplace, and is installed by pointing directly at a folder path on your computer** ("local directory source" — confirmed as of 2026-07-20, still true today). If this later moves to a GitHub-hosted marketplace, step 1's address may change from a folder path to a different kind of address — this section will be updated when that happens.

1. **Register the marketplace** — inside the Claude Code chat window, type this exactly (only replace the address with your own computer's real path):
   ```
   /plugin marketplace add <full path to this repository folder>
   ```
   (example: `D:\AI_Dev_Work\2026y\26y_07m_26d_SoDam-Design-Kit`)

2. **Install the plugin** — then type:
   ```
   /plugin install sodam-design-kit@sodam
   ```

3. **Fully restart Claude Code** — close the window completely and reopen it. (See [Section 11](#11-troubleshooting), "Installed but the command doesn't show up" — this must be a **full restart**, not a refresh.)

4. **Install dependencies (once only)** — from **inside this plugin's own repository folder** (where this `README.en.md` lives), type into your terminal:
   ```
   npm install
   ```
   The verification gate depends on the browser-automation tool (Playwright) and the accessibility checker (axe-core), which are not bundled with the kit's code and must be fetched with this command.

   > **Important (a confirmed real-world pitfall)**: Because this plugin uses a "local directory source," installing it does **not** create a copy anywhere else. Claude Code simply uses the original folder you pointed to in step 1. So `npm install` must also be run **inside that same original folder** — there is no separate "installed location" to go looking for.

5. **Verify the install** — inside the **target project** (the Next.js project from prerequisite #3), type:
   ```
   /sodam-design-kit:setup
   ```
   If this command appears in autocomplete and runs without error, the install succeeded.

**How do you know it failed?**: if you type the first few letters (`/sod`) and nothing appears in autocomplete, the install didn't take. See the first row of [Section 11](#11-troubleshooting).

---

## 4. Quick Start (first success in 5 minutes)

Once prerequisites and installation are done, here's the fastest path to seeing a real result.

**Step 1 — Initial setup (once per target project)**
```
/sodam-design-kit:setup
```
→ Success looks like: a message confirming `.design-kit/config.json` and `.design-kit/component-map.json` were created.

**Step 2 — Run your first pipeline (when a component is already mapped)**
```
/sodam-design-kit:pipeline
```
→ When asked for a Figma link, paste a **small, single-element** Figma share link (its URL should contain `node-id=`).
→ Success looks like: a final `PASS` verdict, plus a message that a report file was written to `.design-kit/reports/`.

**Step 3 — Check the report**
```
.design-kit/reports/2026-XX-XX-XXX.md
```
Open this file and confirm it contains `**PASS**` and three screenshot paths for 360px/768px/1440px. If you see that, real-browser verification genuinely completed.

> A `FAIL` result is also normal — it means the gate is working correctly. See [Section 11](#11-troubleshooting), "It says 'completion blocked.'"

**Step 4 (optional) — See everything you've made in one place**
```
/sodam-design-kit:open
```
→ A browser window (dashboard) opens automatically, showing your verification history, reports, and screenshots all in one place. When you're done, type `/sodam-design-kit:open --stop` in the chat to turn it off (it's harmless to leave running, but it's good practice to stop it when you're not using it).

---

## 5. How to Run, Use, and Operate It

This kit runs from inside Claude Code via **slash commands** (commands starting with `/`). You don't need to type raw Node commands yourself (those are only used by the kit's own developers for self-testing — see [`.PRD/04_PROJECT_SPEC.md`](./.PRD/04_PROJECT_SPEC.md), "Test Method").

### `/sodam-design-kit:setup` — initial setup
- **Input**: none (uses the current project folder automatically) / optional: a Figma file link
- **What it does**: reads `components.json` (shadcn's own config) to locate your actual component folder, scans the `.tsx` files inside it, and writes `.design-kit/component-map.json`. It also creates `.design-kit/config.json` (default settings — 3 viewport sizes, 3 auto-retries, etc.).
- **How it behaves**: run it **once** per project. If a config already exists it's skipped automatically; add `--force` to rescan (existing Figma mappings are preserved, and only newly found components are added).
- **Success looks like**: a completion message + a new `.design-kit/` folder.

### `/sodam-design-kit:pipeline` — design → code → verification
- **Input**: a Figma share link (a direct page/node link, not a whole-file link — see [Section 10](#10-security--data-flow))
- **What it does**: reads Figma → records the mapping in `component-map.json` → generates shadcn/ui code → auto-creates a preview route (`/design-kit-preview/{component}`) → auto-starts a dev server → runs real-browser verification (Playwright + axe-core + 3 viewports) → writes the report.
- **How it behaves**: on `FAIL`, it retries automatically up to 3 times (two consecutive failures are required to finalize a `FAIL`). **Both the "reuse an already-mapped component" path and the "generate a brand-new component from scratch" path have been verified end-to-end (PASS).** Before placing a newly generated component, it automatically checks for hardcoded style values (e.g. `#ff0000`) and refuses to place the file if it finds any.
- **Success looks like**: a report file in `.design-kit/reports/` containing `**PASS**`.

### `/sodam-design-kit:open` — view the verification-history dashboard
- **Input**: none / only `--stop` to shut it down
- **What it does**: opens all your accumulated reports, run records, and screenshots in a human-friendly browser screen (a dashboard). From there you can click into a report's details, or hit a "re-verify" button to run the check again on the spot.
- **How it behaves**: it's only reachable from your own computer (address `127.0.0.1`, meaning "this computer itself") — nobody else can reach it. If it's already running, it reuses the existing instance instead of starting a new one.
- **Success looks like**: a browser window opens automatically, showing your list of reports.

### `/sodam-design-kit:detail-page` — product detail-page pipeline (Phase 3)
- **Input**: a product data file (CSV or JSON — a table-style file listing product names, features, etc.)
- **What it does**: reads your product data → an AI writes marketing copy (title, key benefits, description, FAQ) → that copy is wired into detail-page code → the same verification gate (real-browser + accessibility + 3 viewport sizes) as everything else must pass.
- **How it behaves**: instead of creating a brand-new page file for every product, it builds exactly one page template and stores each product's data separately (to prevent the file count from growing without bound).
- **Success looks like**: same as the other commands — a report in `.design-kit/reports/` containing `**PASS**`.

### `/sodam-design-kit:marketing-asset` — marketing image (OG image) generation (Phase 3, og spec only)
- **Input**: a title (required) + a subtitle (optional)
- **What it does**: automatically renders your title/subtitle into a social-share image (1200×630, an Open Graph image). If the result fails the dimension/format/size checks, no file is written at all.
- **How it behaves**: reuses the Korean font (Pretendard) already set up by the font pipeline so text never renders as broken boxes, and automatically records the generated image in the AI-generation history (`AI-GENERATION-LOG.md`).
- **Success looks like**: a file appears at `public/design-kit-assets/og-<title>.png`. Other formats (poster, banner, business card) aren't supported yet (a future increment).

### P1 Completion Verification Procedure (for the project maintainer)

> This is not something you do on every regular use — it's the **final check that the kit actually works the same way from a brand-new session, from scratch** ([`.PRD/01_PRD.md`](./.PRD/01_PRD.md) §9, Success Criteria 5 and 6). Follow these steps in a new Claude Code session, and this document alone is enough to reproduce it.

1. **Pick a target project** — ideally one that has already run `/sodam-design-kit:setup` and already has a Figma mapping (so no fresh Figma call is needed, and the free 6-calls-per-month limit isn't touched).
2. **Before running anything, check the current state of the reports folder** and keep it as your baseline (PowerShell):
   ```powershell
   Get-ChildItem "<target project path>\.design-kit\runs" | Sort-Object Name | Select-Object -Last 3
   ```
   Remember this file list — you'll compare against it afterward to confirm nothing was deleted.
3. In Claude Code, run:
   ```
   /sodam-design-kit:pipeline
   ```
   Provide the target project's path and the Figma node (or let it use the existing mapping).
4. **Success looks like this (all of the following must be true)**:
   - The result includes `"verdict": "PASS"`
   - **One new report file** appeared in `.design-kit\reports\`
   - **None of the existing files** you noted in step 2 were removed (no overwrites)
   - The agent did **not** write a throwaway script on the fly — verification and report-writing must complete together via a single `verify-runner.mjs --target ...` command
5. **Always run this from PowerShell** — in Git Bash, values starting with `/` (like `/design-kit-preview/...`) can get misinterpreted as a path. See [Section 11, Troubleshooting](#11-troubleshooting).

---

## 6. Command Reference

| Command | Description | Input | Run from | Current status |
|---|---|---|---|---|
| `/sodam-design-kit:setup` | Generates config.json and seeds component-map by scanning shadcn components | none (optional: Figma file link) | inside the target (Next.js) project | ✅ verified working |
| `/sodam-design-kit:pipeline` | Figma read → mapping → shadcn/ui code generation → verification gate | Figma page/node link | inside the target (Next.js) project | ✅ both the reuse (mapped-component) path and the new-component generation path verified PASS |
| `/sodam-design-kit:open` | Opens a browser dashboard to review verification history, reports, and screenshots + trigger re-verification (127.0.0.1 only; stop with `--stop`) | none | inside the target project | ✅ real background start/reuse/stop round-trip verified PASS |
| `/sodam-design-kit:detail-page` | Product data (CSV/JSON) → copy generation → detail-page code → the same verification gate (Phase 3) | a product data file (CSV or JSON) | inside the target (Next.js) project | ✅ verified PASS → FAIL (deliberate a11y violation) → back to PASS round-trip |
| `/sodam-design-kit:marketing-asset` | Title/subtitle → auto-generates a social-share image (OG, 1200x630) (Phase 3, og spec only) | title (required) · subtitle (optional) | inside the target project (`public/design-kit-assets/`) | ✅ verified PASS (Korean rendering, dimensions confirmed); poster/banner/business-card are a future increment |

Commands for kit developers only (end users don't need these):

| Command | Description | Run from |
|---|---|---|
| `npm install` | Installs the browser and accessibility tools used for verification (once only) | this kit's own repository folder |
| `npm test` | Runs the kit's own automated tests (272 as of 2026-08-18; the count may grow over time) | this kit's own repository folder |
| `npm run selftest` (= `node scripts/e2e-selftest.mjs`) | Full self-check of the round-trip pipeline (PASS/FAIL/recheck) | this kit's own repository folder |

---

## 7. Update Summary

> The items below are collapsible "toggles" — click a heading (the line starting with ▶) to expand it. The most recent entry is at the top.

<details open>
<summary><b>▶ 2026-08-18 — License gate extended: image/icon assets now scanned too (click to collapse)</b></summary>

- Completed the fourth item in the Phase 3 sequence. Until now only fonts got "where did this come from, what license is it under" automatic tracking and checking — now image and icon files can be checked the same way (opt-in — off unless you turn it on).
- Images produced by the marketing-image generator (see the item just below) and verification screenshots are **not** in scope for this check — those already have their own record (the AI-generation history). This boundary was designed in deliberately from the start and confirmed against a real project.
- Also added automatic generation of a source-attribution document (`ATTRIBUTION.md`).
- **Verified by direct testing**: confirmed that unregistered image files already sitting in the real fixture project (5 default icons + 1 favicon) were correctly flagged, then confirmed that registering one of them in the ledger made exactly that one file drop out of the list.
- Added 26 new automated tests (246 → 272), all passing. No new dependencies (`npm audit` still 0).

</details>

<details>
<summary><b>▶ 2026-08-17 — Verification round found and fixed 3 real bugs (click to expand)</b></summary>

- While re-testing the newly built features (AI-generation history logging, marketing-asset generation) across normal, edge-case, and failure scenarios, found and fixed 3 genuine problems.
- ① Passing a project path that doesn't exist silently created a new folder instead of failing → now fails with a clear error message.
- ② A prompt containing a code block (three backticks) could corrupt the formatting of the log file → now always wraps it safely.
- ③ Two similar titles differing only in punctuation could silently overwrite the first generated image with the second → now automatically disambiguated.
- Added 5 regression tests, all passing (241 → 246).

</details>

<details>
<summary><b>▶ 2026-08-17 — Added marketing image (OG image) auto-generation (click to expand)</b></summary>

- Added a feature that turns a title and subtitle into a social-share image (1200×630, the Open Graph spec) automatically.
- Verified the Korean font renders correctly (no broken-box glyphs) by actually installing it on this machine before starting the work.
- If the generated image fails the dimension/format/size checks, no file is written at all — the same "nothing ships without passing verification" principle this kit applies everywhere, now applied to images too.
- Other formats (poster, banner, business card, etc.) are out of scope for this round; each will get its own real verification when added later.
- Added 17 new automated tests, all passing (224 → 241).

</details>

<details>
<summary><b>▶ 2026-08-17 — AI-written copy is now logged automatically (click to expand)</b></summary>

- Added a feature that automatically records when, with which model, and how freeform content the agent writes (currently: detail-page copy) was generated.
- Unlike verification screenshots, this log file is actually committed to the repository — so if the project is public, secrets (passwords, API keys, etc.) accidentally included in a prompt could end up permanently exposed. A filter that strips out secret-looking patterns is now always applied before anything is written, to close that risk.
- Added 18 new automated tests, all passing (206 → 224).

</details>

<details>
<summary><b>▶ 2026-08-10 — Phase 3 launched: detail-page pipeline (click to expand)</b></summary>

- The precondition for Phase 3 (marketing assets + detail pages + a public-release review) — "Phase 1 and 2 are stable under the maintainer's own real-world use" — was confirmed through actual live testing (dashboard screenshots visibly rendering, and the re-verify button working correctly). With that confirmed, the **detail-page pipeline** was built as the first Phase 3 feature.
- **What it does**: pick a product out of one product-data file (CSV or JSON), write marketing copy for it (title, key benefits, description, FAQ), wire that copy into detail-page code, and require the same verification gate (real-browser + accessibility + 3 viewport sizes) to pass before it's considered done.
- **Design principle**: rather than creating a new page file per product, exactly one page template is created, and each product's data is stored separately — this kit had already flagged this phase, by its own design docs, as "the step most likely to create the most new files, and therefore the riskiest for regressions," so the design specifically avoids growing the file count.
- **Verified by real testing**: dummy product data was added to a real fixture project and the whole flow was run end-to-end to confirm PASS; an accessibility defect (an image missing alt text) was deliberately injected to confirm the gate genuinely produces a FAIL; then it was reverted and confirmed to return to PASS.
- 22 new automated tests were added (178 → 200), all passing. No new dependencies (`npm audit` stays at 0).
- A feature that automatically logs AI-generation history (AI-GENERATION-LOG.md) and the marketing-image pipeline are left for a future increment (out of scope this round).

</details>

<details>
<summary><b>▶ 2026-08-10 — First genuine live-usage test completed (click to expand)</b></summary>

- For the first time, Phase 2 was tested not by "an AI checking against a fixture," but by **the maintainer actually opening a fresh chat session and using it themselves**: opening the dashboard with `/sodam-design-kit:open`, reading a report, clicking the re-verify button, and asking natural-language questions about the font and visual-regression features — all done directly, first-hand.
- In the process, one real defect was found: a report written by the self-check (`e2e-selftest`) never recorded which screen (route) it had originally checked, so the dashboard's "re-verify" button could never work on it again. It was fixed immediately and re-verified.
- Opening the dashboard and clicking through a report can now genuinely be called "confirmed by real use." However, the font-automation and visual-change-detection features themselves weren't switched on directly by command — they were answered about in natural language by the AI — so this doesn't yet count as a fully complete "confirmed by real use" for those two features specifically.

</details>

<details>
<summary><b>▶ 2026-08-10 — Fixed: dashboard screenshots were never actually visible in a real browser (click to expand)</b></summary>

- The dashboard screen (declared "done" on 2026-08-09) turned out to have never properly shown its verification screenshots in a browser at all — this was only discovered this round by actually opening the real screen in a headless (invisible) browser.
- Two causes were stacked together: ① the image file path had a duplicated prefix, causing a "file not found (404)" error, and ② a security setting (CSP) didn't allow the special image format the screenshots used (`blob:`), so the browser blocked the image from displaying at all. Both failed "quietly" — the program didn't crash, the image just silently never appeared — which is why this had gone unnoticed until now.
- Before the fix (3 console errors) → each cause fixed and re-checked one at a time → after the fix (0 console errors, all 3 images confirmed showing real pixels on screen) — all confirmed directly. Automated tests grew from 175 to 178, all passing.
- **Lesson learned**: a feature marked "verified complete" in the past may have only been checked at the data level, not by actually looking at real screen elements (like images) with human eyes. Going forward, anything screen-related will default to being checked with an invisible automated browser, down to real pixels.

</details>

<details>
<summary><b>▶ 2026-08-10 — Added: a check that automatically catches unregistered fonts (click to expand)</b></summary>

- A new check was added that fails verification (FAIL) if a font file from an unknown source — one not officially registered by the project — is found mixed in (opt-in — turn it on with the `--fontGate` option when you want it).
- **Verified by real testing**: an unregistered font file was deliberately added to a project and the check was run to confirm it actually produced a FAIL; the file was then removed and confirmed to return to PASS. Already-registered fonts (e.g. Pretendard) were confirmed to pass through without any false alarms.
- Automated tests grew from 157 to 172, all passing.

</details>

<details>
<summary><b>▶ 2026-08-09 — Fixed 2 real defects found during a comprehensive verification round (click to expand)</b></summary>

- When the dashboard displayed a report, it was mistaking the "visual-regression" results section for an actual screenshot and trying to display it incorrectly — found and fixed.
- Also found and fixed: a corrupted screenshot file could crash the entire verification process. Now, one damaged file no longer halts the whole run.
- Automated tests grew from 155 to 157, all passing.

</details>

<details>
<summary><b>▶ 2026-08-09 — Added: automatically fetching and setting up Korean fonts (click to expand)</b></summary>

- Previously, a Korean font had to be manually prepared and added to the project. Now this kit can pick from freely-usable, commercially-licensed open-source Korean fonts (Pretendard, Noto Sans KR), **automatically download them, and set them up ready to use** in the project.
- A ledger file (`ASSET-LEDGER.csv`) that automatically records which license each downloaded font uses was also introduced in this round — useful later if you ever need to confirm the terms under which a font was used.
- **Verified by real testing**: an actual Pretendard font file (about 1.5MB) was genuinely downloaded from the internet, and running the same command again was confirmed not to re-download it (idempotent).
- Automated tests grew from 143 to 155, all passing.

</details>

<details>
<summary><b>▶ 2026-08-09 — Added: automatically detecting unintended visual changes (click to expand)</b></summary>

- A feature was added that automatically compares screenshots, pixel by pixel, to catch unintended visual changes after a code edit (opt-in — turn it on with the `--visualRegression` option). It compares against a "baseline" screen a human has approved as correct; approving a baseline is only ever done by a human, deliberately (`--promoteBaseline`), and only for a screen that already passed verification (PASS).
- **Verified by real testing**: after approving a baseline, making no changes correctly reported "identical"; deliberately changing a background color was correctly caught as "different" at all 3 viewport sizes, produced a FAIL, and generated a real diff image; reverting the change correctly returned it to "identical."
- Automated tests grew from 135 to 143, all passing.

</details>

<details>
<summary><b>▶ 2026-08-09 — Resolved one accessibility warning (click to expand)</b></summary>

- The preview screens this kit auto-generates had a minor accessibility warning: "missing a page heading (`<h1>`)." A heading was added in a way that's invisible on screen but still recognized by screen readers, resolving it.
- **Verified by real testing**: re-running verification confirmed the warning genuinely disappeared (1 → 0).
- Automated tests grew from 134 to 135, all passing.

</details>

<details>
<summary><b>▶ 2026-08-09 — Added the dashboard and the `/open` command (click to expand)</b></summary>

- Until now, reports and run records existed only as files you had to open one at a time. Now, a single `/sodam-design-kit:open` command opens your whole verification history in a browser dashboard, and lets you trigger re-verification right there on the spot.
- **Safeguards**: the dashboard is reachable only from your own computer (`127.0.0.1`) and needed no login or password to be made safe — several layers of protection (blocking path-traversal attempts, rejecting malformed requests, a lock that refuses re-verify requests while a pipeline is already running) were built alongside it, and each was tested by actually simulating the corresponding attack.
- **Verified by real testing**: the full round trip was confirmed for real — starting the dashboard → the browser correctly showing the screen → reusing the existing instance instead of starting a duplicate → `--stop` genuinely shutting it down.
- Automated tests grew from 123 to 134, all passing.

</details>

<details>
<summary><b>▶ 2026-08-04 — Fixed 3 real defects found during live new-session testing + Phase 1 (MVP) officially complete (click to expand)</b></summary>

- **Before declaring completion, the final gate (reproducing everything from a brand-new session) was actually attempted 4 times.** In the process, 3 real defects that had never surfaced before were found and fixed during genuine live use:
  1. **Screenshots being saved outside the project folder entirely (in an unrelated folder on the user's computer)**: when the screenshot save path was given as a relative path, it could resolve to the wrong location depending on "which folder the process happened to be running from." The report correctly said "success," but the actual file wasn't inside the project at all. This is now always recalculated relative to the project folder.
  2. **Screenshots being saved inside the project, but outside the `.design-kit/` folder this kit manages**: a subtler issue found right after fixing #1 — the files landed inside the project folder, but outside the `.design-kit/` folder this kit officially manages, so they were skipped by automatic cleanup and left somewhere that could accidentally get committed to git. Fixed by anchoring the save location to the `.design-kit/` folder itself.
  3. **Being asked for a Figma file link again even for an already-mapped component**: the "reuse" path (reusing a component that's already linked) was designed to never need to call Figma again — but one step in the run procedure asked for a Figma link unconditionally, without checking whether a mapping already existed, so execution would stall even for components that were already fully connected. Fixed by adding a check at the very start of the procedure: "if it's already mapped, skip straight past this."
- **After fixing all three, the fourth attempt finally succeeded completely** — no throwaway glue code, no existing report deleted, and screenshots landed in exactly the right place, start to finish.
- With this, all 6 items in [`.PRD/01_PRD.md`](./.PRD/01_PRD.md) §9 (Success Criteria) are now backed by real evidence, and **Phase 1 (MVP) has been officially marked complete.**
- The automated test count remains 68 (this round was mostly documentation and procedure fixes), and all 68 pass.

</details>

<details>
<summary><b>▶ 2026-07-27 — Fixed two minor issues found during a test/verification pass (click to expand)</b></summary>

- **The self-check command was silently pointing at the wrong thing**: the kit maintainers' `npm run selftest` command referenced an option that doesn't actually exist, so instead of running the real self-check (`scripts/e2e-selftest.mjs`) it just printed a usage message and stopped. **End users never run this command themselves** — this document has always instructed running the correct script directly — so anyone following this document was never affected. It was still fixed immediately upon discovery, to point at the correct script.
- **A gap where screenshots could end up exposed to git if verification was run standalone, skipping the normal setup → pipeline order**: following the documented order, the screenshot folder is automatically registered in `.gitignore`. But an alternate, exceptional path — running the verification step directly without ever running `setup` first (mainly used by the kit's own developers for testing) — was found, by direct reproduction, to skip that registration. The same registration logic was added to the report-writing code to close this gap. **This path, too, never affected anyone following the documented order.**
- Both fixes leave the existing 66 automated tests unaffected — all 66 still pass.

</details>

<details>
<summary><b>▶ 2026-07-27 — Added: more specific reasons when verification fails (click to expand)</b></summary>

- Previously, even when an accessibility check (axe-core) failed, the report only showed a count like "1 critical violation" — a person had to go dig up exactly what was wrong and why.
- Reports now include a "violation details" section with the specific rule name, description, and the exact screen element involved. This detail is also passed into the next automatic retry attempt, reducing repeated failures for the same underlying reason.
- 5 new automated tests were added, and all pass (61 → 66).

</details>

<details>
<summary><b>▶ 2026-07-27 — Added: generating a brand-new component from scratch (click to expand)</b></summary>

- Until now, only the path that "reuses" a component already mapped from Figma had actually been verified — generating a brand-new component with no existing mapping was planned but not yet implemented.
- This path is now implemented and verified end-to-end. Before placing newly generated code into the project, it now **automatically refuses to place it** if color or spacing values are hardcoded as raw numbers (e.g. `#ff0000`, `12px`) — closing off any way for code that bypasses the project's own design tokens to sneak in.
- 8 new automated tests were added, and all pass (53 → 61).

</details>

<details>
<summary><b>▶ 2026-07-27 — Fixed: verification could end up checking the wrong app entirely if another program was already using the same port (click to expand)</b></summary>

- **The most serious problem found — what got checked might not have been your project at all**: this kit automatically avoids a busy port (e.g. 3000) and moves to the next one when starting its verification browser. However, **it could mistakenly think a port was "free" even when another program (e.g. a dev server from a completely different project) was already using it.** When that happened, the verification browser opened and checked **that other program's screen instead of yours**, yet still produced a report that looked exactly like it had checked your project.
  - This was caught happening for real: an unrelated project's dev server was using port 3000, and the kit mistakenly treated that port as "free" and ended up checking that other program's screen.
  - Fixed by switching to a more accurate way of checking whether a port is actually in use. With the other program still running on that port, a re-check confirmed the kit now correctly moves to the next port and **checks only your own project**.
  - One new automated test was added so this can never quietly come back.
- Thanks to this fix, the automated test count is now **53**, with **all 53 passing** (verified by an actual run on 2026-07-27).

</details>

<details>
<summary><b>▶ 2026-07-27 — Fixed: verification silently switched itself off when the folder path contained a space or non-English characters (click to expand)</b></summary>

- **The most important fix — "completion blocking" was disappearing silently**: if the folder this kit is installed in contained a **space** (e.g. `My Projects`) or **non-English characters** (e.g. a Korean Windows account name, `C:\Users\홍길동\...`), the verification scripts **did nothing at all and exited quietly**. No error message appeared, so from the user's point of view it looked like everything had worked. When this happened in the completion-blocking hook (`hooks/verify-gate.mjs`), it meant **a failing check could be reported as "done" with nothing to stop it** — which removes the entire reason this kit exists. That is why it was fixed first.
  - Reproduced across three paths: folder with a space → off / folder with Korean characters → off / plain-English folder → working. After the fix, all three work.
  - The pre-fix version was run directly from a Korean + space path and confirmed to print **literally nothing**; the fixed version prints a proper "block" verdict from the same location.
  - To make sure this can never quietly return, **two new automated tests** now run the real scripts from a folder that deliberately contains a space and Korean characters.
- **One automated test was actually failing**: the docs claimed "all 50 pass", but an actual run showed **only 49 passing**. The cause: one test was pinned to the date "2026-07-20", so it passed **only on the day it was written and broke the next day**. Fixed by allowing the date to be injected (no impact on real-world usage).
- Together these bring the automated test count from **50 to 53**, with **all 53 passing** (verified by an actual run on 2026-07-27).

</details>

<details>
<summary><b>▶ 2026-07-20 — Unified verify+report command; fixed a data-loss bug (click to expand)</b></summary>

- **Unified verification and report-writing into a single command**: Previously, the docs described "run the real-browser check" and "record the result" as separate steps, but the report-writing script had no command-line interface at all — so an AI agent had to write a throwaway glue script by hand every time. `verify-runner.mjs` now has a `--target` option so verification and report-writing complete in a single command.
- **Fixed a bug where recorded results could silently vanish**: The sequence number used in report filenames was calculated as "how many files currently exist," so deleting any one file in the middle of the sequence caused the next number to collide with an already-existing file — silently overwriting and destroying a different run's results (confirmed via real reproduction). It's now calculated as "the actual highest existing number + 1," and two new automated tests reproduce this exact scenario to guard against regression.
- Thanks to these two fixes, the automated test count grew from 48 to 50, and all of them pass.

</details>

<details>
<summary><b>▶ 2026-07-20 — Core Phase 1 features completed (click to expand)</b></summary>

- Implemented all core scripts: initial setup (setup), design-to-code generation (pipeline-codegen), automatic preview-route creation (preview-route), real-browser verification (verify-runner), report-writing (report-writer), and the completion-blocking hook (verify-gate).
- Verified end-to-end with a real Figma Community file (Coffee Shop Mobile App) — reading one screen, generating code from it, and passing real-browser verification (PASS).
- Confirmed the same install-and-run flow works starting from a completely new session (though that check happened on the version *before* the fixes above — re-confirming with the fixed version is still an open step).

</details>

> Future changes will keep being appended here, in date order. The authoritative full history (including internal audit records) lives in [`.PRD/README.md`](./.PRD/README.md).

---

## 8. Workflow

```
User                    Claude Code (AI)              This kit's code
  │                        │                             │
  │  "Turn this button      │                             │
  │   into code"            │                             │
  ├──────────────────────▶│                             │
  │                        │  Read the Figma design (MCP/connector)
  │                        │◀── layer structure, colors, sizes ──┤
  │                        │                             │
  │                        │  Record the mapping in component-map.json
  │                        ├───────────────────────────▶│
  │                        │                             │
  │                        │  Request shadcn/ui code generation
  │                        ├───────────────────────────▶│
  │                        │◀── generated .tsx file(s) ──────┤
  │                        │                             │
  │                        │  Auto-start a dev server           │
  │                        │  → open in an automated browser (Playwright)
  │                        │  → accessibility check (axe-core)   │
  │                        │  → check at 360px, 768px, 1440px    │
  │                        │◀── PASS or FAIL verdict ────────┤
  │                        │                             │
  │   ┌───── PASS ─────┐   │  Report recorded (runs/·reports/)  │
  │   │ "done" may be   │◀──┤                             │
  │   │ reported        │   │                             │
  │   └───────────────┘   │                             │
  │   ┌───── FAIL ─────┐   │  Auto-retry up to 3 times          │
  │   │ Reporting       │◀──┤  (2 consecutive failures =         │
  │   │ "done" is       │   │   final FAIL)                      │
  │   │ blocked by the  │   │                             │
  │   │ hook            │   │                             │
  │   └───────────────┘   │                             │
```

The key point is the final fork: **`hooks/verify-gate.mjs` mechanically prevents the word "done" without a PASS report** — even if the AI forgets, or tries to cut corners.

---

## 9. Architecture & File/Document Locations

### This kit's own repository structure
```
SoDam-Design-Kit/                     ← this kit's repository (where this README lives)
├── .claude-plugin/
│   ├── plugin.json                   ← plugin manifest (name, version)
│   └── marketplace.json              ← marketplace registration (marketplace name: sodam)
├── commands/
│   ├── setup.md                      ← the actual definition of /sodam-design-kit:setup
│   ├── pipeline.md                   ← the actual definition of /sodam-design-kit:pipeline
│   ├── open.md                       ← the actual definition of /sodam-design-kit:open
│   ├── detail-page.md                ← the actual definition of /sodam-design-kit:detail-page (Phase 3)
│   └── marketing-asset.md            ← the actual definition of /sodam-design-kit:marketing-asset (Phase 3, og spec only)
├── hooks/
│   └── verify-gate.mjs               ← completion-blocking logic (blocks on FAIL)
├── scripts/                          ← the actual engine, all Node.js (representative examples — see scripts/ for the full list)
│   ├── setup-wizard.mjs
│   ├── pipeline-codegen.mjs
│   ├── detail-page-pipeline.mjs      ← detail-page pipeline engine (Phase 3)
│   ├── preview-route.mjs
│   ├── verify-runner.mjs
│   ├── report-writer.mjs
│   ├── font-pipeline.mjs             ← automatic Korean font download/setup engine
│   ├── visual-regression.mjs         ← automatic visual-change detection engine
│   ├── ai-generation-log.mjs         ← AI-generation history logging engine (Phase 3)
│   ├── marketing-asset-pipeline.mjs  ← marketing image (OG) auto-generation engine (Phase 3, og spec only)
│   └── asset-ledger.mjs              ← license-gate extension (image/icon assets) + attribution-doc auto-generation (Phase 3)
├── tests/                            ← automated tests (272 as of 2026-08-18)
├── .PRD/                             ← this kit's authoritative design docs (most detailed source of truth)
├── CHECKPOINT.md                     ← the next tasks to pick up (for developers; not tracked in git)
├── README.md / README.en.md          ← this document
└── package.json
```

### What appears inside the target project (where code gets generated)
Running `/sodam-design-kit:setup` inside your **target project** creates exactly one new folder, `.design-kit/`:
```
(target project)/.design-kit/
├── config.json               ← settings like viewport sizes and retry count (deletable — `setup` recreates it)
├── component-map.json        ← the mapping between components and Figma nodes (deleting this loses your mapping — be careful)
├── product-pages.json        ← 1 detail-page template + the list of product data locations (Phase 3, /sodam-design-kit:detail-page)
├── runs/*.json                ← run records (the machine-readable source of the verdict) — meant to be committed to git
├── reports/*.md                ← human-readable reports — meant to be committed to git
└── reports/screenshots/       ← verification screenshots — only the most recent 10 runs are kept automatically (older ones are auto-deleted)
```
> The list above is representative (Phase 2 also added `fonts/`, `ASSET-LEDGER.csv`, `.api-token`, `.lock`, `.dashboard.json`, `reports/baseline/`, etc. — [`.PRD/02_DATA_MODEL.md`](./.PRD/02_DATA_MODEL.md) is the authoritative source).
> **Safe to delete**: `reports/screenshots/` (regenerated automatically). **Do not delete**: `component-map.json` (recreating it means reading Figma again, and the free Figma plan only allows 6 reads a month — see [Section 10](#10-security--data-flow)).

---

## 10. Security & Data Flow

**No exaggeration — just the facts.**

- **What leaves your computer**: read requests to Figma's servers (using your own Figma login, for only the design pages you specify). Nothing else is sent to any server by this kit. Login credentials (tokens, etc.) are never stored by the kit's own code — it reuses whatever Figma connector/official MCP login is already set up in Claude Code.
- **What stays local (on your computer only)**: the generated code, and everything inside `.design-kit/` — settings, mappings, run records, and screenshots. All of it lives only on your local disk and is never transmitted anywhere.
- **Figma image URLs expire after 7 days**: URLs Figma returns for images/icons are temporary and break after 7 days. This kit is designed to download them locally right away instead of embedding the temporary URL directly in generated code.
- **Figma free-plan read limits**: if your own Figma account is on the free (Starter/View) plan, you get only **6 reads per month** (paid Dev/Full plans get 200–600 per day). This kit is designed to save what it reads into `component-map.json` and reuse it, to conserve that limit.
- **No personal data or real customer data allowed**: this kit's rules (the "Do Not" list in [`.PRD/04_PROJECT_SPEC.md`](./.PRD/04_PROJECT_SPEC.md)) prohibit connecting Figma files or product data that contain personal information or real customer data. Only dummy/sample data should be used, for both designs and product data.
- **How external commands are run**: when running things like the dev server, this kit only spawns processes with an argument array — it never concatenates strings into a shell command (which would risk command injection).
- **The dashboard (`/open`) is only reachable from your own computer**: it's bound to `127.0.0.1` (an address meaning "this computer, and only this computer"), so no one else can reach it over the internet. Path-traversal protection, rejection of malformed requests, and a lock that blocks concurrent access are all implemented, and each was confirmed by actually simulating an attack against it.
- **No sensitive data in reports**: reports and run records are designed — and automated-tested — to never contain secrets (passwords, tokens) or absolute paths from your computer.
- **No API keys (currently)**: the current version needs no separate API keys or environment variables. If a future feature adds paid image-generation APIs (later in Phase 3, still just a plan), those will be managed exclusively through a `.env` file.

---

## 11. Troubleshooting

| Symptom | Cause | Fix | Success looks like |
|---|---|---|---|
| Installed, but `/sodam-design-kit:setup` doesn't show up | Claude Code is still using a cached, stale view of installed plugins | **Fully close and reopen** Claude Code (not a refresh — a complete restart) | The command appears in autocomplete when typing `/` |
| "Completion has been blocked" appears | **This is expected behavior.** The verification gate detected a `FAIL` and is deliberately preventing a report of "done" | Open the latest report in `.design-kit/reports/` to see why it failed → retry, or investigate manually | The report clearly states a specific reason for failure |
| `FAIL` keeps repeating | The problem may not be fixable by the automatic retries (max 3) | Read the failure reason in the report (accessibility violations, console errors) yourself. `gateEnabled` should only ever be changed by you, directly, in `.design-kit/config.json` | A retry turns into `PASS`, or you've identified the root cause |
| Figma won't connect, or reads seem insufficient | The connector login may have expired, or you may need the official MCP | Check the connector's login status → switch to the official remote MCP (`mcp.figma.com/mcp`) if needed | A Figma read request returns results normally |
| A `.fig` file saved on my computer won't open | The Figma connector/MCP can only read files **saved to a Figma account** — it cannot read local files directly | Open that file in the Figma desktop app to save it to your account, then use its share link | The share link reads successfully |
| It says shadcn or Playwright (the verification browser) isn't installed | The target project lacks shadcn/ui, or `npm install` wasn't run in this kit's own repo | If it's shadcn, follow the prompt asking whether to run `npx shadcn init`; if it's Playwright, re-run `npm install` inside this kit's repository folder | The command runs normally after the prompted install finishes |
| A message about a port conflict flashes by during verification | Another program is already using that port | **No action needed** — this kit is designed to automatically find and use the next available port | Verification proceeds without any manual intervention |
| On Windows, passing an option like `--route /...` (starting with `/`) produces a strange result | A Git Bash (MSYS) environment quirk mangles values starting with `/` into file paths (not a defect in this kit's code — a note for developers) | Use PowerShell instead | Verification returns a correct result |
| Korean text (or other non-Latin text) renders as broken boxes (□) | The project doesn't have a Korean font set up yet | Ask a developer to run the `font-pipeline` feature (auto-sets up Pretendard, etc.) — regular users only need to follow the normal setup/pipeline flow | Text displays correctly |
| The dashboard (`/open`) won't start, or the page is blank | Another instance is already running, or `npm install` was never run in this kit's own repo | Run `/sodam-design-kit:open --stop` once to shut it down, then start it again. If that doesn't help, re-run `npm install` | The browser correctly shows your list of reports |
| I'm not used to typing commands | Totally understandable if computers or chat-style tools are new to you | Read the [glossary in Section 0](#0-before-you-start-key-terms-in-5-minutes) first, then follow [Section 4, Quick Start](#4-quick-start-first-success-in-5-minutes) one line at a time, exactly as written | Each step's stated "success looks like" outcome appears as described |

---

## 12. FAQ

**Q. Can I use this if I don't know how to code at all?**
A. Running the commands themselves only requires knowing a few slash commands (`/sodam-design-kit:setup`, `/sodam-design-kit:pipeline`, etc.). That said, the "target project" (Next.js + Tailwind + shadcn/ui) needs to already exist. Everything else can be requested from the AI in plain language.

**Q. I'm genuinely new to computers, messaging apps, and AI — can I still get started?**
A. Read the [glossary in Section 0](#0-before-you-start-key-terms-in-5-minutes) first, then follow [Section 4, Quick Start](#4-quick-start-first-success-in-5-minutes) exactly as written. Being honest, though: this is a developer tool, so parts of it (installing Node.js, using a terminal) still require some basic computer familiarity — it will go a lot more smoothly with someone nearby who can help, rather than going it alone with zero technical background, especially for setting up the target project mentioned in prerequisite #3.

**Q. Do I need a paid Figma plan?**
A. No, the free (Starter) plan works. It's limited to 6 reads per month (see [Section 10](#10-security--data-flow)). This kit is built to cache what it reads and reuse it, so you can still run the pipeline multiple times within that limit.

**Q. If verification fails (FAIL), does that mean my code is broken?**
A. Not necessarily. It could be an accessibility rule violation, a console error, a rendering failure, or something else — and the report will state the specific reason. A failure is also evidence that this kit is checking things correctly.

**Q. Can I edit the generated code myself?**
A. Yes — the generated code becomes a regular file in your own project, and you're free to modify it. Re-running the pipeline will re-verify it.

**Q. Can I use this commercially, or share/redistribute it?**
A. **Yes, under the terms of the Apache License 2.0** (finalized 2026-08-09) — you must include a copy of the license, mark any changed files, and preserve the original copyright notice. The license does not, however, grant rights to the "SoDam-Design-Kit" name or trademark itself. Please read [Section 13](#13-legal-copyright-license--commercial-use) carefully.

**Q. Can I sell, or deliver to a client, things this kit produces (like a detail page)?**
A. This kit's own license doesn't stop you from doing that. But the **copyright of the original Figma design**, **the source of any product data**, and **the legal status of AI-generated code/copy** are separate questions from this kit's license, and are entirely your own responsibility — each is explained in detail in [Section 13](#13-legal-copyright-license--commercial-use).

**Q. Does this work on Windows/Mac/Linux?**
A. This kit is built with Node.js scripts, so in principle it should run on all three. However, the environment it has actually been thoroughly built and tested on so far is **Windows**. Real-world verification on Mac/Linux has not yet been performed.

**Q. Is this a stable, finished release?**
A. No. The current version is **0.1.0 (pre-release)**. The core features (Phase 1, Phase 2, and the first Phase 3 feature) have all been round-trip verified against a real project, but command names and finer details may still change. Before relying on it for something important, check [CHECKPOINT.md](./CHECKPOINT.md) and [Section 7](#7-update-summary) for the latest status.

---

## 13. Legal, Copyright, License & Commercial Use

> ⚠️ **Read this summary first**: this kit itself **can** be used commercially and redistributed (Apache License 2.0). But legal responsibility for what you *produce* with this kit — code, copy, images — is a separate matter, and is **entirely your own responsibility**. This section is **not legal advice and carries no legal guarantee.** Anything not yet finalized is clearly marked "undecided" below. For commercial use, redistribution, or any decision requiring legal judgment, please consult a qualified attorney.

### License for SoDam-Design-Kit itself — **Apache License 2.0 (finalized 2026-08-09)**
- **Current status (confirmed fact)**: a `LICENSE` file (full text of Apache License 2.0) exists at the repository root. The copyright holder is **SoDam AI Studio**, year 2026.
- **What this means**: Apache License 2.0 is a permissive license that allows use, copying, modification, redistribution, and commercial use of the code and documentation. It requires that you include a copy of the license, mark any modified files as changed, and preserve the original copyright/patent/trademark notices (see Section 4 of the license text). **Rights to the "SoDam-Design-Kit" name or trademark are not granted by this license** (see Section 6 of the license text — the trademark clause).
- No separate NOTICE file is included (this is a new work with no upstream NOTICE to carry forward).
- **No warranty, limited liability (license text, Sections 7–8)**: this kit is provided "AS IS," with no guarantee of fitness for a particular purpose or freedom from defects. The creator is not liable for any damages (direct, indirect, special, or incidental) arising from its use.

### Things you must not do (strict standard — clearly prohibited)
- ❌ Redistributing under the **"SoDam-Design-Kit" name or logo as if it were your own creation** (the license permits using the code, but does not grant naming or trademark rights)
- ❌ **Removing or hiding** the copyright/license notices or the `LICENSE` file when redistributing
- ❌ Redistributing modified files **without marking that they were changed**, as if they were the unmodified original
- ❌ Reading and commercially using someone else's Figma design **without proper authorization** (copyright in the original design belongs to whoever created it, entirely independent of this kit)
- ❌ Connecting Figma files or product data that contain personal information or real customer data to this kit (see [Section 10](#10-security--data-flow))

### Licenses of open-source components used internally — confirmed by direct inspection
Separately from this kit's own license, the open-source libraries it uses internally for verification are governed by their own respective licenses, and **this kit uses them unmodified, as installed dependencies only.**

| Component | License | Purpose |
|---|---|---|
| Playwright / playwright-core | Apache License 2.0 (confirmed by direct inspection) | Launches an automated browser to check rendering |
| axe-core / @axe-core/playwright | Mozilla Public License 2.0 (confirmed by direct inspection) | Automated accessibility checking |
| pixelmatch | ISC License (confirmed by direct inspection) | Pixel-level image comparison for automatic visual-change detection |
| pngjs | MIT License (confirmed by direct inspection) | PNG image read/write for automatic visual-change detection |
| satori | Mozilla Public License 2.0 (confirmed by direct inspection) | Renders marketing-image text layout (e.g. OG images) to SVG (Phase 3) |
| sharp | Apache License 2.0 (confirmed by direct inspection) | Converts marketing-image SVG output to PNG (Phase 3) |

These licenses are granted independently by their respective projects and are unrelated to this kit's own license. If you want to use these components directly yourself, check their original license text.

### Licenses of fonts this kit downloads automatically
The "Korean font automation" feature described in [Section 7](#7-update-summary) only auto-downloads fonts from a pre-approved whitelist under the open-source **OFL (SIL Open Font License)** — currently Pretendard and Noto Sans KR. OFL permits modifying, redistributing, and commercially using the font, but **prohibits selling the font file itself as a standalone product**. The license basis for each downloaded font is automatically recorded in the target project's `ASSET-LEDGER.csv`.

### Responsibility for Figma design data
This kit only reads designs you personally have access to, through your own Figma account, and never redistributes, stores, or transmits Figma design data itself elsewhere. However, **whether you have the right (copyright) to turn a given design into code is entirely your own responsibility** — copyright in the original design belongs to whoever created it (or their organization), and this kit does not verify or guarantee that relationship on your behalf.

### Responsibility for product data and AI-written copy (Phase 3, `/sodam-design-kit:detail-page`)
The detail-page copy this feature produces (titles, descriptions, FAQs, etc.) is written by an AI, based on the product data you provide as input. **This kit does not judge the factual accuracy of that product information, whether the copy is exaggerated, or whether it complies with advertising/labeling laws in your jurisdiction. Before publishing any such copy commercially, you must personally fact-check and review it.**

### Responsibility for AI-generated code and copy
The code and copy this kit generates are produced by Claude (an AI). **Copyright attribution and the scope of protection for AI-generated works is an area where legal interpretation still varies by country and remains unsettled.** Before using generated code or copy commercially, please seek expert confirmation at your own responsibility if needed. This kit and its documentation provide no legal guarantee regarding this.

### Summary table (Apache License 2.0 standard)

| Action | Currently allowed? |
|---|---|
| Personal use by the creator | ✅ Allowed |
| Modifying the code for solo/internal team use | ✅ Allowed |
| Distributing/copying this kit itself to a third party | ✅ Allowed — must include license copy + mark changes |
| Selling a paid service/product built on this kit | ✅ Allowed — same conditions apply |
| Delivering this kit to a company/client | ✅ Allowed — same conditions apply |
| Distributing under the "SoDam-Design-Kit" name/trademark as-is | ❌ Prohibited — the license permits code use but does not grant naming/trademark rights |
| Removing copyright/license notices and redistributing | ❌ Prohibited (license violation) |
| Using code/copy **generated by** this kit in your own project or product | ✅ Allowed — but confirming the source Figma design's copyright and the factual accuracy of product information is your responsibility |
| Taking someone else's Figma design without authorization and using it commercially | ❌ Regardless of this kit's license, this can infringe the original designer's rights (your responsibility) |
| Using the open-source components this kit relies on (Playwright, axe-core, pixelmatch, pngjs, satori, sharp) directly, on your own | ✅ Allowed, under each project's own license (Apache-2.0 / MPL-2.0 / ISC / MIT) |
| Reselling a font this kit auto-downloads (e.g. Pretendard) as a standalone font product | ❌ Prohibited (violates the OFL license) |

**No warranty, limited liability**: this kit and its documentation are provided "as-is," with no guarantee of fitness for a particular purpose or freedom from defects. All outcomes from using it are your own responsibility.

---

## Appendix: Full Design Documentation

More detailed specifications, decision rationale, and development history than this document covers live in [`.PRD/`](./.PRD):
- [`01_PRD.md`](./.PRD/01_PRD.md) — what's being built and why; UI/UX, security, legal, documentation, and success criteria
- [`02_DATA_MODEL.md`](./.PRD/02_DATA_MODEL.md) — data structures (file schemas such as config.json)
- [`03_PHASES.md`](./.PRD/03_PHASES.md) — the phased (1/2/3) development plan and current progress
- [`04_PROJECT_SPEC.md`](./.PRD/04_PROJECT_SPEC.md) — tech stack, absolute rules (do-not / always-do)
- [`.PRD/README.md`](./.PRD/README.md) — the full audit log of the development process
- [`CHECKPOINT.md`](./CHECKPOINT.md) — the list of tasks to pick up next (for developers)
