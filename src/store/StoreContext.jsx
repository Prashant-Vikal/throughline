import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadDb, saveDb, resetDb, newId } from './store.js';
import { meetsSeniority, hasConflict } from '../components/constants.js';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [db, setDb] = useState(loadDb);

  useEffect(() => {
    saveDb(db);
  }, [db]);

  // --- pipeline-shaped immutable updates ---------------------------------
  const editPipeline = useCallback((pipelineId, fn) => {
    setDb((prev) => ({
      ...prev,
      pipelines: prev.pipelines.map((p) => (p.id === pipelineId ? fn(p) : p)),
    }));
  }, []);

  // --- scorecard-shaped immutable updates --------------------------------
  const editScorecard = useCallback((scorecardId, fn) => {
    setDb((prev) => ({
      ...prev,
      scorecards: prev.scorecards.map((s) => (s.id === scorecardId ? fn(s) : s)),
    }));
  }, []);

  const actions = {
    reset: () => setDb(resetDb()),

    addPipeline: ({ role, level, discipline }) => {
      const id = newId('p');
      const pipeline = { id, role, level, discipline, stages: [] };
      setDb((prev) => ({ ...prev, pipelines: [...prev.pipelines, pipeline] }));
      return id;
    },

    updatePipeline: (id, patch) =>
      editPipeline(id, (p) => ({ ...p, ...patch })),

    deletePipeline: (id) =>
      setDb((prev) => ({ ...prev, pipelines: prev.pipelines.filter((p) => p.id !== id) })),

    addStage: (pipelineId, name) =>
      editPipeline(pipelineId, (p) => ({
        ...p,
        stages: [
          ...p.stages,
          { id: newId('s'), name, order: p.stages.length + 1, reviews: [] },
        ],
      })),

    updateStage: (pipelineId, stageId, patch) =>
      editPipeline(pipelineId, (p) => ({
        ...p,
        stages: p.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)),
      })),

    deleteStage: (pipelineId, stageId) =>
      editPipeline(pipelineId, (p) => ({
        ...p,
        stages: reindex(p.stages.filter((s) => s.id !== stageId)),
      })),

    moveStage: (pipelineId, stageId, dir) =>
      editPipeline(pipelineId, (p) => ({ ...p, stages: reindex(move(p.stages, stageId, dir)) })),

    addReview: (pipelineId, stageId, review) =>
      editPipeline(pipelineId, (p) => ({
        ...p,
        stages: p.stages.map((s) =>
          s.id === stageId
            ? {
                ...s,
                reviews: [
                  ...s.reviews,
                  {
                    id: newId('r'),
                    label: review.label || 'New review',
                    reviewerRole: review.reviewerRole || 'reviewer',
                    scorecardId: review.scorecardId,
                    order: s.reviews.length + 1,
                    stopOnFail: !!review.stopOnFail,
                  },
                ],
              }
            : s,
        ),
      })),

    updateReview: (pipelineId, stageId, reviewId, patch) =>
      editPipeline(pipelineId, (p) => ({
        ...p,
        stages: p.stages.map((s) =>
          s.id === stageId
            ? { ...s, reviews: s.reviews.map((r) => (r.id === reviewId ? { ...r, ...patch } : r)) }
            : s,
        ),
      })),

    deleteReview: (pipelineId, stageId, reviewId) =>
      editPipeline(pipelineId, (p) => ({
        ...p,
        stages: p.stages.map((s) =>
          s.id === stageId
            ? { ...s, reviews: reindex(s.reviews.filter((r) => r.id !== reviewId)) }
            : s,
        ),
      })),

    moveReview: (pipelineId, stageId, reviewId, dir) =>
      editPipeline(pipelineId, (p) => ({
        ...p,
        stages: p.stages.map((s) =>
          s.id === stageId ? { ...s, reviews: reindex(move(s.reviews, reviewId, dir)) } : s,
        ),
      })),

    // --- Scorecard editor actions (immutable) --------------------------------
    // A scorecard is a reusable evaluation template: criteria (each weighted,
    // with a rubric and a subjective flag) plus red flags.

    addScorecard: ({ name, discipline } = {}) => {
      const id = newId('sc');
      setDb((prev) => {
        const scorecard = {
          id,
          name: name || 'New scorecard',
          // Default to a discipline from the shared list so it's always a valid entry.
          discipline: discipline || prev.disciplines?.[0] || 'General',
          criteria: [],
          redFlags: [],
        };
        return { ...prev, scorecards: [...prev.scorecards, scorecard] };
      });
      return id;
    },

    updateScorecard: (id, patch) => editScorecard(id, (s) => ({ ...s, ...patch })),

    addCriterion: (scorecardId) =>
      editScorecard(scorecardId, (s) => ({
        ...s,
        criteria: [
          ...s.criteria,
          {
            id: newId('c'),
            name: 'New criterion',
            weight: 0,
            subjective: false,
            rubric: { low: '', high: '' },
          },
        ],
      })),

    updateCriterion: (scorecardId, criterionId, patch) =>
      editScorecard(scorecardId, (s) => ({
        ...s,
        criteria: s.criteria.map((c) =>
          c.id === criterionId
            ? { ...c, ...patch, rubric: { ...c.rubric, ...(patch.rubric ?? {}) } }
            : c,
        ),
      })),

    deleteCriterion: (scorecardId, criterionId) =>
      editScorecard(scorecardId, (s) => ({
        ...s,
        criteria: s.criteria.filter((c) => c.id !== criterionId),
      })),

    moveCriterion: (scorecardId, criterionId, dir) =>
      editScorecard(scorecardId, (s) => ({ ...s, criteria: move(s.criteria, criterionId, dir) })),

    addRedFlag: (scorecardId, label) =>
      editScorecard(scorecardId, (s) => ({
        ...s,
        redFlags: [...s.redFlags, { id: newId('rf'), label: label || 'New red flag' }],
      })),

    updateRedFlag: (scorecardId, redFlagId, patch) =>
      editScorecard(scorecardId, (s) => ({
        ...s,
        redFlags: s.redFlags.map((rf) => (rf.id === redFlagId ? { ...rf, ...patch } : rf)),
      })),

    deleteRedFlag: (scorecardId, redFlagId) =>
      editScorecard(scorecardId, (s) => ({
        ...s,
        redFlags: s.redFlags.filter((rf) => rf.id !== redFlagId),
      })),

    // --- Reviewer roster actions (immutable) ---------------------------------
    // The roster is the "who reviewed" half of the model. Because every past
    // evaluation must always resolve to a real person, removal is soft when a
    // reviewer is load-bearing for the audit trail.

    addReviewer: ({ name, title, role, email, slackHandle, discipline, seniority } = {}) => {
      const id = newId('u');
      const reviewer = {
        id,
        name: name || 'New reviewer',
        title: title || '',
        role: role || 'reviewer', // PERMISSION axis
        email: email || '', // optional; missing on seeded reviewers = empty
        slackHandle: slackHandle || '', // optional Slack handle (e.g. "@devon")
        discipline: discipline || '', // DISCIPLINE axis (from db.disciplines)
        seniority: seniority || 'Mid', // SENIORITY axis
        active: true,
      };
      setDb((prev) => ({ ...prev, reviewers: [...prev.reviewers, reviewer] }));
      return id;
    },

    updateReviewer: (id, patch) =>
      setDb((prev) => ({
        ...prev,
        reviewers: prev.reviewers.map((r) => {
          if (r.id !== id) return r;
          let p = patch;
          // The super-admin is the permanent owner: it can never be deactivated
          // or demoted away from admin — enforced here, not just in the UI.
          if (r.isSuperAdmin) {
            p = { ...patch };
            if (p.active === false) delete p.active;
            if (p.role && p.role !== 'admin') delete p.role;
          }
          return { ...r, ...p };
        }),
      })),

    // Add a discipline to the shared managed list (de-duplicated, trimmed).
    // Used by both reviewers and scorecards.
    addDiscipline: (name) =>
      setDb((prev) => {
        const value = (name || '').trim();
        const list = prev.disciplines ?? [];
        if (!value || list.some((d) => d.toLowerCase() === value.toLowerCase())) return prev;
        return { ...prev, disciplines: [...list, value] };
      }),

    // Archive (= inactivate) a reviewer: reversible, keeps the record, removes
    // them from active participation. Never the protected super-admin.
    archiveReviewer: (id) =>
      setDb((prev) => {
        const t = prev.reviewers.find((r) => r.id === id);
        if (!t || t.isSuperAdmin) return prev; // super-admin is permanent
        return { ...prev, reviewers: prev.reviewers.map((r) => (r.id === id ? { ...r, active: false } : r)) };
      }),

    restoreReviewer: (id) =>
      setDb((prev) => ({
        ...prev,
        reviewers: prev.reviewers.map((r) => (r.id === id ? { ...r, active: true } : r)),
      })),

    // Hard delete a reviewer — only when nothing is orphaned: no evaluations AND
    // no assignments on record. Never the super-admin. Otherwise a no-op (the UI
    // blocks it and offers archive instead).
    deleteReviewer: (id) =>
      setDb((prev) => {
        const t = prev.reviewers.find((r) => r.id === id);
        if (!t || t.isSuperAdmin) return prev;
        const hasEvals = prev.evaluations.some((e) => e.reviewerId === id);
        const hasAssignments = (prev.assignments ?? []).some((a) => a.reviewerId === id);
        if (hasEvals || hasAssignments) return prev; // blocked — would orphan history
        return { ...prev, reviewers: prev.reviewers.filter((r) => r.id !== id) };
      }),

    // --- Candidate archive / delete (mirrors the reviewer pattern) -----------
    // Archive: reversible, keeps the throughline, withdraws from active flow.
    archiveCandidate: (id) =>
      setDb((prev) => ({
        ...prev,
        candidates: prev.candidates.map((c) => (c.id === id ? { ...c, archived: true } : c)),
      })),

    restoreCandidate: (id) =>
      setDb((prev) => ({
        ...prev,
        candidates: prev.candidates.map((c) => (c.id === id ? { ...c, archived: false } : c)),
      })),

    // Hard delete a candidate — only when no evaluations would be orphaned.
    // Cleans up their operational rows (state, assignments); never an evaluated
    // candidate (the UI blocks it and offers archive).
    deleteCandidate: (id) =>
      setDb((prev) => {
        if (prev.evaluations.some((e) => e.candidateId === id)) return prev; // blocked
        return {
          ...prev,
          candidates: prev.candidates.filter((c) => c.id !== id),
          candidateState: prev.candidateState.filter((s) => s.candidateId !== id),
          assignments: (prev.assignments ?? []).filter((a) => a.candidateId !== id),
        };
      }),

    // --- Reviewer assignment + simulated notifications -----------------------
    // db.assignments may be absent on older sandboxes → always read with `?? []`.
    // Notifications are PREVIEWS only; nothing is ever actually sent.

    // Assign (or reassign) a reviewer to a review. Selection NEVER notifies —
    // assignment and notification are separate events. Any existing live
    // assignment for the same review is cancelled (kept for the record, never
    // erased), then a fresh one is created with an empty notification log.
    // A declared conflict is a HARD block — the reviewer is never assigned.
    assignReviewer: ({ candidateId, reviewId, reviewerId }) => {
      const id = newId('as');
      const now = new Date().toISOString();
      setDb((prev) => {
        if (hasConflict(prev.conflicts, candidateId, reviewerId)) return prev; // conflict → blocked
        // Inert candidates (archived / declined / hired) take no new assignments.
        const cand = prev.candidates.find((c) => c.id === candidateId);
        const st = prev.candidateState.find((s) => s.candidateId === candidateId);
        if (cand?.archived || st?.status === 'declined' || st?.status === 'hired') return prev;
        const assignments = (prev.assignments ?? []).map((a) =>
          a.candidateId === candidateId &&
          a.reviewId === reviewId &&
          (a.status === 'assigned' || a.status === 'in_progress')
            ? { ...a, status: 'cancelled' }
            : a,
        );
        const assignment = {
          id,
          candidateId,
          reviewId,
          reviewerId,
          status: 'assigned',
          assignedAt: now,
          completedAt: null,
          notifications: [],
        };
        return { ...prev, assignments: [...assignments, assignment] };
      });
      return id;
    },

    // Declare a conflict of interest (admin or self-recusal). Appended to an
    // auditable collection — never deletes, mirrors the decision ledger.
    declareConflict: ({ candidateId, reviewerId, declaredBy, source, reason }) =>
      setDb((prev) => {
        const conflict = {
          id: newId('cf'),
          candidateId,
          reviewerId,
          declaredBy,
          source: source === 'self' ? 'self' : 'admin',
          reason: (reason || '').trim(),
          declaredAt: new Date().toISOString(),
        };
        return { ...prev, conflicts: [...(prev.conflicts ?? []), conflict] };
      }),

    // Cancel a review's live assignment (kept as 'cancelled', never erased) so
    // distribution can refill it — used when a conflicted reviewer is assigned.
    cancelAssignment: (candidateId, reviewId) =>
      setDb((prev) => ({
        ...prev,
        assignments: (prev.assignments ?? []).map((a) =>
          a.candidateId === candidateId &&
          a.reviewId === reviewId &&
          (a.status === 'assigned' || a.status === 'in_progress')
            ? { ...a, status: 'cancelled' }
            : a,
        ),
      })),

    // Auto-distribute + notify the candidate's ACTIVE stage. Fired when a stage
    // becomes active (candidate creation, or advancing to the next stage):
    //  - reviews with no assignment get one pool member via round-robin, with
    //    panel rotation preferring people not already on this candidate;
    //  - a manual/existing assignment is never overwritten;
    //  - an empty pool is left unassigned (no error);
    //  - then active-stage assignments with no notification yet are notified
    //    (simulated), on a channel the reviewer has on file.
    activateAssignments: (candidateId) =>
      setDb((prev) => {
        const now = new Date().toISOString();
        const cand = prev.candidates.find((c) => c.id === candidateId);
        const pipeline = cand && prev.pipelines.find((p) => p.id === cand.pipelineId);
        const state = prev.candidateState.find((s) => s.candidateId === candidateId);
        const stage = pipeline?.stages.find((s) => s.id === state?.currentStageId);
        if (!cand || !pipeline || !stage) return prev;
        // Inert candidates get no new assignments/notifications.
        if (cand.archived || state.status === 'declined' || state.status === 'hired') return prev;

        let assignments = [...(prev.assignments ?? [])];
        const rotation = { ...(prev.rotation ?? {}) };
        const isLive = (a) => a.status === 'assigned' || a.status === 'in_progress';
        const activeFor = (reviewId) =>
          assignments.find((a) => a.candidateId === candidateId && a.reviewId === reviewId && isLive(a));
        const activeReviewer = (id) => {
          const r = prev.reviewers.find((x) => x.id === id);
          return r && r.active !== false;
        };

        // Who is already on this candidate (any review) — for panel rotation.
        const used = new Set(
          assignments.filter((a) => a.candidateId === candidateId && isLive(a)).map((a) => a.reviewerId),
        );
        const thisStage = new Set(); // people taken during this pass

        // Open-assignment load per reviewer (across all candidates) — recomputed
        // each pick so in-pass assignments count toward balance.
        const openCountOf = (reviewerId) =>
          assignments.filter(
            (a) =>
              a.reviewerId === reviewerId &&
              isLive(a) &&
              !prev.evaluations.some((e) => e.candidateId === a.candidateId && e.reviewId === a.reviewId),
          ).length;

        // 1. Auto-assign empty reviews from their pool (with optional conditions).
        for (const review of [...stage.reviews].sort((a, b) => a.order - b.order)) {
          if (activeFor(review.id)) { thisStage.add(activeFor(review.id).reviewerId); continue; } // manual/existing wins
          // pool → remove conflicted → seniority filter (optional) → rotation → pick.
          const pool = (review.pool ?? [])
            .filter(activeReviewer)
            .filter((id) => !hasConflict(prev.conflicts, candidateId, id))
            .filter((id) => meetsSeniority(prev.reviewers.find((r) => r.id === id), review, cand));
          if (!pool.length) continue; // empty (no pool, or filtered out) → leave unassigned
          const loadAware = !!review.conditions?.loadAware;
          const pick = choosePoolMember(pool, used, thisStage, rotation[review.id] ?? 0, loadAware ? openCountOf : null);
          assignments.push({
            id: newId('as'),
            candidateId,
            reviewId: review.id,
            reviewerId: pick.chosen,
            status: 'assigned',
            assignedAt: now,
            completedAt: null,
            notifications: [],
          });
          rotation[review.id] = pick.nextPointer;
          used.add(pick.chosen);
          thisStage.add(pick.chosen);
        }

        // 2. Notify active-stage assignments that haven't been notified yet.
        assignments = assignments.map((a) => {
          if (a.candidateId !== candidateId || !isLive(a)) return a;
          const review = stage.reviews.find((r) => r.id === a.reviewId);
          if (!review || (a.notifications ?? []).length > 0) return a;
          const reviewer = prev.reviewers.find((r) => r.id === a.reviewerId);
          const channel = pickChannel(reviewer);
          if (!channel) return a; // no contact method → nothing sent
          const notif = { ...buildNotif(channel, { reviewer, candidate: cand, review, pipeline }), sentAt: now, read: false };
          return { ...a, notifications: [notif] };
        });

        return { ...prev, assignments, rotation };
      }),

    // Append another simulated notification (e.g. a reminder) to an assignment.
    addNotification: (assignmentId, notification) =>
      setDb((prev) => {
        // Defensive: don't notify for a closed/archived candidate.
        const a = (prev.assignments ?? []).find((x) => x.id === assignmentId);
        if (!a) return prev;
        const cand = prev.candidates.find((c) => c.id === a.candidateId);
        const st = prev.candidateState.find((s) => s.candidateId === a.candidateId);
        if (!cand || cand.archived || st?.status === 'declined' || st?.status === 'hired') return prev;
        return {
          ...prev,
          assignments: (prev.assignments ?? []).map((x) =>
            x.id === assignmentId
              ? { ...x, notifications: [...(x.notifications ?? []), { ...notification, sentAt: new Date().toISOString(), read: false }] }
              : x,
          ),
        };
      }),

    // Mark every notification addressed to a reviewer as read (bell opened).
    markNotificationsReadFor: (reviewerId) =>
      setDb((prev) => ({
        ...prev,
        assignments: (prev.assignments ?? []).map((a) =>
          a.reviewerId === reviewerId
            ? { ...a, notifications: (a.notifications ?? []).map((n) => (n.read ? n : { ...n, read: true })) }
            : a,
        ),
      })),

    // --- Decision & state actions (immutable — never deletes) ----------------

    recordDecision: ({ candidateId, stageId, action, decidedBy, rationale }) => {
      const id = newId('d');
      const decision = {
        id,
        candidateId,
        stageId,
        action,
        decidedBy,
        decidedAt: new Date().toISOString(),
        rationale,
      };
      setDb((prev) => ({ ...prev, decisions: [...prev.decisions, decision] }));
    },

    // Update the candidate's operational state row (advance, hire, decline).
    setCandidateState: (candidateId, patch) =>
      setDb((prev) => ({
        ...prev,
        candidateState: prev.candidateState.map((s) =>
          s.candidateId === candidateId
            ? { ...s, ...patch, updatedAt: new Date().toISOString() }
            : s,
        ),
      })),

    // Add a candidate and initialise their state at stage 1 of the pipeline.
    // id is the join key; email is a validated human identifier (validated in
    // the form). resume/portfolio/etc are LINKS only — no upload in this demo.
    addCandidate: ({ name, email, pipelineId, source, seniority, resumeUrl, portfolioUrl, websiteUrl, githubUrl }) => {
      const id = newId('cand');
      const now = new Date().toISOString();
      setDb((prev) => {
        const pipeline = prev.pipelines.find((p) => p.id === pipelineId);
        const stages = pipeline ? [...pipeline.stages].sort((a, b) => a.order - b.order) : [];
        const firstStage = stages[0] ?? null;
        const firstReview = firstStage
          ? [...firstStage.reviews].sort((a, b) => a.order - b.order)[0] ?? null
          : null;
        const candidate = {
          id,
          name,
          email,
          source: source || 'Added manually',
          pipelineId,
          seniority: seniority || 'Mid',
          createdAt: now.slice(0, 10),
          resumeUrl: resumeUrl || '',
          portfolioUrl: portfolioUrl || '',
          websiteUrl: websiteUrl || '',
          githubUrl: githubUrl || '',
        };
        const state = {
          candidateId: id,
          currentStageId: firstStage?.id ?? null,
          currentReviewId: firstReview?.id ?? null,
          status: 'awaiting_review',
          updatedAt: now,
        };
        return {
          ...prev,
          candidates: [...prev.candidates, candidate],
          candidateState: [...prev.candidateState, state],
        };
      });
      return id;
    },

    // --- Reviewer's desk actions --------------------------------------------
    // A submission is metadata; its scores / notes / flags are separate rows,
    // mirroring the seed shape. The throughline is reconstructed from them.

    // Returns the new evaluation id so the desk can keep editing the draft.
    submitEvaluation: ({ candidateId, reviewId, reviewerId, scores, notes, flags }) => {
      const evId = newId('ev');
      const now = new Date().toISOString();

      setDb((prev) => {
        // Defensive: never accept a new evaluation for a closed/archived candidate.
        const cand = prev.candidates.find((c) => c.id === candidateId);
        const st = prev.candidateState.find((s) => s.candidateId === candidateId);
        if (!cand || cand.archived || st?.status === 'declined' || st?.status === 'hired') return prev;
        const stageId = stageIdForReview(prev, reviewId);
        const evaluation = {
          id: evId, candidateId, stageId, reviewId, reviewerId,
          submittedAt: now, lockedAt: null,
        };
        return {
          ...prev,
          evaluations: [...prev.evaluations, evaluation],
          scores: [...prev.scores, ...scoreRows(evId, scores)],
          notes: [...prev.notes, ...noteRows(evId, notes)],
          flags: [...prev.flags, ...flagRows(evId, flags)],
          // A matching live assignment is now fulfilled → mark it completed.
          assignments: completeAssignmentsFor(prev.assignments, candidateId, reviewId, now),
          candidateState: advanceWithinStage(prev, candidateId, stageId, [...prev.evaluations, evaluation]),
        };
      });
      return evId;
    },

    // Edit an UNLOCKED draft during the grace window: replace its children.
    // Never touches a locked evaluation — that is the permanent record.
    editEvaluation: (evaluationId, { scores, notes, flags }) =>
      setDb((prev) => {
        const ev = prev.evaluations.find((e) => e.id === evaluationId);
        if (!ev || ev.lockedAt) return prev; // locked → immutable
        return {
          ...prev,
          scores: [...prev.scores.filter((s) => s.evaluationId !== evaluationId), ...scoreRows(evaluationId, scores)],
          notes: [...prev.notes.filter((n) => n.evaluationId !== evaluationId), ...noteRows(evaluationId, notes)],
          flags: [...prev.flags.filter((f) => f.evaluationId !== evaluationId), ...flagRows(evaluationId, flags)],
        };
      }),

    // Lock a submission: stamp lockedAt. After this it is immutable forever.
    lockEvaluation: (evaluationId) =>
      setDb((prev) => ({
        ...prev,
        evaluations: prev.evaluations.map((e) =>
          e.id === evaluationId && !e.lockedAt ? { ...e, lockedAt: new Date().toISOString() } : e,
        ),
      })),
  };

  return <StoreContext.Provider value={{ db, actions }}>{children}</StoreContext.Provider>;
}

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};

