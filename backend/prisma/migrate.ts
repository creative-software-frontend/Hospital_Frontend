/**
 * `npm run migration` (and `npm run db:migrate`) entry point.
 *
 * Applies pending Prisma migrations and regenerates the Prisma client.
 *   - Stops immediately if `prisma migrate deploy` fails.
 *   - Regenerates the client unless it is locked by a running dev server
 *     (EPERM on Windows), in which case it prints a warning and continues,
 *     because the already-generated client is usually still current.
 *
 * Does NOT run `migrate dev`, `db push`, `migrate reset`, seed, or any import.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");

if (!existsSync(envPath)) {
  console.error("\nSetup stopped: backend/.env not found.\n");
  process.exit(1);
}

const entries = new Map<string, string>();
for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  entries.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim().replace(/^["']|["']$/g, ""));
}
for (const [k, v] of entries.entries()) {
  if (!process.env[k]) process.env[k] = v;
}

const prismaBin = resolve(root, "node_modules", "prisma", "build", "index.js");

console.log("[1/2] Applying pending Prisma migrations...");
const migrate = spawnSync(process.execPath, [prismaBin, "migrate", "deploy"], {
  cwd: root,
  stdio: "inherit",
});
if ((migrate.status ?? 1) !== 0) {
  console.error("\nMigration failed. Fix the error above before continuing.\n");
  process.exit(1);
}
console.log("  Migrations applied (or none pending).");

console.log("[2/2] Regenerating Prisma client...");
const gen = spawnSync(process.execPath, [prismaBin, "generate"], { cwd: root, stdio: "inherit" });
if ((gen.status ?? 1) !== 0) {
  console.warn(
    "\n  `prisma generate` could not update the client (often EPERM because the\n" +
      "  backend dev server is running and locks the query-engine DLL).\n" +
      "  Stop `npm run dev` in backend/, re-run `npm run migration`, then restart.\n" +
      "  The existing client is usually still usable in the meantime.\n",
  );
  // Do not fail the whole command on a locked DLL; migrate deploy already succeeded.
} else {
  console.log("  Prisma client regenerated.");
}

console.log("\nDone. Start the servers:");
console.log("  backend:  cd backend && npm run dev");
console.log("  frontend: npm run dev  (from project root)\n");
