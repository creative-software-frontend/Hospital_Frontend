import { PrismaClient } from "@prisma/client";

// One shared PrismaClient instance for the whole application.
// In development with tsx watch, `globalThis` caching prevents the creation
// of a new client (and new DB connection pool) on every hot reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
