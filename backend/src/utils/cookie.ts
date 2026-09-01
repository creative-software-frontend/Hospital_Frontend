import type { Response } from "express";
import { config } from "../config";

const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day (match JWT_EXPIRES_IN default)

/**
 * Sets the HTTP-only JWT cookie with appropriate security attributes.
 * `secure` is enabled only in production; `sameSite`/`domain` come from env.
 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(config.jwtCookieName, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    domain: config.cookieDomain,
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

/**
 * Clears the HTTP-only JWT cookie. Idempotent — works even if absent.
 */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(config.jwtCookieName, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    domain: config.cookieDomain,
    path: "/",
  });
}
