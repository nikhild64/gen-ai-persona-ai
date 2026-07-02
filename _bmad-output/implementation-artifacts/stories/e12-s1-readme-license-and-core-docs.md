# Story E12-S1: README + LICENSE + creator-permissions + attributions + browser-compat + performance + feature-flags

Status: ready-for-dev

- **Epic:** 12 — Submission Deliverables
- **Critical-path position:** 35 of 37 (Day 7 evening)
- **Blocks:** E12-S3
- **Depends on:** E0-S1

## Story

As a **cohort grader**,
I want **a `README.md` at repo root that within 30 seconds tells me what the product is, links to the live URL, shows me the persona switcher in action, points me at `EVALUATION.md`, and includes setup + deploy + parody disclaimer + takedown contact**,
So that **I can enter the submission cold and orient myself without hunting**.

## Acceptance Criteria

**Given** the developer authors `README.md` at repo root,
**When** the doc is complete,
**Then** it follows the exact 8-section order from PRD §9: (1) what the product is (2-sentence hook + link to live URL); (2) screenshot / GIF of the persona switcher in action (image or animated GIF captured post-Epic 4 completion, stored at `docs/media/persona-switcher.gif` or `public/media/`); (3) cohort context (built for ChaiCode GenAI cohort, creator-approved); (4) live URL and repo URL (both explicit); (5) setup instructions (env vars, `npm install`, `npm start`); (6) deploy instructions (Vercel one-click OR sequential steps); (7) links to `docs/` and `EVALUATION.md`; (8) parody disclaimer + takedown contact.

**Given** the developer authors `LICENSE` at repo root,
**When** the file is complete,
**Then** it's MIT license text + an explicit exclusion clause: `"This MIT license grants rights to the code artifact only. It does NOT grant any rights to the creators' name, likeness, or content. The Hitesh Choudhary and Piyush Garg persona identities are used under cohort-authorized permission (see docs/creator-permissions.md), not open-sourced. Republication, redistribution, or forking of the persona prompt files without maintaining the docs/creator-permissions.md documentation and takedown contact is not authorized."` (or similar wording capturing the intent).

**Given** the developer authors `docs/creator-permissions.md`,
**When** the file is populated,
**Then** it contains: (a) verbatim quote(s) of the ChaiCode cohort authorization that covers this build's persona use, including photo use — the actual authorization language from wherever it was granted (email, DM, cohort platform announcement); (b) names of the creators (Hitesh Choudhary, Piyush Garg); (c) the channel of authorization (email / cohort platform / DM); (d) the approval date. Reviewable by a grader in 60 seconds per PRD §9.

**Given** the developer authors `docs/attributions.md`,
**When** the file is populated,
**Then** it contains: (a) avatar attributions — source URL for each of `public/avatars/hitesh.jpg` and `public/avatars/piyush.jpg` + a note that the images are used with cohort permission per `docs/creator-permissions.md`; (b) syntax highlighter attribution — the highlight.js / shiki + palette source; (c) icon set attribution — PrimeIcons license note; (d) any other third-party asset with license info.

**Given** the developer authors `docs/browser-compat.md`,
**When** the doc is populated,
**Then** it captures the Chromium 120+ / Firefox 120+ / Safari 16.4+ (desktop + mobile) support matrix per PRD §6 + AD Stack; documents the manual smoke-test procedure (open the live URL in each browser, run through UJ-1 setup, chat with each persona, verify streaming works, verify persona switch, verify Ask-Both, note any browser-specific bugs); logs the LAST manual smoke-test date + browser/version combos tested.

**Given** the developer authors `docs/performance.md`,
**When** the doc is populated,
**Then** it captures: (a) bundle-size ceiling of 200KB gzip per AD-21 + last measured value; (b) how to measure (`ng build --stats-json` + `source-map-explorer`); (c) LCP / TTFT / total-response targets per PRD §6; (d) run cadence for `npm run eval:perf` (pre-release + after `src/features/chat/` or `src/infrastructure/providers/` changes per Epic 11 story E11-S3); (e) IndexedDB restore-perf note (500ms median on 100-message thread per AD-21 FR-14 headroom).

