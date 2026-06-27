import React, { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { REVIEWER_ROLES, SENIORITY } from './constants.js';
import { isValidEmail } from './Surfaces.jsx';
import { Eyebrow, Badge } from './ui.jsx';

const emailError = (v) => (v && !isValidEmail(v) ? 'That email doesn’t look valid.' : '');
// Slack handles are normalised to a leading "@" rather than rejected.
const normalizeSlack = (v) => {
  const t = (v || '').trim();
  if (!t) return '';
  return t.startsWith('@') ? t : `@${t}`;
};
// Union a select's options with the current value so a legacy/out-of-list value
// still renders as selected rather than silently blanking.
const optionsWith = (list, current) =>
  current && !list.includes(current) ? [current, ...list] : list;

// =============================================================================
// Team — manage the reviewer roster. The roster is the "who reviewed" half of
// the model; because every past evaluation must resolve to a real person,
// reviewers with history are retained (marked inactive), never erased.
// =============================================================================

const SUPER_ADMIN_MSG =
  "The super-admin is the permanent owner and can't be removed or demoted — this is how a new organization always has a way in.";
const SELF_MSG =
  "You can't remove or change the role of the account you're currently viewing as — switch personas first.";

export default function Team({ canEdit, personaId }) {
  const { db, actions } = useStore();
  const disciplines = db.disciplines ?? [];

  // One evaluation count per reviewer — who is load-bearing for the audit trail.
  const counts = db.evaluations.reduce((acc, e) => {
    acc[e.reviewerId] = (acc[e.reviewerId] ?? 0) + 1;
    return acc;
  }, {});
  // Any assignment (any status) also counts as history that hard delete can't orphan.
  const assignmentCounts = (db.assignments ?? []).reduce((acc, a) => {
    acc[a.reviewerId] = (acc[a.reviewerId] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="rise">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <Eyebrow>Team</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">
            The people behind every evaluation
          </h1>
          <p className="mt-1.5 max-w-[60ch] text-sm text-ink-faint">
            Reviewers with evaluations on record are never erased — removing one marks them inactive,
            so every past review still resolves to a real person in the traceability view.
          </p>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl2 border border-line bg-panel shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-faint">
              <th className="px-4 py-3 font-medium">Reviewer</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Discipline</th>
              <th className="px-4 py-3 font-medium">Seniority</th>
              <th className="px-4 py-3 font-medium text-right">On record</th>
              {canEdit && <th className="px-4 py-3 font-medium text-right">Manage</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {db.reviewers.map((r) => (
              <ReviewerRow
                key={r.id}
                reviewer={r}
                count={counts[r.id] ?? 0}
                hasHistory={(counts[r.id] ?? 0) > 0 || (assignmentCounts[r.id] ?? 0) > 0}
                canEdit={canEdit}
                isSelf={r.id === personaId}
                disciplines={disciplines}
                actions={actions}
              />
            ))}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <>
          <AddReviewer actions={actions} disciplines={disciplines} />
          <DisciplineManager disciplines={disciplines} actions={actions} />
        </>
      ) : (
        <p className="mt-4 text-xs text-ink-faint">
          You&rsquo;re viewing the roster read-only. Switch to the VP persona to add, edit, or remove reviewers.
        </p>
      )}
    </section>
  );
}

// Shared discipline vocabulary — admins can extend it; new entries become
// selectable for reviewers and scorecards alike.
function DisciplineManager({ disciplines, actions }) {
  const [value, setValue] = useState('');
  return (
    <section className="mt-8 rounded-xl2 border border-line bg-panel p-5 shadow-card">
      <Eyebrow>Disciplines</Eyebrow>
      <p className="mt-1.5 max-w-[60ch] text-xs text-ink-faint">
        The shared vocabulary for what kind of work someone reviews. Reviewers and scorecards both
        draw from this list.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {disciplines.map((d) => (
          <Badge key={d} cls="border-line bg-paper text-ink-soft">{d}</Badge>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) { actions.addDiscipline(value); setValue(''); }
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a discipline (e.g. Data Scientist)…"
          className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-thread focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-thread/40 hover:text-ink"
        >
          Add
        </button>
      </form>
    </section>
  );
}

function ReviewerRow({ reviewer, count, hasHistory, canEdit, isSelf, disciplines, actions }) {
  const inactive = reviewer.active === false;
  const isSuper = reviewer.isSuperAdmin === true;
  // Role can't be changed for the super-admin (locked to Admin) or one's own
  // current persona. Archive/delete is likewise protected for both.
  const roleLocked = isSuper || isSelf;
  const protect = isSuper ? SUPER_ADMIN_MSG : isSelf ? SELF_MSG : '';
  const roleLabel = REVIEWER_ROLES.find((x) => x.id === reviewer.role)?.label ?? reviewer.role;

  function del() {
    if (protect || hasHistory) return; // defensive — button is absent in these states
    if (confirm(`Permanently delete ${reviewer.name}? No evaluations or assignments on record, so this is a clean removal.`))
      actions.deleteReviewer(reviewer.id);
  }

  return (
    <tr className={`align-top transition ${inactive ? 'opacity-60' : 'hover:bg-thread-wash/40'}`}>
      {/* Name + title */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <InlineText
            value={reviewer.name}
            canEdit={canEdit}
            onChange={(v) => actions.updateReviewer(reviewer.id, { name: v })}
            className="font-medium text-ink"
          />
          {isSuper && <Badge cls="border-thread/40 bg-thread-wash text-thread">super-admin</Badge>}
          {inactive && <Badge cls="border-line bg-line/50 text-ink-faint">Inactive</Badge>}
        </div>
        <InlineText
          value={reviewer.title}
          canEdit={canEdit}
          placeholder="Add a title"
          onChange={(v) => actions.updateReviewer(reviewer.id, { title: v })}
          className="text-xs text-ink-faint"
        />
        <InlineText
          value={reviewer.email || ''}
          canEdit={canEdit}
          placeholder="Add an email"
          validate={emailError}
          onChange={(v) => actions.updateReviewer(reviewer.id, { email: v })}
          className="font-mono text-xs text-ink-faint"
        />
        <InlineText
          value={reviewer.slackHandle || ''}
          canEdit={canEdit}
          placeholder="Add a Slack handle"
          onChange={(v) => actions.updateReviewer(reviewer.id, { slackHandle: normalizeSlack(v) })}
          className="font-mono text-xs text-ink-faint"
        />
      </td>

      {/* Role */}
      <td className="px-4 py-3">
        {canEdit && !roleLocked ? (
          <select
            value={reviewer.role}
            onChange={(e) => actions.updateReviewer(reviewer.id, { role: e.target.value })}
            className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-thread/40 focus:border-thread focus:outline-none"
          >
            {REVIEWER_ROLES.map((x) => (
              <option key={x.id} value={x.id}>{x.label}</option>
            ))}
          </select>
        ) : canEdit && roleLocked ? (
          <select
            value={reviewer.role}
            disabled
            title={protect}
            className="cursor-not-allowed rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink-faint opacity-60"
          >
            {REVIEWER_ROLES.map((x) => (
              <option key={x.id} value={x.id}>{x.label}</option>
            ))}
          </select>
        ) : (
          <Badge cls="border-line bg-paper text-ink-soft">{roleLabel}</Badge>
        )}
      </td>

      {/* Discipline */}
      <td className="px-4 py-3">
        {canEdit ? (
          <select
            value={reviewer.discipline || ''}
            onChange={(e) => actions.updateReviewer(reviewer.id, { discipline: e.target.value })}
            className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-thread/40 focus:border-thread focus:outline-none"
          >
            <option value="">—</option>
            {optionsWith(disciplines, reviewer.discipline).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        ) : (
          <Badge cls="border-line bg-paper text-ink-soft">{reviewer.discipline || '—'}</Badge>
        )}
      </td>

      {/* Seniority */}
      <td className="px-4 py-3">
        {canEdit ? (
          <select
            value={reviewer.seniority || 'Mid'}
            onChange={(e) => actions.updateReviewer(reviewer.id, { seniority: e.target.value })}
            className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-thread/40 focus:border-thread focus:outline-none"
          >
            {optionsWith(SENIORITY, reviewer.seniority).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <Badge cls="border-line bg-paper text-ink-soft">{reviewer.seniority || '—'}</Badge>
        )}
      </td>

      {/* Evaluation count */}
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-sm tabular text-ink">{count}</span>
      </td>

      {/* Actions */}
      {canEdit && (
        <td className="px-4 py-3">
          {protect ? (
            <div className="flex flex-col items-end gap-1">
              <Badge cls="border-line bg-line/40 text-ink-faint">{isSuper ? 'Protected' : "It's you"}</Badge>
              <span className="max-w-[230px] text-right text-[10px] leading-tight text-ink-faint">{protect}</span>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              {inactive ? (
                <button
                  onClick={() => actions.restoreReviewer(reviewer.id)}
                  className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-thread/40 hover:text-ink"
                >
                  Restore
                </button>
              ) : (
                <button
                  onClick={() => actions.archiveReviewer(reviewer.id)}
                  className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-thread/40 hover:text-ink"
                >
                  Inactivate
                </button>
              )}
              {hasHistory ? (
                <span
                  className="font-mono text-[10px] uppercase tracking-wider text-ink-faint"
                  title="Has evaluations or assignments — kept for the audit trail"
                >
                  has history
                </span>
              ) : (
                <button
                  onClick={del}
                  className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-concern/40 hover:text-concern"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

function AddReviewer({ actions, disciplines }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [slackHandle, setSlackHandle] = useState('');
  const [role, setRole] = useState('reviewer');
  const [discipline, setDiscipline] = useState(disciplines[0] ?? '');
  const [seniority, setSeniority] = useState('Mid');
  const [error, setError] = useState('');

  // Email stays optional, but if filled it must be valid (same check as the
  // candidate form). Slack handle is normalised to a leading "@".
  const mailErr = emailError(email.trim());

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (mailErr) { setError(mailErr); return; }
    setError('');
    actions.addReviewer({
      name: name.trim(),
      title: title.trim(),
      email: email.trim(),
      slackHandle: normalizeSlack(slackHandle),
      role,
      discipline,
      seniority,
    });
    setName('');
    setTitle('');
    setEmail('');
    setSlackHandle('');
    setRole('reviewer');
    setDiscipline(disciplines[0] ?? '');
    setSeniority('Mid');
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-xl2 border border-line bg-panel px-4 py-3 shadow-card"
    >
      <div className="flex flex-1 flex-col gap-1">
        <label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Nadia Rahman"
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-thread focus:outline-none"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Data Science Lead"
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-thread focus:outline-none"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Email</label>
        <input
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          placeholder="optional"
          className={`rounded-lg border bg-paper px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-thread ${
            error ? 'border-concern' : 'border-line'
          }`}
        />
        {error && <span className="text-xs text-concern">{error}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Slack handle</label>
        <input
          value={slackHandle}
          onChange={(e) => setSlackHandle(e.target.value)}
          placeholder="@handle (optional)"
          className="rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-thread focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-line bg-paper px-2.5 py-2 text-sm text-ink-soft focus:border-thread focus:outline-none"
        >
          {REVIEWER_ROLES.map((x) => (
            <option key={x.id} value={x.id}>{x.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Discipline</label>
        <select
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
          className="rounded-lg border border-line bg-paper px-2.5 py-2 text-sm text-ink-soft focus:border-thread focus:outline-none"
        >
          <option value="">—</option>
          {disciplines.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Seniority</label>
        <select
          value={seniority}
          onChange={(e) => setSeniority(e.target.value)}
          className="rounded-lg border border-line bg-paper px-2.5 py-2 text-sm text-ink-soft focus:border-thread focus:outline-none"
        >
          {SENIORITY.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft"
      >
        Add reviewer
      </button>
    </form>
  );
}

// Click-to-edit text, mirroring the inline-edit pattern used in the builder.
// An optional validate(value) -> errorString blocks commit while invalid.
function InlineText({ value, onChange, canEdit, className = '', placeholder = '', validate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');

  if (!canEdit) return <span className={className}>{value || <span className="text-ink-faint">{placeholder}</span>}</span>;

  function commit() {
    const v = draft.trim();
    const err = validate ? validate(v) : '';
    if (err) { setError(err); return; } // stay in edit mode until fixed
    setError('');
    setEditing(false);
    onChange(v);
  }

  if (editing) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => { setDraft(e.target.value); if (error) setError(''); }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { setDraft(value); setError(''); setEditing(false); }
          }}
          className={`min-w-0 rounded-md border bg-paper px-1.5 py-0.5 ${error ? 'border-concern' : 'border-thread/40'} ${className}`}
        />
        {error && <span className="text-xs text-concern">{error}</span>}
      </span>
    );
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`rounded-md px-1.5 py-0.5 text-left transition hover:bg-thread-wash ${className}`}
      title="Click to edit"
    >
      {value || <span className="text-ink-faint">{placeholder}</span>}
    </button>
  );
}
