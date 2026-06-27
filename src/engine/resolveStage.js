import { computeResult } from './computeResult.js';
import { getPipelineForCandidate } from './selectors.js';

// resolveStage — derive a stage's outcome from its completed reviews.
// Outcomes: 'in_progress' | 'cleared' | 'did_not_clear' | 'needs_decision'
//
// Key corrections baked in here:
//  - stop_on_fail at the review level ends a stage structurally
//  - reviewer DISAGREEMENT is measured (spread), never averaged away;
//    a split panel routes to 'needs_decision' for a human, not a tidy mean
export function resolveStage(db, candidateId, stageId) {
  const pipeline = getPipelineForCandidate(db, candidateId);
  const stage = pipeline?.stages.find((s) => s.id === stageId);
  if (!stage) return null;

  const reviews = [...stage.reviews]
    .sort((a, b) => a.order - b.order)
    .map((review) => ({ review, result: computeResult(db, candidateId, review.id) }));

  const completed = reviews.filter((r) => r.result);
  const scored = completed.filter((r) => r.result.weightedScore != null);

  // 1. stop_on_fail: one disqualifying review ends the stage immediately.
  const blocking = completed.find(
    (r) => r.review.stopOnFail && r.result.signal === 'concern',
  );
  if (blocking) {
    return {
      outcome: 'did_not_clear',
      reviews,
      avgScore: avg(scored),
      spread: spread(scored),
      stopReason: blocking.result.redFlagOverride
        ? `Red flag in "${blocking.review.label}" — ${blocking.result.flags[0]?.label}`
        : `Stop-on-fail review "${blocking.review.label}" raised a concern`,
      summary: { totalReviews: stage.reviews.length, completed: completed.length },
    };
  }

  // 2. Not every required review is in yet → still in progress.
  if (completed.length < stage.reviews.length) {
    return {
      outcome: 'in_progress',
      reviews,
      avgScore: avg(scored),
      spread: spread(scored),
      stopReason: null,
      summary: {
        totalReviews: stage.reviews.length,
        completed: completed.length,
        awaiting: stage.reviews.length - completed.length,
      },
    };
  }

  // 3. All in. Measure disagreement BEFORE collapsing to an average.
  const sp = spread(scored);
  if (sp >= db.config.disagreementThreshold && scored.length > 1) {
    return {
      outcome: 'needs_decision',
      reviews,
      avgScore: avg(scored),
      spread: sp,
      stopReason: `Reviewers disagree by ${sp.toFixed(1)} points — this needs a conversation, not an average`,
      summary: { totalReviews: stage.reviews.length, completed: completed.length, spread: sp },
    };
  }

  // 4. Aligned reviews → the average is meaningful. Still a recommendation.
  const mean = avg(scored);
  return {
    outcome: mean >= db.config.bands.mixed ? 'cleared' : 'did_not_clear',
    reviews,
    avgScore: mean,
    spread: sp,
    stopReason: null,
    summary: { totalReviews: stage.reviews.length, completed: completed.length },
  };
}

const avg = (rows) =>
  rows.length ? rows.reduce((a, r) => a + r.result.weightedScore, 0) / rows.length : null;

const spread = (rows) => {
  if (rows.length < 2) return 0;
  const vals = rows.map((r) => r.result.weightedScore);
  return Math.max(...vals) - Math.min(...vals);
};
