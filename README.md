# Throughline

*A system for building fair, traceable hiring pipelines. One engine, many roles.*

Throughline is an evaluation layer for hiring. It is not an applicant tracking system. It is a working argument about how hiring decisions should be made: the system computes and recommends, the judgment stays human, and every decision can be traced back to the evidence that produced it.

It runs as a per-visitor sandbox. The app ships with a populated demo dataset, anything you change persists in your own browser only, and a reset restores the original. No backend, no database, no accounts.

The reasoning behind the product lives in [`docs/THESIS.md`](docs/THESIS.md), and the architecture in [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md).

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # outputs a static site to dist/
npm run preview    # serve the built dist/ locally
```

To publish, run `npm run build` and host the contents of `dist/` on any static host. The build uses a relative base, so it works from a sub-path too.

## What it does

- **Pipeline Builder.** Define a role, assemble its stages and reviews, attach a scorecard to each review, set ordering and stop-on-fail. One engine produces a different pipeline for every role.
- **Decision and Traceability.** For any candidate, the full throughline: each stage, every review revealed side by side once locked, the score spread, red flags, and the recommendation, with the gate decision committed by a person and recorded with a rationale.
- **Reviewer's desk.** Score a candidate against a scorecard, blind to peers until lock, with written evidence required for extreme scores on subjective criteria.
- **Scorecard editor.** Reusable per-discipline scorecards: weighted criteria, low and high rubric anchors, subjective flags, and red flags.
- **Team and routing.** Manage reviewers, with assignment from per-review pools by round-robin, optional seniority and load-aware conditions, automatic panel rotation, and declared conflicts of interest.
- **Candidates.** Create candidates individually or by CSV import, with validation and a preview before anything is created.
- **Pipeline Health and notifications.** A view of where candidates are waiting, and per-person notifications that fire only when it is a reviewer's turn.
- **Role switcher.** View the app as an admin, a reviewer, or an observer. Permissions follow the role, which is how the blind-review and decision constraints are demonstrated from the inside.
- **Light and dark themes**, following the system preference with a manual override.

## The engine

Three pure functions over an in-memory store, no database required.

- `computeResult` derives one review's weighted score, signal band, and any red-flag override.
- `resolveStage` applies stop-on-fail and measures reviewer disagreement rather than averaging it away. A split panel routes to "needs decision."
- `recommendNext` computes a recommendation and never auto-decides. Every gate action requires a human.

## Repo map

```
docs/                   THESIS.md (the argument) and BLUEPRINT.md (the architecture)
src/data/seed.js        the demo dataset
src/engine/             computeResult, resolveStage, recommendNext, selectors
src/store/              localStorage persistence and the React store
src/components/          the surfaces
src/App.jsx             shell: nav, role switcher, theme, reset
```

## Stack

Vite, React, and Tailwind, with a seeded dataset and browser storage. It runs locally and builds to a static folder for hosting.
