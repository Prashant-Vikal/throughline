// Throughline — baked-in demo data.
// This is the pristine dataset every visitor starts from. A visitor's edits
// layer on top of this in localStorage; "Reset to demo data" restores this.
//
// The engine computes results from `scores` + the scorecard at read time, so
// review Results are intentionally NOT stored here — they are derived. That is
// the whole point: the throughline is reconstructed, never hand-written.

export const SEED = {
  // --- Disciplines: shared vocabulary for reviewers AND scorecards ---------
  // Existing scorecard.discipline values (Design, Engineering) are migrated in
  // so current scorecards keep resolving; the rest are seeded defaults.
  disciplines: [
    'Design',
    'Engineering',
    'Product Designer',
    'Frontend Developer',
    'Product Lead',
    'Marketing Lead',
  ],

  // --- People who can review or decide -------------------------------------
  // role = PERMISSION axis (admin/reviewer/hr). discipline + seniority are
  // independent axes used for context (and, later, routing).
  reviewers: [
    { id: 'u_avery', name: 'Avery Cole', role: 'admin', title: 'VP, Design', isSuperAdmin: true, discipline: 'Design', seniority: 'Principal', email: 'avery.cole@throughline.example', slackHandle: '@avery' },
    { id: 'u_renee', name: 'Renee Park', role: 'hr', title: 'Recruiter', email: 'renee.park@throughline.example', slackHandle: '@renee', discipline: 'Design', seniority: 'Mid' },
    { id: 'u_dev', name: 'Devon Reyes', role: 'reviewer', title: 'Staff Designer', email: 'devon.reyes@throughline.example', slackHandle: '@devon', discipline: 'Design', seniority: 'Senior' },
    // Iris: intentional "email but no Slack handle" example (channel availability).
    { id: 'u_iris', name: 'Iris Lindqvist', role: 'reviewer', title: 'Design Manager', email: 'iris.lindqvist@throughline.example', discipline: 'Design', seniority: 'Senior' },
    // Omar: intentional "no contact method at all" example (the only one).
    { id: 'u_omar', name: 'Omar Haddad', role: 'reviewer', title: 'Principal Designer', discipline: 'Design', seniority: 'Principal' },
    { id: 'u_lena', name: 'Lena Fischer', role: 'reviewer', title: 'Staff Engineer', discipline: 'Engineering', seniority: 'Senior', email: 'lena.fischer@throughline.example', slackHandle: '@lena' },
    { id: 'u_kofi', name: 'Kofi Mensah', role: 'reviewer', title: 'Eng Manager', discipline: 'Engineering', seniority: 'Senior', email: 'kofi.mensah@throughline.example', slackHandle: '@kofi' },
    { id: 'u_yuki', name: 'Yuki Tanaka', role: 'reviewer', title: 'Principal Engineer', discipline: 'Engineering', seniority: 'Principal', email: 'yuki.tanaka@throughline.example', slackHandle: '@yuki' },
  ],

  // --- Scorecards: reusable evaluation templates per discipline -------------
  scorecards: [
    {
      id: 'sc_design',
      name: 'Product Designer',
      discipline: 'Design',
      criteria: [
        {
          id: 'c_craft', name: 'Design Craft', weight: 25, subjective: false,
          rubric: { low: 'Inconsistent visual/interaction quality; relies on templates without rationale.', high: 'Exceptional, considered craft; every decision is intentional and defensible.' },
        },
        {
          id: 'c_systems', name: 'Systems Thinking', weight: 25, subjective: false,
          rubric: { low: 'Designs one screen at a time; misses how parts connect.', high: 'Designs reusable systems; reasons about scale, states, and edge cases.' },
        },
        {
          id: 'c_judgment', name: 'Product Judgment', weight: 20, subjective: false,
          rubric: { low: 'Optimizes for polish over user/business outcome.', high: 'Prioritizes ruthlessly; ties design choices to real outcomes.' },
        },
        {
          id: 'c_comm', name: 'Communication', weight: 15, subjective: true,
          rubric: { low: 'Rationale is hard to follow; cannot defend choices under questioning.', high: 'Explains thinking crisply; brings others along.' },
        },
        {
          id: 'c_collab', name: 'Collaboration', weight: 15, subjective: true,
          rubric: { low: 'Works in isolation; defensive about feedback.', high: 'Seeks and integrates feedback; elevates the people around them.' },
        },
      ],
      redFlags: [
        { id: 'rf_borrowed', label: 'Borrowed work presented as own' },
        { id: 'rf_hostile', label: 'Hostility toward feedback' },
      ],
    },
    {
      id: 'sc_eng',
      name: 'Backend Engineer',
      discipline: 'Engineering',
      criteria: [
        {
          id: 'e_tech', name: 'Technical Ability', weight: 30, subjective: false,
          rubric: { low: 'Struggles with core language/runtime fundamentals.', high: 'Deep, fluent command of the fundamentals and their trade-offs.' },
        },
        {
          id: 'e_design', name: 'Systems Design', weight: 25, subjective: false,
          rubric: { low: 'Designs that do not survive scale or failure.', high: 'Designs for scale, failure, and operability from the start.' },
        },
        {
          id: 'e_problem', name: 'Problem Solving', weight: 20, subjective: false,
          rubric: { low: 'Jumps to code; misses the actual constraint.', high: 'Frames the problem before solving; reasons under ambiguity.' },
        },
        {
          id: 'e_comm', name: 'Communication', weight: 15, subjective: true,
          rubric: { low: 'Cannot explain a design to a non-author.', high: 'Makes complex systems legible to others.' },
        },
        {
          id: 'e_collab', name: 'Collaboration', weight: 10, subjective: true,
          rubric: { low: 'Territorial about code; dismisses review.', high: 'Treats review as a gift; raises the team.' },
        },
      ],
      redFlags: [
        { id: 'rf_dishonest', label: 'Dishonesty about experience' },
        { id: 'rf_plagiarized', label: 'Plagiarized take-home' },
      ],
    },
  ],

  // --- Pipelines: same engine, two visibly different shapes ----------------
  pipelines: [
    {
      id: 'p_designer',
      role: 'Senior Product Designer',
      level: 'Senior',
      discipline: 'Design',
      stages: [
        {
          id: 's_d_app', name: 'Application & Portfolio Review', order: 1,
          reviews: [
            { id: 'r_d_hr', label: 'Recruiter screen', reviewerRole: 'hr', scorecardId: 'sc_design', order: 1, stopOnFail: false, pool: ['u_renee'] },
            { id: 'r_d_port', label: 'Portfolio review', reviewerRole: 'reviewer', scorecardId: 'sc_design', order: 2, stopOnFail: true, pool: ['u_dev', 'u_iris', 'u_omar'] },
          ],
        },
        {
          id: 's_d_hm', name: 'Hiring Manager Review', order: 2,
          reviews: [
            { id: 'r_d_hm', label: 'Hiring manager interview', reviewerRole: 'reviewer', scorecardId: 'sc_design', order: 1, stopOnFail: false, pool: ['u_iris', 'u_omar', 'u_dev'] },
          ],
        },
        {
          id: 's_d_panel', name: 'Portfolio Deep-Dive', order: 3,
          reviews: [
            { id: 'r_d_p1', label: 'Panelist — craft', reviewerRole: 'reviewer', scorecardId: 'sc_design', order: 1, stopOnFail: false, pool: ['u_dev', 'u_iris', 'u_omar'], conditions: { seniority: { mode: 'candidate' } } },
            { id: 'r_d_p2', label: 'Panelist — systems', reviewerRole: 'reviewer', scorecardId: 'sc_design', order: 2, stopOnFail: false, pool: ['u_dev', 'u_iris', 'u_omar'] },
            { id: 'r_d_p3', label: 'Panelist — judgment', reviewerRole: 'reviewer', scorecardId: 'sc_design', order: 3, stopOnFail: false, pool: ['u_dev', 'u_iris', 'u_omar'] },
          ],
        },
        {
          id: 's_d_values', name: 'Values & Collaboration', order: 4,
          reviews: [
            { id: 'r_d_val', label: 'Values interview', reviewerRole: 'reviewer', scorecardId: 'sc_design', order: 1, stopOnFail: false, pool: ['u_omar', 'u_dev', 'u_iris'] },
          ],
        },
      ],
    },
    {
      id: 'p_engineer',
      role: 'Backend Engineer',
      level: 'Mid',
      discipline: 'Engineering',
      stages: [
        {
          id: 's_e_screen', name: 'Resume Screen', order: 1,
          reviews: [
            { id: 'r_e_hr', label: 'Recruiter screen', reviewerRole: 'hr', scorecardId: 'sc_eng', order: 1, stopOnFail: false, pool: ['u_renee'] },
            { id: 'r_e_res', label: 'Engineering resume review', reviewerRole: 'reviewer', scorecardId: 'sc_eng', order: 2, stopOnFail: true, pool: ['u_lena', 'u_kofi', 'u_yuki'], conditions: { loadAware: true } },
          ],
        },
        {
          id: 's_e_phone', name: 'Technical Phone Screen', order: 2,
          reviews: [
            { id: 'r_e_phone', label: 'Technical phone screen', reviewerRole: 'reviewer', scorecardId: 'sc_eng', order: 1, stopOnFail: false, pool: ['u_kofi', 'u_lena', 'u_yuki'] },
          ],
        },
        {
          id: 's_e_panel', name: 'Technical Panel', order: 3,
          reviews: [
            { id: 'r_e_p1', label: 'Coding interview', reviewerRole: 'reviewer', scorecardId: 'sc_eng', order: 1, stopOnFail: false, pool: ['u_lena', 'u_yuki', 'u_kofi'] },
            { id: 'r_e_p2', label: 'Systems design interview', reviewerRole: 'reviewer', scorecardId: 'sc_eng', order: 2, stopOnFail: false, pool: ['u_lena', 'u_yuki', 'u_kofi'] },
            { id: 'r_e_p3', label: 'Problem-solving interview', reviewerRole: 'reviewer', scorecardId: 'sc_eng', order: 3, stopOnFail: false, pool: ['u_lena', 'u_yuki', 'u_kofi'] },
          ],
        },
        {
          id: 's_e_values', name: 'Values & Collaboration', order: 4,
          reviews: [
            { id: 'r_e_val', label: 'Values interview', reviewerRole: 'reviewer', scorecardId: 'sc_eng', order: 1, stopOnFail: false, pool: ['u_yuki', 'u_lena', 'u_kofi'] },
          ],
        },
      ],
    },
  ],

  // --- Candidates ----------------------------------------------------------
  candidates: [
    { id: 'cand_maya', name: 'Maya Okonkwo', email: 'maya.o@example.com', source: 'Referral', pipelineId: 'p_designer', createdAt: '2026-05-02', seniority: 'Senior' },
    { id: 'cand_daniel', name: 'Daniel Roth', email: 'daniel.r@example.com', source: 'Inbound', pipelineId: 'p_designer', createdAt: '2026-05-10', seniority: 'Senior' },
    { id: 'cand_priya', name: 'Priya Nair', email: 'priya.n@example.com', source: 'Sourced', pipelineId: 'p_designer', createdAt: '2026-05-28', seniority: 'Senior' },
    { id: 'cand_tom', name: 'Tom Becker', email: 'tom.b@example.com', source: 'Inbound', pipelineId: 'p_designer', createdAt: '2026-05-15', seniority: 'Senior' },
    { id: 'cand_wei', name: 'Wei Zhang', email: 'wei.z@example.com', source: 'Referral', pipelineId: 'p_engineer', createdAt: '2026-05-04', seniority: 'Mid' },
    { id: 'cand_sofia', name: 'Sofia Alvarez', email: 'sofia.a@example.com', source: 'Sourced', pipelineId: 'p_engineer', createdAt: '2026-05-22', seniority: 'Mid' },
    { id: 'cand_jamal', name: 'Jamal Carter', email: 'jamal.c@example.com', source: 'Inbound', pipelineId: 'p_engineer', createdAt: '2026-06-01', seniority: 'Mid' },
  ],

  // --- Completed evaluations (metadata only) -------------------------------
  // Scores / notes / flags hang off these separately. lockedAt = immutable.
  evaluations: [
    // Maya — cleared app + HM, now mid Portfolio Deep-Dive with a SPLIT panel.
    { id: 'ev_maya_hr', candidateId: 'cand_maya', stageId: 's_d_app', reviewId: 'r_d_hr', reviewerId: 'u_renee', submittedAt: '2026-05-03T10:00:00Z', lockedAt: '2026-05-03T10:30:00Z' },
    { id: 'ev_maya_port', candidateId: 'cand_maya', stageId: 's_d_app', reviewId: 'r_d_port', reviewerId: 'u_dev', submittedAt: '2026-05-04T10:00:00Z', lockedAt: '2026-05-04T10:30:00Z' },
    { id: 'ev_maya_hm', candidateId: 'cand_maya', stageId: 's_d_hm', reviewId: 'r_d_hm', reviewerId: 'u_iris', submittedAt: '2026-05-08T10:00:00Z', lockedAt: '2026-05-08T10:30:00Z' },
    { id: 'ev_maya_p1', candidateId: 'cand_maya', stageId: 's_d_panel', reviewId: 'r_d_p1', reviewerId: 'u_omar', submittedAt: '2026-05-12T10:00:00Z', lockedAt: '2026-05-12T10:30:00Z' },
    { id: 'ev_maya_p2', candidateId: 'cand_maya', stageId: 's_d_panel', reviewId: 'r_d_p2', reviewerId: 'u_dev', submittedAt: '2026-05-12T11:00:00Z', lockedAt: '2026-05-12T11:30:00Z' },
    { id: 'ev_maya_p3', candidateId: 'cand_maya', stageId: 's_d_panel', reviewId: 'r_d_p3', reviewerId: 'u_iris', submittedAt: '2026-05-12T12:00:00Z', lockedAt: '2026-05-12T12:30:00Z' },

    // Tom — red flag at portfolio review (borrowed work) → stop_on_fail stage.
    { id: 'ev_tom_hr', candidateId: 'cand_tom', stageId: 's_d_app', reviewId: 'r_d_hr', reviewerId: 'u_renee', submittedAt: '2026-05-16T10:00:00Z', lockedAt: '2026-05-16T10:30:00Z' },
    { id: 'ev_tom_port', candidateId: 'cand_tom', stageId: 's_d_app', reviewId: 'r_d_port', reviewerId: 'u_dev', submittedAt: '2026-05-16T14:00:00Z', lockedAt: '2026-05-16T14:30:00Z' },

    // Daniel — cleared application, awaiting hiring manager review.
    { id: 'ev_dan_hr', candidateId: 'cand_daniel', stageId: 's_d_app', reviewId: 'r_d_hr', reviewerId: 'u_renee', submittedAt: '2026-05-11T10:00:00Z', lockedAt: '2026-05-11T10:30:00Z' },
    { id: 'ev_dan_port', candidateId: 'cand_daniel', stageId: 's_d_app', reviewId: 'r_d_port', reviewerId: 'u_dev', submittedAt: '2026-05-11T12:00:00Z', lockedAt: '2026-05-11T12:30:00Z' },

    // Wei — full technical panel complete, strong; ready to advance.
    { id: 'ev_wei_hr', candidateId: 'cand_wei', stageId: 's_e_screen', reviewId: 'r_e_hr', reviewerId: 'u_renee', submittedAt: '2026-05-05T10:00:00Z', lockedAt: '2026-05-05T10:30:00Z' },
    { id: 'ev_wei_res', candidateId: 'cand_wei', stageId: 's_e_screen', reviewId: 'r_e_res', reviewerId: 'u_lena', submittedAt: '2026-05-05T12:00:00Z', lockedAt: '2026-05-05T12:30:00Z' },
    { id: 'ev_wei_phone', candidateId: 'cand_wei', stageId: 's_e_phone', reviewId: 'r_e_phone', reviewerId: 'u_kofi', submittedAt: '2026-05-08T10:00:00Z', lockedAt: '2026-05-08T10:30:00Z' },
    { id: 'ev_wei_p1', candidateId: 'cand_wei', stageId: 's_e_panel', reviewId: 'r_e_p1', reviewerId: 'u_lena', submittedAt: '2026-05-13T10:00:00Z', lockedAt: '2026-05-13T10:30:00Z' },
    { id: 'ev_wei_p2', candidateId: 'cand_wei', stageId: 's_e_panel', reviewId: 'r_e_p2', reviewerId: 'u_yuki', submittedAt: '2026-05-13T11:00:00Z', lockedAt: '2026-05-13T11:30:00Z' },
    { id: 'ev_wei_p3', candidateId: 'cand_wei', stageId: 's_e_panel', reviewId: 'r_e_p3', reviewerId: 'u_kofi', submittedAt: '2026-05-13T12:00:00Z', lockedAt: '2026-05-13T12:30:00Z' },

    // Sofia — cleared the resume screen; now at the technical phone screen.
    { id: 'ev_sofia_hr', candidateId: 'cand_sofia', stageId: 's_e_screen', reviewId: 'r_e_hr', reviewerId: 'u_renee', submittedAt: '2026-05-23T10:00:00Z', lockedAt: '2026-05-23T10:30:00Z' },
    { id: 'ev_sofia_res', candidateId: 'cand_sofia', stageId: 's_e_screen', reviewId: 'r_e_res', reviewerId: 'u_lena', submittedAt: '2026-05-23T12:00:00Z', lockedAt: '2026-05-23T12:30:00Z' },
  ],

  // --- Scores: one row per criterion per evaluation, scale 1–5 -------------
  scores: [
    // Maya HR (light pass on the human-signal criteria)
    s('ev_maya_hr', { c_craft: 4, c_systems: 4, c_judgment: 4, c_comm: 5, c_collab: 4 }),
    // Maya portfolio (strong)
    s('ev_maya_port', { c_craft: 5, c_systems: 4, c_judgment: 4, c_comm: 4, c_collab: 4 }),
    // Maya HM (strong)
    s('ev_maya_hm', { c_craft: 4, c_systems: 5, c_judgment: 4, c_comm: 4, c_collab: 5 }),
    // PANEL SPLIT — this is the deliberate disagreement:
    s('ev_maya_p1', { c_craft: 5, c_systems: 5, c_judgment: 5, c_comm: 4, c_collab: 5 }), // Omar: enthusiastic
    s('ev_maya_p2', { c_craft: 4, c_systems: 4, c_judgment: 4, c_comm: 4, c_collab: 4 }), // Devon: solid
    s('ev_maya_p3', { c_craft: 3, c_systems: 2, c_judgment: 2, c_comm: 3, c_collab: 2 }), // Iris: real concern

    // Tom — competent scores, but a RED FLAG overrides everything.
    s('ev_tom_hr', { c_craft: 4, c_systems: 3, c_judgment: 3, c_comm: 4, c_collab: 3 }),
    s('ev_tom_port', { c_craft: 4, c_systems: 4, c_judgment: 3, c_comm: 3, c_collab: 3 }),

    // Daniel — clean pass through application.
    s('ev_dan_hr', { c_craft: 4, c_systems: 4, c_judgment: 4, c_comm: 4, c_collab: 4 }),
    s('ev_dan_port', { c_craft: 4, c_systems: 4, c_judgment: 5, c_comm: 4, c_collab: 4 }),

    // Wei — consistently strong across the panel.
    s('ev_wei_hr', { e_tech: 4, e_design: 4, e_problem: 4, e_comm: 4, e_collab: 4 }),
    s('ev_wei_res', { e_tech: 5, e_design: 4, e_problem: 4, e_comm: 4, e_collab: 4 }),
    s('ev_wei_phone', { e_tech: 5, e_design: 5, e_problem: 4, e_comm: 4, e_collab: 4 }),
    s('ev_wei_p1', { e_tech: 5, e_design: 4, e_problem: 5, e_comm: 4, e_collab: 5 }),
    s('ev_wei_p2', { e_tech: 4, e_design: 5, e_problem: 4, e_comm: 4, e_collab: 4 }),
    s('ev_wei_p3', { e_tech: 5, e_design: 4, e_problem: 5, e_comm: 5, e_collab: 4 }),

    // Sofia — solid resume screen, cleared into the phone screen.
    s('ev_sofia_hr', { e_tech: 4, e_design: 4, e_problem: 4, e_comm: 4, e_collab: 4 }),
    s('ev_sofia_res', { e_tech: 5, e_design: 4, e_problem: 4, e_comm: 4, e_collab: 4 }),
  ].flat(),

  // --- Notes: evidence attached to a criterion within an evaluation --------
  // Note the evidence on Iris's low subjective scores — required by the rules.
  notes: [
    { id: 'n1', evaluationId: 'ev_maya_p3', criterionId: 'c_systems', text: 'Portfolio pieces were strong individually but she struggled to articulate how the design system scaled across surfaces when pushed.' },
    { id: 'n2', evaluationId: 'ev_maya_p3', criterionId: 'c_collab', text: 'Became noticeably defensive when I challenged the navigation model — talked over the follow-up rather than engaging it.' },
    { id: 'n3', evaluationId: 'ev_maya_p1', criterionId: 'c_judgment', text: 'Best prioritization rationale I have seen at this level — cut her own favorite feature for a measurable reason.' },
    { id: 'n4', evaluationId: 'ev_wei_p2', criterionId: 'e_design', text: 'Walked through partition tolerance and back-pressure without prompting. Clearly operates real systems.' },
  ],

  // --- Triggered red flags -------------------------------------------------
  flags: [
    { id: 'f1', evaluationId: 'ev_tom_port', redFlagId: 'rf_borrowed', criterionId: 'c_craft', note: 'Two case studies match a published agency project almost exactly, presented here as solo work. Asked about it, the account shifted.' },
  ],

  // --- Operational state machine (one row per candidate) -------------------
  candidateState: [
    { candidateId: 'cand_maya', currentStageId: 's_d_panel', currentReviewId: null, status: 'needs_decision', updatedAt: '2026-05-12T12:30:00Z' },
    { candidateId: 'cand_daniel', currentStageId: 's_d_hm', currentReviewId: 'r_d_hm', status: 'awaiting_review', updatedAt: '2026-05-11T12:30:00Z' },
    { candidateId: 'cand_priya', currentStageId: 's_d_app', currentReviewId: 'r_d_hr', status: 'awaiting_review', updatedAt: '2026-05-28T09:00:00Z' },
    { candidateId: 'cand_tom', currentStageId: 's_d_app', currentReviewId: null, status: 'declined', updatedAt: '2026-05-16T14:30:00Z' },
    { candidateId: 'cand_wei', currentStageId: 's_e_panel', currentReviewId: null, status: 'awaiting_decision', updatedAt: '2026-05-13T12:30:00Z' },
    { candidateId: 'cand_sofia', currentStageId: 's_e_phone', currentReviewId: 'r_e_phone', status: 'awaiting_review', updatedAt: '2026-05-23T12:30:00Z' },
    { candidateId: 'cand_jamal', currentStageId: 's_e_screen', currentReviewId: 'r_e_hr', status: 'awaiting_review', updatedAt: '2026-06-01T09:00:00Z' },
  ],

  // --- Recorded human gate decisions (the system never auto-decides) -------
  decisions: [
    { id: 'd_tom', candidateId: 'cand_tom', stageId: 's_d_app', action: 'decline', decidedBy: 'u_avery', decidedAt: '2026-05-16T15:00:00Z', rationale: 'Confirmed the borrowed-work red flag with the source agency. Integrity issue, not a craft issue.' },
  ],

  // --- Audited overrides (kept beside what they overrode; never destructive)
  overrides: [],

  // --- Declared conflicts of interest (human-declared, system-enforced) -----
  // Devon is already assigned to Daniel's hiring-manager review, so this seeds
  // the "already-assigned → flagged for reassignment" path visibly on load.
  conflicts: [
    {
      id: 'cf_daniel_devon',
      candidateId: 'cand_daniel',
      reviewerId: 'u_dev',
      declaredBy: 'u_avery',
      source: 'admin',
      reason: 'Former teammate — Avery declared the conflict.',
      declaredAt: '2026-05-11T16:00:00Z',
    },
  ],

  // --- Reviewer assignments (who is on the hook for an open review) ---------
  // assignedAt is set RELATIVE TO FIRST LOAD so the aging states (Due soon /
  // Overdue) are visible on a fresh sandbox without manufacturing them.
  // Each ties to a candidate who is genuinely awaiting that review.
  assignments: [
    // Daniel's hiring-manager review — overdue, and on Devon's (reviewer) desk.
    { id: 'as_daniel_hm', candidateId: 'cand_daniel', reviewId: 'r_d_hm', reviewerId: 'u_dev', status: 'assigned', assignedAt: hoursAgo(72), completedAt: null, notifications: [] },
    // Jamal's recruiter screen — overdue.
    { id: 'as_jamal_hr', candidateId: 'cand_jamal', reviewId: 'r_e_hr', reviewerId: 'u_renee', status: 'assigned', assignedAt: hoursAgo(54), completedAt: null, notifications: [] },
    // Sofia's technical phone screen — due soon.
    { id: 'as_sofia_phone', candidateId: 'cand_sofia', reviewId: 'r_e_phone', reviewerId: 'u_kofi', status: 'assigned', assignedAt: hoursAgo(30), completedAt: null, notifications: [] },
    // Priya's recruiter screen — on track.
    { id: 'as_priya_hr', candidateId: 'cand_priya', reviewId: 'r_d_hr', reviewerId: 'u_renee', status: 'assigned', assignedAt: hoursAgo(6), completedAt: null, notifications: [] },
  ],

  // --- Round-robin pointers for pool auto-distribution (per review) --------
  rotation: {},

  // --- Config --------------------------------------------------------------
  config: {
    gracePeriodMinutes: 30,
    // signal bands for a single review's weighted score
    bands: { strong: 4.0, mixed: 3.0 }, // >=4 strong, >=3 mixed, else concern
    // stage routes to "needs decision" when reviewer spread is this large
    disagreementThreshold: 1.0, // max-min of reviewers' weighted scores
    // review-aging thresholds (hours) — guidance pointed at the work, not people
    slaHours: 48, // at/after this an open review is Overdue
    reminderHours: 24, // at/after this it is Due soon
  },
};

// Helper: an ISO timestamp h hours before first load (for demo aging states).
function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

// Helper: expand a {criterionId: value} map into score rows for one evaluation.
function s(evaluationId, map) {
  return Object.entries(map).map(([criterionId, value], i) => ({
    id: `${evaluationId}_${criterionId}`,
    evaluationId,
    criterionId,
    value,
  }));
}
