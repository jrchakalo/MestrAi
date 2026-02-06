import { createAdminClient } from '../supabase/server';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_WINDOW_SEC = 60;
const RATE_LIMIT_MAX = 20;
const rateLimitStore = new Map<string, number[]>();

function isRateLimitedInMemory(key: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = rateLimitStore.get(key)?.filter((t) => t >= windowStart) || [];

  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitStore.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
  return false;
}

export async function isRateLimited(key: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) {
    return isRateLimitedInMemory(key);
  }

  const { data, error } = await admin.rpc('check_rate_limit', {
    p_key: key,
    p_limit: RATE_LIMIT_MAX,
    p_window_seconds: RATE_LIMIT_WINDOW_SEC,
  });

  if (error) {
    return isRateLimitedInMemory(key);
  }

  return Boolean(data);
}