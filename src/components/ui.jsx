import React from 'react';

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <line x1="4" y1="3" x2="4" y2="19" strokeWidth="1.5" className="stroke-thread-soft" />
        <circle cx="4" cy="5" r="2.4" className="fill-thread" />
        <circle cx="4" cy="11" r="2.4" className="fill-thread" />
        <circle cx="4" cy="17" r="2.4" className="fill-thread" />
        <line x1="9" y1="5" x2="18" y2="5" strokeWidth="1.5" className="stroke-ink" />
        <line x1="9" y1="11" x2="18" y2="11" strokeWidth="1.5" className="stroke-ink" />
        <line x1="9" y1="17" x2="14" y2="17" strokeWidth="1.5" className="stroke-ink" />
      </svg>
      <span className="font-display text-[19px] font-medium tracking-tight text-ink">
        Throughline
      </span>
    </div>
  );
}

export function Badge({ children, cls = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

export function Eyebrow({ children }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
      {children}
    </div>
  );
}

export function IconButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-panel text-ink-soft transition hover:border-thread/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
