import React, { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { Eyebrow, IconButton, Badge } from './ui.jsx';

// =============================================================================
// Scorecard editor — define the reusable evaluation template for a discipline:
// weighted criteria, rubric anchors, the subjective flag, and red flags.
// Everything here feeds the Pipeline Builder (attachable) and the Reviewer's
// desk (the subjective flag drives the evidence rule).
// =============================================================================

export default function ScorecardEditor({ canEdit }) {
  const { db, actions } = useStore();
  const [selectedId, setSelectedId] = useState(db.scorecards[0]?.id ?? null);
  const scorecard = db.scorecards.find((s) => s.id === selectedId) ?? db.scorecards[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
      <ScorecardRail
        scorecards={db.scorecards}
        selectedId={scorecard?.id}
        onSelect={setSelectedId}
        canEdit={canEdit}
        onAdd={() => {
          const id = actions.addScorecard({ name: 'New scorecard' });
          setSelectedId(id);
        }}
      />
      {scorecard ? (
        <ScorecardCanvas scorecard={scorecard} db={db} actions={actions} canEdit={canEdit} />
      ) : (
        <div className="grid place-items-center rounded-xl2 border border-dashed border-line bg-panel py-20 text-center text-ink-faint">
          No scorecards yet.
        </div>
      )}
    </div>
  );
}

function ScorecardRail({ scorecards, selectedId, onSelect, onAdd, canEdit }) {
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <Eyebrow>Scorecards</Eyebrow>
      <div className="mt-3 flex flex-col gap-1.5">
        {scorecards.map((s) => {
          const active = s.id === selectedId;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`rounded-xl2 border px-3.5 py-3 text-left transition ${
                active
                  ? 'border-thread/40 bg-thread-wash shadow-card'
                  : 'border-line bg-panel hover:border-thread/30'
              }`}
            >
              <div className="font-medium leading-snug text-ink">{s.name}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-ink-faint">
                <span>{s.discipline}</span>
                <span aria-hidden>·</span>
                <span className="tabular">{s.criteria.length} criteria</span>
              </div>
            </button>
          );
        })}
      </div>
      {canEdit && (
        <button
          onClick={onAdd}
          className="mt-3 w-full rounded-xl2 border border-dashed border-line px-3.5 py-2.5 text-sm text-ink-soft transition hover:border-thread/40 hover:text-ink"
        >
          + New scorecard
        </button>
      )}
    </aside>
  );
}

