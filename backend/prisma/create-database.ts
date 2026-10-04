/**
 * Creates the database named in DATABASE_URL if it does not exist yet.
 *
 * `prisma migrate deploy` cannot do this itself: it connects straight to the
 * database it is going to migrate, so on a fresh MySQL server it fails with
 * "Unknown database". This connects to the same server *without* a database
 * selected and issues CREATE DATABASE IF NOT EXISTS, which is what makes a
 * one-command setup work against an empty server.
 *
 *   npm run db:create
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!database) {
    throw new Error(`DATABASE_URL has no database name: ${url}`);
  }
  // Point at the server itself so the connection succeeds before the database
  // exists. Some MySQL users cannot see any schema without one, so fall back to
  // the built-in "mysql" database if the server rejects it.
  const serverUrl = new URL(url);
  serverUrl.pathname = "/mysql";

  return {
    database,
    charset: parsed.searchParams.get("charset") ?? undefined,
    serverUrl: serverUrl.toString(),
  };
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set. Copy backend/.env.example to backend/.env first.");
  }

  const { database, serverUrl } = parseDatabaseUrl(raw);
  if (!/^[A-Za-z0-9_$-]+$/.test(database)) {
    throw new Error(`Refusing to use unsafe database name: ${database}`);
  }

  let client = new PrismaClient({ datasourceUrl: serverUrl });

  try {
    await client.$executeRawUnsafe(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log(`Database "${database}" is ready.`);
  } catch {
    await client.$disconnect().catch(() => {});
    const fallbackUrl = new URL(raw);
    fallbackUrl.pathname = "/information_schema";
    client = new PrismaClient({ datasourceUrl: fallbackUrl.toString() });
    await client.$executeRawUnsafe(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log(`Database "${database}" is ready.`);
  } finally {
    await client.$disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.error("Database creation failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
