import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from './store/StoreContext.jsx';
import { Wordmark } from './components/ui.jsx';
import PipelineBuilder from './components/PipelineBuilder.jsx';
import { CandidatesView } from './components/Surfaces.jsx';
import { DecisionView } from './components/DecisionView.jsx';
import { ReviewerDesk } from './components/ReviewerDesk.jsx';
import ScorecardEditor from './components/ScorecardEditor.jsx';
import Team from './components/Team.jsx';
import PipelineHealth from './components/PipelineHealth.jsx';
import { NotificationBell } from './components/NotificationBell.jsx';

const SURFACES = [
  { id: 'builder', label: 'Pipeline Builder' },
  { id: 'scorecards', label: 'Scorecards' },
  { id: 'team', label: 'Team' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'health', label: 'Pipeline Health' },
  { id: 'review', label: 'Review' },
];

export default function App() {
  const { db, actions } = useStore();
  const [surface, setSurface] = useState('builder');
  const [personaId, setPersonaId] = useState('u_avery'); // seeded admin (Avery Cole)
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null); // deep-link from a notification

  // Theme: follow the OS by default ('system'); an explicit Light/Dark choice
  // persists and wins. Applied by toggling `.dark` on <html> (the same class
  // the no-flash script in index.html sets before paint).
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('throughline.theme') || 'system'; } catch { return 'system'; }
  });
  useEffect(() => {
    const root = document.documentElement;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mql.matches));
    apply();
    try { localStorage.setItem('throughline.theme', theme); } catch {}
    if (theme === 'system') {
      mql.addEventListener('change', apply);
      return () => mql.removeEventListener('change', apply);
    }
  }, [theme]);

  // Personas are generated from the real roster: every ACTIVE reviewer, plus a
  // read-only Observer. Permissions follow each reviewer's role.
  const personas = useMemo(() => {
    const fromRoster = db.reviewers
      .filter((r) => r.active !== false)
      .map((r) => ({
        id: r.id,
        role: r.role,
        label: r.name,
        sub: `${r.title ? `${r.title} — ` : ''}${r.role}`,
      }));
    return [...fromRoster, { id: 'observer', role: 'observer', label: 'Observer', sub: 'Read-only' }];
  }, [db.reviewers]);

  // Fall back to the first persona if the selected one is no longer offered
  // (e.g. it was just marked inactive).
  const persona = personas.find((p) => p.id === personaId) ?? personas[0];
  const canEdit = persona.role === 'admin';

  // Clicking a notification jumps that persona to the relevant review.
  function openReview(target) {
    setReviewTarget(target);
    setSurface('review');
  }

  return (
    <div className="min-h-full">
      <TopBar
        surface={surface}
        onSurface={(s) => { setSurface(s); setSelectedCandidateId(null); setReviewTarget(null); }}
        personas={personas}
        persona={persona}
        onPersona={setPersonaId}
        onOpenReview={openReview}
        theme={theme}
        onTheme={setTheme}
        onReset={() => {
          if (confirm('Reset everything to the demo data? Your changes in this browser will be cleared.'))
            actions.reset();
        }}
      />

      {!canEdit && (surface === 'builder' || surface === 'scorecards') && (
        <Banner>
          Viewing as <strong>{persona.label}</strong>. Reviewers and observers can read{' '}
          {surface === 'scorecards' ? 'scorecards' : 'pipelines'} but not edit them — switch to the
          VP persona to build. The same principle keeps reviews blind until they are locked.
        </Banner>
      )}

      <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        {surface === 'builder' && <PipelineBuilder canEdit={canEdit} />}
        {surface === 'candidates' && (
          selectedCandidateId
            ? <DecisionView
                candidateId={selectedCandidateId}
                persona={persona}
                onBack={() => setSelectedCandidateId(null)}
              />
            : <CandidatesView onSelect={(id) => setSelectedCandidateId(id)} canEdit={canEdit} />
        )}
        {surface === 'review' && <ReviewerDesk persona={persona} initialOpen={reviewTarget} />}
        {surface === 'scorecards' && <ScorecardEditor canEdit={canEdit} />}
        {surface === 'team' && <Team canEdit={canEdit} personaId={persona.id} />}
        {surface === 'health' && <PipelineHealth persona={persona} />}
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-10 pt-2 sm:px-8">
        <p className="text-xs text-ink-faint">
          Throughline — a demo. Your changes persist in this browser only and never leave it.
          Everything resets to the seeded data with one click.
        </p>
      </footer>
    </div>
  );
}

