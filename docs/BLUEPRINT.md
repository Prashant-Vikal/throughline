# Throughline: product blueprint

*A system for building fair, traceable hiring pipelines. One engine, many roles.*

## What this is

Throughline is not a single hiring pipeline. It is a system that builds them, one tailored to each role a company hires for, all running on the same evaluation engine.

A hiring leader picks a role, assembles its stages and the scorecards that back them, and the system produces a working, auditable evaluation workflow for that role. Run a designer and an engineer through it and you get two visibly different processes, with different stages, criteria, and bars, produced by the same underlying machine.

The purpose underneath the machinery is fair, defensible, explainable decisions. Structure exists to defeat bias and anchoring, not merely to log activity. Every design choice below serves that.

## Design principles

These are the spine of the product.

1. **The system computes and recommends. People decide.** The engine scores, bands, and surfaces a recommendation. Advancing a candidate, and especially declining one, is always a human action with a recorded decision maker and rationale. There is no automatic rejection on a threshold.

2. **Reviews are blind until they lock.** Within a stage, a reviewer cannot see a peer's scores, notes, or recommendation for the same candidate until their own evaluation is submitted. Independent review is the reason structured evaluation works. Without this control, a second opinion is an echo of the first.

3. **Disagreement is surfaced, never averaged away.** A weighted score is an input, not a verdict. When reviewers disagree, the system shows the spread and routes the stage to "needs decision" rather than smoothing a five and a one into a tidy three. Variance is signal, often the most important signal in the loop.

4. **Extreme scores on subjective criteria require written evidence.** Criteria like Collaboration, Communication, and Judgment are flagged subjective. Scoring at the extremes on those requires a cited observation before the evaluation can be submitted. Unexplained low marks on judgment-shaped dimensions are where bias hides, and the interface makes evidence the cost of a strong opinion.

5. **Everything traces back.** Any outcome, whether a stage cleared or a candidate declined, can be expanded to the exact reviewers, criterion scores, notes, red flags, and computed results that produced it. Nothing is deleted. Overrides are recorded beside what they overrode.

6. **Humane language throughout.** Stages, reviews, and scorecards, named the way a hiring manager says them out loud rather than the way a database stores them. The vocabulary is part of the interface.

## The surfaces

**Pipeline Builder.** Pick or define a role, assemble stages, each holding one or more reviews, attach a scorecard to each review, and set order and the stop-on-fail flag. This is where one engine, many pipelines becomes tangible.

**Decision and Traceability.** For a candidate, the full throughline: stage by stage, every review revealed side by side once locked, the score spread, red flags, and the recommendation, with the gate decision sitting in human hands. Any outcome expands to the evidence beneath it.

**Reviewer's desk.** Score a candidate against the active review's scorecard, blind to peers, leaving notes and triggering red flags. Enforces the evidence rule and the grace-period-then-lock behavior.

**Scorecard editor.** Define a reusable scorecard for a discipline: criteria, weights, the low and high rubric anchors for each, and red flags.

Around these sit the supporting surfaces the system grew to need: team and reviewer management, candidate creation and bulk CSV import, assignment with simulated notifications, a per-person notification view, and a pipeline health view that surfaces where candidates are waiting.

## Point of view: a role switcher

The app opens with a persistent "viewing as" switcher, so anyone can experience every persona without setup.

- **Admin.** Builds pipelines and scorecards, manages the team, sees everything, makes and records gate decisions.
- **Reviewer.** Sees only their assigned reviews, scores blind, submits within the grace window.
- **Observer.** A read-only view, for showing how a decision was reached.

The switcher is itself a statement. It lets a viewer feel the blind-review constraint from the inside as a reviewer, then see the full revealed picture as an admin or observer.

## Domain model

One instinct holds the model together: the record of who reviewed is kept separate from what they scored, wrote, and flagged. That separation is what makes the throughline reconstructable.