function ScorecardCanvas({ scorecard, db, actions, canEdit }) {
  const total = scorecard.criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
  const usage = countUsage(db, scorecard.id);

  return (
    <section className="rise min-w-0">
      <header className="mb-6 border-b border-line pb-5">
        <Eyebrow>Evaluation template</Eyebrow>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <Field
              value={scorecard.name}
              canEdit={canEdit}
              onChange={(v) => actions.updateScorecard(scorecard.id, { name: v })}
              className="font-display text-3xl font-medium tracking-tight text-ink"
              placeholder="Scorecard name"
            />
            <div className="mt-1.5 flex items-center gap-2 text-sm text-ink-faint">
              <span className="font-mono text-[11px] uppercase tracking-wider">Discipline</span>
              {canEdit ? (
                <select
                  value={scorecard.discipline || ''}
                  onChange={(e) => actions.updateScorecard(scorecard.id, { discipline: e.target.value })}
                  className="rounded-lg border border-line bg-paper px-2.5 py-1 text-sm text-ink-soft transition hover:border-thread/40 focus:border-thread focus:outline-none"
                >
                  {/* Union the current value so legacy strings stay selected. */}
                  {(scorecard.discipline && !(db.disciplines ?? []).includes(scorecard.discipline)
                    ? [scorecard.discipline, ...(db.disciplines ?? [])]
                    : db.disciplines ?? []
                  ).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-ink-soft">{scorecard.discipline || '—'}</span>
              )}
            </div>
          </div>
          <p className="max-w-[34ch] text-right text-xs leading-relaxed text-ink-faint">
            A reusable template. Attach it to any review in the{' '}
            <span className="text-ink-soft">Pipeline Builder</span> — the same scorecard can back
            many roles.
            {usage > 0 && (
              <>
                {' '}
                <span className="font-mono text-thread tabular">In use by {usage} review{usage === 1 ? '' : 's'}.</span>
              </>
            )}
          </p>
        </div>
      </header>

      {/* Weight total banner */}
      <WeightTotal total={total} />

      {/* Criteria */}
      <div className="mt-4 flex flex-col gap-3">
        {scorecard.criteria.length === 0 && (
          <p className="rounded-xl2 border border-dashed border-line bg-panel px-4 py-6 text-center text-sm text-ink-faint">
            No criteria yet.{canEdit && ' Add the dimensions this scorecard measures.'}
          </p>
        )}
        {scorecard.criteria.map((crit, i) => (
          <CriterionCard
            key={crit.id}
            crit={crit}
            index={i}
            total={scorecard.criteria.length}
            scorecardId={scorecard.id}
            actions={actions}
            canEdit={canEdit}
          />
        ))}
        {canEdit && (
          <button
            onClick={() => actions.addCriterion(scorecard.id)}
            className="rounded-xl2 border border-dashed border-line bg-paper px-4 py-3 text-left text-sm text-thread transition hover:border-thread/40 hover:text-ink"
          >
            + Add criterion
          </button>
        )}
      </div>

      {/* Red flags */}
      <RedFlagSection scorecard={scorecard} actions={actions} canEdit={canEdit} />
    </section>
  );
}

function WeightTotal({ total }) {
  const ok = total === 100;
  return (
    <div
      className={`flex items-center justify-between rounded-xl2 border px-4 py-3 ${
        ok ? 'border-strong/30 bg-strong-wash' : 'border-mixed/40 bg-mixed-wash'
      }`}
    >
      <div className="text-sm">
        <span className="font-medium text-ink">Weights total</span>
        <span className="ml-2 text-xs text-ink-faint">
          {ok
            ? 'Balanced — the criteria sum to 100%.'
            : 'Off 100% — the engine still normalizes by total weight, so this is guidance, not a blocker.'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-mono text-lg font-semibold tabular ${ok ? 'text-strong' : 'text-mixed'}`}>
          {total}%
        </span>
        {!ok && <Badge cls="border-mixed/40 bg-mixed-wash text-mixed">off 100</Badge>}
      </div>
    </div>
  );
}

function CriterionCard({ crit, index, total, scorecardId, actions, canEdit }) {
  const upd = (patch) => actions.updateCriterion(scorecardId, crit.id, patch);
  return (
    <div className="rounded-xl2 border border-line bg-panel p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[180px] flex-1">
          <Field
            value={crit.name}
            canEdit={canEdit}
            onChange={(v) => upd({ name: v })}
            className="font-medium text-ink"
            placeholder="Criterion name"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Weight */}
          <label className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">weight</span>
            {canEdit ? (
              <div className="flex items-center">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={crit.weight}
                  onChange={(e) => upd({ weight: clampWeight(e.target.value) })}
                  className="w-14 rounded-lg border border-line bg-paper px-2 py-1 text-right font-mono text-sm text-ink focus:border-thread focus:outline-none"
                />
                <span className="ml-0.5 font-mono text-sm text-ink-faint">%</span>
              </div>
            ) : (
              <span className="font-mono text-sm font-semibold tabular text-ink">{crit.weight}%</span>
            )}
          </label>

          {canEdit && (
            <div className="flex items-center gap-1.5">
              <IconButton label="Move criterion up" disabled={index === 0}
                onClick={() => actions.moveCriterion(scorecardId, crit.id, 'up')}>↑</IconButton>
              <IconButton label="Move criterion down" disabled={index === total - 1}
                onClick={() => actions.moveCriterion(scorecardId, crit.id, 'down')}>↓</IconButton>
              <IconButton label="Delete criterion"
                onClick={() => actions.deleteCriterion(scorecardId, crit.id)}>✕</IconButton>
            </div>
          )}
        </div>
      </div>

      {/* Subjective flag + its consequence */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <SubjectiveToggle
          on={crit.subjective}
          canEdit={canEdit}
          onToggle={() => upd({ subjective: !crit.subjective })}
        />
        <span className="text-xs text-ink-faint">
          {crit.subjective ? (
            <>
              Marked subjective → on the <span className="text-ink-soft">Reviewer&rsquo;s desk</span>, an
              extreme score (1, 2, or 5) here <span className="text-ink-soft">requires a written observation</span>.
            </>
          ) : (
            <>Mark subjective to require written evidence for extreme scores — that&rsquo;s where bias hides.</>
          )}
        </span>
      </div>

      {/* Rubric anchors */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <RubricField
          band="When it's low (a 1)"
          value={crit.rubric?.low ?? ''}
          canEdit={canEdit}
          onChange={(v) => upd({ rubric: { low: v } })}
        />
        <RubricField
          band="When it's high (a 5)"
          value={crit.rubric?.high ?? ''}
          canEdit={canEdit}
          onChange={(v) => upd({ rubric: { high: v } })}
        />
      </div>
    </div>
  );
}

function RubricField({ band, value, canEdit, onChange }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{band}</div>
      {canEdit ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder="Describe what this looks like…"
          className="mt-1 w-full resize-none border-0 bg-transparent p-0 text-xs leading-snug text-ink-soft placeholder:text-ink-faint focus:outline-none"
        />
      ) : (
        <p className="mt-1 text-xs leading-snug text-ink-soft">{value || <span className="text-ink-faint">—</span>}</p>
      )}
    </div>
  );
}

function SubjectiveToggle({ on, canEdit, onToggle }) {
  if (!canEdit) {
    return on ? (
      <Badge cls="border-thread/40 bg-thread-wash text-thread">subjective</Badge>
    ) : (
      <Badge cls="border-line bg-paper text-ink-faint">objective</Badge>
    );
  }
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      title="Subjective criteria require written evidence for extreme scores on the Reviewer's desk."
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        on ? 'border-thread/40 bg-thread-wash text-thread' : 'border-line bg-paper text-ink-faint'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-thread' : 'bg-ink-faint/40'}`} />
      subjective
    </button>
  );
}

function RedFlagSection({ scorecard, actions, canEdit }) {
  const [adding, setAdding] = useState('');
  return (
    <section className="mt-8 rounded-xl2 border border-line bg-panel p-5 shadow-card">
      <Eyebrow>Red flags</Eyebrow>
      <p className="mt-1.5 max-w-[60ch] text-xs text-ink-faint">
        A different kind of fact, scored apart from the number. Triggering one on the Reviewer&rsquo;s
        desk forces a <span className="text-concern">Concern</span> regardless of the weighted score.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {scorecard.redFlags.length === 0 && (
          <p className="text-sm text-ink-faint">No red flags defined.</p>
        )}
        {scorecard.redFlags.map((rf) => (
          <div
            key={rf.id}
            className="flex items-center gap-3 rounded-xl2 border border-line bg-paper px-4 py-2.5"
          >
            <span className="text-concern" aria-hidden>⚑</span>
            <div className="min-w-0 flex-1">
              <Field
                value={rf.label}
                canEdit={canEdit}
                onChange={(v) => actions.updateRedFlag(scorecard.id, rf.id, { label: v })}
                className="text-sm text-ink"
                placeholder="Red flag label"
              />
            </div>
            {canEdit && (
              <IconButton label="Remove red flag"
                onClick={() => actions.deleteRedFlag(scorecard.id, rf.id)}>✕</IconButton>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (adding.trim()) {
              actions.addRedFlag(scorecard.id, adding.trim());
              setAdding('');
            }
          }}
        >
          <input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder="Add a red flag (e.g. fabricated work)…"
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-thread focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-thread/40 hover:text-ink"
          >
            Add
          </button>
        </form>
      )}
    </section>
  );
}

// --- A plain editable text field (input on edit, span when read-only) --------

function Field({ value, onChange, canEdit, className = '', placeholder }) {
  if (!canEdit) return <span className={className}>{value}</span>;
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 transition hover:border-line focus:border-thread/50 focus:bg-paper focus:outline-none ${className}`}
    />
  );
}

// --- Helpers -----------------------------------------------------------------

function clampWeight(raw) {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

// How many reviews across all pipelines attach this scorecard.
function countUsage(db, scorecardId) {
  let n = 0;
  for (const p of db.pipelines)
    for (const stage of p.stages)
      for (const review of stage.reviews) if (review.scorecardId === scorecardId) n++;
  return n;
}
