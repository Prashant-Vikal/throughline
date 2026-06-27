import React from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { isValidEmail } from './Surfaces.jsx';
import { Eyebrow, Badge } from './ui.jsx';

// Reminders can only go out on a channel the reviewer actually has on file.
const hasEmail = (r) => isValidEmail(r?.email);
const hasSlack = (r) => !!(r?.slackHandle && r.slackHandle.trim());

// =============================================================================
// Pipeline Health — accountability pointed at the WORK and the candidate's
// experience, never a reviewer scoreboard. It shows where candidates are
// waiting so the pipeline can be unblocked. No per-reviewer ranking, ever.
// =============================================================================

export default function PipelineHealth({ persona }) {
  const { db, actions } = useStore();
  const sla = db.config?.slaHours ?? 48;
  const reminder = db.config?.reminderHours ?? 24;

  const items = openReviewItems(db, sla, reminder);

  // Reviewer sees only their own queue; VP/admin and Observer see the pipeline.
  const personal = persona?.role === 'reviewer' || persona?.role === 'hr';
  const canRemind = persona?.role === 'admin';

  if (personal) {
    const mine = items
      .filter((i) => i.assignment.reviewerId === persona.id)
      .sort((a, b) => b.ageHours - a.ageHours);
    return <PersonalQueue persona={persona} items={mine} sla={sla} reminder={reminder} />;
  }

  return (
    <FullHealth items={items} sla={sla} reminder={reminder} canRemind={canRemind} actions={actions} />
  );
}

// --- VP / Observer: candidates waiting (the headline) ------------------------

