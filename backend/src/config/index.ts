import "dotenv/config";

const DEFAULT_JWT_SECRET = "change-this-in-production";
const PLACEHOLDER_JWT_SECRET = "CHANGE_THIS_IN_PRODUCTION";
const isProduction = process.env.NODE_ENV === "production";
const rawJwtSecret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

if (
  isProduction &&
  (!process.env.JWT_SECRET ||
    rawJwtSecret === DEFAULT_JWT_SECRET ||
    rawJwtSecret === PLACEHOLDER_JWT_SECRET)
) {
  throw new Error(
    "JWT_SECRET must be set to a strong, unique secret when NODE_ENV=production",
  );
}

if (!isProduction && rawJwtSecret === DEFAULT_JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn("[config] JWT_SECRET not set; using insecure fallback. Set JWT_SECRET for production.");
}

export const config = {
  port: Number(process.env.PORT || 5000),
  env: process.env.NODE_ENV || "development",
  jwtSecret: rawJwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  jwtCookieName: process.env.JWT_COOKIE_NAME || "hms_token",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  cookieSameSite:
    (process.env.COOKIE_SAME_SITE as "lax" | "strict" | "none" | undefined) || "lax",
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  isProduction,
} as const;

export const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : ["http://localhost:3000"];
