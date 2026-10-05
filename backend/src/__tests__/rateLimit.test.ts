import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRateLimiter,
  clearRateLimitStore,
  twoFactorRateLimiter,
  loginRateLimiter,
  changePasswordRateLimiter,
} from "../utils/rateLimit";
import type { Request, Response } from "express";

function makeRes() {
  const res: {
    _status: number;
    _json: unknown;
    _headers: Record<string, string>;
    status: (code: number) => typeof res;
    json: (body: unknown) => typeof res;
    setHeader: (key: string, value: string) => typeof res;
  } = {
    _status: 200,
    _json: null,
    _headers: {},
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._json = body;
      return this;
    },
    setHeader(key, value) {
      this._headers[key] = value;
      return this;
    },
  };
  return res;
}

describe("createRateLimiter", () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it("allows requests up to the max and rejects after", () => {
    const limiter = createRateLimiter({ scope: "t1", windowMs: 60_000, max: 2 });
    const req = { ip: "10.0.0.1" } as unknown as Request;
    const next = vi.fn();

    limiter(req, {} as Response, next);
    limiter(req, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(2);

    const res = makeRes();
    limiter(req, res as unknown as Response, next);
    expect(res._status).toBe(429);
    expect(res._json).toEqual({ success: false, message: "Too many requests, please try again later." });
    expect(res._headers["Retry-After"]).toBeTruthy();
  });

  it("allows different keys independently", () => {
    const limiter = createRateLimiter({ scope: "t2", windowMs: 60_000, max: 1 });
    const next = vi.fn();

    limiter({ ip: "10.0.0.1" } as unknown as Request, {} as Response, next);
    limiter({ ip: "10.0.0.2" } as unknown as Request, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

it("resets after the window elapses", () => {
    // Fake timers keep this deterministic; a real 1ms window plus a real sleep
    // made the test flaky under parallel load.
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter({ scope: "t3", windowMs: 1_000, max: 1 });
      const req = { ip: "10.0.0.1" } as unknown as Request;
      const next = vi.fn();

      limiter(req, {} as Response, next);
      const blocked = makeRes();
      limiter(req, blocked as unknown as Response, next);
      expect(blocked._status).toBe(429);

      vi.advanceTimersByTime(1_001);

      const next2 = vi.fn();
      limiter(req, {} as Response, next2);
      expect(next2).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not count requests the skip predicate rejects", () => {
    const limiter = createRateLimiter({
      scope: "t4",
      windowMs: 60_000,
      max: 1,
      skip: (req) => !(req.body as { code?: string }).code,
    });
    const next = vi.fn();

    // No code present -> never counted, so the budget is never consumed.
    for (let i = 0; i < 5; i++) {
      limiter({ ip: "10.0.0.1", body: {} } as unknown as Request, {} as Response, next);
    }
    expect(next).toHaveBeenCalledTimes(5);

    // First coded request consumes the single slot...
    const coded = { ip: "10.0.0.1", body: { code: "123456" } } as unknown as Request;
    limiter(coded, {} as Response, next);

    // ...and the next one is refused.
    const res = makeRes();
    limiter({ ip: "10.0.0.1", body: { code: "654321" } } as unknown as Request, res as unknown as Response, next);
    expect(res._status).toBe(429);
  });
});

describe("twoFactorRateLimiter", () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it("ignores password-only attempts so users never hit a misleading message", () => {
    const next = vi.fn();
    for (let i = 0; i < 15; i++) {
      twoFactorRateLimiter(
        { ip: "10.0.0.1", body: { identifier: "a@b.com", password: "x" } } as unknown as Request,
        {} as Response,
        next,
      );
    }
    expect(next).toHaveBeenCalledTimes(15);
  });

  it("blocks after ten presented codes for the same identifier", () => {
    const next = vi.fn();
    const res = makeRes();
    for (let i = 0; i < 11; i++) {
      twoFactorRateLimiter(
        { ip: "10.0.0.1", body: { identifier: "a@b.com", twoFactorCode: "000000" } } as unknown as Request,
        i === 10 ? (res as unknown as Response) : ({} as Response),
        next,
      );
    }
    expect(next).toHaveBeenCalledTimes(10);
    expect(res._status).toBe(429);
  });

it("keys on the identifier so one account's guesses cannot lock out another", () => {
    const next = vi.fn();
    const res = makeRes();
    for (let i = 0; i < 10; i++) {
      twoFactorRateLimiter(
        { ip: "10.0.0.1", body: { identifier: "a@b.com", twoFactorCode: "000000" } } as unknown as Request,
        {} as Response,
        next,
      );
    }
    twoFactorRateLimiter(
      { ip: "10.0.0.1", body: { identifier: "c@d.com", twoFactorCode: "000000" } } as unknown as Request,
      res as unknown as Response,
      next,
    );
    expect(res._status).toBe(200);
  });
});

describe("limiter isolation", () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it("does not let login attempts consume the password-change budget", () => {
    // Regression: both limiters used the bare client IP as their store key, so a
    // burst of logins blocked a user from changing their password with a
    // misleading "too many password change attempts" error.
    const next = vi.fn();
    for (let i = 0; i < 60; i++) {
      loginRateLimiter(
        { ip: "10.0.0.9", body: { identifier: "a@b.com", password: "x" } } as unknown as Request,
        {} as Response,
        next,
      );
    }
    expect(next).toHaveBeenCalledTimes(60);

    const res = makeRes();
    changePasswordRateLimiter({ ip: "10.0.0.9", body: {} } as unknown as Request, res as unknown as Response, next);
    expect(res._status).toBe(200);
    expect(next).toHaveBeenCalledTimes(61);
  });

  it("keeps two limiters with identical key generators in separate buckets", () => {
    const a = createRateLimiter({ scope: "a", windowMs: 60_000, max: 1 });
    const b = createRateLimiter({ scope: "b", windowMs: 60_000, max: 1 });
    const next = vi.fn();
    const req = { ip: "10.0.0.10" } as unknown as Request;

    // Exhaust `a` completely.
    a(req, {} as Response, next);
    const blockedA = makeRes();
    a(req, blockedA as unknown as Response, next);
    expect(blockedA._status).toBe(429);

    // `b` has never been used, so it must still have its full budget.
    const firstB = makeRes();
    b(req, firstB as unknown as Response, next);
    expect(firstB._status).toBe(200);

    const blockedB = makeRes();
    b(req, blockedB as unknown as Response, next);
    expect(blockedB._status).toBe(429);
  });
});
