import { resolveStage } from './resolveStage.js';
import { getPipelineForCandidate, getState } from './selectors.js';

// recommendNext — what the system SUGGESTS happens next for a candidate.
// It computes and recommends. It never moves or declines anyone on its own;
// every gate action below carries requiresHuman: true and must be committed
// by a person, with a recorded rationale. That restraint is deliberate.
export function recommendNext(db, candidateId) {
  const pipeline = getPipelineForCandidate(db, candidateId);
  const state = getState(db, candidateId);
  if (!pipeline || !state) return null;

  const stages = [...pipeline.stages].sort((a, b) => a.order - b.order);
  const idx = stages.findIndex((s) => s.id === state.currentStageId);
  const stage = stages[idx];
  const resolution = resolveStage(db, candidateId, stage.id);
  const isLastStage = idx === stages.length - 1;

  if (state.status === 'hired' || state.status === 'declined') {
    return { kind: 'closed', requiresHuman: false, stage, resolution,
      message: state.status === 'hired' ? 'Candidate was hired.' : 'Candidate was declined.' };
  }

  switch (resolution.outcome) {
    case 'in_progress':
      return { kind: 'await_reviews', requiresHuman: false, stage, resolution,
        message: `Waiting on ${resolution.summary.awaiting} of ${resolution.summary.totalReviews} reviews in ${stage.name}.` };

    case 'needs_decision':
      return { kind: 'review_together', requiresHuman: true, stage, resolution,
        message: `${stage.name} is split. Bring the panel together before deciding — do not average it away.` };

    case 'did_not_clear':
      return { kind: 'recommend_decline', requiresHuman: true, stage, resolution,
        message: resolution.stopReason ?? `${stage.name} did not clear. A person should confirm the decline.` };

    case 'cleared':
      return isLastStage
        ? { kind: 'recommend_hire', requiresHuman: true, stage, resolution,
            message: `Cleared the final stage. Recommend extending an offer — your call to commit.` }
        : { kind: 'recommend_advance', requiresHuman: true, stage, resolution, nextStage: stages[idx + 1],
            message: `Cleared ${stage.name}. Recommend advancing to ${stages[idx + 1].name}.` };

    default:
      return { kind: 'await_reviews', requiresHuman: false, stage, resolution, message: '' };
  }
}
