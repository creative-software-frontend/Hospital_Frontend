import type { Response } from "express";
import { config } from "../config";

const DEFAULT_MAX_AGE_MS = 12 * 60 * 60 * 1000; // matches the JWT ceiling in token.ts

/**
 * Sets the HTTP-only JWT cookie with appropriate security attributes.
 * `secure` is enabled only in production; `sameSite`/`domain` come from env.
 *
 * `maxAgeMs` should be the effective session lifetime (Settings -> Security ->
 * Session Timeout) so the browser drops the cookie at the same moment the
 * server-side session expires.
 */
export function setAuthCookie(res: Response, token: string, maxAgeMs?: number): void {
  res.cookie(config.jwtCookieName, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    domain: config.cookieDomain,
    maxAge: maxAgeMs ?? DEFAULT_MAX_AGE_MS,
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
