import {
  getEvaluation,
  getScoresFor,
  getNotesFor,
  getFlagsFor,
  getScorecard,
  getReviewer,
} from './selectors.js';

// Find which scorecard a review uses (a review lives inside a stage's pipeline).
function scorecardForReview(db, reviewId) {
  for (const p of db.pipelines) {
    for (const stage of p.stages) {
      const review = stage.reviews.find((r) => r.id === reviewId);
      if (review) return getScorecard(db, review.scorecardId);
    }
  }
  return undefined;
}

// computeResult — derive one review's result from its scores + scorecard.
// Returns null when the evaluation does not exist (review not yet done).
// NEVER stored: the throughline is reconstructed from evidence every time.
export function computeResult(db, candidateId, reviewId) {
  const evaluation = getEvaluation(db, candidateId, reviewId);
  if (!evaluation) return null;

  const scorecard = scorecardForReview(db, reviewId);
  if (!scorecard) return null;

  const scores = getScoresFor(db, evaluation.id);
  const notes = getNotesFor(db, evaluation.id);
  const flags = getFlagsFor(db, evaluation.id);

  // Weighted average across the criteria that were actually scored.
  let weightSum = 0;
  let weighted = 0;
  const perCriterion = scorecard.criteria.map((crit) => {
    const score = scores.find((s) => s.criterionId === crit.id);
    const value = score ? score.value : null;
    if (value != null) {
      weighted += value * crit.weight;
      weightSum += crit.weight;
    }
    return {
      criterion: crit,
      value,
      note: notes.find((n) => n.criterionId === crit.id)?.text ?? null,
    };
  });

  const weightedScore = weightSum > 0 ? weighted / weightSum : null;
  const redFlagOverride = flags.length > 0;

  // Red flags override the number entirely — a different kind of fact.
  let signal;
  if (redFlagOverride) signal = 'concern';
  else if (weightedScore == null) signal = 'incomplete';
  else if (weightedScore >= db.config.bands.strong) signal = 'strong';
  else if (weightedScore >= db.config.bands.mixed) signal = 'mixed';
  else signal = 'concern';

  return {
    evaluationId: evaluation.id,
    reviewId,
    reviewer: getReviewer(db, evaluation.reviewerId),
    submittedAt: evaluation.submittedAt,
    lockedAt: evaluation.lockedAt,
    locked: !!evaluation.lockedAt,
    weightedScore,
    signal,
    redFlagOverride,
    flags: flags.map((f) => ({
      ...f,
      label: scorecard.redFlags.find((rf) => rf.id === f.redFlagId)?.label ?? f.redFlagId,
    })),
    perCriterion,
    scorecard,
  };
}
