import React, { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import {
  computeResult,
  resolveStage,
  recommendNext,
  getPipelineForCandidate,
  getState,
  getCandidate,
} from '../engine/index.js';
import { OUTCOME, SIGNAL, PERSONAS, REVIEWER_ROLES, meetsSeniority, hasConflict } from './constants.js';
import { isValidEmail } from './Surfaces.jsx';
import { Eyebrow, Badge } from './ui.jsx';

// A channel is only offered if the recipient has the contact info for it.
const hasEmail = (r) => isValidEmail(r?.email);
const hasSlack = (r) => !!(r?.slackHandle && r.slackHandle.trim());
const noContactNote = (c) => (c === 'slack' ? 'No Slack handle on file' : 'No email on file');

// ---- Main view ----------------------------------------------------------------

export function DecisionView({ candidateId, persona, onBack }) {
  const { db, actions } = useStore();
  const candidate = getCandidate(db, candidateId);
  const pipeline = getPipelineForCandidate(db, candidateId);
  const state = getState(db, candidateId);
  const rec = recommendNext(db, candidateId);

  const [deciding, setDeciding] = useState(null); // 'advance' | 'decline' | 'hire'
  const [rationale, setRationale] = useState('');
  const [rationaleError, setRationaleError] = useState(false);

  if (!candidate || !pipeline || !state) {
    return (
      <div className="py-10 text-center text-ink-faint">Candidate not found.</div>
    );
  }

  const isAdmin = persona?.role === 'admin';
  const archived = !!candidate.archived; // archived → read-only, no actions
  const terminal = state.status === 'declined' || state.status === 'hired';
  const inert = archived || terminal; // no assignment / notification / gate actions
  const stages = [...pipeline.stages].sort((a, b) => a.order - b.order);

  function commitDecision(action) {
    if (!rationale.trim()) { setRationaleError(true); return; }
    setRationaleError(false);

    actions.recordDecision({
      candidateId,
      stageId: rec?.stage?.id,
      action,
      decidedBy: persona.id,
      rationale: rationale.trim(),
    });

    // Update candidate state. Advance must move the pipeline for ANY stage
    // state (cleared, or "advance anyway" from needs-decision / did-not-clear),
    // so derive the next stage from the pipeline rather than rec.nextStage
    // (which the engine only sets on the cleared path).
    if (action === 'hire') {
      actions.setCandidateState(candidateId, { status: 'hired' });
    } else if (action === 'decline') {
      actions.setCandidateState(candidateId, { status: 'declined' });
    } else if (action === 'advance') {
      const idx = stages.findIndex((s) => s.id === state.currentStageId);
      const next = stages[idx + 1];
      if (next) {
        actions.setCandidateState(candidateId, {
          currentStageId: next.id,
          currentReviewId: next.reviews[0]?.id ?? null,
          status: 'awaiting_review',
        });
        // The next stage just became active → auto-distribute + notify.
        actions.activateAssignments(candidateId);
      } else {
        // Advancing past the final stage is a hire.
        actions.setCandidateState(candidateId, { status: 'hired' });
      }
    }

    setDeciding(null);
    setRationale('');
  }

  const pastDecisions = db.decisions.filter((d) => d.candidateId === candidateId);

  return (
    <section className="rise">
      {/* Header */}
      <header className="mb-6 border-b border-line pb-5">
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink transition"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to candidates
        </button>
        <Eyebrow>Decision &amp; Traceability</Eyebrow>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight text-ink">
              {candidate.name}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {pipeline.role} · {pipeline.level} · via {candidate.source}
            </p>
            <ContactLinks candidate={candidate} />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <CandidateStatusBadge status={state.status} />
            {archived && <Badge cls="border-line bg-line/50 text-ink-faint">Archived</Badge>}
          </div>
        </div>
      </header>

      {inert && (
        <div className="mb-5 rounded-xl2 border border-line bg-line/30 px-4 py-3 text-sm text-ink-soft">
          {archived ? (
            <>This candidate is <span className="font-medium text-ink">archived</span> — their record is read-only. Restore them on the Candidates tab to assign, notify, or act on a decision.</>
          ) : state.status === 'hired' ? (
            <>This candidate was <span className="font-medium text-ink">hired</span> — the pipeline is closed and the record is read-only.</>
          ) : (
            <>This candidate was <span className="font-medium text-ink">declined</span> — the pipeline is closed and the record is read-only.</>
          )}
        </div>
      )}

      {/* Thread */}
      <div className="relative">
        {/* Brass vertical thread line */}
        <div
          className="absolute left-[11px] top-4 bottom-4 w-px bg-thread-soft opacity-40"
          aria-hidden
        />

        <div className="flex flex-col gap-0">
          {stages.map((stage, idx) => {
            const resolution = resolveStage(db, candidateId, stage.id);
            const isCurrent = stage.id === state.currentStageId;
            const isPast = isPastStage(stages, idx, state.currentStageId);
            const isFuture = !isCurrent && !isPast;

            return (
              <StageNode
                key={stage.id}
                stage={stage}
                resolution={resolution}
                isCurrent={isCurrent}
                isPast={isPast}
                isFuture={isFuture}
                db={db}
                candidateId={candidateId}
                pipeline={pipeline}
                candidate={candidate}
                persona={persona}
                actions={actions}
                inert={inert}
                defaultExpanded={isCurrent || isPast}
              />
            );
          })}
        </div>
      </div>

      {/* System recommendation */}
      {rec && (
        <div className="mt-8 rounded-xl2 border border-thread/30 bg-thread-wash px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-thread mb-1">
            System recommendation
          </div>
          <p className="text-sm font-medium text-ink">{rec.message}</p>
          {rec.requiresHuman && (
            <p className="mt-1 text-xs text-ink-soft">
              This is a recommendation, not a decision. Only a person can commit this gate.
            </p>
          )}
        </div>
      )}

      {/* Gate decision — VP/admin only; inert for archived candidates */}
      {rec?.requiresHuman && state.status !== 'hired' && state.status !== 'declined' && archived && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-xs text-ink-faint">Gate decision:</span>
          {gateActions(rec.kind).map(({ action, label }) => (
            <button
              key={action}
              disabled
              title="Archived — restore to act"
              className="cursor-not-allowed rounded-lg border border-line bg-panel px-4 py-2 text-sm font-medium text-ink-faint opacity-40"
            >
              {label}
            </button>
          ))}
          <span className="text-xs text-ink-faint italic">archived — restore to act</span>
        </div>
      )}
      {rec?.requiresHuman && state.status !== 'hired' && state.status !== 'declined' && !archived && (
        <div className="mt-5">
          {deciding ? (
            <div className="rounded-xl2 border border-line bg-panel p-5 shadow-card">
              <div className="mb-3 text-sm font-medium text-ink">
                Recording a {decidingLabel(deciding)} decision — provide a rationale
              </div>
              <textarea
                className={`w-full rounded-lg border bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-thread transition resize-none ${
                  rationaleError ? 'border-concern' : 'border-line'
                }`}
                rows={3}
                placeholder="What did you observe? What evidence supports this decision? (required)"
                value={rationale}
                onChange={(e) => { setRationale(e.target.value); setRationaleError(false); }}
              />
              {rationaleError && (
                <p className="mt-1 text-xs text-concern">A written rationale is required before committing this decision.</p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => commitDecision(deciding)}
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft"
                >
                  Commit {decidingLabel(deciding)}
                </button>
                <button
                  onClick={() => { setDeciding(null); setRationale(''); setRationaleError(false); }}
                  className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft transition hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-ink-faint">Gate decision:</span>
              {gateActions(rec.kind).map(({ action, label, cls }) => (
                <button
                  key={action}
                  onClick={() => isAdmin ? setDeciding(action) : undefined}
                  disabled={!isAdmin}
                  title={isAdmin ? undefined : 'Only the VP / admin persona can commit gate decisions'}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    isAdmin
                      ? cls
                      : 'cursor-not-allowed border-line bg-panel text-ink-faint opacity-50'
                  }`}
                >
                  {label}
                </button>
              ))}
              {!isAdmin && (
                <span className="text-xs text-ink-faint italic">
                  Switch to the VP persona to commit a decision.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Past decisions ledger */}
      {pastDecisions.length > 0 && (
        <div className="mt-8 border-t border-line pt-5">
          <Eyebrow>Decision ledger</Eyebrow>
          <div className="mt-3 flex flex-col gap-2">
            {pastDecisions.map((d) => {
              const decider = db.reviewers.find((r) => r.id === d.decidedBy);
              return (
                <div
                  key={d.id}
                  className="rounded-xl2 border border-line bg-panel px-4 py-3 shadow-card"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                    <span className="font-mono uppercase tracking-wider text-thread">
                      {d.action}
                    </span>
                    <span>·</span>
                    <span>{decider?.name ?? d.decidedBy}</span>
                    <span>·</span>
                    <span>{fmt(d.decidedAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{d.rationale}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conflicts of interest — declared facts, system-enforced */}
      <ConflictsSection candidateId={candidateId} db={db} actions={actions} isAdmin={isAdmin} persona={persona} />
    </section>
  );
}

// ---- Conflicts of interest ----------------------------------------------------

function ConflictsSection({ candidateId, db, actions, isAdmin, persona }) {
  const conflicts = (db.conflicts ?? []).filter((c) => c.candidateId === candidateId);
  const [reviewerId, setReviewerId] = useState('');
  const [reason, setReason] = useState('');

  // Active reviewers not already conflicted with this candidate.
  const declarable = db.reviewers.filter(
    (r) => r.active !== false && !hasConflict(db.conflicts, candidateId, r.id),
  );

  function declare() {
    if (!reviewerId || !reason.trim()) return;
    actions.declareConflict({ candidateId, reviewerId, declaredBy: persona?.id ?? 'admin', source: 'admin', reason: reason.trim() });
    setReviewerId('');
    setReason('');
  }

  return (
    <div className="mt-8 border-t border-line pt-5">
      <Eyebrow>Conflicts of interest</Eyebrow>
      <p className="mt-1.5 max-w-[60ch] text-xs text-ink-faint">
        Declared facts, enforced by routing — a conflicted reviewer is never assigned this candidate.
        Nothing here is auto-detected.
      </p>

      {conflicts.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {conflicts.map((c) => {
            const reviewer = db.reviewers.find((r) => r.id === c.reviewerId);
            const decider = db.reviewers.find((r) => r.id === c.declaredBy);
            return (
              <div key={c.id} className="rounded-xl2 border border-concern/30 bg-concern-wash/30 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                  <span className="font-medium text-concern">⚑ {reviewer?.name ?? c.reviewerId}</span>
                  <span>·</span>
                  <Badge cls="border-line bg-paper text-ink-soft">{c.source === 'self' ? 'recused' : 'declared'}</Badge>
                  <span>·</span>
                  <span>{c.source === 'self' ? 'self' : decider?.name ?? c.declaredBy}</span>
                  <span>·</span>
                  <span className="font-mono">{fmt(c.declaredAt)}</span>
                </div>
                <p className="mt-1 text-sm text-ink-soft">{c.reason}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">No conflicts declared for this candidate.</p>
      )}

      {isAdmin && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl2 border border-line bg-panel px-4 py-3 shadow-card">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Reviewer</label>
            <select
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
              className="rounded-lg border border-line bg-paper px-2.5 py-2 text-sm text-ink-soft focus:border-thread focus:outline-none"
            >
              <option value="">Choose a reviewer…</option>
              {declarable.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.title ? ` — ${r.title}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Former manager"
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-thread focus:outline-none"
            />
          </div>
          <button
            onClick={declare}
            disabled={!reviewerId || !reason.trim()}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            Declare conflict
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Stage node ---------------------------------------------------------------

function StageNode({ stage, resolution, isCurrent, isPast, isFuture, db, candidateId, pipeline, candidate, persona, actions, inert, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const outcome = resolution?.outcome ?? 'in_progress';
  const o = OUTCOME[outcome] ?? OUTCOME.in_progress;

  const submittedReviews = (resolution?.reviews ?? []).filter((r) => r.result);
  const pendingReviews = (resolution?.reviews ?? []).filter((r) => !r.result);

  return (
    <div className="relative flex gap-4 pb-6">
      {/* Thread node */}
      <div className="relative z-10 flex-shrink-0">
        <ThreadNode outcome={outcome} isFuture={isFuture} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pt-0.5">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-start justify-between gap-3 text-left group"
        >
          <div>
            <div className="font-medium text-ink group-hover:text-thread transition">
              {stage.name}
            </div>
            {resolution?.spread > 0 && outcome === 'needs_decision' && (
              <div className="mt-0.5 font-mono text-[10px] text-mixed">
                spread {resolution.spread.toFixed(2)} pts across reviewers
              </div>
            )}
            {resolution?.stopReason && outcome === 'did_not_clear' && (
              <div className="mt-0.5 text-xs text-concern">{resolution.stopReason}</div>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Badge cls={o.cls}>{o.label}</Badge>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
              className={`text-ink-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
            >
              <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
        </button>

        {expanded && (
          <div className="mt-3">
            {/* Spread callout */}
            {outcome === 'needs_decision' && resolution?.spread >= 1 && (
              <SpreadCallout resolution={resolution} />
            )}

            {/* Submitted reviews, side by side — the revealed trace */}
            {submittedReviews.length > 0 && (
              <div className={`mt-3 grid gap-3 ${submittedReviews.length > 2 ? 'grid-cols-1 md:grid-cols-3' : submittedReviews.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-sm'}`}>
                {submittedReviews.map(({ review, result }) => (
                  <ReviewCard key={review.id} review={review} result={result} db={db} />
                ))}
              </div>
            )}

            {/* Pending reviews — assignment + simulated notifications */}
            {pendingReviews.length > 0 && (
              <div className="mt-3 flex flex-col gap-3">
                {pendingReviews.map(({ review }) => (
                  <AssignmentRow
                    key={review.id}
                    review={review}
                    db={db}
                    candidateId={candidateId}
                    candidate={candidate}
                    pipeline={pipeline}
                    persona={persona}
                    actions={actions}
                    stageActive={isCurrent}
                    inert={inert}
                  />
                ))}
              </div>
            )}

            {isFuture && submittedReviews.length === 0 && pendingReviews.length === 0 && (
              <p className="mt-2 text-xs text-ink-faint italic">Not yet reached.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Spread callout -----------------------------------------------------------

function SpreadCallout({ resolution }) {
  const scored = resolution.reviews
    .filter((r) => r.result?.weightedScore != null)
    .sort((a, b) => (b.result.weightedScore ?? 0) - (a.result.weightedScore ?? 0));

  return (
    <div className="rounded-lg border border-mixed/40 bg-mixed-wash px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-mixed mb-1.5">
        Reviewer disagreement · spread {resolution.spread.toFixed(2)} pts
      </div>
      <p className="text-xs text-ink-soft mb-2">
        {resolution.stopReason}
      </p>
      <div className="flex flex-wrap gap-3">
        {scored.map(({ review, result }) => (
          <div key={review.id} className="flex items-center gap-2">
            <span className="text-xs text-ink-soft">{result.reviewer?.name ?? '—'}</span>
            <span className="font-mono text-sm font-medium text-ink">
              {result.weightedScore?.toFixed(2)}
            </span>
            <Badge cls={SIGNAL[result.signal]?.cls ?? ''}>
              {SIGNAL[result.signal]?.label ?? result.signal}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Review card (expandable to per-criterion trace) --------------------------

function ReviewCard({ review, result, db }) {
  const [open, setOpen] = useState(false);

  if (!result) {
    return (
      <div className="rounded-xl2 border border-line bg-panel px-4 py-3 shadow-card opacity-60">
        <div className="text-xs font-medium text-ink-soft">{review.label}</div>
        <div className="mt-1 text-xs text-ink-faint italic">Not yet submitted</div>
      </div>
    );
  }

  const sig = SIGNAL[result.signal] ?? SIGNAL.incomplete;

  return (
    <div className={`rounded-xl2 border shadow-card ${result.redFlagOverride ? 'border-concern/40 bg-concern-wash/30' : 'border-line bg-panel'}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="text-xs font-medium text-ink-soft">{review.label}</div>
          <div className="mt-0.5 text-sm font-medium text-ink truncate">
            {result.reviewer?.name ?? '—'}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {result.weightedScore != null && (
              <span className="font-mono text-sm font-semibold text-ink tabular">
                {result.weightedScore.toFixed(2)}
              </span>
            )}
            <Badge cls={sig.cls}>{sig.label}</Badge>
            <span className="font-mono text-[10px] uppercase tracking-wider text-strong">✓ completed</span>
          </div>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden
          className={`mt-1 flex-shrink-0 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {/* Red flags — always visible when present */}
      {result.flags?.length > 0 && (
        <div className="border-t border-concern/20 px-4 py-2">
          {result.flags.map((f) => {
            const note = db.flags.find((df) => df.id === f.id);
            return (
              <div key={f.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="stroke-concern">
                    <path d="M6 2V7M6 9.5V10" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="6" cy="6" r="5" strokeWidth="1" />
                  </svg>
                  <span className="text-xs font-medium text-concern">{f.label}</span>
                </div>
                {note?.note && (
                  <p className="ml-4 text-xs text-ink-soft">{note.note}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Per-criterion trace (expanded) */}
      {open && result.perCriterion?.length > 0 && (
        <div className="border-t border-line">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-ink-faint">
                <th className="px-4 py-2 font-medium">Criterion</th>
                <th className="px-4 py-2 font-medium text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.perCriterion.map(({ criterion, value, note }) => (
                <tr key={criterion.id} className="align-top">
                  <td className="px-4 py-2">
                    <div className="font-medium text-ink-soft">
                      {criterion.name}
                      {criterion.subjective && (
                        <span className="ml-1 font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                          subjective
                        </span>
                      )}
                    </div>
                    {note && (
                      <div className="mt-1 text-xs text-ink-faint italic">&ldquo;{note}&rdquo;</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className={`font-mono font-semibold tabular ${scoreColor(value)}`}>
                      {value ?? '—'}
                    </span>
                    <span className="ml-0.5 text-ink-faint">/5</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-line px-4 py-2 text-right">
            <span className="text-xs text-ink-faint">Locked </span>
            <span className="font-mono text-xs text-ink-faint">{fmt(result.lockedAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Assignment + simulated notifications -------------------------------------

function AssignmentRow({ review, db, candidateId, candidate, pipeline, persona, actions, stageActive, inert }) {
  const isAdmin = persona?.role === 'admin';
  const archived = !!inert; // inert (archived / declined / hired) → read-only, no assign/notify
  const assignment = activeAssignment(db, candidateId, review.id);
  const reviewer = assignment ? db.reviewers.find((r) => r.id === assignment.reviewerId) : null;
  const roleLabel = REVIEWER_ROLES.find((x) => x.id === review.reviewerRole)?.label ?? review.reviewerRole;
  const eligible = db.reviewers.filter((r) => r.active !== false && r.role === review.reviewerRole);
  const poolIds = review.pool ?? [];
  const noPool = poolIds.length === 0;
  // Narrow the pool the way routing does: active → not conflicted → seniority.
  const activePool = poolIds.filter((id) => {
    const r = db.reviewers.find((x) => x.id === id);
    return r && r.active !== false;
  });
  const afterConflict = activePool.filter((id) => !hasConflict(db.conflicts, candidateId, id));
  const afterSeniority = afterConflict.filter((id) =>
    meetsSeniority(db.reviewers.find((x) => x.id === id), review, candidate),
  );
  const conflictBlocked = !noPool && activePool.length > 0 && afterConflict.length === 0;
  const seniorityBlocked = !noPool && afterConflict.length > 0 && afterSeniority.length === 0;
  // Is the currently-assigned reviewer now conflicted? (declared after assignment)
  const assignedConflicted = assignment && hasConflict(db.conflicts, candidateId, assignment.reviewerId);
  // …or inactivated while still holding this open, unsubmitted assignment?
  const assignedInactive = assignment && reviewer && reviewer.active === false;

  return (
    <div className="rounded-xl2 border border-line bg-panel shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">{review.label}</div>
          <div className="mt-0.5 text-xs text-ink-faint">
            Needs a {roleLabel.toLowerCase()} · not yet submitted
          </div>
        </div>
        <AssignmentStateBadge assignment={assignment} reviewer={reviewer} stageActive={stageActive} />
      </div>

      <div className="border-t border-line px-4 py-3">
        {archived ? (
          <p className="text-xs text-ink-faint">
            {assignment ? `Assigned to ${reviewer?.name ?? '—'}. ` : ''}Read-only — this candidate&rsquo;s pipeline is closed.
          </p>
        ) : (
          <>
        {assignedConflicted && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-concern/40 bg-concern-wash/40 px-3 py-2">
            <span className="text-xs font-medium text-concern">
              ⚑ {reviewer?.name} has a declared conflict — reassign this review.
            </span>
            {isAdmin && (
              <button
                onClick={() => { actions.cancelAssignment(candidateId, review.id); actions.activateAssignments(candidateId); }}
                className="rounded-lg border border-concern/40 px-2.5 py-1 text-xs text-concern transition hover:bg-concern hover:text-paper"
              >
                Reassign automatically
              </button>
            )}
          </div>
        )}
        {assignedInactive && !assignedConflicted && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-mixed/40 bg-mixed-wash/40 px-3 py-2">
            <span className="text-xs font-medium text-mixed">
              ⚑ {reviewer?.name} is inactive — reassign this review.
            </span>
            {isAdmin && (
              <button
                onClick={() => { actions.cancelAssignment(candidateId, review.id); actions.activateAssignments(candidateId); }}
                className="rounded-lg border border-mixed/40 px-2.5 py-1 text-xs text-mixed transition hover:bg-mixed hover:text-paper"
              >
                Reassign automatically
              </button>
            )}
          </div>
        )}
        {!assignment && noPool && (
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            No pool configured — set one in the Pipeline Builder, or assign manually below.
          </p>
        )}
        {!assignment && conflictBlocked && (
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-concern">
            No eligible reviewer — remaining pool members have declared conflicts.
          </p>
        )}
        {!assignment && seniorityBlocked && (
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-mixed">
            No pool member meets the seniority requirement — assign manually or adjust the pool.
          </p>
        )}
        {isAdmin ? (
          eligible.length === 0 ? (
            <p className="text-xs text-concern">
              No active {roleLabel.toLowerCase()} available to assign — add one in the Team tab.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Reassign freely before submission — selection never notifies */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-faint">
                  {assignment ? 'Reassign' : `Assign a ${roleLabel.toLowerCase()}`}:
                </span>
                <select
                  value={assignment?.reviewerId ?? ''}
                  onChange={(e) => {
                    const rid = e.target.value;
                    if (rid && rid !== assignment?.reviewerId) {
                      actions.assignReviewer({ candidateId, reviewId: review.id, reviewerId: rid });
                    }
                  }}
                  className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-thread/40 focus:border-thread focus:outline-none"
                >
                  {!assignment && <option value="">Choose a reviewer…</option>}
                  {eligible.map((r) => {
                    const conflicted = hasConflict(db.conflicts, candidateId, r.id);
                    return (
                      <option key={r.id} value={r.id} disabled={conflicted}>
                        {r.name}{r.title ? ` — ${r.title}` : ''}{conflicted ? ' (conflict)' : ''}
                      </option>
                    );
                  })}
                </select>
                {assignment && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    selecting won&rsquo;t notify
                  </span>
                )}
              </div>

              {/* Notification only when this stage is the active one */}
              {assignment && (
                stageActive ? (
                  <NotificationPanel
                    assignment={assignment}
                    reviewer={reviewer}
                    candidate={candidate}
                    review={review}
                    pipeline={pipeline}
                    canEdit={isAdmin}
                    actions={actions}
                  />
                ) : (
                  <WaitingToOpen reviewer={reviewer} />
                )
              )}
            </div>
          )
        ) : (
          <p className="text-xs text-ink-faint">
            {assignment
              ? stageActive
                ? `Assigned to ${reviewer?.name ?? '—'}.`
                : `Assigned to ${reviewer?.name ?? '—'} — will be notified when this stage opens.`
              : 'Unassigned — only a VP can assign a reviewer.'}
          </p>
        )}
          </>
        )}
      </div>
    </div>
  );
}

function WaitingToOpen({ reviewer }) {
  return (
    <div className="rounded-lg border border-line bg-paper/60 px-3 py-2 text-xs text-ink-soft">
      <span className="font-medium text-ink">Assigned to {reviewer?.name ?? '—'}</span> — will be
      notified when this stage opens. Earlier stages must clear first; nothing is sent until then.
    </div>
  );
}

function AssignmentStateBadge({ assignment, reviewer, stageActive }) {
  if (!assignment) return <Badge cls="border-line bg-line/40 text-ink-faint">Unassigned</Badge>;
  if (assignment.status === 'completed')
    return <Badge cls="text-strong bg-strong-wash border-strong/30">Completed · {reviewer?.name}</Badge>;
  const notified = (assignment.notifications ?? []).length > 0;
  const label = !stageActive
    ? `Assigned · awaiting stage`
    : notified
    ? `Assigned · notified`
    : `Assigned · not yet notified`;
  return (
    <Badge cls="border-thread/30 bg-thread-wash text-thread">
      {label} · {reviewer?.name ?? '—'}
      {reviewer?.active === false && ' (inactive)'}
    </Badge>
  );
}

// Channel toggle that disables (never hides) a channel with no contact info,
// so the dependency on what's on file stays visible.
function ChannelPicker({ avail, channel, onPick }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        {['email', 'slack'].map((c) => (
          <button
            key={c}
            disabled={!avail[c]}
            title={avail[c] ? '' : noContactNote(c)}
            onClick={() => avail[c] && onPick(c)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              !avail[c]
                ? 'cursor-not-allowed border border-line text-ink-faint opacity-50'
                : channel === c
                ? 'bg-ink text-paper'
                : 'border border-line text-ink-soft hover:text-ink'
            }`}
          >
            {c === 'email' ? 'Email' : 'Slack'}
          </button>
        ))}
      </div>
      {!avail.email && <span className="text-[10px] text-ink-faint">No email on file</span>}
      {!avail.slack && <span className="text-[10px] text-ink-faint">No Slack handle on file</span>}
    </div>
  );
}

function NotificationPanel({ assignment, reviewer, candidate, review, pipeline, canEdit, actions }) {
  const avail = { email: hasEmail(reviewer), slack: hasSlack(reviewer) };
  const anyChannel = avail.email || avail.slack;
  const lastCh = assignment.notifications?.at(-1)?.channel;
  // Default to the last channel used (if still available), else the first available.
  const initial = lastCh && avail[lastCh] ? lastCh : avail.email ? 'email' : avail.slack ? 'slack' : 'email';
  const [channel, setChannel] = useState(initial);
  const log = assignment.notifications ?? [];
  const preview = anyChannel ? buildNotification(channel, { reviewer, candidate, review, pipeline }) : null;

  return (
    <div className="border-t border-line bg-paper/50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-thread">
          Notification preview (simulated — nothing is actually sent)
        </div>
        <ChannelPicker avail={avail} channel={channel} onPick={setChannel} />
      </div>

      {anyChannel ? (
        <>
          <div className="mt-2 rounded-lg border border-line bg-panel p-3">
            <div className="text-xs text-ink-faint">
              To: <span className="font-mono text-ink-soft">{recipientFor(reviewer, channel)}</span>
            </div>
            {channel === 'email' && (
              <div className="mt-0.5 text-xs text-ink-faint">
                Subject: <span className="text-ink-soft">{preview.subject}</span>
              </div>
            )}
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">{preview.body}</p>
          </div>

          {canEdit && (
            <button
              onClick={() =>
                actions.addNotification(assignment.id, buildNotification(channel, { reviewer, candidate, review, pipeline }))
              }
              className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft transition hover:border-thread/40 hover:text-ink"
            >
              {log.length ? 'Resend' : 'Notify now'} via {channel === 'email' ? 'Email' : 'Slack'}
            </button>
          )}
        </>
      ) : (
        <div className="mt-2 rounded-lg border border-concern/30 bg-concern-wash/40 p-3 text-xs text-ink-soft">
          No contact method on file for <span className="font-medium">{reviewer?.name}</span>. Add an
          email or Slack handle on the <span className="font-medium text-ink">Team</span> tab to notify them.
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Sent log ({log.length})
          </div>
          <ul className="mt-1 flex flex-col gap-1">
            {log.map((n, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-ink-faint">
                <Badge cls="border-line bg-paper text-ink-soft">{n.channel === 'email' ? 'Email' : 'Slack'}</Badge>
                <span className="font-mono">{fmtTime(n.sentAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- Thread node dot ----------------------------------------------------------

function ThreadNode({ outcome, isFuture }) {
  const colors = {
    cleared: 'bg-strong border-strong/40',
    needs_decision: 'bg-mixed border-mixed/40',
    did_not_clear: 'bg-concern border-concern/40',
    in_progress: 'bg-thread border-thread/40',
  };
  const cls = isFuture
    ? 'bg-paper border-line'
    : colors[outcome] ?? colors.in_progress;

  return (
    <div
      className={`mt-1.5 h-[22px] w-[22px] rounded-full border-2 ${cls} shadow-card`}
    />
  );
}

// ---- Candidate contact + links ------------------------------------------------

function ContactLinks({ candidate }) {
  const links = [
    ['Resume', candidate.resumeUrl],
    ['Portfolio', candidate.portfolioUrl],
    ['Website', candidate.websiteUrl],
    ['GitHub', candidate.githubUrl],
  ].filter(([, url]) => url);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {candidate.email && (
        <a
          href={`mailto:${candidate.email}`}
          className="font-mono text-ink-soft underline decoration-line underline-offset-2 transition hover:text-thread"
        >
          {candidate.email}
        </a>
      )}
      {links.map(([label, url]) => (
        <a
          key={label}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-2 py-0.5 text-ink-soft transition hover:border-thread/40 hover:text-thread"
        >
          {label}
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M3 1h6v6M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      ))}
    </div>
  );
}

// ---- Candidate status badge ---------------------------------------------------

function CandidateStatusBadge({ status }) {
  const map = {
    hired: 'text-strong bg-strong-wash border-strong/30',
    declined: 'text-concern bg-concern-wash border-concern/30',
    needs_decision: 'text-mixed bg-mixed-wash border-mixed/40',
    awaiting_decision: 'text-mixed bg-mixed-wash border-mixed/40',
    awaiting_review: 'text-ink-soft bg-line/40 border-line',
  };
  const label = {
    hired: 'Hired',
    declined: 'Declined',
    needs_decision: 'Needs decision',
    awaiting_decision: 'Awaiting decision',
    awaiting_review: 'In review',
  };
  return (
    <Badge cls={map[status] ?? 'text-ink-soft bg-line/40 border-line'}>
      {label[status] ?? status}
    </Badge>
  );
}

// ---- Helpers ------------------------------------------------------------------

function isPastStage(stages, idx, currentStageId) {
  const currentIdx = stages.findIndex((s) => s.id === currentStageId);
  return idx < currentIdx;
}

function gateActions(kind) {
  if (kind === 'recommend_advance') {
    return [
      { action: 'advance', label: 'Advance', cls: 'border-strong/40 bg-strong-wash text-strong hover:bg-strong hover:text-paper' },
      { action: 'decline', label: 'Decline', cls: 'border-concern/40 bg-concern-wash text-concern hover:bg-concern hover:text-paper' },
    ];
  }
  if (kind === 'recommend_hire') {
    return [
      { action: 'hire', label: 'Extend offer', cls: 'border-strong/40 bg-strong-wash text-strong hover:bg-strong hover:text-paper' },
      { action: 'decline', label: 'Decline', cls: 'border-concern/40 bg-concern-wash text-concern hover:bg-concern hover:text-paper' },
    ];
  }
  if (kind === 'recommend_decline' || kind === 'review_together') {
    return [
      { action: 'decline', label: 'Confirm decline', cls: 'border-concern/40 bg-concern-wash text-concern hover:bg-concern hover:text-paper' },
      { action: 'advance', label: 'Advance anyway', cls: 'border-line bg-panel text-ink-soft hover:text-ink' },
    ];
  }
  return [];
}

function decidingLabel(action) {
  return { advance: 'advance', decline: 'decline', hire: 'hire' }[action] ?? action;
}

function scoreColor(value) {
  if (value == null) return 'text-ink-faint';
  if (value >= 4) return 'text-strong';
  if (value >= 3) return 'text-mixed';
  return 'text-concern';
}

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// The current live (non-cancelled) assignment for a review, newest first.
function activeAssignment(db, candidateId, reviewId) {
  const all = (db.assignments ?? []).filter(
    (a) => a.candidateId === candidateId && a.reviewId === reviewId && a.status !== 'cancelled',
  );
  return all.sort((a, b) => Date.parse(b.assignedAt) - Date.parse(a.assignedAt))[0] ?? null;
}

const firstName = (name = '') => name.trim().split(/\s+/)[0] || 'there';

function recipientFor(reviewer, channel) {
  if (!reviewer) return '—';
  if (channel === 'slack') return reviewer.slackHandle || '—';
  return reviewer.email ? `${reviewer.name} <${reviewer.email}>` : '—';
}

// Build a simulated notification. PREVIEW ONLY — never actually sent.
function buildNotification(channel, { reviewer, candidate, review, pipeline }) {
  const who = firstName(reviewer?.name);
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
