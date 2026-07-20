# SoDam-Design-Kit — Beginner's Guide

> This guide is written for people who are **completely new** to computers, AI, and apps. Whenever a technical term appears, it's explained right there on the spot. Just follow the steps in order, one at a time.

[한국어 (Korean)](./GUIDE.md) | [Beginner Guide (English, current document)](./GUIDE.en.md) | [Full README](./README.en.md)

---

## Terms worth knowing before you start

| Term | Plain explanation |
|---|---|
| **AI** | A computer program that can talk like a person and do work for you. This guide uses an AI called "Claude." |
| **Claude Code** | A program that lets you talk to Claude (the AI) and have it do computer tasks for you (creating files, writing code, etc.). Every step in this guide happens inside this program. |
| **Terminal / command window** | A screen where, instead of clicking with a mouse, you type commands as text to tell the computer what to do. Claude Code automatically opens a window like this — don't worry, you don't need to be afraid of it. Just type exactly what this guide tells you to. |
| **Plugin** | Something like an add-on part that gives Claude Code a new feature. "SoDam-Design-Kit," which you'll install in this guide, is exactly that: a plugin. |
| **Slash command (a command starting with `/`)** | A special command you can type into the Claude Code chat that runs a pre-defined task. Example: `/plugin` |
| **Folder / directory** | Something like an envelope that holds files inside your computer. The yellow icons you see in Windows Explorer are folders. |
| **Path** | The text "address" that describes exactly where a file or folder is located inside your computer. Example: `D:\MyFolder\SubFolder` |
| **Figma** | A web service used to draw screen designs (buttons, layouts, etc.). Widely used by designers. |
| **Code** | Text written in a programming language that a computer can run. This kit automatically turns Figma designs into code. |
| **Browser** | A program that displays internet pages (Chrome, Edge, etc.). This kit automatically checks whether the code it generates actually looks right in a real browser. |

---

## What can this tool do? (one-line summary)

**It automatically turns a screen you designed in Figma (say, a single button) into code — but only code that a computer has actually double-checked, for real.** Instead of a person glancing at the result and guessing "looks about right," this tool opens a real browser and checks: does the screen actually render correctly? Would it work well for people using accessibility tools (like screen readers)? Does it look right on a phone, a tablet, and a PC screen? Only once all of that passes is the tool allowed to say "it's done."

---

## 4 things to prepare before you start

All 4 of the following need to be ready before you can move to the next step. Check them one by one.

