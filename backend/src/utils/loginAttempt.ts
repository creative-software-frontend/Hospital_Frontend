/**
 * Tracks consecutive failed login attempts per identifier+IP. The decision to
 * lock an account is taken by the auth service using SecuritySetting.maxLoginAttempts.
 * In-memory windowing is sufficient for single-instance deployments; the DB
 * lock (status = LOCKED) is the durable, authoritative enforcement.
 */

interface AttemptState {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const attemptStore = new Map<string, AttemptState>();

function keyFor(identifier: string, ip?: string): string {
  return `${identifier.trim().toLowerCase()}|${ip ?? ""}`;
}

export function recordFailedLogin(identifier: string, ip?: string): number {
  const key = keyFor(identifier, ip);
  const now = Date.now();
  const current = attemptStore.get(key);
  const nextCount = current && current.resetAt > now ? current.count + 1 : 1;
  attemptStore.set(key, { count: nextCount, resetAt: now + WINDOW_MS });
  return nextCount;
}

export function getFailedLoginCount(identifier: string, ip?: string): number {
  const state = attemptStore.get(keyFor(identifier, ip));
  if (!state || state.resetAt <= Date.now()) {
    return 0;
  }
  return state.count;
}

export function clearFailedLogins(identifier: string, ip?: string): void {
  attemptStore.delete(keyFor(identifier, ip));
}

export function clearAllFailedLogins(): void {
  attemptStore.clear();
}