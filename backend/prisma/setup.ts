/**
 * One-command database bootstrap for a fresh clone.
 *
 *   npm run setup
 *
 * Runs the steps in the only order that works, and is safe to re-run:
 *   1. [1/5] Checking environment...
 *   2. [2/5] Preparing Prisma...
 *   3. [3/5] Applying database migrations...
 *   4. [4/5] Seeding required data...
 *   5. [5/5] Verifying database...
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = ["DATABASE_URL", "JWT_SECRET", "BACKUP_STORAGE_PATH", "MYSQLDUMP_PATH"];

const localBin = {
  prisma: resolve(root, "node_modules", "prisma", "build", "index.js"),
  tsx: resolve(root, "node_modules", "tsx", "dist", "cli.mjs"),
} as const;

type Tool = keyof typeof localBin;

function run(tool: Tool, args: string[]): number | null {
  const result = spawnSync(process.execPath, [localBin[tool], ...args], {
    cwd: root,
    stdio: "inherit",
  });
  return result.status;
}

function prismaClientExists(): boolean {
  return existsSync(resolve(root, "node_modules", ".prisma", "client", "index.js"));
}

function fail(message: string): never {
  console.error(`\nSetup stopped: ${message}\n`);
  process.exit(1);
}

function step(n: number, total: number, title: string) {
  console.log(`[${n}/${total}] ${title}`);
}

const envPath = resolve(root, ".env");
if (!existsSync(envPath)) {
  fail("backend/.env not found. Copy backend/.env.example to backend/.env and set DATABASE_URL.");
}

const contents = readFileSync(envPath, "utf8");
const entries = new Map<string, string>();
for (const rawLine of contents.split("\n")) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  entries.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim().replace(/^["']|["']$/g, ""));
}

// Populate process.env so subcommands and Prisma see backend/.env entries
for (const [k, v] of entries.entries()) {
  if (!process.env[k]) {
    process.env[k] = v;
  }
}

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
  fail(
    "Refusing to run setup in production environment (NODE_ENV=production).\n" +
      "  If you intend to initialize a production database, set SEED_ALLOW_PRODUCTION=true explicitly.",
  );
}

const missing = required.filter((key) => !entries.has(key));
const placeholders = required.filter((key) => {
  const value = entries.get(key) ?? "";
  return /USER:PASSWORD|CHANGE_THIS|<.*>|your-/i.test(value);
});

if (missing.length > 0) {
  fail(`${missing.join(", ")} not set in backend/.env.`);
}
if (placeholders.length > 0) {
  fail(
    `${placeholders.join(", ")} still holds its example value in backend/.env. ` +
      "Replace it before running setup.",
  );
}

const total = 5;
step(1, total, "Checking environment...");
console.log("  .env configuration is valid.");

step(2, total, "Preparing Prisma...");
if (run("prisma", ["generate"]) !== 0) {
  if (prismaClientExists()) {
    console.log(
      "  prisma generate failed, but a generated client is already present - continuing.\n" +
        "  (This normally means a dev server is running and holding the engine file.)",
    );
  } else {
    fail(
      "prisma generate failed and no generated client exists.\n" +
        "  If you see EPERM on Windows, stop the running backend dev server and retry.",
    );
  }
}

if (run("tsx", ["prisma/create-database.ts"]) !== 0) {
  fail("Could not create the database. Check DATABASE_URL and that the MySQL server is running.");
}

step(3, total, "Applying database migrations...");
if (run("prisma", ["migrate", "deploy"]) !== 0) {
  fail("Migrations failed. See the Prisma output above for the specific migration that failed.");
}

step(4, total, "Seeding required data...");
if (run("tsx", ["prisma/seed.ts"]) !== 0) {
  fail("Seeding failed. See the error above; the seed is safe to re-run once fixed.");
}

step(5, total, "Verifying database...");
if (run("tsx", ["prisma/verify-database.ts"]) !== 0) {
  fail("Database verification failed.");
}
