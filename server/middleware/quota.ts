import type { Request } from 'express';
import { SERVER_CONFIG } from '../config.ts';

export interface QuotaBucket {
  count: number;
  resetAt: number;
}

export interface QuotaCheckStatus {
  key: string;
  limit: number;
  remaining: number;
  resetAt: string;
  isConfigured: boolean;
}

const quotaStore = new Map<string, QuotaBucket>();

function pruneExpiredBuckets(now: number): void {
  if (quotaStore.size < SERVER_CONFIG.maxQuotaBuckets) return;
  for (const [k, bucket] of quotaStore.entries()) {
    if (now >= bucket.resetAt) {
      quotaStore.delete(k);
    }
  }
}

export function getRequesterKey(req: Request): { key: string; limit: number } {
  const uidHeader = req.header('x-user-id');
  if (uidHeader && /^[a-zA-Z0-9_-]{4,128}$/.test(uidHeader)) {
    return { key: `uid:${uidHeader}`, limit: SERVER_CONFIG.signedInDailyQuota };
  }
  const forwarded = req.header('x-forwarded-for');
  const ip = (forwarded ? forwarded.split(',')[0].trim() : req.ip) || 'local';
  return { key: `ip:${ip}`, limit: SERVER_CONFIG.guestDailyQuota };
}

export function getQuotaStatus(req: Request): QuotaCheckStatus {
  const { key, limit } = getRequesterKey(req);
  const now = Date.now();
  pruneExpiredBuckets(now);

  let bucket = quotaStore.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + SERVER_CONFIG.dayMs };
    quotaStore.set(key, bucket);
  }

  return {
    key,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: new Date(bucket.resetAt).toISOString(),
    isConfigured: Boolean(process.env.GEMINI_API_KEY)
  };
}

export function consumeQuota(req: Request): { allowed: boolean; status: QuotaCheckStatus } {
  const status = getQuotaStatus(req);
  if (status.remaining <= 0) {
    return { allowed: false, status };
  }
  const bucket = quotaStore.get(status.key)!;
  bucket.count += 1;
  return {
    allowed: true,
    status: {
      ...status,
      remaining: Math.max(0, status.limit - bucket.count)
    }
  };
}
