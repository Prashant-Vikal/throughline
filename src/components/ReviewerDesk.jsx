import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import {
  computeResult,
  getScorecard,
  getCandidate,
  getState,
  getPipelineForCandidate,
} from '../engine/index.js';
import { SIGNAL, hasConflict } from './constants.js';
import { Eyebrow, Badge } from './ui.jsx';

// =============================================================================
// Reviewer's desk — one reviewer, one candidate, one review. Blind until lock.
// =============================================================================

export function ReviewerDesk({ persona, initialOpen = null }) {
  const { db } = useStore();
  const [open, setOpen] = useState(initialOpen); // { candidateId, reviewId } | { evaluationId }

  // Deep-link from a notification: open the targeted review when it changes.
  useEffect(() => { if (initialOpen) setOpen(initialOpen); }, [initialOpen]);

  // Devon Reyes is the reviewer persona; admins/observers don't get a queue.
  const reviewerId = persona?.id;
  const role = persona?.role;
  const reviewerCanScore = role === 'reviewer' || role === 'hr';

  const { pending, submitted } = useMemo(
    () => buildQueue(db, reviewerId, role),
    [db, reviewerId, role],
  );

  // Keep the open item valid for this persona.
  const openValid =
    open &&
    (open.evaluationId
      ? submitted.some((s) => s.evaluation.id === open.evaluationId)
      : pending.some((p) => p.candidateId === open.candidateId && p.review.id === open.reviewId));

  return (
    <section className="rise">
      <header className="mb-6 border-b border-line pb-5">
        <Eyebrow>Reviewer&rsquo;s desk</Eyebrow>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight text-ink">
              Score what&rsquo;s in front of you
            </h1>
            <p className="mt-1.5 max-w-[56ch] text-sm text-ink-faint">
              You see only your own assignments. Peers&rsquo; scores stay hidden until you submit —
              an independent read is the whole point of structured review.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-panel px-3 py-1.5 text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Reviewing as</div>
            <div className="text-sm font-medium text-ink">{persona?.label}</div>
          </div>
        </div>
      </header>

      {!reviewerCanScore ? (
        <NonReviewerNote persona={persona} />
      ) : openValid ? (
        open.evaluationId ? (
          <SubmittedReview
            evaluationId={open.evaluationId}
            persona={persona}
            onBack={() => setOpen(null)}
          />
        ) : (
          <ScoringForm
            candidateId={open.candidateId}
            reviewId={open.reviewId}
            persona={persona}
            onBack={() => setOpen(null)}
            onSubmitted={(evaluationId) => setOpen({ evaluationId })}
          />
        )
      ) : (
        <Queue pending={pending} submitted={submitted} db={db} onOpen={setOpen} />
      )}
    </section>
  );
}

// --- The queue ---------------------------------------------------------------

