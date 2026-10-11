# SoDam-Design-Kit

A Claude Code design-automation kit that turns Figma designs into shadcn/ui code — and **will not call the work "done" unless it passes real-browser verification (Playwright + axe-core + 3 viewport sizes).**

[한국어 (Korean)](./README.md) | [English (current document)](./README.en.md)

> ✅ **Current status (as of 2026-10-12, confirmed by running it directly)**: **Phase 1 (MVP)** and **Phase 2 (dashboard, automatic visual-change detection, Korean font automation)** are officially complete, and **Phase 3 (advanced) is also complete through the detail-page pipeline, AI-generation history logging, marketing-image generation (OG/poster/banner/business-card), the license-gate extension, and a Claude Desktop MCP extension (verification-history browsing)** (only beta-release timing remains, a user decision). The automated tests all pass — **361** for the officially published v0.5.0, and **374** for the current working copy, which also contains 2 fixes that are not published yet. There are **0 known security vulnerabilities** (`npm audit` was re-run on 2026-10-12; the 4 found on 2026-09-11 and the 5 newly reported on 2026-10-11 were all patched). The licenses of all packages including transitive dependencies were re-tallied on 2026-10-12: **153 entries in `package-lock.json`**, with zero strong copyleft (GPL/AGPL) — see [Section 13](#13-legal-copyright-license--commercial-use). There are **5 commands** in total (`setup`, `pipeline`, `open`, `detail-page`, `marketing-asset`), and every one of them has been round-trip verified (PASS) against a real project. See [Section 7](#7-update-summary) for the full history.
>
> ⚠️ This kit is still **version 0.5.0 (pre-release, actively under development)**. Command names, behavior, and file structure may still change — this document will be updated whenever they do.
>
> 📌 **How to read this document**: anything marked "(unpublished)" is a fix that is in the code at the time of writing but is **not** in the officially published version (v0.5.0) you can download from GitHub. Where the published version and the current working copy differ, it is marked that way.

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
| **Command / slash command** | A pre-defined instruction that starts with `/` (a "slash"). If you've ever used a `/`-prefixed command in a chat app like Discord or Slack (e.g. `/remind`), it's the exact same idea. This kit uses 5 such commands, e.g. `/sodam-design-kit:setup`. |
| **Plugin** | An "add-on bundle" you attach to an existing program (here, Claude Code). It's similar to installing a new app on your phone — this kit itself is one such plugin. |
| **Marketplace** | A list where plugins are gathered so you can pick and install them by name (like an app store). This kit has a small marketplace named `sodam`, and the `sodam-design-kit` plugin lives inside it. |
| **Dependency** | **Helper programs made by other people** that this kit needs in order to work (for example Playwright, which controls the browser). They are not bundled inside the kit; they are downloaded from the internet at install time. Which ones there are, and the terms each is licensed under, are in [Section 13](#13-legal-copyright-license--commercial-use). |
| **Copy (installed copy)** | When you install a plugin, Claude Code **copies the original into its own private folder and runs that copy**. So if you later edit the original or download a new version, the copy stays as it was until you update ([Section 3](#3-download--installation)). |
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
- The check result (pass/fail) is recorded as a "report", and **once a failure (FAIL) is recorded**, the system (a hook) mechanically blocks any report of "done" (it doesn't help if the AI pretends not to have seen the failure or tries to trick its way past it). There is one limitation, though: this mechanism cannot stop the case where verification was never run at all — the exact conditions are written in [Section 8](#8-workflow).

```
Figma design ──▶ Code generation ──▶ Real-browser check ──▶ Only then: "done"
```

**Why a tool like this exists**: if you simply tell an AI "build this to match the design," the AI can generate code and then say "all done." But whether that code **actually renders correctly on screen, doesn't have broken text, and works for screen-reader users** might just be something the AI *claimed* was true, without anyone actually checking. This kit forces that final check to be done mechanically by a **real browser program**, not just asserted in words — so "it said it worked, but it actually didn't" is greatly reduced (only when verification was actually run; see the limitation above).

**Who this is for**: Anyone who designs in Figma and uses Claude Code to turn that design into code (the same person can do both) — especially anyone uneasy about "the AI says it made the code, but did anyone actually check it renders?"

**Who this is *not* for (an honest limitation)**: this is not a tool that builds an entire website from scratch for someone with zero coding background. What it generates is **individual screen pieces** inside a project that already exists (Next.js + Tailwind + shadcn/ui) — [Section 2](#2-prerequisites--required-software-with-download-instructions) explains this requirement in detail.

---

## 2. Prerequisites & Required Software (with download instructions)

All 5 of the following must be ready. If even one is missing, you cannot proceed to Section 3 (Installation).

| # | Requirement | Why it's needed | Download / Check |
|---|---|---|---|
| 1 | **Claude Code** | This kit is itself a Claude Code "plugin" — it cannot run without Claude Code | Install per the official guide at [claude.com/claude-code](https://claude.com/claude-code). After installing, type `claude --version` in a terminal — if a version appears, you're set (the install and update steps in this document were verified by running them directly on **version 2.1.296**) |
| 2 | **Node.js 20.9 or newer** (the current LTS is recommended) | Every verification script in this kit is written in Node.js (a JavaScript runtime). **Why the minimum is 20.9**: `sharp`, the component this kit uses for image processing, requires Node 20.9 or newer (confirmed directly from the value written in `package-lock.json`). An earlier version of this document said "18 or newer", which was incorrect guidance | Download the "LTS" version from [nodejs.org](https://nodejs.org). After installing, type `node -v` in a terminal (the command-input window) — if a number of `v20.9.0` or higher appears, you're set (the PC on which the steps in this document were last verified runs v26.7.0) |
| 3 | **Target project**: Next.js + Tailwind CSS + shadcn/ui | The code this kit generates assumes exactly this combination (other frameworks are not yet supported) | You need a project already built with this stack. If you don't have one, create one with `npx create-next-app@latest` (official Next.js method) and follow the [official shadcn/ui install guide](https://ui.shadcn.com/docs/installation) |
| 4 | **Figma file access** | The original design you're porting to code must live in Figma | Use the **Figma connector** already linked to claude.ai, or log in via the official **Figma MCP** (`https://mcp.figma.com/mcp`). A free (Starter) Figma plan works, but has a **limit on the number of reads** (when this was first written, the measured value was 6 per month; it has since been confirmed that Figma's official documentation now states a different figure — check Figma's official guidance for the exact current limit. See [Section 10](#10-security--data-flow) below) |
| 5 | **Internet connection · about 1GB of free storage** | At install time, the dependencies and the browser files used for verification have to be downloaded | Values measured directly on this development PC: the installed kit copy is **about 76MB** (of which the dependencies in `node_modules` are 75MB) + the verification browser (Chromium) is **about 690MB** (415 + 269 + 3MB). Each time the kit version is raised a new copy is created (the old version folder stays), so the total grows slowly. Sizes may differ by PC and version. For when you need **Git**, see "Method A" in [Section 3](#3-download--installation) |

> **Not sure what a term means?** Check the [glossary in Section 0](#0-before-you-start-key-terms-in-5-minutes) first. In particular, if "terminal" is unfamiliar: it's a text-based window where you type commands instead of clicking. Once Claude Code is installed, the window you type commands into *is* the terminal — nothing extra to install.

> **Don't have prerequisite #3 yet?**: this kit assumes there's already a "somewhat-built website project" to work with. It isn't designed for "build me a whole website from nothing." If you don't have such a project yet, you can ask Claude Code in plain language to set one up first (e.g., "create an empty Next.js + Tailwind + shadcn/ui project for me").

---

## 3. Download & Installation

> ✅ The install and update commands in this section were **run directly on Windows + Claude Code 2.1.296 on 2026-10-12**, and the results were checked. The test was done in a **throwaway temporary settings folder** so as not to touch the everyday configuration, and it reproduced a first-time install from a clean state. Limitations: ① The step of downloading the verification browser files (about 690MB) from the internet for the first time could not be reproduced from scratch, because they were already installed on this PC (only that the command finishes without error was confirmed). ② The PC used for testing was logged in to GitHub — this repository is public (PUBLIC), so in principle no login is needed, but this could not be confirmed on a PC that is not logged in. ③ macOS and Linux were not tested.

### Three things to know first (behavior confirmed by direct testing)

1. **Installing creates a "copy".** When you install a plugin, Claude Code copies the original into its own private folder and runs that **copy**. The location is `plugins\cache\sodam\sodam-design-kit\<version>` inside the Claude settings folder (the settings folder is usually `C:\Users\<your name>\.claude`; it differs on PCs where the location has been changed). So even if you edit the original folder or download a new version, **the copy stays as it was until you run the "How to update" steps below**. (An earlier version of this document said "no copy is created", which was an incorrect description.)
2. **Dependencies are installed automatically.** When installed from a clean state, Claude Code installed the dependencies (Playwright, axe-core, sharp, etc.) inside the copy on its own. So **you do not need to type `npm install` yourself.** However, if you use it **right after** installing or updating, the dependencies may still be getting ready — if the first command fails with a dependency-related error, wait 1–2 minutes and run it again (the exact time it takes was not measured).
3. **The verification browser is not installed automatically.** The browser (Chromium) in which this kit actually opens the screen has to be downloaded separately, once — that is **step 4** of the method below. If you skip it, verification fails with an `Executable doesn't exist ...` error ([Section 11](#11-troubleshooting)).

### Method A (recommended) — install directly from the GitHub address (without downloading the repository separately)

> **What you need**: [Git](https://git-scm.com/downloads) (Claude Code downloads it using Git internally).

1. **Register the marketplace** — type this in the Claude Code chat window:
   ```
   /plugin marketplace add sodam-ai/SoDam-Design-Kit
   ```
   (You can also use the full address `https://github.com/sodam-ai/SoDam-Design-Kit.git`. Both were confirmed to succeed on 2026-10-12. To do the same thing from a terminal: `claude plugin marketplace add sodam-ai/SoDam-Design-Kit`.)

2. **Install the plugin**:
   ```
   /plugin install sodam-design-kit@sodam
   ```

3. **Fully restart Claude Code** — close the window completely and reopen it. It must be a **full quit and restart**, not a refresh (the first item of [Section 11](#11-troubleshooting)).

4. **Install the verification browser (once only)** — type this in a terminal (PowerShell on Windows):
   ```
   npx playwright@1.61.1 install chromium
   ```
   > The number `1.61.1` is the Playwright version used by the officially published v0.5.0 (the value written in this kit's `package-lock.json`). **This number may change when the kit version changes**, so if verification later fails with `Executable doesn't exist`, follow the command shown on that error screen (`npx playwright install`), or ask Claude Code to "install the Playwright browser for me". If you download a browser of a different version, this kit will not be able to find it.

5. **Verify the install** — type this inside the **target project** (prerequisite #3 in Section 2, the project you are porting code into):
   ```
   /sodam-design-kit:setup
   ```
   If the command appears in the autocomplete list and runs, you're set. You can also check by typing `claude plugin list` in a terminal and seeing that the `Status` of `sodam-design-kit@sodam` shows `enabled`.

### Method B — install from a folder on your computer (for developers who edit the code)

1. Download the repository: `git clone https://github.com/sodam-ai/SoDam-Design-Kit.git`
2. Give marketplace registration the **full path of the folder** (e.g. `/plugin marketplace add D:\MyFolder\SoDam-Design-Kit`).
3. The rest is the same as steps 2–5 of Method A (`/plugin install sodam-design-kit@sodam` → full restart → install the browser → verify).
4. This method also **creates a copy** (confirmed the same way as in Method A). If you edited the code in the original folder, be sure to **commit it first** and then run the "How to update" steps below — whether uncommitted edits are reflected in the copy was not confirmed.
5. To run this kit's automated tests (`npm test`), or to run the scripts directly without the plugin, you need to run `npm ci` (or `npm install`) once **inside that folder**. It is not needed when you use the kit only as a plugin.

### How to update (when a new version is out)

Type the following two lines into a terminal, one after the other (this is the order confirmed by actually upgrading from 0.5.0 to 0.5.1 on 2026-10-12):
```
claude plugin marketplace update sodam
claude plugin update sodam-design-kit@sodam
```
→ If "Restart to apply changes" appears, you must **fully restart Claude Code** for the new version to take effect. Check it with the `Version` column of `claude plugin list`. The new version folder is created separately as `plugins\cache\...\<new version>`, and **the old version folder stays as it is** (within the scope where it was confirmed that this does not affect operation).

> **Important**: If you do not update, the Claude Code you normally use **keeps running the old version's copy.** For example, even if a new safeguard has been added to this kit, it does not apply until you update.

### How do you know the install didn't work?
If you type up to `/sod` in the chat window and nothing appears in the autocomplete list, the install (or the restart) is not complete. See the first item of [Section 11](#11-troubleshooting).

### Section 3 addendum — Want verification history in Claude Desktop too? (optional, added 2026-08-20)

> The steps 1-5 above are for **Claude Code** (the terminal-style chat) only. If you also want **Claude Desktop** (the regular desktop app) to show this kit's verification history, reports, and screenshots, and let you trigger re-verification, you can install an additional extension below — the two are separate apps, and this extension is optional.

1. First download the repository as in Method B (above) and run `npm ci` once in that folder (because the extension file bundles the dependencies from this folder's `node_modules` — confirmed directly on 2026-10-12 by opening the inside of a freshly built `.mcpb` and seeing `node_modules` in it). Then generate the extension file (`.mcpb`) with the following command (terminal, inside this repository folder):
   ```
   npx @anthropic-ai/mcpb pack .
   ```
   A `.mcpb` file named after this repository folder appears in the folder (it was just created, so you can find it right there). It's about 20MB (the file built with v0.5.0 is 20.3MB — larger than most extensions because it includes real-browser re-verification. It used to be about 70MB because unrelated files were accidentally bundled in; that's been fixed by excluding unnecessary files, which brought it down to the current size. On 2026-10-12 the inside of the file was opened again, and it was re-confirmed that it contains no development notes, session state, or design documents).
2. **Double-click** the generated `.mcpb` file. If all goes well, Claude Desktop shows an install screen — review the details and approve.

   > **Did double-clicking instead open a Windows "How do you want to open this file?" dialog?** That's not an install failure — it just means this computer has no file association for `.mcpb` yet (this can happen even if Claude Desktop is already installed — confirmed by hands-on testing on 2026-09-01). Click **Cancel** on that dialog and install this way instead:
   > 1. Open Claude Desktop, then the `☰` menu (top left) → **Settings** (Ctrl+,)
   > 2. Click **"Extensions"** in the left sidebar
   > 3. Click **"Advanced settings"** at the bottom of the page
   > 4. Under "Extension developer," click the leftmost of the 4 buttons: **"Install Extension"**
   > 5. In the file picker, choose the `.mcpb` file you just created
   > 6. When the confirmation screen appears (name/description, the 5 tool names, "All requirements met," maker "SoDam AI Studio," license Apache-2.0, version), click **Install**

3. **Success looks like (either of these confirms it)**:
   - Asking Claude Desktop something like "show me the recent verification history" and seeing it call this kit's tool (`list_runs`, etc.).
   - Or: Settings → **"Developer"** → **"Local MCP servers"** shows `SoDam Design Kit` with a **`running`** badge.

**What this extension can and can't do (honest disclosure)**:
- Can: browse verification history, view reports/screenshots, trigger re-verification — the same data as the `/sodam-design-kit:open` dashboard in Claude Code. **(added 2026-08-20)** It can also re-wire a component that's already registered in `component-map.json` back into the verification preview page (it does not read Figma or write new code — it only reuses an existing mapping).
- Can't: **mechanically block completion**. That's a Claude Code hook-only feature. Claude Desktop only shows the re-verify result (PASS/FAIL); it won't forcibly stop work on a FAIL. It also **won't write real code for a new component into your project on Claude Desktop's behalf** — that was intentionally left out this round because it would let unverified code enter the project silently.
- The re-verify feature of this extension runs a real browser (Playwright) internally. The extension file contains the dependencies (the Playwright program itself) but **does not contain the browser files (Chromium, about 690MB)** — you must run the command from [step 4 of Method A](#method-a-recommended--install-directly-from-the-github-address-without-downloading-the-repository-separately) above (`npx playwright@1.61.1 install chromium`) once on your PC for re-verification to work. (Browsing the verification history, and viewing reports and screenshots, work without the browser — only re-verification needs it.)

---

## 4. Quick Start (first success in 5 minutes)

Once prerequisites and installation are done (**including installing the verification browser — step 4 of Method A in Section 3**), here's the fastest path to seeing a real result. If you haven't downloaded the browser yet, step 2 fails with an `Executable doesn't exist` error.

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
- **What it does**: reads `components.json` (shadcn's own config) to locate your actual component folder, scans the `.tsx` files inside it, and writes `.design-kit/component-map.json`. It also creates `.design-kit/config.json` (default settings — 3 viewport sizes, 3 auto-retries, etc.). **Worth knowing (confirmed from the code)**: this `config.json` is currently just **default values for the record**, and no program reads these values to change its behavior. The 3 viewport sizes (360 · 768 · 1440px) are fixed in the code, so editing this file does not change how the checks work.
- **How it behaves**: run it **once** per project. If a config already exists it's skipped automatically; add `--force` to rescan (existing Figma mappings are preserved, and only newly found components are added).
- **Success looks like**: a completion message + a new `.design-kit/` folder.

### `/sodam-design-kit:pipeline` — design → code → verification
- **Input**: a Figma share link (a direct page/node link, not a whole-file link — see [Section 10](#10-security--data-flow))
- **What it does**: reads Figma → records the mapping in `component-map.json` → generates shadcn/ui code → auto-creates a preview route (`/design-kit-preview/{component}`) → auto-starts a dev server → runs real-browser verification (Playwright + axe-core + 3 viewports) → writes the report.
- **How it behaves**: on `FAIL`, the AI reads the failure reason in the report, fixes the code, and verifies again. The limit of 3 retries is something the **procedure document (`commands/pipeline.md`) instructs the AI to do**; the program does not enforce the count. Also, the rule "two consecutive failures are required to finalize a FAIL" **is not in the code** — in reality, **if the single most recent report record is a FAIL, completion is blocked immediately** ([Section 8](#8-workflow)). The standard verification command also includes a TypeScript type check (`--typeCheck`) (for projects that have a `tsconfig.json`). **Both the "reuse an already-mapped component" path and the "generate a brand-new component from scratch" path have been verified end-to-end (PASS).** Before placing a newly generated component, it automatically checks for hardcoded style values (e.g. `#ff0000`) and refuses to place the file if it finds any.
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

### `/sodam-design-kit:marketing-asset` — marketing image (OG · poster · banner · business card) generation (Phase 3)
- **Input**: a title (required) + a subtitle (optional); business cards also accept extra lines (company, phone, email, etc., optional)
- **What it does**: automatically renders one of 4 formats — OG (1200×630, social-share) · poster (1080×1350, Instagram-portrait) · banner (1200×400, wide) · business card (1050×600, real print standard at 3.5×2 inches). If the result fails the dimension/format/size checks, no file is written at all.
- **How it behaves**: reuses the Korean font (Pretendard) already set up by the font pipeline so text never renders as broken boxes, and automatically records the generated image in the AI-generation history (`AI-GENERATION-LOG.md`).
- **Success looks like**: a file appears at `public/design-kit-assets/<format>-<title>.png`. Other formats (SNS cards, etc.) aren't supported yet.

### P1 Completion Verification Procedure (for the project maintainer)

> This is not something you do on every regular use — it's the **final check that the kit actually works the same way from a brand-new session, from scratch** ([`.PRD/01_PRD.md`](./.PRD/01_PRD.md) §9, Success Criteria 5 and 6). Follow these steps in a new Claude Code session, and this document alone is enough to reproduce it.

1. **Pick a target project** — ideally one that has already run `/sodam-design-kit:setup` and already has a Figma mapping (so no fresh Figma call is needed, and the free plan's monthly read limit isn't touched).
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
| `/sodam-design-kit:marketing-asset` | Title/subtitle (+extra info for business cards) → auto-generates OG/poster/banner/business-card images (Phase 3) | title (required) · subtitle (optional) · business-card extra info (optional) | inside the target project (`public/design-kit-assets/`) | ✅ all 4 formats verified PASS (Korean rendering, dimensions confirmed) |

Commands for kit developers only (end users don't need these):

| Command | Description | Run from |
|---|---|---|
| `npm ci` (or `npm install`) | Installs the dependencies (Playwright, axe-core, etc.) — **not needed when you use the kit only as a plugin** (Section 3); only needed when you run the automated tests or the scripts directly. The **browser files used for verification are not installed by this command** (`npx playwright install chromium` is needed separately) | this kit's own repository folder |
| `npm test` | Runs the kit's own automated tests (as of 2026-10-12: 361 for the officially published v0.5.0, and 374 for the working copy that includes the unpublished fixes — the count may grow) | this kit's own repository folder |
| `node scripts/e2e-selftest.mjs --fixture <path to a test project>` | Full self-check of the round-trip pipeline (PASS/FAIL/recheck). You must pass, via `--fixture`, **a separate Next.js test project to be verified** (run without a path, it only prints the usage and exits), and that test project is not included in this repository (first-time users can skip this). `npm run selftest` in `package.json` is shorthand for the same command, so you must pass arguments like `npm run selftest -- --fixture <path>` | this kit's own repository folder |

### Verification options (5 optional features) — switches that add checks on top of the basic check

The basic verification covers 4 things: "does the screen render · are there no console errors · are there no accessibility violations (critical/serious) · do screenshots exist at all 3 viewport sizes". The options below are switches that **add more checks** on top of that, and you append them to the end of the verification-runner (`scripts/verify-runner.mjs`) command. The slash commands `pipeline` and `detail-page` run with only `--typeCheck` attached as standard, and the other 4 are **off by default** (a design so that existing projects don't suddenly flip to FAIL without warning). To turn one on, ask Claude Code something like "verify with the font check turned on too", or append it yourself in a terminal.

| Option | What it does when on | When it FAILs | Worth knowing |
|---|---|---|---|
| `--typeCheck` | Runs the TypeScript type check (`tsc --noEmit`) before the screen verification | When there is a type error, or when the check could not be run (it is not silently passed) | You must also pass `--project` (without it, the run is refused). Errors in files inside `.next/`, which the dev server creates, are excluded. Without this option, a type error still gives PASS as long as the screen renders (confirmed by a direct experiment) |
| `--fontGate` | Checks that the font files found in the project are registered in `.design-kit/ASSET-LEDGER.csv` (the asset ledger) | When there is a font file that is not in the ledger | Pretendard and the like, downloaded automatically by this kit, are already registered and are not flagged |
| `--assetGate` | Checks image and icon files for ledger registration in the same way | When there is an image that is not in the ledger | `public/design-kit-assets/` (marketing-image output) and `.design-kit/` (verification screenshots) are excluded from the check. The source-attribution document `.design-kit/ATTRIBUTION.md` is generated from the ledger by a command separate from this option: `node scripts/asset-ledger.mjs --project <target project> --generateAttribution` |
| `--visualRegression` | Compares the current screen, pixel by pixel, against a baseline screen that a person has approved as "this screen is correct" | When it differs from the baseline screen (an image showing the difference is generated) | If there is no approved baseline screen yet, the comparison is skipped (not a FAIL) |
| `--promoteBaseline` | Approves the current screen as the new **baseline screen** | (This option does not produce a FAIL) | **Only screens whose verification is PASS** are approved, and a person must explicitly ask for it. There is no path that approves automatically |

Example (PowerShell; `<kit folder>` is the folder downloaded with Method B in Section 3, or the installed copy folder):
```powershell
node "<kit folder>\scripts\verify-runner.mjs" --project "<target project folder>" --route /design-kit-preview/button --target "Button check" --typeCheck --fontGate
```
- **"Re-verify" (the dashboard button, and re-verification in Claude Desktop) inherits the options that were turned on in the original run, as they were.** `--typeCheck` has done so since the officially published v0.5.0, while `--fontGate`, `--assetGate`, and `--visualRegression` are **(unpublished)**. In the time before they were inherited, there was a bypass: if you "re-verified" a record that had FAILed on an option check, it came out PASS with the files unchanged, which lifted the completion block; it was closed after being reproduced and confirmed directly. When re-verifying, visual regression **only compares** and does not approve a baseline screen.
- `--screenshotDir` (where screenshots are saved) accepts only paths inside `.design-kit/`. A value that goes outside with `..` (e.g. `../../elsewhere`) is refused with an error (exit code 2) without creating anything **(unpublished)** — previously, giving such a value had a defect where screenshots were saved outside the project.

---

## 7. Update Summary

> The items below are collapsible "toggles" — click a heading (the line starting with ▶) to expand it. The most recent entry is at the top.

<details open>
<summary><b>▶ 2026-10-12 — (unpublished) "Re-verify" now inherits every option check + screenshot save-path escape blocked + install guidance corrected (click to collapse)</b></summary>

- **Status note**: items ① and ② below are in the code and the automated tests pass, but at the time of writing they are **not yet merged or released on GitHub**, so they are **not in** the officially published version (v0.5.0) that you can download from GitHub. Item ③ is a correction of this README itself.
- **① Closed the other 3 re-verification bypasses**: the v0.5.0 entry right below closed the "re-verify" bypass only for records that had FAILed on `--typeCheck`. The same hole existed for `--fontGate`, `--assetGate` and `--visualRegression` as well (re-verifying a record that had FAILed on an option gave PASS with the files unchanged — the font and asset options were reproduced and confirmed directly, and visual regression has the same structure so it was fixed together). Now the options turned on in the original run are kept in the record, and re-verification inherits them. Visual regression **only compares** against the baseline screen, and approving a baseline screen is still kept so that a person must explicitly ask for it.
- **② Closed a defect where the screenshot save path leaked outside the project**: it was directly reproduced that pointing outside with `..`, as in `--screenshotDir ../../ESCAPED`, saved the screenshots outside the project and still finished as a success (exit code 0). Now anything not inside `.design-kit/` is refused before anything is created (exit code 2), and the `\` separator and look-alike sibling folders such as `.design-kit-evil` are blocked too. A `..` that stays inside `.design-kit/` (e.g. `reports/../shots/x`) is not blocked.
- **③ README corrections**: that installing creates a copy and the dependencies are installed automatically (the previous document said the opposite), that the minimum Node version is 20.9, not 18, that the verification browser has to be downloaded separately (the previous document had no such step), how to update, that the retry count and the "2 consecutive failures" rule are not in the code, that no program reads the `config.json` values, the verification-options table, the re-tally of the license package count (153), and the removal of broken links that pointed to files not in the repository.
- **Automated tests**: 361 → 374 (13 added, 1 new test file), all passing, `npm audit` 0. No new dependencies added.
- **Honest limits**: for ①, **no end-to-end check against a real project** — going through a real dev server, font scan and baseline-screen comparison — has been done yet (only the automated tests that swap in fake components were confirmed), and even after merge and release, it takes effect in the Claude Code you normally use only after you do the [update in Section 3](#3-download--installation).

</details>

<details>
<summary><b>▶ 2026-10-11 — Release v0.5.0 — type check added to the standard procedure, and a re-verification bypass closed (click to expand)</b></summary>

- The optional `--typeCheck` check added last time was not part of the actual commands in the standard procedure, so it never ran in the normal flow. The standard verification commands of `pipeline` and `detail-page` now include `--typeCheck` (TypeScript projects with a `tsconfig.json`).
- Added guidance for the case where a type error is outside the display files (data, auth, storage or API logic files): the AI must not edit those files just to get the check to pass — it **stops immediately and reports to you**. If the check itself cannot run (no `tsconfig.json`/typescript, timeout), it also stops and reports the cause instead of retrying.
- A hands-on experiment found and closed a bypass: re-running a run that had failed with `--typeCheck` through the dashboard 're-verify' button or the MCP `reverify` tool gave PASS with the file unchanged, which unblocked completion. Re-verification now inherits the original run's type-check setting (before the fix PASS → after the fix FAIL; restoring the file gives PASS again, no false alarm).
- This release is the first to ship the 5 security-vulnerability patches (sharp, the MCP SDK, etc.) and the MCP version-reporting fix that landed after the previous release (v0.4.1). To get them into the Claude Desktop extension (`.mcpb`) and the installed plugin you must rebuild and reinstall (full restart).
- All 361 automated tests pass, `npm audit` reports 0, and the real-screen verification (normal/error verdicts and completion blocking) was re-checked.
- Not done yet as of this release: the visual-regression, font and asset optional flags are not inherited by re-verification (→ solved in the 2026-10-12 entry right above, unpublished). Lint and build are still not checked.

</details>

<details>
<summary><b>▶ 2026-10-11 — Added optional --typeCheck so type errors can fail the gate (click to expand)</b></summary>

- In a hands-on experiment, deliberately putting a type error into a file used by a page still gave PASS from the existing verification — only the type checker (`tsc --noEmit`) failed. That is because the dev server renders pages even when they contain type errors.
- Added an optional `--typeCheck` flag to `verify-runner.mjs`. It is off by default (so existing projects that already have type errors do not suddenly flip to FAIL). When on, type errors produce FAIL, and so does being unable to run the check (it never passes silently). Errors in files under `.next/` (generated by the dev server) are excluded. Using it without `--project` is rejected.
- Lint (code style check) and build are still not run by the gate.
- Verified on a real project in 3 cases: a deliberately injected error → FAIL, a leftover pre-existing error → FAIL, a clean state → PASS. All 350 automated tests pass.

</details>

<details>
<summary><b>▶ 2026-10-11 — Patched 5 security vulnerabilities + fixed MCP version reporting (click to collapse)</b></summary>

- Re-running `npm audit` (the command that checks installed packages for known security problems) reported 5 new issues (1 critical, 2 high, 2 moderate). The kit's own code is unchanged; the list of known vulnerabilities was updated.
- Three of the five come from indirect packages that the MCP (Claude Desktop connection) library pulls in; the other two are the image-processing package (sharp) and the MCP library itself, both installed directly. Per the "fix high or above immediately" rule, all were upgraded. The direct dependency list (`package.json`) is unchanged — only the lock file (`package-lock.json`) changed.
- The Claude Desktop extension (MCP) was reporting its own version as `0.3.0`; it now follows the `package.json` version (currently 0.4.1). One automated test was added.
- All 334 automated tests pass, `npm audit` shows 0 vulnerabilities, and the live screen verification (PASS/FAIL verdicts and completion blocking) plus a real MCP connection were re-checked.
- This is not yet reflected in the already-built `.mcpb` file or the installed plugin (they must be rebuilt and reinstalled).

</details>

<details>
<summary><b>▶ 2026-09-11 — Patch release v0.4.1 (version housekeeping, click to collapse)</b></summary>

- The two entries right below (longer verification wait time, 4 security fixes) landed after the last tagged release (v0.4.0), and the tag/GitHub Release hadn't caught up with them.
- No code or docs changed here — just bumping the version number 0.4.0 -> 0.4.1 and publishing it as a new GitHub Release (a patch version — this folds already-made fixes into an official release, it's not a new feature).
- All 333 automated tests still pass.

</details>

<details>
<summary><b>▶ 2026-09-11 — Fixed a false "verification failed" right after a cold start (click to expand)</b></summary>

- If you'd just turned on your computer, or hadn't run this kit in a while, the very first verification could take a bit longer than usual to get the preview page ready — but the kit only waited 30 seconds before deciding the page "wasn't ready" and marking the whole verification a failure.
- Reproduced this twice (today and in the prior session): running the exact same command again, right after, always succeeded immediately. So this wasn't the kit being broken — it just wasn't waiting long enough.
- Fixed by raising the wait time from 30 to 60 seconds. The pass/fail judging logic itself was not touched. All 333 automated tests still pass.
- Also added this symptom and its fix to [Section 11, Troubleshooting](#11-troubleshooting).

</details>

<details>
<summary><b>▶ 2026-09-11 — Found and immediately fixed 4 security vulnerabilities in bundled dependencies + version 0.4.0 (click to expand)</b></summary>

- Re-running `npm audit` (a command that checks installed packages against known security-vulnerability databases) turned up 4 new issues (2 high, 2 moderate) in packages this kit never installed directly but that came bundled in with others. The kit's own code hadn't changed — the vulnerability records were simply published in the meantime.
- One of them (the image-processing library `sharp`) is actually used to inspect images downloaded from Figma, so it was fixed right away with a **one-step version bump** (0.35.3 → 0.35.4). The other three were transitive dependencies of the Claude Desktop extension's SDK, pulled in for a connection method this kit doesn't actually use — real-world risk was minimal, but they were bumped to their latest patched versions as well.
- After the fix, all 333 automated tests still pass, and a full live re-run (PASS/FAIL verdicts and completion blocking) confirmed nothing broke. No new packages were added — only existing ones were bumped, so behavior is unchanged.
- Since the last release (0.3.0, August 19) went out, the 3 additional marketing-image formats, the extended license gate, AI-generation-history logging, the Claude Desktop extension, and now this security fix have all landed without a version bump — so the version is now **0.4.0**.

</details>

<details>
<summary><b>▶ 2026-08-21 — Hardened repo security, audited every dependency license, fixed a data-leak bug in the packaged extension (click to expand)</b></summary>

- Found that 3 GitHub repository security features (secret detection, push blocking, and outdated-dependency alerts) had been off for over a week on this public repo, and turned them on.
- Until now only the 8 packages installed directly had their licenses checked. This time we checked all 126 packages, including everything those 8 pull in indirectly. Nothing concerning turned up, but we discovered that a native component bundled inside the image-conversion library (sharp) carries a different kind of license (LGPL) — documented honestly in [Section 13](#13-legal-copyright-license--commercial-use) (there is no legal problem).
- **A real bug we found**: when building the Claude Desktop extension file (`.mcpb`), it should only contain the code needed to run — but by mistake, internal development-only files (like `CHECKPOINT.md`) and an unrelated large test file were being bundled in as well. Fixed the root cause immediately; the extension file shrank from about 70MB to **about 20MB**, and confirmed the problem files are no longer included.
- The automated test count stays at 330 (this round was documentation and repo-configuration only), and all 330 still pass. No new dependencies were added.

</details>

<details>
<summary><b>▶ 2026-08-20 — Fixed designs with photos/icons breaking after 7 days (click to expand)</b></summary>

- When a Figma design contains a photo or icon and gets turned into code, this kit used to put that image's temporary URL directly into the generated code. That URL is one **Figma deletes after 7 days**, so the picture would suddenly vanish from the page once time passed.
- This risk had been written down in the docs from the very start, but nothing actually enforced it — it relied purely on "remembering to handle it carefully." Re-auditing the docs surfaced that gap and it's now fixed.
- From now on, when a screen with images is generated, those images are automatically downloaded into your project folder, and the code points at the saved local file instead — the picture won't disappear after 7 days anymore.
- Safety checks were added too: a file is only saved once it's confirmed to be a real image, and icon files (SVG) are rejected if they contain anything that looks like hidden malicious code.
- Added 15 new automated tests (314 → 329), all passing. No new dependencies were added.

</details>

<details>
<summary><b>▶ 2026-08-20 — Added "re-wire component preview" to the Claude Desktop extension (click to expand)</b></summary>

- One more capability was added to the Claude Desktop extension (introduced in the entry right below): re-wiring a component that's already registered in `component-map.json` back into the verification preview page.
- Designing this surfaced something important, confirmed by reading the code directly: "read a Figma design and write new code automatically" and "wire an already-existing component into a preview" turned out to be completely different risk levels. The former (actually writing new code into the project) has no mechanism on Claude Desktop enforcing "not done until verification passes" — so unverified code could silently end up in the project.
- So only the safe half (wiring an existing component into a preview) was added this round; the risky half (writing new code into the project) was intentionally left out.
- Added 6 new automated tests (308 → 314), all passing. No new dependencies were added (this fully reuses existing functionality).
- Confirmed end-to-end against a real test project: "wire component into preview → re-verify" round-trips correctly.

</details>

<details>
<summary><b>▶ 2026-08-20 — Re-checking the newest features turned up 2 problems, both fixed (click to expand)</b></summary>

- While re-checking the two features right below (the Claude Desktop extension, the new marketing-image formats) carefully once more, 2 real problems were found and fixed.
- ① In the Claude Desktop extension, if the "which project" value was sent as empty by mistake, instead of reporting an error it silently treated the extension's own install location as the target. Now an empty value is rejected immediately with a clear error.
- ② When generating a business-card image, if the "extra info" (company, phone number, etc.) was passed in the wrong shape, instead of an error it silently produced a broken image where each letter was drawn on its own separate line, and only much later, at an unrelated step, did a confusing error finally appear. Now the wrong shape is rejected immediately with a clear error.
- Beyond these two, re-checking turned up no other new problems (path manipulation, unusually long input, and other malformed values were all confirmed to still be handled safely as before).
- Added 4 new automated tests (305 → 308), all passing. No new features or commands were added — this was purely hardening existing ones.

</details>

<details>
<summary><b>▶ 2026-08-20 — Added a Claude Desktop extension (MCP): browse verification history + re-verify (click to expand)</b></summary>

- Until now this kit could only be used from Claude Code (the terminal-style chat). Now Claude Desktop (the regular desktop app) can also browse verification history, reports, and screenshots, and trigger re-verification, via an extension (`.mcpb` file).
- An important discovery came up during design — the original plan was "reuse the existing dashboard (a web server) as-is," but checking the official documentation directly showed that this kind of Claude Desktop extension doesn't work as a web server at all; it works a completely different way (Claude Desktop runs the program directly and talks to it). So instead of "sharing a server," the design was reworked to the simpler "reuse the functions that already exist."
- Honest disclosure: this extension only goes as far as "showing the verification result" — it does not have the feature that forcibly stops work on failure, the way Claude Code does (that's a Claude Code-only capability, technically unavailable from other programs). This fact is spelled out directly in the tool descriptions themselves.
- Added 16 new automated tests (289 → 305), all passing. Two new dependencies (the official MCP toolkit and an input-validation library), `npm audit` still 0.
- The next piece (generating code directly from Figma data) was intentionally left out this round — this round only covers "browse verification history and re-verify," built solidly first.

</details>

<details>
<summary><b>▶ 2026-08-20 — Added poster/banner/business-card formats to marketing images (click to expand)</b></summary>

- Previously only one format (OG, 1200×630, social-share) could be generated. Now poster (1080×1350, Instagram-portrait) · banner (1200×400, wide) · business card (1050×600, real print size) are also available.
- A business card needs more than a name and title — company, phone, email, etc. — so a new `--extraLines` option was added to include extra lines of information.
- The earlier OG-image feature had already warned that verifying one format doesn't prove the others work, so each of the 3 new formats was actually generated and visually checked by eye (no clipped text, no broken Korean characters).
- Added 10 new automated tests (279 → 289), all passing. No new dependencies (`npm audit` still 0).

</details>

<details>
<summary><b>▶ 2026-08-18 — License gate extended: image/icon assets now scanned too (click to expand)</b></summary>

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
  │   ┌───── FAIL ─────┐   │  The AI reads the reason,          │
  │   │ Reporting       │◀──┤  fixes it, re-verifies             │
  │   │ "done" is       │   │  (recommended max 3 — per docs)    │
  │   │ blocked by the  │   │                             │
  │   │ hook            │   │                             │
  │   └───────────────┘   │                             │
```

The key point is the final fork: **once a verification result is recorded as FAIL, `hooks/verify-gate.mjs` mechanically prevents the word "done"** — even if the AI pretends not to have seen the FAIL, or tries to cut corners.

**Exactly under what conditions this block triggers** (confirmed from the code in `hooks/verify-gate.mjs`):
- It blocks **if the single most recent run record in `.design-kit/runs/` is a FAIL**. There is no condition like "2 consecutive failures" — one FAIL blocks for as long as that record is the newest. It is lifted once a new PASS record is created afterward.
- It also blocks if the run-record folder cannot be read, or if the most recent record file is corrupted (the cause is reported separately).
- It does not block if the `.design-kit/runs/` folder itself does not exist, or has no records at all (so as not to get in the way in projects that don't use this kit). **That means this hook cannot stop someone from saying "done" without running verification at all.** What covers that case is the procedure document (`commands/pipeline.md`) and the "no completion report without a PASS report" instruction in `AGENTS.md`, and that is an **instruction for the AI to follow, not mechanical enforcement.** So, before trusting the word "done", we recommend getting into the habit of opening `.design-kit/reports/` yourself to check that the latest PASS report is there.
- The hook only looks at `.design-kit/runs/` in the **folder where Claude Code is open**. If you open Claude Code and work in some folder other than the target project, it cannot see that project's FAIL records.
- This hook is **Claude Code only**. It does not exist in the Claude Desktop extension or other tools, so there the result is only shown and nothing is blocked (see the [Section 3 addendum](#section-3-addendum--want-verification-history-in-claude-desktop-too-optional-added-2026-08-20)).

---

## 9. Architecture & File/Document Locations

### This kit's own repository structure
```
SoDam-Design-Kit/                     ← this kit's repository (where this README lives)
├── .claude-plugin/
│   ├── plugin.json                   ← plugin manifest (name, version)
│   └── marketplace.json              ← marketplace registration (marketplace name: sodam)
├── manifest.json                     ← Claude Desktop extension (.mcpb) manifest — a separate file from plugin.json (Phase 3)
├── commands/
│   ├── setup.md                      ← the actual definition of /sodam-design-kit:setup
│   ├── pipeline.md                   ← the actual definition of /sodam-design-kit:pipeline
│   ├── open.md                       ← the actual definition of /sodam-design-kit:open
│   ├── detail-page.md                ← the actual definition of /sodam-design-kit:detail-page (Phase 3)
│   └── marketing-asset.md            ← the actual definition of /sodam-design-kit:marketing-asset (Phase 3, og/poster/banner/business-card)
├── hooks/
│   └── verify-gate.mjs               ← completion-blocking logic (blocks on FAIL)
├── skills/
│   └── design-pipeline/SKILL.md      ← a skill file that tells Claude Code "when to use this kit" (on words like Figma or design) and the core rules
├── scripts/                          ← the actual engine, all Node.js (as of 2026-10-12: 17 actual files in the `scripts/` folder + 1 screen (UI) folder)
│   ├── setup-wizard.mjs
│   ├── pipeline-codegen.mjs
│   ├── detail-page-pipeline.mjs      ← detail-page pipeline engine (Phase 3)
│   ├── preview-route.mjs
│   ├── verify-runner.mjs             ← verification runner (dev-server startup · render · accessibility · 3 viewports · 5 optional options)
│   ├── typecheck-gate.mjs            ← type-check option (--typeCheck) engine
│   ├── execution-lock.mjs            ← a lock that keeps verification from running twice at the same time in the same project
│   ├── dashboard-server.mjs          ← /open dashboard server (127.0.0.1 only) + re-verify feature
│   ├── dashboard-web/                ← the dashboard screen (index.html · dashboard.js)
│   ├── e2e-selftest.mjs              ← full round-trip self-check (needs a test-project path)
│   ├── report-writer.mjs
│   ├── asset-downloader.mjs          ← Figma image/icon auto-download engine (fixes the 7-day expiring URL problem)
│   ├── font-pipeline.mjs             ← automatic Korean font download/setup engine
│   ├── visual-regression.mjs         ← automatic visual-change detection engine
│   ├── ai-generation-log.mjs         ← AI-generation history logging engine (Phase 3)
│   ├── marketing-asset-pipeline.mjs  ← marketing image auto-generation engine (Phase 3, og/poster/banner/business-card)
│   ├── asset-ledger.mjs              ← license-gate extension (image/icon assets) + attribution-doc auto-generation (Phase 3)
│   └── mcp-server.mjs                ← Claude Desktop extension engine — verification-history browsing + re-verify (Phase 3)
├── tests/                            ← automated tests (as of 2026-10-12: 361 for the officially published v0.5.0, 374 for the working copy that includes the unpublished fixes)
├── .PRD/                             ← this kit's authoritative design docs (most detailed source of truth)
├── AGENTS.md                         ← a summary of the rules for tools outside Claude Code, such as Codex
├── LICENSE                           ← the full text of the Apache License 2.0
├── .mcpbignore                       ← the list of files to leave out when building the Claude Desktop extension file (prevents internal notes from leaking)
├── README.md / README.en.md          ← this document (Korean/English, Markdown)
├── README.html / README.en.html      ← the same content as a web page (open it in a browser)
├── package.json / package-lock.json  ← the dependency list, with exact versions pinned
└── (not in the repository) CHECKPOINT.md      ← the developer's personal work notes. It is intentionally not pushed to GitHub (a local-only file), so it is not in the folder you download
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
> The list above is representative (Phase 2 also added `fonts/`, `ASSET-LEDGER.csv`, `.api-token`, `.lock`, `.dashboard.json`, `reports/baseline/`, etc., and Phase 3 added `AI-GENERATION-LOG.md`, `ATTRIBUTION.md`, etc. — [`.PRD/02_DATA_MODEL.md`](./.PRD/02_DATA_MODEL.md) is the authoritative source). Marketing images are saved in the target project's `public/design-kit-assets/`.
>
> **Remember that on your computer these two places exist separately**: ① the "this kit's repository" structure above is the same as the original you get from GitHub, and ② what actually runs is the **copy** that Claude Code made (`<Claude settings folder>\plugins\cache\sodam\sodam-design-kit\<version>`) ([Section 3](#3-download--installation)). The verification results (`.design-kit/`) pile up in the **target project folder**, not in the copy.
> **Safe to delete**: `reports/screenshots/` (regenerated automatically). **Do not delete**: `component-map.json` (recreating it means reading Figma again, and the free Figma plan has a monthly limit on the number of reads — see [Section 10](#10-security--data-flow)).

---

## 10. Security & Data Flow

**No exaggeration — just the facts.**

- **Every case in which this kit communicates externally is listed here** (confirmed on 2026-10-12 by searching the kit's entire code for network calls):
  1. **Claude Code ↔ Anthropic servers (not something this kit's code sends, but Claude Code's own default behavior)**: because this kit runs inside Claude Code, exactly as in normal Claude Code use, **the conversation content, the files the AI reads, and part of the Figma design data are sent to Anthropic's servers**. For how that is handled, check Anthropic's official guidance. So do not leave files containing personal information or real customer data within what the AI can read.
  2. **Figma servers**: it reads only the design pages you specify, using your own Figma login. Login credentials (tokens, etc.) are never stored by the kit's own code — it reuses whatever Figma connector/official MCP login is already set up in Claude Code.
  3. **At install time only**: the plugin is downloaded from GitHub, the dependencies from the npm registry, and the verification browser (Chromium) from the Playwright distribution server ([Section 3](#3-download--installation)).
  4. **Only when you use the automatic Korean font setup feature**: it downloads only from addresses on an allowlist fixed in the code (the Pretendard v1.3.9 and Noto Sans KR fonts, and each license file, on `raw.githubusercontent.com`). Fonts not on the list are refused.
  5. **Only when you use the Figma image/icon download feature**: it downloads only from the `https://` address that Figma provides (`http://` is refused, nothing is saved if the address changes to `http://` partway through, and files over 10MB or that are not images are not saved).
  6. Beyond the above, **there is no code in this kit that sends usage statistics, remote logs, error reports, or the like** (confirmed by searching the entire code for related words and network calls).
  7. **⚠️ The dev server that is briefly opened during verification is NOT "this computer only" (measured directly on 2026-10-12)**: when this kit starts the dev server it asks for it to open only on `127.0.0.1` (this computer itself), but when it was actually brought up the same way and checked, the server was **accepting connections on all network addresses (`::`)**. That means that for the several tens of seconds that verification is running, there is a **possibility** that another device on the same network can connect to that temporary screen (the code of the screen being built, development information). Whether the Windows firewall blocks this could not be confirmed. **To be safe, do not run verification on an untrusted network such as a cafe or public Wi-Fi.** (This is an item that should be passed on to the developers as an improvement task — it has not been fixed yet.) By contrast, the `/sodam-design-kit:open` dashboard is, per the code, opened only on `127.0.0.1`.
- **What stays local (on your computer only)**: the generated code, and everything inside `.design-kit/` — settings, mappings, run records, and screenshots. All of it lives only on your local disk and is never transmitted anywhere.
- **Figma image URLs expire after 7 days**: URLs Figma returns for images/icons are temporary and break after 7 days. This kit is designed to download them locally right away instead of embedding the temporary URL directly in generated code.
- **Figma free-plan read limits (the figure has changed before, and I could not pin down the exact current value)**: if your own Figma account is on the free (Starter/View) plan, there is a **monthly limit** on the number of Figma reads. The value confirmed directly when this kit was built was **6 per month** (paid Dev/Full plans get 200–600 per day), and when Figma's official documentation was checked again on 2026-09-01, it was found that this figure **is now stated as 20 per month** (though I could not confirm whether that figure is exactly the one that applies to my account's conditions). So this document guarantees only that it is "very low, somewhere between 6 and 20 per month" — **check Figma's official guidance directly for the exact limit.** This kit is designed to save what it reads into `component-map.json` and reuse it, to conserve that limit.
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
| `FAIL` keeps repeating | The problem may not be fixable by the AI's retries (up to 3 recommended) | Read the failure reason in the report (accessibility violations, console errors) yourself. **Trying to turn the gate off by changing the `gateEnabled` value in `.design-kit/config.json` does not work** — no program reads that value (confirmed from the code). Don't try to turn the gate off; fix the reason for the FAIL | A retry turns into `PASS`, or you've identified the root cause |
| Figma won't connect, or reads seem insufficient | The connector login may have expired, or you may need the official MCP | Check the connector's login status → switch to the official remote MCP (`mcp.figma.com/mcp`) if needed | A Figma read request returns results normally |
| A `.fig` file saved on my computer won't open | The Figma connector/MCP can only read files **saved to a Figma account** — it cannot read local files directly | Open that file in the Figma desktop app to save it to your account, then use its share link | The share link reads successfully |
| It says shadcn/ui isn't installed | The target project doesn't have shadcn/ui | Follow the prompt asking whether to run `npx shadcn init` | The command runs normally after the prompted install finishes |
| Verification fails with `browserType.launch: Executable doesn't exist at ...chromium_headless_shell...`, and below it says "Looks like Playwright was just installed or updated. Please run the following command to download new browsers" | **The verification browser (Chromium) files are not on this computer yet** (this is the actual error text, reproduced as-is on 2026-10-12 by emptying the browser path). The dependencies are installed automatically, but the browser is not downloaded automatically | Run `npx playwright@1.61.1 install chromium` in a terminal ([step 4 of Method A in Section 3](#method-a-recommended--install-directly-from-the-github-address-without-downloading-the-repository-separately)). The `npx playwright install` that the error screen suggests serves the same purpose | The same verification command proceeds all the way to a PASS/FAIL verdict without error |
| A "cannot find package" error such as `Cannot find package 'playwright'` appears | You may have just installed or updated, and the dependencies may still be installing automatically | Wait 1–2 minutes and run the same command again. If it persists, check the version with `claude plugin list`, and check that the installed copy folder (see the end of [Section 9](#9-architecture--filedocument-locations)) has a `node_modules` folder. Recovery when it is missing (running `npm ci` in that folder) is a general measure and **has not been tried directly with this kit** | The same command runs without a dependency error |
| A message about a port conflict flashes by during verification | Another program is already using that port | **No action needed** — this kit is designed to automatically find and use the next available port | Verification proceeds without any manual intervention |
| On Windows, passing an option like `--route /...` (starting with `/`) produces a strange result | A Git Bash (MSYS) environment quirk mangles values starting with `/` into file paths (not a defect in this kit's code — a note for developers) | Use PowerShell instead | Verification returns a correct result |
| Korean text (or other non-Latin text) renders as broken boxes (□) | The project doesn't have a Korean font set up yet | Ask a developer to run the `font-pipeline` feature (auto-sets up Pretendard, etc.) — regular users only need to follow the normal setup/pipeline flow | Text displays correctly |
| The dashboard (`/open`) won't start, or the page is blank | Another instance is already running, or you just installed or updated and the dependency installation hasn't finished yet | Run `/sodam-design-kit:open --stop` once to shut it down, then start it again. If that doesn't help, run it again after 1–2 minutes (see the "cannot find package" item right above) | The browser correctly shows your list of reports |
| Double-clicking the `.mcpb` file in Claude Desktop opens a "How do you want to open this file?" window instead | This computer has no file association for `.mcpb` (unrelated to whether Claude Desktop itself is installed) | Click **Cancel** in that window → Claude Desktop Settings → **Extensions** → **Advanced settings** → **Install Extension** button, and pick the file directly (see the Section 3 addendum) | The confirmation screen shows the 5 tools and "All requirements met," and after install, Settings → Developer → Local MCP servers shows a `running` badge |
| I'm not used to typing commands | Totally understandable if computers or chat-style tools are new to you | Read the [glossary in Section 0](#0-before-you-start-key-terms-in-5-minutes) first, then follow [Section 4, Quick Start](#4-quick-start-first-success-in-5-minutes) one line at a time, exactly as written | Each step's stated "success looks like" outcome appears as described |
| Verification fails with "dev server did not become ready within N ms" | Your computer just started, or hasn't run this kit in a while, so the very first page takes longer than usual to get ready (not a real failure) | Just run the same command again — the second time is normally fast, since everything is already warmed up | Re-running proceeds normally to a PASS/FAIL verdict |
| A new version is out, but the Claude Code I normally use still behaves like the old one | What is installed is a **copy**, so the old version keeps running until you update ([Section 3](#3-download--installation)) | Run `claude plugin marketplace update sodam` → `claude plugin update sodam-design-kit@sodam` in a terminal, then **fully restart** Claude Code | The `Version` in `claude plugin list` changes to the new version |
| Registering the marketplace fails with a `Filename too long` error | The Windows path-length limit. Reproduced directly on 2026-10-12 in the case where **the Claude settings folder has been moved to a very long path** (it did not occur in a normal install during testing) | It was confirmed that shortening the Claude settings folder path makes the same command succeed | The message `Successfully added marketplace: sodam` |
| `/plugin marketplace add sodam-ai/SoDam-Design-Kit` fails | Git may not be installed, or GitHub may be unreachable (**not tested directly on a PC without Git**) | Install [Git](https://git-scm.com/downloads) or check your internet connection, then try again. If that doesn't work, install with [Method B](#method-b--install-from-a-folder-on-your-computer-for-developers-who-edit-the-code) | The message `Successfully added marketplace: sodam` |

---

## 12. FAQ

**Q. Can I use this if I don't know how to code at all?**
A. Running the commands themselves only requires knowing a few slash commands (`/sodam-design-kit:setup`, `/sodam-design-kit:pipeline`, etc.). That said, the "target project" (Next.js + Tailwind + shadcn/ui) needs to already exist. Everything else can be requested from the AI in plain language.

**Q. I'm genuinely new to computers, messaging apps, and AI — can I still get started?**
A. Read the [glossary in Section 0](#0-before-you-start-key-terms-in-5-minutes) first, then follow [Section 4, Quick Start](#4-quick-start-first-success-in-5-minutes) exactly as written. Being honest, though: this is a developer tool, so parts of it (installing Node.js, using a terminal) still require some basic computer familiarity — it will go a lot more smoothly with someone nearby who can help, rather than going it alone with zero technical background, especially for setting up the target project mentioned in prerequisite #3.

**Q. Do I need a paid Figma plan?**
A. No, the free (Starter) plan works. It does have a limit that allows only a very small number of reads per month (the value confirmed directly when this was first written was 6 per month, and the official documentation's figure has since changed to 20 per month — check Figma for the exact current value) (see [Section 10](#10-security--data-flow)). This kit is built to cache what it reads and reuse it, so you can still run the pipeline multiple times within that limit.

**Q. If verification fails (FAIL), does that mean my code is broken?**
A. Not necessarily. It could be an accessibility rule violation, a console error, a rendering failure, or something else — and the report will state the specific reason. A failure is also evidence that this kit is checking things correctly.

**Q. Can I edit the generated code myself?**
A. Yes — the generated code becomes a regular file in your own project, and you're free to modify it. Re-running the pipeline will re-verify it.

**Q. Can I use this commercially, or share/redistribute it?**
A. **Yes, under the terms of the Apache License 2.0** (finalized 2026-08-09) — you must include a copy of the license, mark any changed files, and preserve the original copyright notice. The license does not, however, grant rights to the "SoDam-Design-Kit" name or trademark itself. Please read [Section 13](#13-legal-copyright-license--commercial-use) carefully.

**Q. Can I sell, or deliver to a client, things this kit produces (like a detail page)?**
A. This kit's own license doesn't stop you from doing that. But the **copyright of the original Figma design**, **the source of any product data**, and **the legal status of AI-generated code/copy** are separate questions from this kit's license, and are entirely your own responsibility — each is explained in detail in [Section 13](#13-legal-copyright-license--commercial-use).

**Q. Does this work on Windows/Mac/Linux?**
A. This kit is built with Node.js scripts, so in principle it should run on all three. However, the environment it has actually been thoroughly built and tested on so far is **Windows**. Real-world verification on Mac/Linux has not yet been performed. The manifest (`manifest.json`) of the Claude Desktop extension (`.mcpb`) states **only Windows and macOS** as supported operating systems and does not include Linux. Node.js must be **20.9 or newer** on any operating system ([Section 2](#2-prerequisites--required-software-with-download-instructions)).

**Q. Is this a stable, finished release?**
A. No. The current version is **0.5.0 (pre-release)**. The core features (Phase 1, Phase 2, and most of Phase 3) have all been round-trip verified against a real project, but command names and finer details may still change. Before relying on it for something important, check [Section 7](#7-update-summary) and GitHub's [Releases page](https://github.com/sodam-ai/SoDam-Design-Kit/releases) for the latest status.

**Q. How do I get a new version? Does it update automatically?**
A. Within the scope confirmed at the time of writing, **I could not confirm that it changes automatically.** What is installed is a copy, so you have to run the two lines under ["How to update" in Section 3](#3-download--installation) (`claude plugin marketplace update sodam` → `claude plugin update sodam-design-kit@sodam`) and **fully restart** Claude Code.

**Q. Are my designs and code sent externally?**
A. This kit's code does not send usage statistics or remote logs (confirmed by searching the entire code). However, **Claude Code itself sending the conversation content, the files the AI reads, and Figma data to Anthropic's servers** happens separately from this kit. It was also confirmed that the dev server briefly opened during verification was in a state where it could be reached from other devices on the same network — please be sure to read [Section 10](#10-security--data-flow) for the details and the caution.

**Q. Can I use it with other AI tools such as Codex?**
A. Only partly. `AGENTS.md` is a summary document meant to make other tools follow this kit's core rules. However, the `/sodam-design-kit:...` slash commands and the **hook that "blocks completion on FAIL" are Claude Code only**, so they do not work in other tools. This kit's scripts are ordinary Node programs, so in theory they can be run from a terminal in other tools too, but **this document has no record of having actually tried them in other tools.** If you use it with such a tool, a person must open the verification result (the latest report in `.design-kit/reports/`) directly and confirm the PASS.

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
| @modelcontextprotocol/sdk | MIT License (confirmed by direct inspection) | Official SDK for the Claude Desktop extension (MCP) (Phase 3) |
| zod | MIT License (confirmed by direct inspection) | Input validation for MCP tools (Phase 3) |

These licenses are granted independently by their respective projects and are unrelated to this kit's own license. If you want to use these components directly yourself, check their original license text.

### Re-tally of the licenses of all packages, including transitive dependencies (2026-10-12)
The table above only covers the 8 packages this kit installs directly (their licenses were checked again on 2026-10-12 against the `license` field in `package-lock.json` and confirmed to match the table). Counting the transitive dependencies those 8 pull in, **`package-lock.json` records 153 packages** (the 2026-08-21 audit found 126; the number has grown since, as dependencies were updated). This time, without a separate scanner, the `license` field of **all 153 was tallied with a script**.

| License | Package count |
|---|---|
| MIT | 106 |
| Apache-2.0 | 16 |
| LGPL-3.0-or-later | 10 |
| ISC | 10 |
| MPL-2.0 | 3 |
| Apache-2.0 AND LGPL-3.0-or-later | 3 |
| BSD-3-Clause | 2 |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 |
| BSD-2-Clause | 1 |
| 0BSD | 1 |
| **Total** | **153** |

- **Packages with no `license` field**: 0 · **Strong copyleft licenses (GPL, AGPL, etc.)**: 0.
- **The number actually installed on your computer is smaller than this**: 29 of the 153 are "optional per-operating-system" dependencies, so even though the builds for every operating system are listed, only the ones matching your own operating system are installed on your computer.
- **A finding noted separately because it needs attention — the 14 that include LGPL-3.0-or-later**: all of them are native components that the image-processing dependency `sharp` brings in per operating system (the 10 `@img/sharp-libvips-*` are for macOS and Linux, the 3 `@img/sharp-win32-*` are for Windows, and 1 is `@img/sharp-wasm32`). Only 1–2 of them are installed on your computer (on 64-bit Windows, `@img/sharp-win32-x64`). This is because they bundle a library called `libvips`. **Because this kit does not modify them and uses them only as installed dependencies**, this falls under the common way of using them in which LGPL does not spread to the kit as a whole (this is an explanation for reference and carries no legal guarantee).
- **3 are MPL-2.0** (`axe-core`, `@axe-core/playwright`, `satori`): "file-level" copyleft. This kit uses them unmodified, but **if you modify the files of these components yourself and distribute them, you must publish the source of the modified files under MPL-2.0**.
- **These components are bundled whole inside the installed copy and the `.mcpb` file.** When the inside of the `.mcpb` was opened on 2026-10-12, it contained 128 `LICENSE`-type files. You **must not delete or obscure these files (especially the `LICENSE` of the LGPL and MPL components above) when redistributing.**

### Programs not included in this kit that you download separately (each one's own license and terms apply)
- **Chromium browser**: the roughly 690MB of browser files that Playwright downloads with the step 4 command in Section 3. **They are not files of this kit**, and they follow the licenses of the Chromium project and of each third-party component inside it. Check that project's official guidance for the exact terms (this document does not vouch for those terms on its behalf).
- **Node.js, Git, Claude Code, Claude Desktop, Figma (the service)**: each one's own license or terms of service applies. In particular, Claude Code and Figma have **terms of service**, and complying with them is the user's responsibility; this kit does not vouch for them.

### Trademark notice
Names such as Figma, Claude, Claude Code, Anthropic, shadcn/ui, Next.js, Tailwind CSS, Playwright, Node.js, and GitHub are trademarks or service names of their respective owners. This document uses the names only to explain which tools this kit is used with; it does not claim any affiliation with, endorsement by, or sponsorship from those companies.

### Where the license is stated (a part that is easy to confuse)
The **authoritative statement of this kit's license is the `LICENSE` file at the top level of the repository** (`Copyright 2026 SoDam AI Studio` on line 203). `Apache-2.0` is also written in the Claude Desktop extension manifest `manifest.json`. By contrast, `package.json` and `.claude-plugin/plugin.json` **have no license field** (confirmed 2026-10-12), so an automated tool that reads only those files may show the license as "none" — base your judgment on the `LICENSE` file.

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
| Using the open-source components this kit relies on (Playwright, axe-core, pixelmatch, pngjs, satori, sharp, @modelcontextprotocol/sdk, zod) directly, on your own | ✅ Allowed, under each project's own license (Apache-2.0 / MPL-2.0 / ISC / MIT) |
| Reselling a font this kit auto-downloads (e.g. Pretendard) as a standalone font product | ❌ Prohibited (violates the OFL license) |
| Handing the installed copy or the `.mcpb` file to someone else as-is | ⚠️ Allowed, but the conditions stack — on top of this kit's Apache-2.0 conditions, you must not delete the `LICENSE` files of the components inside (especially the LGPL and MPL ones). For commercial redistribution, consulting an attorney is recommended |
| Distributing the Chromium browser files that Playwright downloads together with this kit, as if they were part of it | ❓ This kit does not include Chromium — you must check that separate project's license (this document does not vouch for it) |
| Promoting it as an "official product / partner product" using names such as Claude or Figma | ❌ Prohibited — trademark infringement and risk of misleading people (see "Trademark notice" above) |
| Having the AI (Claude Code) read Figma data to work with this kit | ⚠️ Allowed, but you must assume Claude Code sends that content to Anthropic's servers ([Section 10](#10-security--data-flow)) — if the design contains secrets or personal information, check your company's policy |

**No warranty, limited liability**: this kit and its documentation are provided "as-is," with no guarantee of fitness for a particular purpose or freedom from defects. All outcomes from using it are your own responsibility.

---

## Appendix: Full Design Documentation

More detailed specifications, decision rationale, and development history than this document covers live in [`.PRD/`](./.PRD):
- [`01_PRD.md`](./.PRD/01_PRD.md) — what's being built and why; UI/UX, security, legal, documentation, and success criteria
- [`02_DATA_MODEL.md`](./.PRD/02_DATA_MODEL.md) — data structures (file schemas such as config.json)
- [`03_PHASES.md`](./.PRD/03_PHASES.md) — the phased (1/2/3) development plan and current progress
- [`04_PROJECT_SPEC.md`](./.PRD/04_PROJECT_SPEC.md) — tech stack, absolute rules (do-not / always-do)
- [`.PRD/README.md`](./.PRD/README.md) — the full audit log of the development process
- (Note) The developer's personal work-notes file `CHECKPOINT.md` is a local-only file that is intentionally not pushed to GitHub, so it is not in this repository. The authoritative record of the development history is `.PRD/README.md` above.
