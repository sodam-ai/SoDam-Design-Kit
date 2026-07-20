# SoDam-Design-Kit

A Claude Code design-automation kit that turns Figma designs into shadcn/ui code — and **will not call the work "done" unless it passes real-browser verification (Playwright + axe-core + 3 viewport sizes).**

[한국어 (Korean)](./README.md) | [English (current document)](./README.en.md)

> ⚠️ **Current status**: Phase 1 (MVP) is **mostly implemented**. The core scripts, verification gate, and report-writing are all built, all 50 automated tests pass, and a real Figma file has round-tripped successfully (PASS). What's still open: re-running the just-fixed pipeline from a **brand-new session**, and finalizing the documentation. This document is an honest record of progress, not an announcement of final completion. The official completion criteria live in [`.PRD/01_PRD.md`](./.PRD/01_PRD.md) §9 (Success Criteria).

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
- **How it behaves**: on `FAIL`, it retries automatically up to 3 times (two consecutive failures are required to finalize a `FAIL`). **The "reuse an already-mapped component" path has been verified end-to-end (PASS).** Generating a brand-new component from scratch (no existing mapping) is planned for a future update and is not yet implemented (see [Section 7](#7-update-summary)).
- **Success looks like**: a report file in `.design-kit/reports/` containing `**PASS**`.

---

## 6. Command Reference

| Command | Description | Input | Run from | Current status |
|---|---|---|---|---|
| `/sodam-design-kit:setup` | Generates config.json and seeds component-map by scanning shadcn components | none (optional: Figma file link) | inside the target (Next.js) project | ✅ verified working |
| `/sodam-design-kit:pipeline` | Figma read → mapping → shadcn/ui code generation → verification gate | Figma page/node link | inside the target (Next.js) project | ✅ reuse (mapped-component) path verified PASS · ⚠️ new-component generation path planned for a future update |

Commands for kit developers only (end users don't need these):
| Command | Description | Run from |
|---|---|---|
| `npm install` | Installs the browser and accessibility tools used for verification (once only) | this kit's own repository folder |
| `npm test` | Runs the kit's own automated tests (50 tests) | this kit's own repository folder |
| `node scripts/e2e-selftest.mjs --fixture <path>` | Full self-check of the round-trip pipeline (PASS/FAIL/recheck) | this kit's own repository folder |

---

## 7. Update Summary

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
├── tests/                            ← automated tests (50)
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
A. **No, not currently.** This kit's own license has not yet been finalized. Please read [Section 13](#13-legal-copyright-license--commercial-use) below carefully.

**Q. Does this work on Windows/Mac/Linux?**
A. This kit is built with Node.js scripts, so in principle it should run on all three. However, the environment it has actually been thoroughly built and tested on so far is **Windows**. Real-world verification on Mac/Linux has not yet been performed.

---

## 13. Legal, Copyright, License & Commercial Use

> ⚠️ This section is **not legal advice and carries no legal guarantee.** It is provided for reference only, and anything not yet finalized is clearly marked "undecided" below. For commercial use, redistribution, or any decision requiring legal judgment, please consult a qualified attorney.

### License for SoDam-Design-Kit itself — **Undecided (strict default: all rights reserved)**
- **Current status (confirmed fact)**: this repository has no `LICENSE` file and no license has been designated.
- **What this means**: a work with no explicit license grant is, in principle, treated as **All Rights Reserved by the copyright holder**. In other words, **without explicit permission, you may not distribute, copy, redistribute, sell, deliver to a company/client, or offer this kit's code or documentation as a paid service to any third party.** For now, treat this as usable **only by its creator, for personal use.**
- **Future plan (not yet finalized — under consideration)**: adopting the Apache License 2.0 at the time of public release is being considered, but this is **not yet a finalized decision** — it still requires review by the creator (user) and, ideally, legal counsel. Until this section is actually updated to reflect a finalized decision, the "all rights reserved" default above remains in effect.
- Once a license is finalized, this section and a `LICENSE` file at the repository root will be updated together.

### Licenses of open-source components used internally — confirmed by direct inspection
Separately from this kit's own license, the open-source libraries it uses internally for verification are governed by their own respective licenses, and **this kit uses them unmodified, as installed dependencies only.**

| Component | License | Purpose |
|---|---|---|
| Playwright / playwright-core | Apache License 2.0 (confirmed by direct inspection) | Launches a real browser to check rendering |
| axe-core / @axe-core/playwright | Mozilla Public License 2.0 (confirmed by direct inspection) | Automated accessibility checking |

These licenses are granted independently by their respective projects and are unrelated to this kit's own license. If you want to use these components directly yourself, check their original license text.

### Responsibility for Figma design data
This kit only reads designs you personally have access to, through your own Figma account, and never redistributes, stores, or transmits Figma design data itself elsewhere. However, **whether you have the right (copyright) to turn a given design into code is entirely your own responsibility** — copyright in the original design belongs to whoever created it (or their organization), and this kit does not verify or guarantee that relationship on your behalf.

### Responsibility for AI-generated code
The code this kit generates is produced by Claude (an AI). **Copyright attribution and the scope of protection for AI-generated works is an area where legal interpretation still varies by country and remains unsettled.** Before using generated code commercially, please seek expert confirmation at your own responsibility if needed. This kit and its documentation provide no legal guarantee regarding this.

### Summary table (strict standard)

| Action | Currently allowed? |
|---|---|
| Personal use by the creator | ✅ Allowed |
| Modifying the code for solo/internal team use | ⚠️ License undecided — not recommended (ask the creator directly) |
| Distributing/copying this kit itself to a third party | ❌ Not allowed (license undecided) |
| Selling a paid service/product built on this kit | ❌ Not allowed (license undecided) |
| Delivering this kit to a company/client | ❌ Not allowed (license undecided) |
| Using code **generated by** this kit in your own project | ✅ Allowed — but confirming the copyright of the source Figma design is your responsibility |
| Using the open-source components this kit relies on (Playwright, axe-core) directly, on your own | ✅ Allowed, under each project's own license (Apache-2.0 / MPL-2.0) |

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
