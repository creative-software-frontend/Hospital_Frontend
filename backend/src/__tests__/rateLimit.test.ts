import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRateLimiter, clearRateLimitStore } from "../utils/rateLimit";
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
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
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
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const next = vi.fn();

    limiter({ ip: "10.0.0.1" } as unknown as Request, {} as Response, next);
    limiter({ ip: "10.0.0.2" } as unknown as Request, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("resets after the window elapses", () => {
    const limiter = createRateLimiter({ windowMs: 1, max: 1 });
    const req = { ip: "10.0.0.1" } as unknown as Request;
    const next = vi.fn();

    limiter(req, {} as Response, next);
    const blocked = makeRes();
    limiter(req, blocked as unknown as Response, next);
    expect(blocked._status).toBe(429);

    return new Promise((resolve) => {
      setTimeout(() => {
        const next2 = vi.fn();
        limiter(req, {} as Response, next2);
        expect(next2).toHaveBeenCalledTimes(1);
        resolve(undefined);
      }, 5);
    });
  });
});