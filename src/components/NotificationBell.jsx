import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { hasConflict } from './constants.js';
import { Badge } from './ui.jsx';

// =============================================================================
// Notification bell — surfaces the SAME simulated notifications stored on
// assignments to their recipient (the assignment's reviewer). Per-persona:
// it shows only what's addressed to the current persona's reviewer id.
// =============================================================================

export function NotificationBell({ persona, onOpenReview }) {
  const { db, actions } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // The persona's underlying reviewer id. The Observer persona ('observer')
  // is not a reviewer, so it matches no assignment and sees nothing.
  const reviewerId = persona?.id;
  const items = gatherNotifications(db, reviewerId);
  const unread = items.filter((n) => !n.read && !n.stale).length;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    // Opening the panel marks the persona's notifications read.
    if (next && unread > 0) actions.markNotificationsReadFor(reviewerId);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        title="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-line bg-panel text-ink-soft transition hover:border-thread/40 hover:text-ink"
      >
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path
            d="M9 2.5a4.5 4.5 0 0 0-4.5 4.5c0 3.5-1.3 4.7-1.3 4.7h11.6s-1.3-1.2-1.3-4.7A4.5 4.5 0 0 0 9 2.5Z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
          />
          <path d="M7.5 14.2a1.6 1.6 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[16px] place-items-center rounded-full bg-thread px-1 font-mono text-[10px] font-semibold leading-none text-paper tabular" style={{ height: 16 }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl2 border border-line bg-panel shadow-lift">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-medium text-ink">Notifications</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              {persona?.label}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-faint">
              Nothing for you right now.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.key}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      // Stale notifications are no longer actionable → do nothing.
                      if (!n.stale && n.candidate && n.review)
                        onOpenReview?.({ candidateId: n.candidate.id, reviewId: n.review.id });
                    }}
                    aria-disabled={n.stale}
                    className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition ${
                      n.stale ? 'cursor-default opacity-50' : 'hover:bg-thread-wash/50'
                    } ${!n.stale && !n.read ? 'bg-thread-wash/30' : ''}`}
                  >
                    {!n.stale && !n.read && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-thread" aria-hidden />}
                    <div className={`min-w-0 flex-1 ${n.stale || n.read ? 'pl-4' : ''}`}>
                      <div className="text-sm text-ink">
                        Review request: <span className="font-medium">{n.candidate?.name ?? 'a candidate'}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-ink-faint">{n.review?.label ?? 'a review'}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge cls="border-line bg-paper text-ink-soft">{n.channel === 'email' ? 'Email' : 'Slack'}</Badge>
                        <span className="font-mono text-[10px] text-ink-faint">{fmtTime(n.sentAt)}</span>
                        {n.stale && (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">no longer actionable</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="border-t border-line px-4 py-2 text-[11px] text-ink-faint">
            Simulated — nothing is actually sent. These are the same previews created at assignment.
          </p>
        </div>
      )}
    </div>
  );
}

// --- Helpers -----------------------------------------------------------------

function gatherNotifications(db, reviewerId) {
  if (!reviewerId) return [];
  const out = [];
  for (const a of db.assignments ?? []) {
    if (a.reviewerId !== reviewerId) continue;
    const candidate = db.candidates.find((c) => c.id === a.candidateId);
    const review = findReview(db, a.reviewId);
    const st = db.candidateState.find((s) => s.candidateId === a.candidateId);
    // A notification is stale (no longer actionable) when the assignment is no
    // longer live (reassigned/cancelled or already submitted), the candidate is
    // closed/archived, or the reviewer is now conflicted with the candidate.
    const live = a.status === 'assigned' || a.status === 'in_progress';
    const stale =
      !live ||
      !candidate ||
      candidate.archived ||
      st?.status === 'declined' ||
      st?.status === 'hired' ||
      hasConflict(db.conflicts, a.candidateId, reviewerId);
    (a.notifications ?? []).forEach((n, i) => {
      out.push({
        key: `${a.id}:${i}`,
        candidate,
        review,
        channel: n.channel,
        sentAt: n.sentAt,
        read: !!n.read,
        stale,
      });
    });
  }
  return out.sort((x, y) => Date.parse(y.sentAt) - Date.parse(x.sentAt));
}

function findReview(db, reviewId) {
  for (const p of db.pipelines)
    for (const stage of p.stages) {
      const review = stage.reviews.find((r) => r.id === reviewId);
      if (review) return review;
    }
  return null;
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
