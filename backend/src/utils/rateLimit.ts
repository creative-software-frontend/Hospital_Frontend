import type { NextFunction, Request, Response } from "express";

interface WindowState {
  count: number;
  resetAt: number;
}

/**
 * Minimal fixed-window in-memory rate limiter. No external dependencies, keeps
 * the surface area small and works per-process. Sufficient for single-instance
 * deployments; swap for a shared store (Redis) when scaling horizontally.
 */
const store = new Map<string, WindowState>();

function cleanup(now: number): void {
  if (store.size === 0) return;
  for (const [key, state] of store) {
    if (state.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function clearRateLimitStore(): void {
  store.clear();
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
  statusCode?: number;
}) {
  const {
    windowMs,
    max,
    keyGenerator = (req) => req.ip ?? req.socket.remoteAddress ?? "unknown",
    message = "Too many requests, please try again later.",
    statusCode = 429,
  } = options;

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    cleanup(now);

    const key = keyGenerator(req);
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;
    if (current.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
      res.status(statusCode).json({ success: false, message });
      return;
    }

    next();
  };
}

// Per-IP limits for the most sensitive endpoints.
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many login attempts. Please wait a few minutes and try again.",
});

export const changePasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password change attempts. Please try again later.",
});