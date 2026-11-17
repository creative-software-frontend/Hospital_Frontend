/**
 * One-command full sync for the senior developer.
 *
 *   npm run sync
 *
 * Does everything needed after the lead developer pushes changes:
 *   1. git pull (latest code + latest DB dump)
 *   2. Import the newest database dump (if present)
 *   3. Apply any pending Prisma migrations
 *   4. Regenerate the Prisma client
 *   5. Build the backend
 *   6. Print the final start commands
 *
 * Safe to re-run.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const projectRoot = resolve(root, "..");
const envPath = resolve(root, ".env");

if (!existsSync(envPath)) {
  console.error("\nSetup stopped: backend/.env not found. Copy backend/.env.example to backend/.env first.\n");
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

const localBin = {
  prisma: resolve(root, "node_modules", "prisma", "build", "index.js"),
  tsx: resolve(root, "node_modules", "tsx", "dist", "cli.mjs"),
} as const;

type Tool = keyof typeof localBin;

function runTool(tool: Tool, args: string[], cwd: string): number {
  const result = spawnSync(process.execPath, [localBin[tool], ...args], { cwd, stdio: "inherit" });
  return result.status ?? 1;
}

function runShell(cmd: string, args: string[], cwd: string): number {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true });
  return result.status ?? 1;
}

function latestDump(): string | null {
  const dir = resolve(root, "backups");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => /^hospital_management_FRESH_.*\.sql$/.test(f))
    .sort();
  if (files.length === 0) return null;
  return files[files.length - 1];
}

// 1. git pull
console.log("[1/6] Pulling latest code from GitHub...");
if (runShell("git", ["pull", "origin", "main"], projectRoot) !== 0) {
  console.error("  git pull failed.");
  process.exit(1);
}
console.log("  Pull complete.");

// 2. Import latest dump
const dump = latestDump();
if (dump) {
  console.log(`[2/6] Importing latest database dump (${dump})...`);
  if (runTool("tsx", ["prisma/import-database.ts", `backups/${dump}`], root) !== 0) {
    console.error("  Import failed.");
    process.exit(1);
  }
  console.log("  Dump imported.");
} else {
  console.log("[2/6] No database dump found in backups/ — skipping import.");
}

// 3. Migrations
console.log("[3/6] Applying pending Prisma migrations...");
if (runTool("prisma", ["migrate", "deploy"], root) !== 0) {
  console.error("  Migrations failed.");
  process.exit(1);
}
console.log("  Migrations applied.");

// 4. Generate
console.log("[4/6] Regenerating Prisma client...");
if (runTool("prisma", ["generate"], root) !== 0) {
  console.error("  Generate failed. If you see EPERM, stop the backend dev server (npm run dev) and re-run sync.");
  process.exit(1);
}
console.log("  Prisma client regenerated.");

// 5. Build
console.log("[5/6] Building backend...");
if (runShell("npm", ["run", "build"], root) !== 0) {
  console.error("  Build failed.");
  process.exit(1);
}
console.log("  Backend built.");

// 6. Done
console.log("[6/6] Done.\n");
console.log("Start the servers:");
console.log("  backend:  cd backend && npm start");
console.log("  frontend: npm run build && npm start  (from project root)\n");
