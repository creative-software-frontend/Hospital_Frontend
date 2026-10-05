import jwt, { type JwtPayload } from "jsonwebtoken";
import { config } from "../config";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  /**
   * JWT id (jti). Ties the token to a UserSession row so the server can revoke
   * a session immediately (logout, device limit, session timeout) instead of
   * waiting for the token to expire on its own.
   */
  jti: string;
  /** Bumped to invalidate every previously issued token at once. */
  tv: number;
}

/**
 * Hard ceiling on how long an access token may live, independent of the
 * Security -> Session Timeout setting. The setting can lower this; it can never
 * raise it above the ceiling.
 */
export const MAX_SESSION_TIMEOUT_MINUTES = 12 * 60;

/** Fallback lifetime used when no policy value has been resolved yet. */
const DEFAULT_SESSION_TIMEOUT_MINUTES = 12 * 60;

/**
 * Access token lifetime in seconds, derived from the configured session timeout
 * so the token and the UserSession row always expire together. Previously this
 * was hard-coded to 12 hours while the setting allowed 24, which meant a
 * configured timeout above 12 hours could never actually be honored.
 */
export function expiresInSeconds(sessionTimeoutMinutes?: number | null): number {
  const requested =
    typeof sessionTimeoutMinutes === "number" && sessionTimeoutMinutes > 0
      ? sessionTimeoutMinutes
      : DEFAULT_SESSION_TIMEOUT_MINUTES;
  const minutes = Math.min(requested, MAX_SESSION_TIMEOUT_MINUTES);
  return Math.round(minutes * 60);
}

/**
 * Creates a signed JWT for the given user. The token carries only the user id
 * (`sub`), a session id (`jti`), a token version (`tv`) plus minimal display
 * info; all authorization data (roles, status, branch, permissions) is loaded
 * fresh from the database on every request and is never trusted from claims.
 */
export function signAccessToken(
  payload: AccessTokenPayload,
  sessionTimeoutMinutes?: number | null,
): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: expiresInSeconds(sessionTimeoutMinutes),
  });
}