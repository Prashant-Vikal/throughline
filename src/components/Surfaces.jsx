import React, { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { recommendNext, resolveStage, getPipelineForCandidate, getState } from '../engine/index.js';
import { OUTCOME, SENIORITY } from './constants.js';
import { Eyebrow, Badge } from './ui.jsx';

// --- Candidates: a real read-out of the engine ----------------------------
export function CandidatesView({ onSelect, canEdit }) {
  const { db, actions } = useStore();
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = db.candidates.filter((c) => c.archived).length;

  const rows = db.candidates
    .filter((c) => !!c.archived === showArchived)
    .filter((c) => pipelineFilter === 'all' || c.pipelineId === pipelineFilter)
    .map((c) => {
      const rec = recommendNext(db, c.id);
      const state = getState(db, c.id);
      const pipeline = getPipelineForCandidate(db, c.id);
      return { c, rec, state, pipeline };
    });

  return (
    <section className="rise">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <Eyebrow>Candidates</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">
            Where everyone stands
          </h1>
          <p className="mt-1.5 max-w-[52ch] text-sm text-ink-faint">
            Each recommendation below is computed live from the evidence on file — and every
            one that moves a candidate is marked as a human decision, never an automatic one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={showArchived ? 'archived' : 'active'}
            onChange={(e) => setShowArchived(e.target.value === 'archived')}
            className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-soft focus:border-thread"
          >
            <option value="active">Active</option>
            <option value="archived">Archived{archivedCount ? ` (${archivedCount})` : ''}</option>
          </select>
          <select
            value={pipelineFilter}
            onChange={(e) => setPipelineFilter(e.target.value)}
            className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-soft focus:border-thread"
          >
            <option value="all">All roles</option>
            {db.pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.role}</option>
            ))}
          </select>
          {canEdit && !adding && !importing && (
            <>
              <button
                onClick={() => setImporting(true)}
                className="rounded-lg border border-line px-3 py-2 text-sm text-ink-soft transition hover:border-thread/40 hover:text-ink"
              >
                Import CSV
              </button>
              <button
                onClick={() => setAdding(true)}
                className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft"
              >
                + Add candidate
              </button>
            </>
          )}
        </div>
      </header>

      {canEdit && importing && (
        <BulkImport db={db} actions={actions} onClose={() => setImporting(false)} />
      )}

      {canEdit && adding && (
        <AddCandidateForm
          pipelines={db.pipelines}
          existingEmails={db.candidates.map((c) => (c.email || '').toLowerCase())}
          defaultPipelineId={pipelineFilter !== 'all' ? pipelineFilter : db.pipelines[0]?.id}
          onCancel={() => setAdding(false)}
          onCreate={(payload) => {
            const id = actions.addCandidate(payload);
            // Stage 1 is active immediately → auto-distribute its reviews + notify.
            actions.activateAssignments(id);
            setAdding(false);
            onSelect?.(id);
          }}
        />
      )}

      <div className="overflow-hidden rounded-xl2 border border-line bg-panel shadow-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-faint">
              <th className="px-4 py-3 font-medium">Candidate</th>
              <th className="px-4 py-3 font-medium">Current stage</th>
              <th className="px-4 py-3 font-medium">Stage outcome</th>
              <th className="px-4 py-3 font-medium">System recommendation</th>
              {canEdit && <th className="px-4 py-3 font-medium text-right">Manage</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-sm text-ink-faint">
                  {showArchived ? 'No archived candidates.' : 'No active candidates.'}
                </td>
              </tr>
            )}
            {rows.map(({ c, rec, state, pipeline }) => {
              const outcome = rec?.resolution?.outcome ?? 'in_progress';
              // A terminal gate decision wins over the raw stage resolution so
              // Stage Outcome never contradicts the System Decision.
              const terminalOutcome =
                state?.status === 'hired'
                  ? { label: 'Hired', cls: 'text-strong bg-strong-wash border-strong/30' }
                  : state?.status === 'declined'
                  ? { label: 'Declined', cls: 'text-concern bg-concern-wash border-concern/30' }
                  : null;
              const o = terminalOutcome ?? OUTCOME[outcome] ?? OUTCOME.in_progress;
              return (
                <tr
                  key={c.id}
                  className={`align-top transition hover:bg-thread-wash/40 cursor-pointer ${c.archived ? 'opacity-60' : ''}`}
                  onClick={() => onSelect?.(c.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink hover:text-thread transition">{c.name}</span>
                      {c.archived && <Badge cls="border-line bg-line/50 text-ink-faint">Archived</Badge>}
                    </div>
                    <div className="text-xs text-ink-faint">{pipeline?.role}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{rec?.stage?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge cls={o.cls}>{o.label}</Badge>
                    {!terminalOutcome && rec?.resolution?.spread > 0 && outcome === 'needs_decision' && (
                      <div className="mt-1 text-xs text-mixed tabular">
                        spread {rec.resolution.spread.toFixed(1)} pts
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-ink">{labelFor(rec?.kind)}</div>
                    <div className="mt-0.5 max-w-[40ch] text-xs text-ink-faint">{rec?.message}</div>
                    {rec?.requiresHuman && (
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-thread">
                        awaiting human decision
                      </div>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <CandidateActions candidate={c} db={db} actions={actions} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {onSelect && (
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Click any candidate to open the full <em>Decision &amp; Traceability</em> view.
        </p>
      )}
    </section>
  );
}

// Archive / restore / delete controls for one candidate (VP only). Hard delete
// is offered only when no evaluations would be orphaned; otherwise it offers
// archive instead. Mirrors the reviewer archive-not-delete pattern.
function CandidateActions({ candidate, db, actions }) {
  // History = evaluations on record; deleting one would orphan the throughline.
  const hasHistory = db.evaluations.some((e) => e.candidateId === candidate.id);

  function del() {
    if (hasHistory) return; // defensive — button is disabled in this state
    if (confirm(`Permanently delete ${candidate.name}? No evaluations on record, so this is a clean removal.`))
      actions.deleteCandidate(candidate.id);
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Archive on active, Restore on archived — each is the right control for
          the state, so neither is ever shown disabled-but-clickable. */}
      {candidate.archived ? (
        <button
          onClick={() => actions.restoreCandidate(candidate.id)}
          className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-thread/40 hover:text-ink"
        >
          Restore
        </button>
      ) : (
        <button
          onClick={() => actions.archiveCandidate(candidate.id)}
          className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-thread/40 hover:text-ink"
        >
          Archive
        </button>
      )}
      {hasHistory ? (
        <span
          className="font-mono text-[10px] uppercase tracking-wider text-ink-faint"
          title="Has evaluations — kept for the audit trail"
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
  );
}

const labelFor = (kind) =>
  ({
    recommend_advance: 'Advance',
    recommend_hire: 'Extend offer',
    recommend_decline: 'Decline',
    review_together: 'Convene the panel',
    await_reviews: 'Awaiting reviews',
    closed: 'Closed',
  }[kind] ?? '—');

// --- Add candidate form ----------------------------------------------------
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Shared email check — the single source of truth, reused on the Team tab too.
export const isValidEmail = (email) => EMAIL_RE.test((email || '').trim().toLowerCase());
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]+$/i;

// Loosely normalise a URL: a bare domain gets https:// prepended.
const normalizeUrl = (v) => {
  const t = (v || '').trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

// --- CSV bulk import -------------------------------------------------------

const CSV_COLUMNS = ['name', 'email', 'pipeline', 'seniority', 'source', 'portfolioUrl', 'githubUrl', 'websiteUrl', 'resumeUrl'];

// Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, CRLF.
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip UTF-8 BOM
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  // Drop fully-empty rows.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// Parse + validate against the live store. Never drops rows — flags problems.
function parseAndValidate(text, db) {
  const matrix = parseCSV(text);
  if (!matrix.length) return { rows: [], ready: 0, problems: 0 };

  // Map header → canonical column (lowercased, trimmed; unknowns ignored).
  const headers = matrix[0].map((h) => h.trim().toLowerCase());
  const colIndex = {};
  CSV_COLUMNS.forEach((col) => {
    const idx = headers.indexOf(col.toLowerCase());
    if (idx >= 0) colIndex[col] = idx;
  });

  const existingEmails = new Set(db.candidates.map((c) => (c.email || '').trim().toLowerCase()));
  const seenEmails = new Set(existingEmails);

  const rows = matrix.slice(1).map((cells, i) => {
    const get = (col) => (colIndex[col] != null ? (cells[colIndex[col]] ?? '').trim() : '');
    const name = get('name');
    const email = get('email');
    const emailKey = email.toLowerCase();
    const pipelineCell = get('pipeline');
    const seniorityCell = get('seniority');

    const pipeline = db.pipelines.find(
      (p) => p.role.trim().toLowerCase() === pipelineCell.toLowerCase(),
    );
    const seniority = seniorityCell
      ? SENIORITY.find((s) => s.toLowerCase() === seniorityCell.toLowerCase())
      : undefined;

    let reason = '';
    if (!name) reason = 'Missing name';
    else if (!email) reason = 'Missing email';
    else if (!isValidEmail(email)) reason = 'Invalid email';
    else if (seenEmails.has(emailKey)) reason = existingEmails.has(emailKey) ? 'Duplicate email (already in system)' : 'Duplicate email (in file)';
    else if (!pipelineCell) reason = 'Missing pipeline';
    else if (!pipeline) reason = `Unknown pipeline “${pipelineCell}”`;
    else if (seniorityCell && !seniority) reason = `Invalid seniority “${seniorityCell}”`;

    // Reserve a valid email so later rows with the same email flag as dupes.
    if (!reason) seenEmails.add(emailKey);

    return {
      line: i + 2, // 1-based incl. header
      name, email,
      pipelineId: pipeline?.id ?? null,
      pipelineName: pipeline?.role ?? pipelineCell,
      seniority,
      source: get('source'),
      portfolioUrl: get('portfolioUrl'),
      githubUrl: get('githubUrl'),
      websiteUrl: get('websiteUrl'),
      resumeUrl: get('resumeUrl'),
      ok: !reason,
      reason,
    };
  });

  return { rows, ready: rows.filter((r) => r.ok).length, problems: rows.filter((r) => !r.ok).length };
}

function downloadSampleCSV(pipelines) {
  const p0 = pipelines[0]?.role ?? 'Senior Product Designer';
  const p1 = pipelines[1]?.role ?? p0;
  const lines = [
    CSV_COLUMNS.join(','),
    `Riya Sharma,riya.sharma@example.com,${p0},Senior,Referral,https://riya.example,https://github.com/riya,,`,
    `Ben Olsen,ben.olsen@example.com,${p1},Mid,Inbound,,,https://benolsen.example,`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'throughline-candidates-sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function BulkImport({ db, actions, onClose }) {
  const [parsed, setParsed] = useState(null);
  const [done, setDone] = useState(null);
  const [fileName, setFileName] = useState('');

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDone(null);
    file.text().then((text) => setParsed(parseAndValidate(text, db)));
  }

  function runImport() {
    const valid = parsed.rows.filter((r) => r.ok);
    // Reuse the EXACT single-candidate path: create + initialise state + distribute.
    for (const r of valid) {
      const id = actions.addCandidate({
        name: r.name,
        email: r.email,
        pipelineId: r.pipelineId,
        seniority: r.seniority,
        source: r.source || 'CSV import',
        portfolioUrl: r.portfolioUrl,
        githubUrl: r.githubUrl,
        websiteUrl: r.websiteUrl,
        resumeUrl: r.resumeUrl,
      });
      actions.activateAssignments(id);
    }
    setDone({ imported: valid.length, problems: parsed.problems });
    setParsed(null);
  }

  return (
    <section className="mb-5 rounded-xl2 border border-line bg-panel p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-medium text-ink">Import candidates from CSV</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">VP only</span>
      </div>

      <p className="text-sm text-ink-faint">
        Columns: <span className="font-mono text-xs text-ink-soft">name, email, pipeline</span> (required) plus optional{' '}
        <span className="font-mono text-xs text-ink-soft">seniority, source, portfolioUrl, githubUrl, websiteUrl, resumeUrl</span>.
        The pipeline is matched to an existing role by name. Nothing is created until you confirm.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-line px-3 py-2 text-sm text-ink-soft transition hover:border-thread/40 hover:text-ink">
          Choose CSV file
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        </label>
        {fileName && <span className="font-mono text-xs text-ink-faint">{fileName}</span>}
        <button
          onClick={() => downloadSampleCSV(db.pipelines)}
          className="rounded-lg border border-line px-3 py-2 text-sm text-ink-soft transition hover:border-thread/40 hover:text-ink"
        >
          Download sample CSV
        </button>
        <button
          onClick={onClose}
          className="ml-auto rounded-lg border border-line px-3 py-2 text-sm text-ink-soft transition hover:text-ink"
        >
          Close
        </button>
      </div>

      {done && (
        <div className="mt-4 rounded-lg border border-strong/30 bg-strong-wash px-4 py-3 text-sm text-ink">
          Imported <span className="font-mono font-semibold tabular">{done.imported}</span> candidate{done.imported === 1 ? '' : 's'}.
          {done.problems > 0 && (
            <> <span className="font-mono tabular">{done.problems}</span> problem row{done.problems === 1 ? '' : 's'} were skipped.</>
          )}
        </div>
      )}

      {parsed && (
        <div className="mt-4">
          <div className="mb-2 text-sm text-ink-soft">
            <span className="font-mono font-semibold tabular text-ink">{parsed.rows.length}</span> rows:{' '}
            <span className="font-mono tabular text-strong">{parsed.ready}</span> ready,{' '}
            <span className="font-mono tabular text-concern">{parsed.problems}</span> problem{parsed.problems === 1 ? '' : 's'}.
          </div>

          <div className="max-h-80 overflow-auto rounded-xl2 border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-panel">
                <tr className="border-b border-line uppercase tracking-wider text-ink-faint">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Pipeline</th>
                  <th className="px-3 py-2 font-medium">Seniority</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {parsed.rows.map((r) => (
                  <tr key={r.line} className={r.ok ? '' : 'bg-concern-wash/30'}>
                    <td className="px-3 py-1.5 font-mono text-ink-faint tabular">{r.line}</td>
                    <td className="px-3 py-1.5 text-ink">{r.name || <span className="text-ink-faint">—</span>}</td>
                    <td className="px-3 py-1.5 font-mono text-ink-soft">{r.email || <span className="text-ink-faint">—</span>}</td>
                    <td className="px-3 py-1.5 text-ink-soft">{r.pipelineName || <span className="text-ink-faint">—</span>}</td>
                    <td className="px-3 py-1.5 text-ink-soft">{r.seniority || <span className="text-ink-faint">—</span>}</td>
                    <td className="px-3 py-1.5">
                      {r.ok ? (
                        <Badge cls="border-strong/30 bg-strong-wash text-strong">Ready</Badge>
                      ) : (
                        <span className="text-concern">{r.reason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={runImport}
              disabled={parsed.ready === 0}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              Import {parsed.ready} valid row{parsed.ready === 1 ? '' : 's'}
            </button>
            <button
              onClick={() => setParsed(null)}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft transition hover:text-ink"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AddCandidateForm({ pipelines, existingEmails, defaultPipelineId, onCancel, onCreate }) {
  const [form, setForm] = useState({
    name: '', email: '', pipelineId: defaultPipelineId ?? pipelines[0]?.id ?? '',
    seniority: 'Mid', source: '', resumeUrl: '', portfolioUrl: '', websiteUrl: '', githubUrl: '',
  });
  const [attempted, setAttempted] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const problems = validateCandidate(form, existingEmails);
  const urlFields = [
    ['resumeUrl', 'Resume link'],
    ['portfolioUrl', 'Portfolio link'],
    ['websiteUrl', 'Website'],
    ['githubUrl', 'GitHub'],
  ];

  function submit(e) {
    e.preventDefault();
    setAttempted(true);
    if (Object.keys(problems).length) return;
    onCreate({
      name: form.name.trim(),
      email: form.email.trim(),
      pipelineId: form.pipelineId,
      seniority: form.seniority,
      source: form.source.trim(),
      resumeUrl: normalizeUrl(form.resumeUrl),
      portfolioUrl: normalizeUrl(form.portfolioUrl),
      websiteUrl: normalizeUrl(form.websiteUrl),
      githubUrl: normalizeUrl(form.githubUrl),
    });
  }

  const err = (k) => attempted && problems[k];

  return (
    <form onSubmit={submit} className="mb-5 rounded-xl2 border border-line bg-panel p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-medium text-ink">Add a candidate</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">VP only</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required value={form.name} onChange={set('name')} error={err('name')} placeholder="Riya Sharma" />
        <Field label="Email" required value={form.email} onChange={set('email')} error={err('email')} placeholder="riya@example.com" mono />

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Pipeline <span className="text-thread">*</span></span>
          <select
            value={form.pipelineId}
            onChange={set('pipelineId')}
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-thread focus:outline-none"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.role}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Seniority</span>
          <select
            value={form.seniority}
            onChange={set('seniority')}
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-thread focus:outline-none"
          >
            {SENIORITY.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <Field label="Source" value={form.source} onChange={set('source')} placeholder="Referral, Inbound…" />

        {urlFields.map(([k, label]) => (
          <Field key={k} label={label} value={form[k]} onChange={set(k)} error={err(k)} placeholder="https://…" mono />
        ))}
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        The resume is a <strong>link</strong>, not an upload — this demo has no file storage, so paste a URL to the document.
      </p>

      {attempted && Object.keys(problems).length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {Object.values(problems).map((p, i) => (
            <li key={i} className="text-xs text-concern">• {p}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft">
          Create candidate
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft transition hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, required, value, onChange, error, placeholder, mono }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}{required && <span className="text-thread"> *</span>}
      </span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`rounded-lg border bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-thread ${
          error ? 'border-concern' : 'border-line'
        } ${mono ? 'font-mono' : ''}`}
      />
    </label>
  );
}

function validateCandidate(form, existingEmails) {
  const problems = {};
  if (!form.name.trim()) problems.name = 'Name is required.';
  const email = form.email.trim().toLowerCase();
  if (!email) problems.email = 'Email is required.';
  else if (!isValidEmail(email)) problems.email = 'That email doesn’t look valid.';
  else if (existingEmails.includes(email)) problems.email = 'A candidate with that email already exists.';
  if (!form.pipelineId) problems.pipelineId = 'Choose a pipeline.';
  for (const k of ['resumeUrl', 'portfolioUrl', 'websiteUrl', 'githubUrl']) {
    const v = (form[k] || '').trim();
    if (v && !URL_RE.test(normalizeUrl(v))) problems[k] = `${k.replace('Url', '')} link doesn’t look like a URL.`;
  }
  return problems;
}

// --- Honest "next build" panel for surfaces not yet built here -------------
export function NextBuild({ title, lead, points }) {
  return (
    <section className="rise mx-auto max-w-2xl py-6">
      <Eyebrow>Next build</Eyebrow>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-ink-soft">{lead}</p>
      <ul className="mt-5 flex flex-col gap-3">
        {points.map((p, i) => (
          <li key={i} className="flex gap-3 rounded-xl2 border border-line bg-panel px-4 py-3 shadow-card">
            <span className="mt-0.5 font-mono text-xs text-thread">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-sm text-ink-soft">{p}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-ink-faint">
        The engine and data model these surfaces need already run in this build — see the Pipeline
        Builder and Candidates views. This screen gets built next in Claude Code, against the same store.
      </p>
    </section>
  );
}
