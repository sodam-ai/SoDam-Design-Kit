# SoDam-Design-Kit

A Claude Code design-automation kit that turns Figma designs into shadcn/ui code — and **will not call the work "done" unless it passes real-browser verification (Playwright + axe-core + 3 viewport sizes).**

[한국어 (Korean)](./README.md) | [English (current document)](./README.en.md)

> ✅ **Current status**: **Phase 1 (MVP) is officially complete** (2026-08-04). The core scripts, verification gate, and report-writing are all built, all 68 automated tests pass, and **both the "reuse an already-mapped component" path and the "generate a brand-new component from scratch (no mapping)" path** have round-tripped successfully against real Figma data (PASS). The final and most important gate — **reproducing the whole thing from a brand-new session, from scratch — was actually attempted 4 times and confirmed successful**; 3 real defects found along the way were fixed and re-verified (see the 2026-08-04 entry in [Section 7](#7-update-summary)). All 6 items in [`.PRD/01_PRD.md`](./.PRD/01_PRD.md) §9 (Success Criteria) are now backed by real evidence.

---

## Table of Contents

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

## 1. What this tool is

In one sentence: **it automatically turns a Figma design into working code, and mechanically refuses to let you call it "done" until that code has actually been checked in a real browser.**

- It reads a screen you drew in Figma (e.g., a single button).
- It generates code that matches that design, styled with [shadcn/ui](https://ui.shadcn.com) (a React component library).
- It launches the generated code in a real web browser and automatically checks: does the screen render without breaking? Are there accessibility problems (e.g., for screen-reader users)? Does it look right at phone (360px), tablet (768px), and desktop (1440px) widths?
- If it passes, a "report" record is written. If it fails, the tool mechanically blocks any report of "done" — even if a human (or an AI) forgets or tries to skip the check.

```
Figma design ──▶ Code generation ──▶ Real-browser check ──▶ Only then: "done"
```

**Who this is for**: Anyone who designs in Figma and uses Claude Code to turn that design into code (the same person can do both) — especially anyone uneasy about "the AI says it made the code, but did anyone actually check it renders?"

---

## 2. Prerequisites & Required Software (with download instructions)

All 4 of the following must be ready. If even one is missing, you cannot proceed to Section 3 (Installation).

| # | Requirement | Why it's needed | Download / Check |
|---|---|---|---|
| 1 | **Claude Code** | This kit is itself a Claude Code "plugin" — it cannot run without Claude Code | Install per the official guide at [claude.com/claude-code](https://claude.com/claude-code) |
| 2 | **Node.js 18 or newer** | Every verification script in this kit is written in Node.js (a JavaScript runtime) | Download the "LTS" version from [nodejs.org](https://nodejs.org). After installing, type `node -v` in a terminal — if a version number appears, you're set (this kit was built and verified on v22.19.0) |
| 3 | **Target project**: Next.js + Tailwind CSS + shadcn/ui | The code this kit generates assumes exactly this combination (Phase 1 is locked to this stack; other frameworks are not yet supported) | You need a project already built with this stack. If you don't have one, create one with `npx create-next-app@latest` (official Next.js method) and follow the [official shadcn/ui install guide](https://ui.shadcn.com/docs/installation) |
| 4 | **Figma file access** | The original design you're porting to code must live in Figma | Use the **Figma connector** already linked to claude.ai, or log in via the official **Figma MCP** (`https://mcp.figma.com/mcp`). A free (Starter) Figma plan works, but is limited to **6 reads per month** (see [Section 10](#10-security--data-flow)) |

> **"What's a terminal?"**: A text-based window where you type commands instead of clicking. Once Claude Code is installed, the window where you type commands to it *is* the terminal — there's nothing extra to install.

---

## 3. Download & Installation

> The steps below assume this kit **is not yet published on GitHub, and is installed by pointing directly at a folder path on your computer** ("local directory source" — confirmed as of 2026-07-20). If this later moves to a GitHub-hosted marketplace, step 1's address may change from a folder path to a git URL — this section will be updated when that happens.

1. **Register the marketplace** — inside Claude Code:
   ```
   /plugin marketplace add <full path to this repository folder>
   ```
   (example: `D:\AI_Dev_Work\2026y\26y_07m_26d_SoDam-Design-Kit`)

2. **Install the plugin**:
   ```
   /plugin install sodam-design-kit@sodam
   ```

3. **Fully restart Claude Code** — close the window completely and reopen it. (See [Section 11](#11-troubleshooting), "Installed but the command doesn't show up" — this must be a **full restart**, not a refresh.)

4. **Install dependencies (once only)** — from **inside this plugin's own repository folder** (where this `README.en.md` lives):
   ```
   npm install
   ```
   The verification gate depends on Playwright and axe-core, which are not bundled with the kit's code and must be fetched with this command (`.gitignore` excludes `node_modules/`).

   > **Important (a confirmed real-world pitfall)**: Because this plugin uses a "local directory source," installing it does **not** create a copy anywhere like `~/.claude/plugins/`. Claude Code simply uses the original folder you pointed to in step 1. So `npm install` must also be run **inside that same original folder** — there is no separate "installed location" to go looking for (a real attempt to find one, in a fresh session, failed for exactly this reason).

5. **Verify the install** — inside the **target project** (the Next.js project from prerequisite #3):
   ```
   /sodam-design-kit:setup
   ```
   If this command appears in autocomplete and runs without error, the install succeeded.

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
- **How it behaves**: on `FAIL`, it retries automatically up to 3 times (two consecutive failures are required to finalize a `FAIL`). **Both the "reuse an already-mapped component" path and the "generate a brand-new component from scratch" path have been verified end-to-end (PASS).** Before placing a newly generated component, it automatically checks for hardcoded style values (e.g. `#ff0000`) and refuses to place the file if it finds any (see [Section 7](#7-update-summary)).
- **Success looks like**: a report file in `.design-kit/reports/` containing `**PASS**`.

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
   - The agent did **not** write a throwaway script on the fly — verification and report-writing must complete together via a single `verify-runner.mjs --target ...` command (if it doesn't, the "verification and report-writing merged into one command" item in [Section 7](#7-update-summary) isn't actually working)
5. **Always run this from PowerShell** — in Git Bash, values starting with `/` (like `/design-kit-preview/...`) can get misinterpreted as a path. See [Section 11, Troubleshooting](#11-troubleshooting).

---

## 6. Command Reference

| Command | Description | Input | Run from | Current status |
|---|---|---|---|---|
| `/sodam-design-kit:setup` | Generates config.json and seeds component-map by scanning shadcn components | none (optional: Figma file link) | inside the target (Next.js) project | ✅ verified working |
| `/sodam-design-kit:pipeline` | Figma read → mapping → shadcn/ui code generation → verification gate | Figma page/node link | inside the target (Next.js) project | ✅ both the reuse (mapped-component) path and the new-component generation path verified PASS |
| `/sodam-design-kit:open` | Opens a browser dashboard to review verification history, reports, and screenshots + trigger re-verification (127.0.0.1 only; stop with `--stop`) | none | inside the target project | ✅ real background start/reuse/stop round-trip verified PASS |

Commands for kit developers only (end users don't need these):
| Command | Description | Run from |
|---|---|---|
| `npm install` | Installs the browser and accessibility tools used for verification (once only) | this kit's own repository folder |
| `npm test` | Runs the kit's own automated tests (68 tests) | this kit's own repository folder |
| `node scripts/e2e-selftest.mjs --fixture <path>` | Full self-check of the round-trip pipeline (PASS/FAIL/recheck) | this kit's own repository folder |

---

## 7. Update Summary

<details open>
<summary><b>▶ 2026-08-04 — Fixed 3 real defects found during live new-session testing + Phase 1 (MVP) officially complete (click to collapse)</b></summary>

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

- **The self-check command was silently pointing at the wrong thing**: the kit maintainers' `npm run selftest` command referenced an option that doesn't actually exist, so instead of running the real self-check (`scripts/e2e-selftest.mjs`) it just printed a usage message and stopped. **End users never run this command themselves** — this document has always instructed running `node scripts/e2e-selftest.mjs --fixture <path>` directly — so anyone following this document was never affected. It was still fixed immediately upon discovery, to point at the correct script.
- **A gap where screenshots could end up exposed to git if verification was run standalone, skipping the normal setup → pipeline order**: following the documented order, the screenshot folder is automatically registered in `.gitignore`. But an alternate, exceptional path — running the verification step directly without ever running `setup` first (mainly used by the kit's own developers for testing) — was found, by direct reproduction, to skip that registration. The same registration logic was added to the report-writing code (`report-writer.mjs`) to close this gap. **This path, too, never affected anyone following the documented order.**
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

> Future changes will keep being appended here, in date order. The authoritative full history lives in [`.PRD/README.md`](./.PRD/README.md) (audit log).

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
  │                        │  → open in a real browser (Playwright)
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
│   └── pipeline.md                   ← the actual definition of /sodam-design-kit:pipeline
├── hooks/
│   └── verify-gate.mjs               ← completion-blocking logic (blocks on FAIL)
├── scripts/                          ← the actual engine, all Node.js
│   ├── setup-wizard.mjs
│   ├── pipeline-codegen.mjs
│   ├── preview-route.mjs
│   ├── verify-runner.mjs
│   └── report-writer.mjs
├── tests/                            ← automated tests (68)
├── .PRD/                             ← this kit's authoritative design docs (most detailed source of truth)
├── CHECKPOINT.md                     ← the next tasks to pick up
├── README.md / README.en.md          ← this document
└── package.json
```

### What appears inside the target project (where code gets generated)
Running `/sodam-design-kit:setup` inside your **target project** creates exactly one new folder, `.design-kit/`:
```
(target project)/.design-kit/
├── config.json               ← settings like viewport sizes and retry count (deletable — `setup` recreates it)
├── component-map.json        ← the mapping between components and Figma nodes (deleting this loses your mapping — be careful)
├── runs/*.json                ← run records (the machine-readable source of the verdict) — meant to be committed to git
├── reports/*.md                ← human-readable reports — meant to be committed to git
└── reports/screenshots/       ← verification screenshots — only the most recent 10 runs are kept automatically (older ones are auto-deleted)
```
> **Safe to delete**: `reports/screenshots/` (regenerated automatically). **Do not delete**: `component-map.json` (recreating it means reading Figma again, and the free Figma plan only allows 6 reads a month — see [Section 10](#10-security--data-flow)).

---

## 10. Security & Data Flow

**No exaggeration — just the facts.**

- **What leaves your computer**: read requests to Figma's servers (using your own Figma login, for only the design pages you specify). Nothing else is sent to any server by this kit. Login credentials (tokens, etc.) are never stored by the kit's own code — it reuses whatever Figma connector/official MCP login is already set up in Claude Code.
- **What stays local (on your computer only)**: the generated code, and everything inside `.design-kit/` — settings, mappings, run records, and screenshots. All of it lives only on your local disk and is never transmitted anywhere.
- **Figma image URLs expire after 7 days**: URLs Figma returns for images/icons are temporary and break after 7 days. This kit is designed to download them locally right away instead of embedding the temporary URL directly in generated code.
- **Figma free-plan read limits**: if your own Figma account is on the free (Starter/View) plan, you get only **6 reads per month** (paid Dev/Full plans get 200–600 per day). This kit is designed to save what it reads into `component-map.json` and reuse it, to conserve that limit.
- **No personal data or real customer data allowed**: this kit's rules (the "Do Not" list in [`.PRD/04_PROJECT_SPEC.md`](./.PRD/04_PROJECT_SPEC.md)) prohibit connecting Figma files that contain personal information or real customer data. Only dummy/sample design data should be used.
- **How external commands are run**: when running things like the dev server, this kit only spawns processes with an argument array — it never concatenates strings into a shell command (which would risk command injection).
- **No sensitive data in reports**: reports and run records are designed — and automated-tested — to never contain secrets (passwords, tokens) or absolute paths from your computer.
- **No API keys (currently)**: the current version (Phase 1) needs no separate API keys or environment variables. If a future feature adds paid image-generation APIs (Phase 3, still just a plan), those will be managed exclusively through a `.env` file.

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
| Korean text (or other non-Latin text) renders as broken boxes (□) | No font has been explicitly loaded yet | Currently out of scope for Phase 1 (an automatic font pipeline is planned for later) — check the target project's own font setup for now | (expected to be resolved automatically in a future version) |

---

## 12. FAQ

**Q. Can I use this if I don't know how to code at all?**
A. Running the commands themselves only requires knowing two slash commands (`/sodam-design-kit:setup`, `/sodam-design-kit:pipeline`). That said, the "target project" (Next.js + Tailwind + shadcn/ui) needs to already exist. Everything else can be requested from the AI in plain language.

**Q. Do I need a paid Figma plan?**
A. No, the free (Starter) plan works. It's limited to 6 reads per month (see [Section 10](#10-security--data-flow)). This kit is built to cache what it reads and reuse it, so you can still run the pipeline multiple times within that limit.

**Q. If verification fails (FAIL), does that mean my code is broken?**
A. Not necessarily. It could be an accessibility rule violation, a console error, a rendering failure, or something else — and the report will state the specific reason. A failure is also evidence that this kit is checking things correctly.

**Q. Can I edit the generated code myself?**
A. Yes — the generated code becomes a regular file in your own project, and you're free to modify it. Re-running the pipeline will re-verify it.

**Q. Can I use this commercially, or share/redistribute it?**
A. **Yes, under the terms of the Apache License 2.0** (finalized 2026-08-09) — you must include a copy of the license, mark any changed files, and preserve the original copyright notice. The license does not, however, grant rights to the "SoDam-Design-Kit" name or trademark itself. Please read [Section 13](#13-legal-copyright-license--commercial-use) below carefully.

**Q. Does this work on Windows/Mac/Linux?**
A. This kit is built with Node.js scripts, so in principle it should run on all three. However, the environment it has actually been thoroughly built and tested on so far is **Windows**. Real-world verification on Mac/Linux has not yet been performed.

---

## 13. Legal, Copyright, License & Commercial Use

> ⚠️ This section is **not legal advice and carries no legal guarantee.** It is provided for reference only, and anything not yet finalized is clearly marked "undecided" below. For commercial use, redistribution, or any decision requiring legal judgment, please consult a qualified attorney.

### License for SoDam-Design-Kit itself — **Apache License 2.0 (finalized 2026-08-09)**
- **Current status (confirmed fact)**: a `LICENSE` file (full text of Apache License 2.0) exists at the repository root. The copyright holder is **SoDam AI Studio**, year 2026.
- **What this means**: Apache License 2.0 is a permissive license that allows use, copying, modification, redistribution, and commercial use of the code and documentation. It requires that you include a copy of the license, mark any modified files as changed, and preserve the original copyright/patent/trademark notices (see Section 4 of the license text). **Rights to the "SoDam-Design-Kit" name or trademark are not granted by this license.**
- No separate NOTICE file is included (this is a new work with no upstream NOTICE to carry forward).

### Licenses of open-source components used internally — confirmed by direct inspection
Separately from this kit's own license, the open-source libraries it uses internally for verification are governed by their own respective licenses, and **this kit uses them unmodified, as installed dependencies only.**

| Component | License | Purpose |
|---|---|---|
| Playwright / playwright-core | Apache License 2.0 (confirmed by direct inspection) | Launches a real browser to check rendering |
| axe-core / @axe-core/playwright | Mozilla Public License 2.0 (confirmed by direct inspection) | Automated accessibility checking |
| pixelmatch | ISC License (confirmed by direct inspection) | Pixel-level image comparison for visual regression checks |
| pngjs | MIT License (confirmed by direct inspection) | PNG image read/write for visual regression checks |

These licenses are granted independently by their respective projects and are unrelated to this kit's own license. If you want to use these components directly yourself, check their original license text.

### Responsibility for Figma design data
This kit only reads designs you personally have access to, through your own Figma account, and never redistributes, stores, or transmits Figma design data itself elsewhere. However, **whether you have the right (copyright) to turn a given design into code is entirely your own responsibility** — copyright in the original design belongs to whoever created it (or their organization), and this kit does not verify or guarantee that relationship on your behalf.

### Responsibility for AI-generated code
The code this kit generates is produced by Claude (an AI). **Copyright attribution and the scope of protection for AI-generated works is an area where legal interpretation still varies by country and remains unsettled.** Before using generated code commercially, please seek expert confirmation at your own responsibility if needed. This kit and its documentation provide no legal guarantee regarding this.

### Summary table (Apache License 2.0 standard)

| Action | Currently allowed? |
|---|---|
| Personal use by the creator | ✅ Allowed |
| Modifying the code for solo/internal team use | ✅ Allowed |
| Distributing/copying this kit itself to a third party | ✅ Allowed — must include license copy + mark changes |
| Selling a paid service/product built on this kit | ✅ Allowed — same conditions apply |
| Delivering this kit to a company/client | ✅ Allowed — same conditions apply |
| Distributing under the "SoDam-Design-Kit" name/trademark as-is | ⚠️ Not recommended — the license permits code use but does not grant naming/trademark rights |
| Using code **generated by** this kit in your own project | ✅ Allowed — but confirming the copyright of the source Figma design is your responsibility |
| Using the open-source components this kit relies on (Playwright, axe-core, pixelmatch, pngjs) directly, on your own | ✅ Allowed, under each project's own license (Apache-2.0 / MPL-2.0 / ISC / MIT) |

**No warranty, limited liability**: this kit and its documentation are provided "as-is," with no guarantee of fitness for a particular purpose or freedom from defects. All outcomes from using it are your own responsibility.

---

## Appendix: Full Design Documentation

More detailed specifications, decision rationale, and development history than this document covers live in [`.PRD/`](./.PRD):
- [`01_PRD.md`](./.PRD/01_PRD.md) — what's being built and why; UI/UX, security, legal, documentation, and success criteria
- [`02_DATA_MODEL.md`](./.PRD/02_DATA_MODEL.md) — data structures (file schemas such as config.json)
- [`03_PHASES.md`](./.PRD/03_PHASES.md) — the phased (1/2/3) development plan and current progress
- [`04_PROJECT_SPEC.md`](./.PRD/04_PROJECT_SPEC.md) — tech stack, absolute rules (do-not / always-do)
- [`.PRD/README.md`](./.PRD/README.md) — the full audit log of the development process
- [`CHECKPOINT.md`](./CHECKPOINT.md) — the list of tasks to pick up next
