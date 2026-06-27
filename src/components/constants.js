export const PERSONAS = [
  { id: 'u_avery', label: 'Avery Cole', sub: 'VP, Design — admin', role: 'admin' },
  { id: 'u_dev', label: 'Devon Reyes', sub: 'Staff Designer — reviewer', role: 'reviewer' },
  { id: 'observer', label: 'Observer', sub: 'Read-only', role: 'observer' },
];

// PERMISSION axis only — what you can do in the app. (Discipline + seniority
// are separate axes; see db.disciplines and SENIORITY.) Hiring managers fold
// into 'reviewer' permissions. 'hr' is the recruiter permission level.
export const REVIEWER_ROLES = [
  { id: 'hr', label: 'Recruiter' },
  { id: 'reviewer', label: 'Reviewer' },
  { id: 'admin', label: 'Admin' }, // full VP/admin abilities
];

// SENIORITY axis — independent of permission and discipline.
export const SENIORITY = ['Junior', 'Mid', 'Senior', 'Principal'];

// A declared conflict of interest between a candidate and a reviewer. Conflicts
// are DECLARED facts, never auto-detected — this just checks the record.
export const hasConflict = (conflicts, candidateId, reviewerId) =>
  (conflicts ?? []).some((c) => c.candidateId === candidateId && c.reviewerId === reviewerId);

// Rank a seniority level; unknown/missing is treated as Mid.
export const seniorityRank = (level) => {
  const i = SENIORITY.indexOf(level);
  return i >= 0 ? i : SENIORITY.indexOf('Mid');
};

// Does a reviewer satisfy a review's OPTIONAL seniority condition for this
// candidate? No condition (or unset) → always true (unconditioned behavior).
export function meetsSeniority(reviewer, review, candidate) {
  const c = review?.conditions?.seniority;
  if (!c || !c.mode || c.mode === 'none') return true;
  const rRank = seniorityRank(reviewer?.seniority);
  if (c.mode === 'candidate') return rRank >= seniorityRank(candidate?.seniority);
  if (c.mode === 'floor') return rRank >= seniorityRank(c.floor);
  return true;
}

export const SIGNAL = {
  strong: { label: 'Strong', cls: 'text-strong bg-strong-wash border-strong/30' },
  mixed: { label: 'Mixed', cls: 'text-mixed bg-mixed-wash border-mixed/30' },
  concern: { label: 'Concern', cls: 'text-concern bg-concern-wash border-concern/30' },
  incomplete: { label: 'Incomplete', cls: 'text-ink-faint bg-line/40 border-line' },
};

export const OUTCOME = {
  cleared: { label: 'Cleared', cls: 'text-strong bg-strong-wash border-strong/30' },
  needs_decision: { label: 'Needs decision', cls: 'text-mixed bg-mixed-wash border-mixed/40' },
  did_not_clear: { label: 'Did not clear', cls: 'text-concern bg-concern-wash border-concern/30' },
  in_progress: { label: 'In progress', cls: 'text-ink-soft bg-line/40 border-line' },
};
