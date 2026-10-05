import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import {
  MAX_SESSION_TIMEOUT_MINUTES,
  expiresInSeconds,
  signAccessToken,
  type AccessTokenPayload,
} from "../utils/token";
import { config } from "../config";

const payload: AccessTokenPayload = {
  sub: "1",
  email: "a@b.com",
  name: "A",
  jti: "session-uuid",
  tv: 0,
};

describe("access token lifetime", () => {
  it("follows the configured session timeout", () => {
    expect(expiresInSeconds(15)).toBe(15 * 60);
    expect(expiresInSeconds(30)).toBe(30 * 60);
  });

  it("never exceeds the hard ceiling", () => {
    expect(expiresInSeconds(MAX_SESSION_TIMEOUT_MINUTES)).toBe(MAX_SESSION_TIMEOUT_MINUTES * 60);
    // A 24h timeout must not produce a 24h token.
    expect(expiresInSeconds(24 * 60)).toBe(MAX_SESSION_TIMEOUT_MINUTES * 60);
    expect(expiresInSeconds(9999)).toBe(MAX_SESSION_TIMEOUT_MINUTES * 60);
  });

  it("falls back to the default for missing or nonsensical values", () => {
    expect(expiresInSeconds()).toBe(12 * 60 * 60);
    expect(expiresInSeconds(null)).toBe(12 * 60 * 60);
    expect(expiresInSeconds(0)).toBe(12 * 60 * 60);
    expect(expiresInSeconds(-5)).toBe(12 * 60 * 60);
  });

  it("embeds an expiry that matches the requested timeout", () => {
    const token = signAccessToken(payload, 20);
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    expect(decoded.exp - decoded.iat).toBe(20 * 60);
  });

  it("signs with the configured secret and the session id", () => {
    const token = signAccessToken(payload, 20);
    const verified = jwt.verify(token, config.jwtSecret) as AccessTokenPayload & { jti: string };
    expect(verified.jti).toBe("session-uuid");
    expect(verified.sub).toBe("1");
    expect(verified.tv).toBe(0);
  });
});