# 🔒 LockedIn

**One resume per role, built from your real work.**

Most students apply to AI, Backend, Frontend, DevOps and Data roles with the *same* resume. LockedIn is a terminal app that:

1. Links your **GitHub** and reads your repos (languages, topics, READMEs, pinned projects).
2. Imports your **CV** (PDF/DOCX) and turns it into clean, Overleaf-ready **LaTeX** (Jake's Resume template).
3. In **Tailor mode**, you pick a role (or paste a job description). LockedIn then ranks your repos for that role, picks the strongest 3–4, and rewrites your resume around them.

All AI work runs through the **Claude Code** or **Codex** CLI you're already logged into. There are no API keys and no LockedIn servers.

## Install

Not on npm yet (the `lockedin` name is taken, so a scoped name like `@<you>/lockedin` is needed before publishing). For now, install from source:

```bash
git clone <this repo> && cd LockedIn
npm install && npm run build && npm link   # puts `lockedin` on your PATH
```

Requirements:
- Node 22+.
- One of [Claude Code](https://docs.claude.com/en/docs/claude-code) (`claude`) or [Codex CLI](https://github.com/openai/codex) (`codex`), installed and logged in.
- Optional:
  - [`gh`](https://cli.github.com) logged in, which avoids pasting a token.
  - [`tectonic`](https://tectonic-typesetting.github.io) to build PDFs locally (`brew install tectonic`).

## Use

```bash
lockedin                 # first run: setup (AI → GitHub → CV); afterwards: home menu
lockedin tailor          # pick a role, optionally paste the JD, get a tailored resume
lockedin tailor -r backend --jd ./jd.txt
lockedin sync            # re-fetch GitHub repos
lockedin cv ~/resume.pdf # re-import your CV
lockedin config          # switch Claude/Codex, include/exclude private repos
lockedin roles           # list built-in roles
```

Every tailored resume is saved to `~/.lockedin/outputs/<role>-<date>.{tex,json,pdf}`. Press **Open in Overleaf** to open it straight in a new Overleaf project.

## No-fabrication guard

The model may only **select, reorder and reword** what's already in your CV and repos. A deterministic guard then checks its output:

- Every project must map to a real repo or CV entry.
- A technology may be listed on a project only if that project's README, metadata or CV entry mentions it.
- Skills must appear somewhere in your CV or GitHub.
- Rewritten bullets can't introduce numbers (users, %, latency…) that aren't in the source.

Anything that fails is removed and shown to you on the review screen. The guard doesn't parse technologies named inside bullet prose, which is why you always get a review step before anything is saved.

## Privacy

- **Data stays local.** It lives in `~/.lockedin/` (change it with `LOCKEDIN_HOME`).
- **What leaves your machine:** your CV text and repo READMEs, sent to the AI CLI you chose (Anthropic or OpenAI).
- **Private repos are opt-in.**
- **Contact details** are never sent during tailoring.

## Development

```bash
npm install
npm run dev              # run from source (tsx)
npm test                 # unit + TUI tests (vitest, ink-testing-library)
npm run typecheck
npm run smoke            # one real call to each logged-in AI CLI
npm run build            # bundle to dist/cli.js
```

`scripts/e2e.ts` runs the whole pipeline headlessly: CV → GitHub → rank → tailor → PDF. Point `LOCKEDIN_HOME` at a scratch dir when you run it.

### Layout

```
src/
  cli.tsx            commander entry
  app/               Ink screens (App router, onboarding steps, Tailor flow, UI kit) + services
  providers/         claude -p / codex exec adapters with strict JSON-schema output
  github/            token resolution (gh → env → PAT) + GraphQL repo fetch
  cv/                PDF/DOCX text + link extraction, LLM parse → profile.json
  tailor/            roles, rank, tailor, truth guard
  latex/             escaping + Jake's Resume renderer
  output/            Overleaf hand-off, tectonic compile + one-page fit, saving
  schemas/           zod schemas (single source for validation and JSON schema)
```

Template: [Jake's Resume](https://github.com/jakegut/resume) by Jake Gutierrez (MIT).
