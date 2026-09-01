import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 5000),
  env: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "change-this-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  isProduction: process.env.NODE_ENV === "production",
} as const;

export const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : ["http://localhost:3000"];