### ① Is Claude Code installed?
- If you're already reading this guide inside Claude Code, you're set. If not, follow the official instructions at [claude.com/claude-code](https://claude.com/claude-code) to install it first.

### ② Is Node.js installed?
- Node.js is a program-runner that this tool uses internally.
- **How to check**: type the following exactly, into the Claude Code chat window:
  ```
  node -v
  ```
- **Success looks like**: a number starting with `v` appears, like `v22.19.0`. If you instead see something like "command not found," go to [nodejs.org](https://nodejs.org), download the version labeled "LTS," install it, and check again.

### ③ Is a "target project" ready?
- This tool needs somewhere to put the code it generates — a project that already exists. It must be built with **Next.js + Tailwind CSS + shadcn/ui**.
- If you already have such a project, note down its folder path. If not, ask Claude Code in plain language: "Please create a new project using Next.js, Tailwind, and shadcn/ui" — and have it set that up first.

### ④ Can you access Figma?
- The design you want to turn into code needs to live in Figma. If Figma is already connected to your claude.ai account, you're good to go; if not, ask Claude Code "please connect to Figma," and it will guide you through logging in.
- A free Figma account is fine. Just note it's limited to reading designs 6 times per month, so it's worth saving those reads for screens you actually need to check.

> Once all 4 are ready, move on to "Installing" below. If even one is missing, prepare that first.

---

## Installing (only needs to be done once)

> ⚠️ These installation steps assume this tool **is not yet published publicly, and is installed by pointing directly at a folder on your own computer.** This method may change later.

### Step 1: Register the marketplace
Type this into the Claude Code chat window (replace the path with wherever this kit's folder actually is on your computer — for example, `D:\AI_Dev_Work\2026y\26y_07m_26d_SoDam-Design-Kit`):
```
/plugin marketplace add D:\AI_Dev_Work\2026y\26y_07m_26d_SoDam-Design-Kit
```
✅ **Success looks like this**: you see a confirmation message such as "marketplace added."

### Step 2: Install the plugin
```
/plugin install sodam-design-kit@sodam
```
✅ **Success looks like this**: you see a message like "Installed" or "installation complete."

### Step 3: Fully close and reopen Claude Code
- Not just a refresh — **close the window completely**, then start it again.
- Why is this needed? Claude Code needs a proper restart to fully recognize what was just installed (this is a common pitfall, so we're flagging it in advance).

### Step 4: Download the required parts (once only)
In the Claude Code chat window, move into **this kit's own repository folder** (the same path you typed in Step 1), and type:
```
npm install
```
- This downloads the tools used to check the screen in a real browser and to check accessibility. It may take a little while.
✅ **Success looks like this**: the command finishes without errors, and you can type something new again.

> 💡 **Watch out for this pitfall**: some programs, when installed, create a copy somewhere like `AppData\...`. **This tool does not do that.** It keeps using the exact original folder you pointed to in Step 1. So don't go looking for a separate "installed folder" — it doesn't exist.

### Step 5: Confirm the install
Now move into your **target project** (prerequisite ③ — the project you'll be putting the code into), and type:
```
/sodam-design-kit:setup
```
✅ **Success looks like this**: when you type `/`, `sodam-design-kit:setup` appears in the autocomplete list, and running it finishes without any errors.

**If you've made it this far, the installation is done! 🎉**

---

## Trying it out for real (your first run, results in 5 minutes)

### Step 1: Initial setup (only once per project)
Inside your target project folder:
```
/sodam-design-kit:setup
```
✅ **Success looks like this**: you see a message like "created," and a new folder called `.design-kit` appears inside that project folder.

### Step 2: Get your Figma design ready — copy its link
1. In Figma, click on the screen element you want turned into code (e.g., a single button) to select it.
2. Copy its share link — but **not the whole file's link, only the one for that specific selected element** (right-click → "Copy link" or a similarly named menu item). The link's address needs to contain the text `node-id=` for it to be precise enough.
   - ⚠️ **A common mistake**: don't just copy the whole-file link (the one in your address bar right when you first open the file). You must **click to select the specific element first**, then copy its link.

### Step 3: Run the pipeline
In the Claude Code chat window:
```
/sodam-design-kit:pipeline
```
Then paste the Figma link you just copied, and ask in plain language, e.g., "turn this button into code."

- The AI will automatically go through these steps in order: ① read the Figma design → ② generate code → ③ launch it in a real browser to check it → ④ run an accessibility check → ⑤ check it at phone/tablet/PC sizes → ⑥ record the result.
- This can take anywhere from tens of seconds to a few minutes. If you see a message like "check failed, retrying," don't worry — that's a normal automatic retry (up to 3 times).

### Step 4: Check the result
✅ **The final marker of success**: the AI's reply shows a `PASS` label, and a new file (ending in `.md`) appears in the `.design-kit/reports/` folder. Open that file — if you see:
- the text `**PASS**`
- three screenshot paths for three screen sizes: 360px / 768px / 1440px

...that means real-browser verification genuinely finished.

❌ If you see `FAIL` instead? **Nothing is broken.** In fact, it's proof that this tool is checking things properly. Open the report file to see why it failed, and ask the AI: "please look at this failure reason and fix it."

---

## Common problems and how to fix them (troubleshooting)

| You see this | Why it happens | What to do |
|---|---|---|
| Installed, but `/sodam-design-kit:setup` doesn't show up in autocomplete | Claude Code hasn't noticed the new plugin yet | **Fully close and reopen** Claude Code (not a refresh) |
| "Completion has been blocked" | **This is normal.** It's a safety feature that stops the AI from moving on and pretending everything's fine when a check actually failed | Open the report to see the failure reason, then try again |
| `FAIL` keeps happening over and over | The automatic 3-time retry may not be enough for this particular issue | Open the report yourself and read the failure reason, or ask the AI: "please look at this reason and fix it" |
| Figma won't connect | Your login may have expired, or there might be a permissions issue | Ask the AI: "please check the Figma connection status" |
| A `.fig` file saved on my own computer won't open | This tool can only read files that are **saved to a Figma account** — it can't read a file straight off your computer | Open that file in the Figma app to save it to your account, then use that link instead |
| A message about "port conflict" flashes by | Another program is already using that same spot | **You don't need to do anything.** This tool automatically finds another spot and keeps going |
| Korean or other non-English text looks like broken squares (□) | Fonts aren't automatically handled yet (planned for a future update) | For now, check the font setup of your target project directly |

---

## Frequently Asked Questions (FAQ)

**Q1. I don't know how to code at all — can I still use this?**
A. Yes. Just type the two commands in this guide (`/sodam-design-kit:setup`, `/sodam-design-kit:pipeline`) exactly as shown, and ask for everything else in plain language. The one thing that needs to already exist is the "target project" itself (the Next.js code skeleton) — someone (or the AI, if you ask it) needs to set that up beforehand.

**Q2. If the AI does everything anyway, why does "checking" even matter?**
A. AI can make mistakes too. This tool makes sure that before the AI says "it's done," a computer actually opens a browser and looks at it — the way a human would. The goal is to make sure something is "actually confirmed to work," not just "claimed to work."

**Q3. What if something stops partway through?**
A. Just describe what happened in the Claude Code chat window (for example: "it stopped partway through, what should I do?"). The AI can check the current state and guide you on what to do next.

**Q4. Can I share this tool with someone else, or sell it?**
A. **No, not currently.** The permission terms (license) for this tool itself haven't been decided yet. Please make sure to read the [Legal & Copyright section of the README](./README.en.md#13-legal-copyright-license--commercial-use).

**Q5. Does any of my personal or company data get sent anywhere?**
A. No. This tool only reads the specific Figma design screens you point it to, and sends no other data to any outside server. All generated code and check records stay only on your own computer. That said, the rule is: never connect a real Figma file containing personal information to this tool (use practice/dummy data only).

---

## Need more detail?

- For more technical explanations (the full command table, architecture, workflow diagrams, etc.), see [`README.en.md`](./README.en.md).
- For why this tool was built this way, and what's planned for the future, the most detailed source is the design documentation in [`.PRD/`](./.PRD).
- If you'd prefer Korean, see [`GUIDE.md`](./GUIDE.md).