**Given** the developer authors `docs/feature-flags.md`,
**When** the doc is populated per Epic 10 story E10-S1's content-scope note,
**Then** it lists each env-var name (`FEATURE_ASK_BOTH_MODE`, `FEATURE_ROLLING_SUMMARY`, `FEATURE_MODERATION`, `FEATURE_BYO_KEY`, `ASK_BOTH_MODE`), truthy/falsy semantics, defaults, and includes the supersession note per PRD §11.3 ("flags are baked at build time; a flip requires rebuild + redeploy; request-time flag reads are not possible in Pure FE per AD-1").

**verifies:** PRD §9 (deliverables — README, LICENSE, creator-permissions, attributions, browser-compat, performance, feature-flags docs), SM-5 (all deliverables present, binary yes/no)

**touches:** `README.md`, `LICENSE`, `docs/creator-permissions.md`, `docs/attributions.md`, `docs/browser-compat.md`, `docs/performance.md`, `docs/feature-flags.md`, `docs/media/persona-switcher.gif` (or `public/media/persona-switcher.gif`), `public/avatars/hitesh.jpg` (source per docs/attributions.md), `public/avatars/piyush.jpg` (source per docs/attributions.md)

**test target:** manual smoke test (open README from a fresh cohort peer's perspective; can they orient in 30 seconds?; each linked doc file exists; live URL loads; screenshot renders; creator-permissions is 60-second reviewable)

## Developer Context

Doc-heavy story. All submission chrome + creator-permissions provenance + attributions + browser matrix + perf + feature-flags docs land here. Content for `docs/performance.md` was scoped in E11-S3, `docs/feature-flags.md` in E10-S1 — this story places the actual files.

**60-second reviewability:** each doc should be short + skimmable. Creator-permissions especially — grader needs to see the auth quote FAST.

## Technical Requirements

### `README.md` — 8-section structure per PRD §9

```markdown
# Chai Code Personas

**AI chat website with Hitesh Choudhary + Piyush Garg. Cohort-authorized educational demo built for the ChaiCode GenAI cohort.**

🔗 **Live URL:** https://chai-code-personas.vercel.app

![Persona switcher demo](./docs/media/persona-switcher.gif)

## Cohort context

Built by a student of the ChaiCode GenAI cohort taught by Hitesh Choudhary + Piyush Garg. Both creators have granted approval for this build. See `docs/creator-permissions.md` for the verbatim authorization.

## Live URL & Repo

- Live: https://chai-code-personas.vercel.app
- Repo: https://github.com/<user>/gen-ai-persona-ai

## Setup

1. Node 22 LTS + npm.
2. `npm install`.
3. Copy `.env.example` → `.env.local` (if any env vars needed for dev).
4. `npm start` → localhost:4200.

You'll need a BYO-Key (Gemini free-tier from https://ai.google.dev, Groq free-tier from https://console.groq.com) to actually chat. The settings modal auto-opens on first send if no key is saved.

## Deploy

Vercel one-click:
1. Fork this repo.
2. In Vercel dashboard: Import Project → point at fork.
3. Set framework preset: Angular.
4. Output directory: `dist/gen-ai-persona-ai/browser`.
5. (Optional) Set env vars per `docs/feature-flags.md`.
6. Deploy.

## Docs

- `docs/persona-data-collection.md` — how we sourced the persona voices.
- `docs/prompt-engineering.md` — layered prompt structure explanation.
- `docs/context-management.md` — Rolling Summary + Verbatim Tail + Drift Refresh design.
- `docs/sample-conversations.md` — live-captured examples per persona + Ask-Both.
- `docs/creator-permissions.md` — cohort authorization.
- `docs/feature-flags.md` — env var semantics.
- `docs/browser-compat.md` — support matrix.
- `docs/performance.md` — perf targets + measurement.
- `docs/attributions.md` — asset + library credits.
- `EVALUATION.md` — grader crib sheet + full eval report.

## Parody disclaimer

This is an **AI simulation, not the real person**. Cohort-authorized educational demo built with permission of Hitesh Choudhary + Piyush Garg for the ChaiCode GenAI cohort.

Takedown contact: [email placeholder — see docs/creator-permissions.md]
```

### `LICENSE` — MIT + exclusion clause

Standard MIT text + append:

```
---

CREATOR-CONTENT EXCLUSION

This MIT license grants rights to the code artifact only. It does NOT grant any rights to the creators' name, likeness, or content. The Hitesh Choudhary and Piyush Garg persona identities are used under cohort-authorized permission (see docs/creator-permissions.md), not open-sourced. Republication, redistribution, or forking of the persona prompt files without maintaining the docs/creator-permissions.md documentation and takedown contact is not authorized.
```

### Doc files — content per PRD §9

- `docs/creator-permissions.md` — verbatim auth quote, creators' names, channel, date.
- `docs/attributions.md` — avatar sources, syntax highlighter, PrimeIcons, any other 3rd-party assets.
- `docs/browser-compat.md` — matrix + smoke procedure + last-tested combos.
- `docs/performance.md` — content authored in E11-S3; place file here.
- `docs/feature-flags.md` — content authored in E10-S1; place file here.

### Persona-switcher demo GIF

Record a 5-10 second screen capture showing landing → click persona card → chat → click persona switcher → theme slides → chat with other persona. Save as `docs/media/persona-switcher.gif`. Optimize with `gifsicle` or use LICEcap.

### Avatar sources

`public/avatars/hitesh.jpg` + `public/avatars/piyush.jpg` — source URL cited in `docs/attributions.md`. Cohort-authorized per `docs/creator-permissions.md`.

## Architecture Compliance

- **PRD §9:** 7 deliverables listed here match §9 exactly.
- **SM-5:** binary yes/no — every named file exists.

## File Structure Requirements

```
README.md
LICENSE
docs/
  creator-permissions.md
  attributions.md
  browser-compat.md
  performance.md
  feature-flags.md
  media/persona-switcher.gif
public/avatars/
  hitesh.jpg
  piyush.jpg
```

## Testing Requirements

Manual smoke:
- Read README cold — orient in 30 sec?
- Every linked doc exists + is populated.
- Live URL loads.
- GIF renders in GitHub preview.
- creator-permissions 60-sec reviewable.

## Latest Tech Information

- Vercel Angular deployment via one-click framework preset supported through 2026.
- GIF file size — target < 2MB for fast GitHub preview.

## Previous Story Intelligence

- **E10-S1:** feature-flags.md content authored — place file here.
- **E11-S3:** performance.md content authored — place file here.
- **E4-S1/S2:** persona-switcher works — record GIF here.
- **E0-S1:** repo scaffolded.

## Project Context Reference

- PRD §9 Submission Deliverables (lines 686–711).
- Sprint status: key `e12-s1-readme-license-and-core-docs`, blocks `[e12-s3]`.

## References

- [Source: prd.md#§9] Exhaustive deliverables list.
- [Source: prd.md#SM-5] Binary presence check.

## Story Completion Status

- [ ] `README.md` — 8-section structure per PRD §9.
- [ ] `LICENSE` — MIT + creator-content exclusion clause.
- [ ] `docs/creator-permissions.md` — verbatim auth quote + metadata.
- [ ] `docs/attributions.md` — avatar + library + icon attributions.
- [ ] `docs/browser-compat.md` — support matrix + smoke procedure.
- [ ] `docs/performance.md` — content from E11-S3.
- [ ] `docs/feature-flags.md` — content from E10-S1.
- [ ] `docs/media/persona-switcher.gif` — recorded GIF ≤ 2MB.
- [ ] `public/avatars/hitesh.jpg` + `piyush.jpg` — present + attributed.
