export const SERVER_CONFIG = {
  port: Number(process.env.PORT) || 3000,
  aiModel: 'gemini-4-hydrogen',
  guestDailyQuota: 15,
  signedInDailyQuota: 30,
  dayMs: 24 * 60 * 60 * 1000,
  maxQuotaBuckets: 5000
} as const;
