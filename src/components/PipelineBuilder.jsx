import React, { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { REVIEWER_ROLES, SENIORITY } from './constants.js';
import { Eyebrow, IconButton, Badge } from './ui.jsx';

export default function PipelineBuilder({ canEdit }) {
  const { db, actions } = useStore();
  const [selectedId, setSelectedId] = useState(db.pipelines[0]?.id ?? null);
  const pipeline = db.pipelines.find((p) => p.id === selectedId) ?? db.pipelines[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
      <PipelineRail
        pipelines={db.pipelines}
        selectedId={pipeline?.id}
        onSelect={setSelectedId}
        canEdit={canEdit}
        onAdd={() => {
          const id = actions.addPipeline({ role: 'New role', level: 'Mid', discipline: 'General' });
          setSelectedId(id);
        }}
      />
      {pipeline ? (
        <PipelineCanvas pipeline={pipeline} scorecards={db.scorecards} reviewers={db.reviewers} actions={actions} canEdit={canEdit} />
      ) : (
        <Empty canEdit={canEdit} />
      )}
    </div>
  );
}

function PipelineRail({ pipelines, selectedId, onSelect, onAdd, canEdit }) {
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <Eyebrow>Roles</Eyebrow>
      <div className="mt-3 flex flex-col gap-1.5">
        {pipelines.map((p) => {
          const active = p.id === selectedId;
          const reviewCount = p.stages.reduce((n, s) => n + s.reviews.length, 0);
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`rounded-xl2 border px-3.5 py-3 text-left transition ${
                active
                  ? 'border-thread/40 bg-thread-wash shadow-card'
                  : 'border-line bg-panel hover:border-thread/30'
              }`}
            >
              <div className="font-medium leading-snug text-ink">{p.role}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-ink-faint">
                <span>{p.level}</span>
                <span aria-hidden>·</span>
                <span className="tabular">{p.stages.length} stages</span>
                <span aria-hidden>·</span>
                <span className="tabular">{reviewCount} reviews</span>
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
          + New role pipeline
        </button>
      )}
    </aside>
  );
}