function TopBar({ surface, onSurface, personas, persona, onPersona, onOpenReview, theme, onTheme, onReset }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 sm:px-8">
        <Wordmark />
        {/* Global controls — pinned to the top row, right-aligned. The theme
            toggle lives here with the bell and Reset (not by the persona). */}
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell persona={persona} onOpenReview={onOpenReview} />
          <ThemeToggle value={theme} onChange={onTheme} />
          <button
            onClick={onReset}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition hover:border-thread/40 hover:text-ink"
          >
            Reset
          </button>
        </div>
        {/* Second tier: navigation + the contextual persona switcher. The
            w-full forces this onto its own row, below the global controls. */}
        <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <nav className="flex flex-wrap gap-1">
            {SURFACES.map((s) => (
              <button
                key={s.id}
                onClick={() => onSurface(s.id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  surface === s.id
                    ? 'bg-ink text-paper'
                    : 'text-ink-soft hover:bg-line/60 hover:text-ink'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <PersonaSwitcher personas={personas} value={persona.id} onChange={onPersona} />
        </div>
      </div>
    </header>
  );
}

// Compact 3-state theme control for the top bar: one icon button that CYCLES
// System → Light → Dark. The icon shows the current mode; behavior unchanged
// (system default + persisted manual override).
function ThemeToggle({ value, onChange }) {
  const order = ['system', 'light', 'dark'];
  const labels = { system: 'Auto', light: 'Light', dark: 'Dark' };
  const next = order[(order.indexOf(value) + 1) % order.length];
  return (
    <button
      onClick={() => onChange(next)}
      title={`Theme: ${labels[value]} — click for ${labels[next]}`}
      aria-label={`Theme: ${labels[value]}. Switch to ${labels[next]}.`}
      className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-panel text-ink-soft transition hover:border-thread/40 hover:text-ink"
    >
      <ThemeIcon mode={value} />
    </button>
  );
}

function ThemeIcon({ mode }) {
  if (mode === 'light') {
    // Sun
    return (
      <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
        <circle cx="9" cy="9" r="3.4" stroke="currentColor" strokeWidth="1.4" />
        <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M14.3 3.7l-1.4 1.4M5.1 12.9l-1.4 1.4" />
        </g>
      </svg>
    );
  }
  if (mode === 'dark') {
    // Moon
    return (
      <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
        <path d="M14.5 10.6A6 6 0 1 1 7.4 3.5a4.8 4.8 0 0 0 7.1 7.1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    );
  }
  // Auto (follows system) — half-filled contrast circle
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="6.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 2.7a6.3 6.3 0 0 1 0 12.6Z" fill="currentColor" />
    </svg>
  );
}

function PersonaSwitcher({ personas, value, onChange }) {
  const persona = personas.find((p) => p.id === value);
  return (
    <label className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5">
      <span className="hidden font-mono text-[10px] uppercase tracking-wider text-ink-faint sm:inline">
        Viewing as
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm font-medium text-ink focus:outline-none"
        title={persona?.sub}
      >
        {personas.map((p) => (
          <option key={p.id} value={p.id}>{p.label} · {p.sub}</option>
        ))}
      </select>
    </label>
  );
}

function Banner({ children }) {
  return (
    <div className="border-b border-thread/30 bg-thread-wash">
      <p className="mx-auto max-w-6xl px-5 py-2.5 text-sm text-ink-soft sm:px-8">{children}</p>
    </div>
  );
}
