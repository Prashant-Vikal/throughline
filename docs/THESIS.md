# Throughline: thesis and non-goals

*Why this exists, what it argues, and what it deliberately does not do.*

## What this is, and what it is not

Throughline is not an applicant tracking system. An ATS is a system of record. It tracks applicants, stores documents, manages compliance, and integrates with job boards. Throughline does none of that, and it is not trying to.

Throughline is an evaluation layer: a working argument about how hiring decisions should be made. An ATS answers "where is this candidate in the process?" Throughline answers a different question: "are we making this decision well, and can we prove it later?"

Most hiring tools are built around the first question and answer the second one barely at all. That gap is the reason this exists.

## The thesis

Evaluation is a discipline with known failure modes. Anchoring. Bias. False consensus. Unexamined automation. Structure exists to defeat those failure modes, not merely to log activity. A system that is auditable and consistent but never connects that machinery to fairness has optimized for the wrong thing.

Throughline makes that connection explicit, and it enforces it in four places.

## Four positions, enforced

These are not features in the checkbox sense. They are positions, and Throughline takes a side in exactly the places most tools stay neutral.

**The system computes and recommends. People decide.** The engine scores, bands, and recommends. Advancing a candidate, and especially declining one, is always a human action with a recorded rationale. There is no automatic rejection on a threshold. Knowing what not to automate is the point.

**Reviews are blind until they lock.** A reviewer cannot see a peer's scores or notes until their own evaluation is submitted. Independent review is the whole reason structured evaluation works. Without this, a second opinion is an echo of the first.

**Disagreement is surfaced, never averaged away.** A five and a one is not a three. When reviewers diverge, the system shows the spread and routes the stage to a human conversation instead of a tidy mean. Variance is signal, and it is often the most important signal in the loop.

**Extreme scores on subjective criteria require written evidence.** A low score on Collaboration or Communication cannot be submitted without a cited observation. Unexplained low marks on judgment-shaped dimensions are where bias hides. The interface makes evidence the cost of a strong opinion.

## What is different from existing tools

The difference is not "more features." It is that those four positions are enforced rather than suggested.

- Blindness is structural. Peer scores are hidden until lock, not merely discouraged from being read first.
- Disagreement routes to a decision. It is not collapsed into a single averaged number.
- Evidence is required for extreme subjective scores. An unjustified low mark on culture or communication is not accepted.
- Gate decisions are computed and recommended, then committed by a person.

This is not better across the board. It is more opinionated, in the specific places that decide whether a decision is fair and defensible.

## What it does best: traceability as a fairness audit

Any decision can be reconstructed down to the evidence that produced it: which reviewer, which criterion, which score, which note, which red flag, where they disagreed, and who committed the gate and why.

That is an explanation, not a log. Most systems produce a log of what happened. Throughline produces an account of why a decision was justified. As defensible and explainable hiring becomes a legal and ethical expectation rather than a nicety, that account is the artifact you can hand to a hiring committee, a candidate, or an auditor.

## Deliberate non-goals

What a system refuses to do says as much as what it does. Each of these was within reach and left out on purpose.

**AI that rates, ranks, or screens candidates.** This is the most tempting thing to add and the most damaging. It contradicts the thesis directly. The whole system argues that automated scores are inputs and that bias hides in unexamined automation, so handing candidate screening to a model would undo the argument in the most visible way. It is especially wrong for design hiring, where portfolio evaluation is the most craft-sensitive and context-dependent judgment in the pipeline, and the thing a design leader should protect rather than automate.

**A full applicant tracking system.** Competing with mature systems of record is not the purpose, and rebuilding one would dilute the point.

**Automatic rejection at a score threshold.** The most interesting counterintuitive candidates fail at a 2.9. The gate stays human.

**Conflict-of-interest detection from employer name strings.** Matching "ABC Corp" to "ABC Corporation Ltd" is unreliable, and silently excluding the wrong person is worse than not excluding anyone. Conflicts are declared by a human and enforced by the system. Fuzzy detection, if it were ever added, would only raise a flag for a person to confirm, never act on its own.

**A general rules engine for assignment.** Routing is scoped to a curated set of conditions: a seniority floor, reviewer load, declared conflicts, and automatic panel rotation. A general rule-authoring environment is a different and much larger product, and complexity there reads as a lack of judgment rather than a surplus of it.

The line running through every refusal is the same: automate the toil, never the judgment.

## Where this goes next

Named directions, not yet built.

**AI as a triage assistant that summarizes but never scores.** A first pass that orients a reviewer to a resume or portfolio against the scorecard, flagging what a human should look at, while leaving the call to the human. Consistent with the thesis because it assists rather than decides.

**AI as a bias auditor pointed at reviewers, not candidates.** Reading the written evaluations to flag possible bias signals, such as low-score clustering or rationale that leans on personality rather than the work. Same technology as candidate scoring, opposite philosophy. Auditing the evaluation for fairness rather than judging the person is the version that fits.

**Leveling.** A scorecard parameterized by level from junior to principal: the same criteria, a different bar, rather than a duplicate scorecard per level.

**Candidate experience.** Treating the candidate as a user, with status visibility and structured feedback on a decline. The process is a brand statement, and a design leader is well placed to make that argument.

**Reviewer calibration.** Tracking scoring tendencies, since some reviewers never award a five, and normalizing for them.

**Closing the loop.** Comparing predicted strength at hire against actual performance on the job, which is the line between a workflow tool and a system that learns whether its own rubric works.

## In one line

Throughline is an evaluation layer that makes hiring decisions fair and defensible. It computes and recommends, the judgment stays human, and every decision can be traced back to the evidence that produced it.
