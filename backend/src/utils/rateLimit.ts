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
  /**
   * Stable name for this limiter. It is prefixed onto the key so two limiters
   * that happen to share a key generator (or the default one) can never consume
   * each other's budget.
   */
  scope: string;
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
  statusCode?: number;
  /**
   * Requests this returns true for are not counted at all. Used when a limiter
   * should only guard a specific step (e.g. only attempts that actually present
   * a two-factor code) instead of every request to the route.
   */
  skip?: (req: Request) => boolean;
}) {
  const {
    scope,
    windowMs,
    max,
    keyGenerator = (req) => req.ip ?? req.socket.remoteAddress ?? "unknown",
    message = "Too many requests, please try again later.",
    statusCode = 429,
    skip,
  } = options;

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    if (skip?.(req)) {
      next();
      return;
    }

    const now = Date.now();
    cleanup(now);

    const key = `${scope}:${keyGenerator(req)}`;
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

export const changePasswordRateLimiter = createRateLimiter({
  scope: "change-password",
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password change attempts. Please try again later.",
});

/**
 * Coarse network-level throttle for the login endpoint. The account lockout in
 * Security -> Maximum Login Attempts handles targeted brute force against one
 * account; this limiter stops a single IP spraying many identifiers.
 *
 * The budget is generous on purpose: hospital staff commonly share one NAT
 * egress address, so a morning rush of legitimate sign-ins must not be mistaken
 * for an attack.
 */
export const loginRateLimiter = createRateLimiter({
  scope: "login",
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many login attempts from this network. Please try again in a few minutes.",
});

/**
 * Throttle the two-factor challenge only. Requests that do not present a code
 * are not counted, so a user fumbling their password never sees a misleading
 * "two-factor" message and a valid password cannot be used to guess codes.
 */
export const twoFactorRateLimiter = createRateLimiter({
  scope: "2fa",
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const identifier =
      typeof req.body?.identifier === "string" ? req.body.identifier.trim().toLowerCase() : "";
    return `${ip}:${identifier}`;
  },
  skip: (req) =>
    !(req.body?.twoFactorCode || req.body?.recoveryCode) &&
    !(typeof req.body?.code === "string" && req.body.code !== ""),
  message: "Too many two-factor attempts. Please wait before trying another code.",
});