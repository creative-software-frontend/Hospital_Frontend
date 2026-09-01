import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
}

/**
 * Creates a signed JWT for the given user. The token carries only the user id
 * (`sub`) plus minimal display info; all authorization data (roles, status,
 * branch, permissions) is loaded fresh from the database on every request and
 * is never trusted from the token claims.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}