function Queue({ pending, submitted, db, onOpen }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="font-display text-xl font-medium text-ink">Needs your review</h2>
          <span className="font-mono text-xs text-thread">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <p className="rounded-xl2 border border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">
            Nothing waiting on you right now.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map(({ candidateId, review, candidate, stage }) => (
              <button
                key={candidateId + review.id}
                onClick={() => onOpen({ candidateId, reviewId: review.id })}
                className="flex items-center justify-between gap-3 rounded-xl2 border border-line bg-panel px-4 py-3 text-left shadow-card transition hover:border-thread/40"
              >
                <div>
                  <div className="font-medium text-ink">{candidate.name}</div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {stage.name} · {review.label}
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-thread">
                  score now →
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="font-display text-xl font-medium text-ink">Your reviews</h2>
          <span className="font-mono text-xs text-ink-faint">{submitted.length}</span>
        </div>
        {submitted.length === 0 ? (
          <p className="text-sm text-ink-faint">You haven&rsquo;t submitted any reviews yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {submitted.map(({ evaluation, candidate, review, result, locked }) => (
              <button
                key={evaluation.id}
                onClick={() => onOpen({ evaluationId: evaluation.id })}
                className="flex items-center justify-between gap-3 rounded-xl2 border border-line bg-panel px-4 py-3 text-left shadow-card transition hover:border-thread/40"
              >
                <div>
                  <div className="font-medium text-ink">{candidate?.name}</div>
                  <div className="mt-0.5 text-xs text-ink-faint">{review?.label}</div>
                </div>
                <div className="flex items-center gap-3">
                  {result?.weightedScore != null && (
                    <span className="font-mono text-sm font-semibold tabular text-ink">
                      {result.weightedScore.toFixed(2)}
                    </span>
                  )}
                  <Badge cls={locked ? 'border-line bg-line/40 text-ink-faint' : 'border-thread/30 bg-thread-wash text-thread'}>
                    {locked ? 'Locked' : 'Editable'}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Scoring form (the blind path) -------------------------------------------

function ScoringForm({ candidateId, reviewId, persona, onBack, onSubmitted }) {
  const { db, actions } = useStore();
  const candidate = getCandidate(db, candidateId);
  const pipeline = getPipelineForCandidate(db, candidateId);
  const { stage, review } = locateReview(pipeline, reviewId);
  const scorecard = getScorecard(db, review?.scorecardId);

  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [flags, setFlags] = useState({}); // redFlagId -> note
  const [attempted, setAttempted] = useState(false);
  const [recusing, setRecusing] = useState(false);
  const [recuseReason, setRecuseReason] = useState('');

  if (!scorecard || !stage) return <BackOnly onBack={onBack} />;

  function recuse() {
    if (!recuseReason.trim()) return;
    actions.declareConflict({
      candidateId,
      reviewerId: persona.id,
      declaredBy: persona.id,
      source: 'self',
      reason: recuseReason.trim(),
    });
    onBack(); // the candidate now leaves this reviewer's queue
  }

  const problems = validate(scorecard, scores, notes, flags);
  const blocked = problems.length > 0;

  function submit() {
    setAttempted(true);
    if (blocked) return;
    const flagList = Object.entries(flags).map(([redFlagId, note]) => ({
      redFlagId,
      criterionId: criterionForFlag(scorecard, redFlagId),
      note,
    }));
    const evId = actions.submitEvaluation({
      candidateId,
      reviewId,
      reviewerId: persona.id,
      scores,
      notes,
      flags: flagList,
    });
    onSubmitted(evId);
  }

  return (
    <div>
      <DeskHeader onBack={onBack} candidate={candidate} stage={stage} review={review} />

      {/* Blind banner */}
      <BlindBanner db={db} candidateId={candidateId} stageId={stage.id} excludeReviewerId={persona.id} />

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Criteria */}
        <div className="flex flex-col gap-3">
          {scorecard.criteria.map((crit) => (
            <CriterionRow
              key={crit.id}
              crit={crit}
              value={scores[crit.id]}
              note={notes[crit.id] ?? ''}
              onScore={(v) => setScores((s) => ({ ...s, [crit.id]: v }))}
              onNote={(t) => setNotes((n) => ({ ...n, [crit.id]: t }))}
              needsEvidence={attempted && evidenceMissing(crit, scores[crit.id], notes[crit.id])}
            />
          ))}

          <RedFlags
            scorecard={scorecard}
            flags={flags}
            onToggle={(rfId) =>
              setFlags((f) => {
                const next = { ...f };
                if (rfId in next) delete next[rfId];
                else next[rfId] = '';
                return next;
              })
            }
            onNote={(rfId, t) => setFlags((f) => ({ ...f, [rfId]: t }))}
            attempted={attempted}
          />
        </div>

        {/* Submit rail */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl2 border border-line bg-panel p-4 shadow-card">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Before you submit
            </div>
            {attempted && blocked ? (
              <ul className="mt-2 flex flex-col gap-1.5">
                {problems.map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs text-concern">
                    <span aria-hidden>•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-ink-faint">
                Low or top marks (1, 2, 5) on a <em>subjective</em> criterion need a written
                observation — that&rsquo;s where bias hides.
              </p>
            )}
            <button
              onClick={submit}
              className="mt-4 w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-ink-soft"
            >
              Submit review
            </button>
            <p className="mt-2 text-center text-[11px] text-ink-faint">
              You&rsquo;ll have a {db.config.gracePeriodMinutes}-minute grace window to edit, then it locks.
            </p>
          </div>

          {/* Self-recusal — a declared conflict, source = self */}
          <div className="mt-3 rounded-xl2 border border-line bg-panel p-4 shadow-card">
            {recusing ? (
              <>
                <div className="text-xs font-medium text-ink">Recuse yourself from {candidate?.name}?</div>
                <textarea
                  value={recuseReason}
                  onChange={(e) => setRecuseReason(e.target.value)}
                  rows={2}
                  placeholder="Why? (e.g. I know this person)"
                  className="mt-2 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-thread focus:outline-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={recuse}
                    disabled={!recuseReason.trim()}
                    className="rounded-lg bg-concern px-3 py-1.5 text-xs font-medium text-paper transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Recuse
                  </button>
                  <button
                    onClick={() => { setRecusing(false); setRecuseReason(''); }}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft transition hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setRecusing(true)}
                className="text-xs text-ink-soft transition hover:text-concern"
              >
                Recuse myself from this candidate
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CriterionRow({ crit, value, note, onScore, onNote, needsEvidence }) {
  return (
    <div className={`rounded-xl2 border bg-panel p-4 shadow-card ${needsEvidence ? 'border-concern/50' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium text-ink">
          {crit.name}
          {crit.subjective && (
            <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-thread">subjective</span>
          )}
        </div>
        <span className="font-mono text-[10px] text-ink-faint">weight {crit.weight}</span>
      </div>

      {/* Rubric anchors */}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Anchor band="1 · low" text={crit.rubric.low} />
        <Anchor band="5 · high" text={crit.rubric.high} />
      </div>

      {/* 1–5 control */}
      <div className="mt-3 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onScore(n)}
            className={`h-9 w-9 rounded-lg border font-mono text-sm transition ${
              value === n
                ? 'border-ink bg-ink text-paper'
                : 'border-line bg-paper text-ink-soft hover:border-thread/40'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Notes */}
      <textarea
        value={note}
        onChange={(e) => onNote(e.target.value)}
        rows={2}
        placeholder={
          crit.subjective
            ? 'Cite a specific observation (required for a 1, 2, or 5)…'
            : 'Notes (optional)…'
        }
        className={`mt-3 w-full resize-none rounded-lg border bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-thread ${
          needsEvidence ? 'border-concern' : 'border-line'
        }`}
      />
      {needsEvidence && (
        <p className="mt-1 text-xs text-concern">
          A {value} on {crit.name} needs a cited observation before this can be submitted.
        </p>
      )}
    </div>
  );
}

function Anchor({ band, text }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{band}</div>
      <p className="mt-0.5 text-xs leading-snug text-ink-soft">{text}</p>
    </div>
  );
}

function RedFlags({ scorecard, flags, onToggle, onNote, attempted }) {
  if (!scorecard.redFlags?.length) return null;
  return (
    <div className="rounded-xl2 border border-line bg-panel p-4 shadow-card">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        Red flags — a different kind of fact
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        These sit apart from the number. Triggering one forces a Concern regardless of the score.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {scorecard.redFlags.map((rf) => {
          const on = rf.id in flags;
          const missingNote = attempted && on && !flags[rf.id]?.trim();
          return (
            <div key={rf.id} className={`rounded-lg border px-3 py-2 ${on ? 'border-concern/40 bg-concern-wash/40' : 'border-line'}`}>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={on} onChange={() => onToggle(rf.id)} className="accent-concern" />
                <span className="text-sm text-ink">{rf.label}</span>
              </label>
              {on && (
                <>
                  <textarea
                    value={flags[rf.id] ?? ''}
                    onChange={(e) => onNote(rf.id, e.target.value)}
                    rows={2}
                    placeholder="What did you observe? A red flag must be evidenced…"
                    className={`mt-2 w-full resize-none rounded-lg border bg-paper px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-thread ${
                      missingNote ? 'border-concern' : 'border-line'
                    }`}
                  />
                  {missingNote && (
                    <p className="mt-1 text-xs text-concern">A triggered red flag requires a written note.</p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Blind banner / peer panel ----------------------------------------------

function BlindBanner({ db, candidateId, stageId, excludeReviewerId }) {
  const peers = db.evaluations.filter(
    (e) => e.candidateId === candidateId && e.stageId === stageId && e.reviewerId !== excludeReviewerId,
  );
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl2 border border-line bg-line/30 px-4 py-3">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="mt-0.5 flex-shrink-0 text-ink-faint">
        <path d="M2 9C3.5 5.5 6 4 9 4s5.5 1.5 7 5c-1.5 3.5-4 5-7 5s-5.5-1.5-7-5Z" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="9" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 15L15 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <div className="text-sm text-ink-soft">
        <span className="font-medium text-ink">Blind review.</span>{' '}
        {peers.length > 0
          ? `${peers.length} other ${peers.length === 1 ? 'review' : 'reviews'} on this stage ${peers.length === 1 ? 'is' : 'are'} sealed until you submit yours.`
          : 'No peer reviews are visible to you while you score.'}{' '}
        An opinion you can&rsquo;t form independently isn&rsquo;t a second opinion.
      </div>
    </div>
  );
}

// --- Submitted review (the revealed path) ------------------------------------

function SubmittedReview({ evaluationId, persona, onBack }) {
  const { db, actions } = useStore();
  const evaluation = db.evaluations.find((e) => e.id === evaluationId);
  if (!evaluation) return <BackOnly onBack={onBack} />;

  const candidate = getCandidate(db, evaluation.candidateId);
  const pipeline = getPipelineForCandidate(db, evaluation.candidateId);
  const { stage, review } = locateReview(pipeline, evaluation.reviewId);
  const result = computeResult(db, evaluation.candidateId, evaluation.reviewId);

  const graceMs = (db.config.gracePeriodMinutes ?? 30) * 60 * 1000;
  const locked = !!evaluation.lockedAt || Date.now() - Date.parse(evaluation.submittedAt) > graceMs;
  const mine = evaluation.reviewerId === persona.id;

  // Peers on the same candidate + stage — revealed now that this reviewer submitted.
  const peers = db.evaluations
    .filter((e) => e.candidateId === evaluation.candidateId && e.stageId === stage?.id && e.id !== evaluation.id)
    .map((e) => ({ e, result: computeResult(db, e.candidateId, e.reviewId) }));

  const [editing, setEditing] = useState(false);

  if (editing && !locked) {
    return (
      <EditForm
        evaluation={evaluation}
        scorecard={result?.scorecard}
        result={result}
        candidate={candidate}
        stage={stage}
        review={review}
        onBack={onBack}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div>
      <DeskHeader onBack={onBack} candidate={candidate} stage={stage} review={review} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge cls={locked ? 'border-line bg-line/40 text-ink-faint' : 'border-thread/30 bg-thread-wash text-thread'}>
          {locked ? 'Locked — immutable' : `Editable · grace window open`}
        </Badge>
        <span className="text-xs text-ink-faint">
          Submitted {fmt(evaluation.submittedAt)}
          {evaluation.lockedAt && ` · locked ${fmt(evaluation.lockedAt)}`}
        </span>
        {mine && !locked && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft transition hover:text-ink"
            >
              Edit
            </button>
            <button
              onClick={() => actions.lockEvaluation(evaluation.id)}
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-paper transition hover:bg-ink-soft"
            >
              Lock now
            </button>
          </div>
        )}
      </div>

      {/* This reviewer's own result */}
      <div className="mt-5">
        <Eyebrow>Your evaluation</Eyebrow>
        <ResultCard result={result} db={db} className="mt-2" />
      </div>

      {/* Revealed peers */}
      <div className="mt-6">
        <Eyebrow>The panel — revealed now that you&rsquo;ve submitted</Eyebrow>
        {peers.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">
            You&rsquo;re the only reviewer on this stage — there&rsquo;s no panel to reveal.
          </p>
        ) : (
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {peers.map(({ e, result: pr }) => (
              <ResultCard key={e.id} result={pr} db={db} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditForm({ evaluation, scorecard, result, candidate, stage, review, onBack, onDone }) {
  const { actions } = useStore();
  const seedScores = {};
  const seedNotes = {};
  result?.perCriterion.forEach((pc) => {
    if (pc.value != null) seedScores[pc.criterion.id] = pc.value;
    if (pc.note) seedNotes[pc.criterion.id] = pc.note;
  });
  const seedFlags = {};
  (result?.flags ?? []).forEach((f) => { seedFlags[f.redFlagId] = f.note ?? ''; });

  const [scores, setScores] = useState(seedScores);
  const [notes, setNotes] = useState(seedNotes);
  const [flags, setFlags] = useState(seedFlags);
  const [attempted, setAttempted] = useState(false);

  const problems = validate(scorecard, scores, notes, flags);
  const blocked = problems.length > 0;

  function save() {
    setAttempted(true);
    if (blocked) return;
    const flagList = Object.entries(flags).map(([redFlagId, note]) => ({
      redFlagId,
      criterionId: criterionForFlag(scorecard, redFlagId),
      note,
    }));
    actions.editEvaluation(evaluation.id, { scores, notes, flags: flagList });
    onDone();
  }

  return (
    <div>
      <DeskHeader onBack={onBack} candidate={candidate} stage={stage} review={review} />
      <p className="mt-3 text-xs text-ink-faint">
        Editing during the grace window. Saving overwrites your draft; once it locks it can&rsquo;t change.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {scorecard.criteria.map((crit) => (
          <CriterionRow
            key={crit.id}
            crit={crit}
            value={scores[crit.id]}
            note={notes[crit.id] ?? ''}
            onScore={(v) => setScores((s) => ({ ...s, [crit.id]: v }))}
            onNote={(t) => setNotes((n) => ({ ...n, [crit.id]: t }))}
            needsEvidence={attempted && evidenceMissing(crit, scores[crit.id], notes[crit.id])}
          />
        ))}
        <RedFlags
          scorecard={scorecard}
          flags={flags}
          onToggle={(rfId) =>
            setFlags((f) => {
              const next = { ...f };
              if (rfId in next) delete next[rfId];
              else next[rfId] = '';
              return next;
            })
          }
          onNote={(rfId, t) => setFlags((f) => ({ ...f, [rfId]: t }))}
          attempted={attempted}
        />
      </div>

      {attempted && blocked && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {problems.map((p, i) => (
            <li key={i} className="text-xs text-concern">• {p}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={save} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft">
          Save changes
        </button>
        <button onClick={onDone} className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft transition hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}

// --- A revealed result card --------------------------------------------------

function ResultCard({ result, db, className = '' }) {
  if (!result) return null;
  const sig = SIGNAL[result.signal] ?? SIGNAL.incomplete;
  return (
    <div className={`rounded-xl2 border shadow-card ${result.redFlagOverride ? 'border-concern/40 bg-concern-wash/30' : 'border-line bg-panel'} ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <div className="text-sm font-medium text-ink">{result.reviewer?.name ?? '—'}</div>
          <div className="text-xs text-ink-faint">{result.reviewer?.title}</div>
        </div>
        <div className="flex items-center gap-2">
          {result.weightedScore != null && (
            <span className="font-mono text-base font-semibold tabular text-ink">
              {result.weightedScore.toFixed(2)}
            </span>
          )}
          <Badge cls={sig.cls}>{sig.label}</Badge>
        </div>
      </div>

      {result.flags?.length > 0 && (
        <div className="border-b border-concern/20 px-4 py-2">
          {result.flags.map((f) => {
            const row = db.flags.find((df) => df.id === f.id);
            return (
              <div key={f.id}>
                <div className="text-xs font-medium text-concern">⚑ {f.label}</div>
                {row?.note && <p className="mt-0.5 text-xs text-ink-soft">{row.note}</p>}
              </div>
            );
          })}
        </div>
      )}

      <table className="w-full text-left text-xs">
        <tbody className="divide-y divide-line">
          {result.perCriterion.map(({ criterion, value, note }) => (
            <tr key={criterion.id} className="align-top">
              <td className="px-4 py-2">
                <div className="text-ink-soft">
                  {criterion.name}
                  {criterion.subjective && (
                    <span className="ml-1 font-mono text-[9px] uppercase tracking-wider text-ink-faint">subj</span>
                  )}
                </div>
                {note && <div className="mt-0.5 italic text-ink-faint">&ldquo;{note}&rdquo;</div>}
              </td>
              <td className="px-4 py-2 text-right">
                <span className={`font-mono font-semibold tabular ${scoreColor(value)}`}>{value ?? '—'}</span>
                <span className="text-ink-faint">/5</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Small pieces ------------------------------------------------------------

function DeskHeader({ onBack, candidate, stage, review }) {
  return (
    <div>
      <button onClick={onBack} className="mb-3 flex items-center gap-1.5 text-xs text-ink-faint transition hover:text-ink">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to your desk
      </button>
      <h2 className="font-display text-2xl font-medium tracking-tight text-ink">{candidate?.name}</h2>
      <p className="mt-1 text-sm text-ink-soft">{stage?.name} · {review?.label}</p>
    </div>
  );
}

function NonReviewerNote({ persona }) {
  return (
    <div className="rounded-xl2 border border-dashed border-line bg-panel px-5 py-8 text-center">
      <p className="text-sm text-ink-soft">
        You&rsquo;re viewing as <strong>{persona?.label}</strong>. The desk shows a reviewer&rsquo;s own
        assignments only.
      </p>
      <p className="mt-1 text-sm text-ink-faint">
        Switch to <strong>Devon Reyes</strong> (Reviewer) in the persona switcher to score blind.
      </p>
    </div>
  );
}

const BackOnly = ({ onBack }) => (
  <button onClick={onBack} className="text-sm text-ink-faint hover:text-ink">← Back to your desk</button>
);

// --- Pure helpers ------------------------------------------------------------

function buildQueue(db, reviewerId, role) {
  const pending = [];
  const submitted = [];

  // Pending: the candidate's current review slot, matching this reviewer's
  // role, not yet submitted by anyone. Mirrors how the seed assigns by role.
  for (const candidate of db.candidates) {
    if (candidate.archived) continue; // archived candidates are inert — no queue
    if (hasConflict(db.conflicts, candidate.id, reviewerId)) continue; // recused / conflicted
    const state = getState(db, candidate.id);
    if (!state || state.status === 'hired' || state.status === 'declined') continue;
    const pipeline = getPipelineForCandidate(db, candidate.id);
    const stage = pipeline?.stages.find((s) => s.id === state.currentStageId);
    if (!stage) continue;
    for (const review of stage.reviews) {
      if (review.reviewerRole !== role) continue;
      const exists = db.evaluations.some((e) => e.candidateId === candidate.id && e.reviewId === review.id);
      if (exists) continue;
      // Surface a review when this reviewer is ASSIGNED to it in the active
      // stage (consistent with who was notified / can act now). Parallel
      // reviews in the same stage are all actionable, not just currentReviewId.
      const assignedToMe = (db.assignments ?? []).some(
        (a) =>
          a.candidateId === candidate.id &&
          a.reviewId === review.id &&
          a.reviewerId === reviewerId &&
          (a.status === 'assigned' || a.status === 'in_progress'),
      );
      const isCurrentSlot = review.id === state.currentReviewId;
      if (!assignedToMe && !isCurrentSlot) continue;
      pending.push({ candidateId: candidate.id, review, candidate, stage });
    }
  }

  // Submitted by this reviewer — their own record, newest first.
  const graceMs = (db.config.gracePeriodMinutes ?? 30) * 60 * 1000;
  for (const e of db.evaluations) {
    if (e.reviewerId !== reviewerId) continue;
    const candidate = getCandidate(db, e.candidateId);
    const pipeline = getPipelineForCandidate(db, e.candidateId);
    const { review } = locateReview(pipeline, e.reviewId);
    const result = computeResult(db, e.candidateId, e.reviewId);
    const locked = !!e.lockedAt || Date.now() - Date.parse(e.submittedAt) > graceMs;
    submitted.push({ evaluation: e, candidate, review, result, locked });
  }
  submitted.sort((a, b) => Date.parse(b.evaluation.submittedAt) - Date.parse(a.evaluation.submittedAt));

  return { pending, submitted };
}

function locateReview(pipeline, reviewId) {
  if (!pipeline) return {};
  for (const stage of pipeline.stages) {
    const review = stage.reviews.find((r) => r.id === reviewId);
    if (review) return { stage, review };
  }
  return {};
}

// Evidence rule: a subjective criterion scored at an extreme (1, 2, 5) needs a note.
function evidenceMissing(crit, value, note) {
  if (!crit.subjective) return false;
  if (value == null) return false;
  const extreme = value === 1 || value === 2 || value === 5;
  return extreme && !(note && note.trim());
}

function validate(scorecard, scores, notes, flags) {
  const problems = [];
  const scored = scorecard.criteria.filter((c) => scores[c.id] != null);
  if (scored.length === 0) problems.push('Score at least one criterion before submitting.');
  for (const crit of scorecard.criteria) {
    if (evidenceMissing(crit, scores[crit.id], notes[crit.id])) {
      problems.push(`${crit.name} scored ${scores[crit.id]} needs a written observation (subjective criterion).`);
    }
  }
  for (const [rfId, note] of Object.entries(flags)) {
    if (!note || !note.trim()) {
      const label = scorecard.redFlags.find((r) => r.id === rfId)?.label ?? 'Red flag';
      problems.push(`${label}: a triggered red flag needs a note.`);
    }
  }
  return problems;
}

function criterionForFlag(scorecard, redFlagId) {
  // Red flags aren't bound to a criterion in the model; keep null unless a
  // future scorecard maps them. (Kept for shape-parity with the seed.)
  return null;
}

function scoreColor(value) {
  if (value == null) return 'text-ink-faint';
  if (value >= 4) return 'text-strong';
  if (value >= 3) return 'text-mixed';
  return 'text-concern';
}

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
