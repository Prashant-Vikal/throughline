// Pure lookups over a plain state object (db). No mutation, no side effects.

export const getPipeline = (db, id) => db.pipelines.find((p) => p.id === id);
export const getCandidate = (db, id) => db.candidates.find((c) => c.id === id);
export const getScorecard = (db, id) => db.scorecards.find((s) => s.id === id);
export const getReviewer = (db, id) => db.reviewers.find((r) => r.id === id);
export const getState = (db, candidateId) =>
  db.candidateState.find((s) => s.candidateId === candidateId);

export const getPipelineForCandidate = (db, candidateId) => {
  const cand = getCandidate(db, candidateId);
  return cand ? getPipeline(db, cand.pipelineId) : undefined;
};

export const getStage = (db, pipelineId, stageId) => {
  const p = getPipeline(db, pipelineId);
  return p ? p.stages.find((s) => s.id === stageId) : undefined;
};

// The single evaluation a reviewer submitted for one candidate+review.
export const getEvaluation = (db, candidateId, reviewId) =>
  db.evaluations.find(
    (e) => e.candidateId === candidateId && e.reviewId === reviewId,
  );

export const getScoresFor = (db, evaluationId) =>
  db.scores.filter((s) => s.evaluationId === evaluationId);
export const getNotesFor = (db, evaluationId) =>
  db.notes.filter((n) => n.evaluationId === evaluationId);
export const getFlagsFor = (db, evaluationId) =>
  db.flags.filter((f) => f.evaluationId === evaluationId);