function PipelineCanvas({ pipeline, scorecards, reviewers, actions, canEdit }) {
  const stages = [...pipeline.stages].sort((a, b) => a.order - b.order);
  return (
    <section className="rise min-w-0">
      <header className="mb-6 border-b border-line pb-5">
        <Eyebrow>Hiring pipeline</Eyebrow>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <InlineText
              value={pipeline.role}
              canEdit={canEdit}
              onChange={(v) => actions.updatePipeline(pipeline.id, { role: v })}
              className="font-display text-3xl font-medium tracking-tight text-ink"
            />
            <div className="mt-1.5 flex items-center gap-2 text-sm text-ink-faint">
              <InlineText
                value={pipeline.level}
                canEdit={canEdit}
                onChange={(v) => actions.updatePipeline(pipeline.id, { level: v })}
              />
              <span aria-hidden>·</span>
              <InlineText
                value={pipeline.discipline}
                canEdit={canEdit}
                onChange={(v) => actions.updatePipeline(pipeline.id, { discipline: v })}
              />
            </div>
          </div>
          <p className="max-w-[34ch] text-right text-xs leading-relaxed text-ink-faint">
            One engine, every role. The shape below is unique to this pipeline — the
            evaluation logic underneath is shared.
          </p>
        </div>
      </header>

      {/* The thread: a single line running down through every stage in sequence. */}
      <div className="relative pl-9">
        <div
          className="thread-line absolute left-[14px] top-2 w-[2px]"
          style={{ height: 'calc(100% - 64px)' }}
          aria-hidden
        />
        <div className="flex flex-col gap-4">
          {stages.map((stage, i) => (
            <StageCard
              key={stage.id}
              stage={stage}
              index={i}
              total={stages.length}
              pipelineId={pipeline.id}
              scorecards={scorecards}
              reviewers={reviewers}
              actions={actions}
              canEdit={canEdit}
            />
          ))}

          {canEdit && (
            <div className="relative">
              <ThreadNode label="+" muted />
              <button
                onClick={() => actions.addStage(pipeline.id, 'New stage')}
                className="ml-9 w-[calc(100%-2.25rem)] rounded-xl2 border border-dashed border-line bg-paper px-4 py-3 text-left text-sm text-ink-soft transition hover:border-thread/40 hover:text-ink"
              >
                Add a stage
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StageCard({ stage, index, total, pipelineId, scorecards, reviewers, actions, canEdit }) {
  return (
    <div className="relative">
      <ThreadNode label={index + 1} />
      <div className="ml-9 rounded-xl2 border border-line bg-panel shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <InlineText
            value={stage.name}
            canEdit={canEdit}
            onChange={(v) => actions.updateStage(pipelineId, stage.id, { name: v })}
            className="font-medium text-ink"
          />
          {canEdit && (
            <div className="flex items-center gap-1.5">
              <IconButton label="Move stage up" disabled={index === 0}
                onClick={() => actions.moveStage(pipelineId, stage.id, 'up')}>↑</IconButton>
              <IconButton label="Move stage down" disabled={index === total - 1}
                onClick={() => actions.moveStage(pipelineId, stage.id, 'down')}>↓</IconButton>
              <IconButton label="Delete stage"
                onClick={() => actions.deleteStage(pipelineId, stage.id)}>✕</IconButton>
            </div>
          )}
        </div>

        <div className="divide-y divide-line">
          {stage.reviews.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-faint">
              No reviews yet. {canEdit && 'Add the evaluations that happen in this stage.'}
            </p>
          )}
          {[...stage.reviews]
            .sort((a, b) => a.order - b.order)
            .map((review, ri) => (
              <ReviewRow
                key={review.id}
                review={review}
                index={ri}
                total={stage.reviews.length}
                pipelineId={pipelineId}
                stageId={stage.id}
                scorecards={scorecards}
                reviewers={reviewers}
                actions={actions}
                canEdit={canEdit}
              />
            ))}
        </div>

        {canEdit && (
          <div className="px-4 py-2.5">
            <button
              onClick={() =>
                actions.addReview(pipelineId, stage.id, {
                  label: 'New review',
                  reviewerRole: 'reviewer',
                  scorecardId: scorecards[0]?.id,
                })
              }
              className="text-sm text-thread transition hover:text-ink"
            >
              + Add review
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ review, index, total, pipelineId, stageId, scorecards, reviewers, actions, canEdit }) {
  const scorecard = scorecards.find((s) => s.id === review.scorecardId);
  const upd = (patch) => actions.updateReview(pipelineId, stageId, review.id, patch);
  // Pool eligibility = same rule the assignment dropdown uses (active + role).
  const eligible = reviewers.filter((r) => r.active !== false && r.role === review.reviewerRole);
  const pool = review.pool ?? [];
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-[150px] flex-1">
          <InlineText
            value={review.label}
            canEdit={canEdit}
            onChange={(v) => upd({ label: v })}
            className="text-sm text-ink"
          />
          <div className="mt-0.5 text-xs text-ink-faint">
            {scorecard ? `Scored on the ${scorecard.name} scorecard` : 'No scorecard attached'}
          </div>
        </div>

        {canEdit ? (
          <>
            <Select value={review.reviewerRole} onChange={(v) => upd({ reviewerRole: v })}>
              {REVIEWER_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </Select>
            <Select value={review.scorecardId} onChange={(v) => upd({ scorecardId: v })}>
              {scorecards.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <StopOnFailToggle on={review.stopOnFail} onToggle={() => upd({ stopOnFail: !review.stopOnFail })} />
            <div className="flex items-center gap-1.5">
              <IconButton label="Move review up" disabled={index === 0}
                onClick={() => actions.moveReview(pipelineId, stageId, review.id, 'up')}>↑</IconButton>
              <IconButton label="Move review down" disabled={index === total - 1}
                onClick={() => actions.moveReview(pipelineId, stageId, review.id, 'down')}>↓</IconButton>
              <IconButton label="Delete review"
                onClick={() => actions.deleteReview(pipelineId, stageId, review.id)}>✕</IconButton>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Badge cls="border-line bg-paper text-ink-soft">
              {REVIEWER_ROLES.find((r) => r.id === review.reviewerRole)?.label ?? review.reviewerRole}
            </Badge>
            {review.stopOnFail && (
              <Badge cls="border-concern/30 bg-concern-wash text-concern">stop-on-fail</Badge>
            )}
          </div>
        )}
      </div>

      <PoolEditor
        pool={pool}
        eligible={eligible}
        reviewers={reviewers}
        canEdit={canEdit}
        onToggle={(id) => upd({ pool: pool.includes(id) ? pool.filter((x) => x !== id) : [...pool, id] })}
      />

      <ConditionsEditor
        review={review}
        canEdit={canEdit}
        onChange={(patch) => upd({ conditions: { ...(review.conditions || {}), ...patch } })}
      />
    </div>
  );
}

// Eligible-reviewer pool for a review. Auto-distribution draws from this set
// (round-robin + panel rotation). A manual assignment always overrides it.
function PoolEditor({ pool, eligible, reviewers, canEdit, onToggle }) {
  const [open, setOpen] = useState(false);
  const nameOf = (id) => reviewers.find((r) => r.id === id)?.name ?? id;

  if (!canEdit) {
    return (
      <div className="mt-1.5 text-xs text-ink-faint">
        Pool: {pool.length ? pool.map(nameOf).join(', ') : <span className="text-concern/80">none</span>}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="font-mono text-[10px] uppercase tracking-wider text-thread transition hover:text-ink"
      >
        Pool · {pool.length} {pool.length === 1 ? 'reviewer' : 'reviewers'} {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-line bg-paper p-2">
          {eligible.length === 0 ? (
            <span className="text-xs text-ink-faint">No eligible reviewers for this role yet.</span>
          ) : (
            eligible.map((r) => {
              const on = pool.includes(r.id);
              return (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                    on ? 'border-thread/40 bg-thread-wash text-ink' : 'border-line text-ink-soft hover:border-thread/30'
                  }`}
                >
                  <input type="checkbox" checked={on} onChange={() => onToggle(r.id)} className="accent-thread" />
                  {r.name}
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// Optional per-review conditions that sit ON TOP of the pool/round-robin core.
// No conditions set → review distributes exactly as before.
function ConditionsEditor({ review, canEdit, onChange }) {
  const [open, setOpen] = useState(false);
  const cond = review.conditions || {};
  const sen = cond.seniority || { mode: 'none' };
  const summary = [
    sen.mode === 'candidate' && '≥ candidate',
    sen.mode === 'floor' && `min ${sen.floor || 'Senior'}`,
    cond.loadAware && 'load-aware',
  ].filter(Boolean);

  if (!canEdit) {
    return summary.length ? (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {summary.map((s) => (
          <Badge key={s} cls="border-thread/30 bg-thread-wash text-thread">{s}</Badge>
        ))}
      </div>
    ) : null;
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="font-mono text-[10px] uppercase tracking-wider text-thread transition hover:text-ink"
      >
        Conditions{summary.length ? ` · ${summary.join(' · ')}` : ' · none'} {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper p-2">
          <label className="flex items-center gap-1.5 text-xs text-ink-soft">
            Seniority:
            <select
              value={sen.mode || 'none'}
              onChange={(e) => onChange({ seniority: { ...sen, mode: e.target.value } })}
              className="rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink-soft focus:border-thread focus:outline-none"
            >
              <option value="none">No rule</option>
              <option value="candidate">≥ candidate&rsquo;s level</option>
              <option value="floor">Minimum level…</option>
            </select>
          </label>
          {sen.mode === 'floor' && (
            <select
              value={sen.floor || 'Senior'}
              onChange={(e) => onChange({ seniority: { ...sen, floor: e.target.value } })}
              className="rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink-soft focus:border-thread focus:outline-none"
            >
              {SENIORITY.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={!!cond.loadAware}
              onChange={(e) => onChange({ loadAware: e.target.checked })}
              className="accent-thread"
            />
            Distribute by load
          </label>
        </div>
      )}
    </div>
  );
}

function StopOnFailToggle({ on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      title="If this review raises a concern, the whole stage ends immediately."
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        on ? 'border-concern/40 bg-concern-wash text-concern' : 'border-line bg-paper text-ink-faint'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-concern' : 'bg-ink-faint/40'}`} />
      stop-on-fail
    </button>
  );
}

function ThreadNode({ label, muted }) {
  return (
    <div
      className={`absolute left-0 top-3 grid h-7 w-7 -translate-x-[2px] place-items-center rounded-full border text-xs font-medium tabular ${
        muted ? 'border-dashed border-thread/40 bg-paper text-thread/60'
              : 'border-thread/40 bg-thread-wash text-thread'
      }`}
    >
      {label}
    </div>
  );
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-thread/40 focus:border-thread"
    >
      {children}
    </select>
  );
}

function InlineText({ value, onChange, canEdit, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!canEdit) return <span className={className}>{value}</span>;
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft.trim()) onChange(draft.trim()); else setDraft(value); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        className={`min-w-0 rounded-md border border-thread/40 bg-paper px-1.5 py-0.5 ${className}`}
      />
    );
  }
  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`rounded-md px-1.5 py-0.5 text-left transition hover:bg-thread-wash ${className}`}
      title="Click to rename"
    >
      {value}
    </button>
  );
}

function Empty({ canEdit }) {
  return (
    <div className="grid place-items-center rounded-xl2 border border-dashed border-line bg-panel py-20 text-center">
      <p className="text-ink-faint">No pipelines yet.</p>
      {canEdit && <p className="mt-1 text-sm text-ink-faint">Create one from the left to begin.</p>}
    </div>
  );
}
