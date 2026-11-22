export const STORAGE_KEYS = {
  preferences: 'recallflow_prefs_v1',
  theme: 'recallflow_theme',
  pinnedNotes: 'recallflow_pinned_v1',
  dailyIntention: 'recallflow_daily_intention_v1',
  tourDone: 'recallflow_tour_done'
} as const;

export const WORKSPACE_LIMITS = {
  maxSubjects: 30,
  maxTags: 50,
  maxDailyGoal: 50,
  maxStaleLimit: 50,
  defaultDailyGoal: 5,
  defaultStaleLimit: 5,
  toastDurationMs: 3200
} as const;