- **Pipeline.** The whole process for one role.
- **Stage.** A phase, such as Portfolio Review or Technical Panel, with an order and a stop-on-fail flag.
- **Review.** One evaluation slot in a stage, assigned to a reviewer role and backed by a scorecard.
- **Scorecard.** A reusable template for a discipline, holding criteria and red flags.
- **Criterion.** A scored dimension from one to five, with a weight, a rubric, and a subjective flag.
- **Rubric.** The anchored description of what low and high mean for a criterion.
- **Red flag.** A disqualifying signal, scored apart from the number.
- **Evaluation.** A reviewer's completed assessment of one review. Metadata only.
- **Score, note, flag.** The separated children of an evaluation.
- **Result.** Computed per evaluation: a weighted score, a signal, and any override.
- **Stage outcome.** In progress, cleared, did not clear, or needs decision.
- **Candidate state.** The operational state of one candidate.
- **Decision.** A recorded human gate action: who, when, what, and why.
- **Override.** An audited change to a result or outcome, kept beside the original.

Signal bands, framed as recommendations rather than verdicts, are Strong, Mixed, and Concern. A red flag can force a Concern regardless of the number. The needs-decision outcome exists precisely because the system refuses to auto-decide: the reviews are complete or in conflict, and a person must commit the gate.

## The engine

Three pure functions over an in-memory store, with no database required.

- **computeResult.** Loads an evaluation's scores and the scorecard's weights, computes a weighted score, applies any red-flag override, and assigns a signal band.
- **resolveStage.** Gathers a stage's revealed evaluations, applies stop-on-fail, measures the spread across reviewers, and returns the outcome. High disagreement routes to needs decision. All clear means ready to advance, still as a human action.
- **recommendNext.** Determines the next stage and surfaces a recommendation. It never moves or rejects a candidate on its own. A person commits the decision, and it is recorded.

## Assignment and routing

Reviewers are assigned from a pool configured per review. When a stage becomes active, open reviews auto-assign from their pool by round-robin, with panel rotation preferring reviewers not already on other reviews for the same candidate. Optional per-review conditions refine this: a seniority floor relative to the candidate, and load-aware distribution to the least-busy eligible reviewer. Declared conflicts of interest, raised by an admin or by a reviewer recusing themselves, exclude a reviewer from routing entirely. A reviewer is notified only when it is actually their turn, once every stage above theirs has cleared.

## Persistence

No backend. The app ships with a populated demo dataset. A visitor's additions and edits layer on top of it in browser storage, persistent for them across reloads, with a reset that restores the original. Every visitor gets a full sandbox they can freely change, with nothing shared to corrupt. It builds to a static folder that can be hosted anywhere.

## Seed data

Two pipelines, one engine, with shapes different enough to show the meta-system at work.

- **Senior Product Designer.** Application and Portfolio Review, Hiring Manager Review, a Portfolio Deep-Dive panel, and Values and Collaboration. Criteria: Design Craft, Systems Thinking, Product Judgment, Communication, and Collaboration, the last two subjective. Red flags: borrowed work presented as one's own, and hostility toward feedback.
- **Backend Engineer.** Resume Screen, Technical Phone Screen, Technical Panel, and Values and Collaboration. Criteria: Technical Ability, Systems Design, Problem Solving, Communication, and Collaboration, the last two subjective. Red flags: dishonesty about experience, and a plagiarized take-home.

Candidates are seeded at different states, including one mid-panel with reviewers in genuine disagreement, so the needs-decision path and the spread display are visible immediately, and one blocked by a red flag.

## Where this goes next

- **Leveling.** A scorecard parameterized by level rather than duplicated per level.
- **Candidate experience.** Status visibility and structured feedback on a decline, treating the process as a brand statement.
- **Reviewer calibration.** Tracking scoring tendencies and normalizing for them.
- **Closing the loop.** Comparing predicted strength at hire against actual performance on the job.
- **AI as assistant and auditor.** Summaries that orient a reviewer without scoring, and bias auditing pointed at reviewers' written evaluations rather than at candidates.

## Stack

Vite, React, and Tailwind, with a seeded dataset and browser storage, and no backend. A light and dark theme that follows the system preference with a manual override. It runs locally and builds to a static folder for hosting.