function FullHealth({ items, sla, reminder, canRemind, actions }) {
  const groups = groupByCandidate(items);
  const counts = {
    overdue: items.filter((i) => i.status === 'overdue').length,
    due_soon: items.filter((i) => i.status === 'due_soon').length,
    on_track: items.filter((i) => i.status === 'on_track').length,
  };

  return (
    <section className="rise">
      <header className="mb-5 border-b border-line pb-5">
        <Eyebrow>Pipeline Health</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">
          Who&rsquo;s waiting, and where it&rsquo;s stuck
        </h1>
        <p className="mt-1.5 max-w-[62ch] text-sm text-ink-faint">
          This is about the candidate&rsquo;s experience and unblocking the work — not ranking
          reviewers. Candidates sitting longest rise to the top so no one is left in limbo.
          Aging is measured against a {sla}h target (a nudge at {reminder}h).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <SummaryStat label="Overdue" n={counts.overdue} cls="text-concern" />
          <SummaryStat label="Due soon" n={counts.due_soon} cls="text-mixed" />
          <SummaryStat label="On track" n={counts.on_track} cls="text-strong" />
        </div>
      </header>

      {groups.length === 0 ? (
        <p className="rounded-xl2 border border-dashed border-line bg-panel px-4 py-10 text-center text-sm text-ink-faint">
          No candidates are waiting on an open review right now. The pipeline is clear.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <CandidateWaitingCard key={g.candidate.id} group={g} canRemind={canRemind} actions={actions} />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryStat({ label, n, cls }) {
  return (
    <div className="flex items-baseline gap-2 rounded-lg border border-line bg-panel px-3 py-1.5">
      <span className={`font-mono text-lg font-semibold tabular ${cls}`}>{n}</span>
      <span className="text-xs text-ink-faint">{label}</span>
    </div>
  );
}

function CandidateWaitingCard({ group, canRemind, actions }) {
  const worst = STATUS[group.worstStatus];
  return (
    <div className="overflow-hidden rounded-xl2 border border-line bg-panel shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="font-medium text-ink">{group.candidate.name}</div>
          <div className="mt-0.5 text-xs text-ink-faint">
            {group.pipeline?.role} · {group.stageName}
          </div>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="font-mono text-sm font-semibold tabular text-ink">{ageLabel(group.maxAge)}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">waiting</div>
          </div>
          <Badge cls={worst.cls}>{worst.label}</Badge>
        </div>
      </div>

      <div className="divide-y divide-line">
        {group.items.map((item) => (
          <WaitingReviewRow key={item.assignment.id} item={item} canRemind={canRemind} actions={actions} />
        ))}
      </div>
    </div>
  );
}

function WaitingReviewRow({ item, canRemind, actions }) {
  const st = STATUS[item.status];
  const reminders = (item.assignment.notifications ?? []).filter((n) => n.kind === 'reminder').length;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${st.dot}`} aria-hidden />
      <div className="min-w-[160px] flex-1">
        <div className="text-sm text-ink">{item.review?.label}</div>
        <div className="mt-0.5 text-xs text-ink-faint">
          with {item.reviewer?.name ?? 'unassigned'}
          {item.reviewer?.active === false && ' (inactive)'}
        </div>
      </div>

      <span className="font-mono text-xs tabular text-ink-soft">{ageLabel(item.ageHours)}</span>
      <Badge cls={st.cls}>{st.label}</Badge>

      {canRemind && <ReminderControl item={item} reminders={reminders} actions={actions} />}
    </div>
  );
}

// Send-reminder control — one button per channel, disabled (not hidden) when
// the reviewer has no contact info for it. Same availability rule as assignment.
function ReminderControl({ item, reminders, actions }) {
  const r = item.reviewer;
  const avail = { email: hasEmail(r), slack: hasSlack(r) };
  const none = !avail.email && !avail.slack;

  if (none) {
    return (
      <span className="text-[10px] text-concern">No contact method — add one on the Team tab.</span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {reminders > 0 && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">reminded ×{reminders}</span>
        )}
        <span className="text-[10px] text-ink-faint">Remind:</span>
        {['email', 'slack'].map((c) => (
          <button
            key={c}
            disabled={!avail[c]}
            title={avail[c] ? `Send a ${c} reminder` : (c === 'slack' ? 'No Slack handle on file' : 'No email on file')}
            onClick={() => avail[c] && actions.addNotification(item.assignment.id, reminderNotification(c, item))}
            className={`rounded-lg border px-2.5 py-1 text-xs transition ${
              avail[c]
                ? 'border-line text-ink-soft hover:border-thread/40 hover:text-ink'
                : 'cursor-not-allowed border-line text-ink-faint opacity-50'
            }`}
          >
            {c === 'email' ? 'Email' : 'Slack'}
          </button>
        ))}
      </div>
      {!avail.slack && <span className="text-[10px] text-ink-faint">No Slack handle on file</span>}
      {!avail.email && <span className="text-[10px] text-ink-faint">No email on file</span>}
    </div>
  );
}

// --- Reviewer: a personal queue, not a judgment ------------------------------

function PersonalQueue({ persona, items, sla, reminder }) {
  return (
    <section className="rise">
      <header className="mb-5 border-b border-line pb-5">
        <Eyebrow>Pipeline Health · Your queue</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">
          Your open reviews
        </h1>
        <p className="mt-1.5 max-w-[60ch] text-sm text-ink-faint">
          A personal to-do, not a scorecard. These candidates are waiting on you — oldest first.
          Aging is measured against a {sla}h target (a nudge at {reminder}h).
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-xl2 border border-dashed border-line bg-panel px-4 py-10 text-center text-sm text-ink-faint">
          You have no open reviews. Nothing is waiting on you.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl2 border border-line bg-panel shadow-card divide-y divide-line">
          {items.map((item) => {
            const st = STATUS[item.status];
            return (
              <div key={item.assignment.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${st.dot}`} aria-hidden />
                <div className="min-w-[160px] flex-1">
                  <div className="text-sm font-medium text-ink">{item.candidate?.name}</div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {item.pipeline?.role} · {item.review?.label}
                  </div>
                </div>
                <span className="font-mono text-xs tabular text-ink-soft">{ageLabel(item.ageHours)}</span>
                <Badge cls={st.cls}>{st.label}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// --- Status model ------------------------------------------------------------

const STATUS = {
  overdue: { label: 'Overdue', cls: 'text-concern bg-concern-wash border-concern/30', dot: 'bg-concern' },
  due_soon: { label: 'Due soon', cls: 'text-mixed bg-mixed-wash border-mixed/40', dot: 'bg-mixed' },
  on_track: { label: 'On track', cls: 'text-strong bg-strong-wash border-strong/30', dot: 'bg-strong' },
};
const SEVERITY = { overdue: 2, due_soon: 1, on_track: 0 };

// --- Data shaping (pure) -----------------------------------------------------

// Every OPEN review: an assignment still 'assigned'/'in_progress' with no
// submitted evaluation yet. Enriched with age + aging status.
function openReviewItems(db, sla, reminder) {
  const now = Date.now();
  return (db.assignments ?? [])
    .filter((a) => {
      if (a.status !== 'assigned' && a.status !== 'in_progress') return false;
      if (db.evaluations.some((e) => e.candidateId === a.candidateId && e.reviewId === a.reviewId)) return false;
      const cand = db.candidates.find((c) => c.id === a.candidateId);
      if (!cand || cand.archived) return false; // archived candidates aren't "waiting"
      const st = db.candidateState.find((s) => s.candidateId === a.candidateId);
      if (st?.status === 'declined' || st?.status === 'hired') return false; // closed → not waiting
      return true;
    })
    .map((a) => {
      const ageHours = (now - Date.parse(a.assignedAt)) / 3600000;
      const candidate = db.candidates.find((c) => c.id === a.candidateId);
      const pipeline = candidate && db.pipelines.find((p) => p.id === candidate.pipelineId);
      const { review, stage } = findReview(pipeline, a.reviewId);
      return {
        assignment: a,
        candidate,
        pipeline,
        review,
        stage,
        reviewer: db.reviewers.find((r) => r.id === a.reviewerId),
        ageHours,
        status: classify(ageHours, sla, reminder),
      };
    });
}

function groupByCandidate(items) {
  const map = new Map();
  for (const item of items) {
    if (!item.candidate) continue;
    const g = map.get(item.candidate.id) ?? {
      candidate: item.candidate,
      pipeline: item.pipeline,
      stageName: item.stage?.name ?? '',
      items: [],
    };
    g.items.push(item);
    map.set(item.candidate.id, g);
  }
  return [...map.values()]
    .map((g) => {
      g.items.sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status] || b.ageHours - a.ageHours);
      const worst = g.items.reduce((m, i) => Math.max(m, SEVERITY[i.status]), 0);
      return {
        ...g,
        worstStatus: Object.keys(SEVERITY).find((k) => SEVERITY[k] === worst),
        maxAge: Math.max(...g.items.map((i) => i.ageHours)),
      };
    })
    .sort((a, b) => SEVERITY[b.worstStatus] - SEVERITY[a.worstStatus] || b.maxAge - a.maxAge);
}

function classify(hours, sla, reminder) {
  if (hours >= sla) return 'overdue';
  if (hours >= reminder) return 'due_soon';
  return 'on_track';
}

function findReview(pipeline, reviewId) {
  if (!pipeline) return {};
  for (const stage of pipeline.stages) {
    const review = stage.reviews.find((r) => r.id === reviewId);
    if (review) return { review, stage };
  }
  return {};
}

function ageLabel(hours) {
  const h = Math.max(0, Math.floor(hours));
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r ? `${d}d ${r}h` : `${d}d`;
}

const firstName = (name = '') => name.trim().split(/\s+/)[0] || 'there';

// A simulated reminder — reuses the same notification shape the bell reads.
function reminderNotification(channel, { reviewer, candidate, review, pipeline }) {
  const who = firstName(reviewer?.name);
  if (channel === 'slack') {
    return {
      kind: 'reminder',
      channel: 'slack',
      body:
        `Hi ${who} — a gentle nudge: *${candidate?.name}* is still waiting on your *${review?.label}* ` +
        `review for the ${pipeline?.role} role. No rush beyond keeping them out of limbo — thank you! 🙏`,
    };
  }
  return {
    kind: 'reminder',
    channel: 'email',
    subject: `Reminder: ${candidate?.name} is waiting — ${review?.label}`,
    body:
      `Hi ${who},\n\n` +
      `A gentle reminder that ${candidate?.name} is still waiting on your "${review?.label}" review ` +
      `for the ${pipeline?.role} role. Whenever you have a window, the Reviewer's desk has everything you need.\n\n` +
      `Keeping candidates moving is the kindest part of a fair process — thank you.\n\nThroughline Hiring`,
  };
}