// helpers
const reindex = (arr) => arr.map((x, i) => ({ ...x, order: i + 1 }));
function move(arr, id, dir) {
  const i = arr.findIndex((x) => x.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// --- Reviewer's desk helpers (pure; operate on a db snapshot) --------------

// Expand the form's {criterionId: value} into separate score rows.
const scoreRows = (evId, scores = {}) =>
  Object.entries(scores)
    .filter(([, v]) => v != null)
    .map(([criterionId, value]) => ({ id: `${evId}_${criterionId}`, evaluationId: evId, criterionId, value }));

// Only criteria with actual written evidence become note rows.
const noteRows = (evId, notes = {}) =>
  Object.entries(notes)
    .filter(([, t]) => t && t.trim())
    .map(([criterionId, text]) => ({ id: `n_${evId}_${criterionId}`, evaluationId: evId, criterionId, text: text.trim() }));

// Triggered red flags, each carrying its required note.
const flagRows = (evId, flags = []) =>
  flags.map((f, i) => ({
    id: `f_${evId}_${i}`,
    evaluationId: evId,
    redFlagId: f.redFlagId,
    criterionId: f.criterionId ?? null,
    note: (f.note ?? '').trim(),
  }));

// Pick a pool member. Panel rotation first narrows to a tier: members not
// already on this candidate (`used`); failing that, not taken in this same
// stage pass (`thisStage`); failing that, the whole pool. Within that tier:
//  - load-aware (openCountOf given): the fewest open assignments, ties broken
//    by round-robin order;
//  - otherwise: plain round-robin (first in rotated order) — IDENTICAL to the
//    prior behavior for unconditioned reviews.
function choosePoolMember(pool, used, thisStage, pointer, openCountOf) {
  const start = ((pointer % pool.length) + pool.length) % pool.length;
  const ordered = [];
  for (let i = 0; i < pool.length; i++) ordered.push(pool[(start + i) % pool.length]);

  let tier = ordered.filter((id) => !used.has(id));
  if (!tier.length) tier = ordered.filter((id) => !thisStage.has(id));
  if (!tier.length) tier = ordered;

  const chosen = openCountOf
    ? tier.reduce((best, id) => (openCountOf(id) < openCountOf(best) ? id : best), tier[0])
    : tier[0];
  return { chosen, nextPointer: (pool.indexOf(chosen) + 1) % pool.length };
}

// Notification helpers (store-side mirror of the desk's availability rules so
// auto-distribution can notify without a UI round-trip). Email needs a valid
// email on file; Slack needs a handle. No contact → no channel → nothing sent.
const NOTIF_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pickChannel = (r) =>
  NOTIF_EMAIL_RE.test((r?.email || '').trim().toLowerCase())
    ? 'email'
    : r?.slackHandle && r.slackHandle.trim()
    ? 'slack'
    : null;

const firstNameOf = (name = '') => name.trim().split(/\s+/)[0] || 'there';

function buildNotif(channel, { reviewer, candidate, review, pipeline }) {
  const who = firstNameOf(reviewer?.name);
  if (channel === 'slack') {
    return {
      channel: 'slack',
      body:
        `Hi ${who} — you've been asked to evaluate *${candidate?.name}* for the ${pipeline?.role} role. ` +
        `Your review: *${review?.label}*. When you have a moment, open the Reviewer's desk to score against the scorecard — ` +
        `your assessment stays blind to other reviewers until you submit. Thanks! 🙏`,
    };
  }
  return {
    channel: 'email',
    subject: `Review request: ${candidate?.name} — ${review?.label}`,
    body:
      `Hi ${who},\n\n` +
      `You've been asked to evaluate ${candidate?.name} for the ${pipeline?.role} role. ` +
      `Your review is "${review?.label}".\n\n` +
      `When you're ready, open the Reviewer's desk to score against the scorecard. ` +
      `Your assessment stays blind to other reviewers until you submit it — that independence is the point.\n\n` +
      `Thank you,\nThroughline Hiring`,
  };
}

// When a review is submitted, fulfil its live assignment (kept, never deleted).
const completeAssignmentsFor = (assignments, candidateId, reviewId, now) =>
  (assignments ?? []).map((a) =>
    a.candidateId === candidateId &&
    a.reviewId === reviewId &&
    (a.status === 'assigned' || a.status === 'in_progress')
      ? { ...a, status: 'completed', completedAt: now }
      : a,
  );

// Find which stage a review belongs to, across all pipelines.
function stageIdForReview(db, reviewId) {
  for (const p of db.pipelines)
    for (const stage of p.stages)
      if (stage.reviews.some((r) => r.id === reviewId)) return stage.id;
  return null;
}

// After a submission, move the candidate forward WITHIN the stage only.
// When every review in the stage is in, the stage is done being reviewed and
// a human gate is owed — never auto-decided here.
function advanceWithinStage(db, candidateId, stageId, allEvals) {
  const cand = db.candidates.find((c) => c.id === candidateId);
  const pipeline = cand && db.pipelines.find((p) => p.id === cand.pipelineId);
  const stage = pipeline?.stages.find((s) => s.id === stageId);
  if (!stage) return db.candidateState;

  return db.candidateState.map((s) => {
    if (s.candidateId !== candidateId || s.currentStageId !== stageId) return s;
    const remaining = [...stage.reviews]
      .sort((a, b) => a.order - b.order)
      .filter((r) => !allEvals.some((e) => e.candidateId === candidateId && e.reviewId === r.id));
    return remaining.length
      ? { ...s, currentReviewId: remaining[0].id, status: 'awaiting_review', updatedAt: new Date().toISOString() }
      : { ...s, currentReviewId: null, status: 'awaiting_decision', updatedAt: new Date().toISOString() };
  });
}
