/**
 * One-command database bootstrap for a fresh clone.
 *
 *   npm run setup
 *
 * Runs the steps in the only order that works, and is safe to re-run:
 *   1. sanity-check .env so failures are readable instead of a Prisma stack trace
 *   2. generate the Prisma client
 *   3. create the database if the server does not have it yet
 *   4. apply migrations (migrate deploy never prompts and never resets data)
 *   5. seed reference data
 *
 * The seed refuses to run when NODE_ENV=production unless explicitly overridden.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = ["DATABASE_URL", "JWT_SECRET"];

/**
 * Local CLIs are invoked through node directly rather than `npx` + shell. That
 * avoids Node's DEP0190 warning about unescaped shell arguments and works the
 * same on Windows, macOS and Linux.
 */
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

/** True when @prisma/client has already been generated into node_modules. */
function prismaClientExists(): boolean {
  return existsSync(resolve(root, "node_modules", ".prisma", "client", "index.js"));
}

function fail(message: string): never {
  console.error(`\nSetup stopped: ${message}\n`);
  process.exit(1);
}

function step(n: number, total: number, title: string) {
  console.log(`\n[${n}/${total}] ${title}`);
}

const envPath = resolve(root, ".env");
if (!existsSync(envPath)) {
  fail("backend/.env not found. Copy backend/.env.example to backend/.env and set DATABASE_URL.");
}

// Read the file rather than trusting process.env, because setup is usually run
// from the repo root where .env has not been loaded yet.
const contents = readFileSync(envPath, "utf8");
const entries = new Map<string, string>();
for (const rawLine of contents.split("\n")) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  entries.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim().replace(/^["']|["']$/g, ""));
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
step(1, total, "Checking configuration");
console.log("  .env looks usable.");

step(2, total, "Generating the Prisma client");
// On Windows a running dev server keeps the query engine DLL locked, so
// regeneration fails with EPERM even though a perfectly good client is already
// on disk. Only treat it as fatal when there is nothing to fall back on.
if (run("prisma", ["generate"]) !== 0) {
  if (prismaClientExists()) {
    console.log(
      "  prisma generate failed, but a generated client is already present - continuing.\n" +
        "  (This normally means a dev server is running and holding the engine file.\n" +
        "   Restart it afterwards so it picks up any schema change.)",
    );
  } else {
    fail(
      "prisma generate failed and no generated client exists.\n" +
        "  If you see EPERM on Windows, stop the running backend dev server and retry.",
    );
  }
}

step(3, total, "Creating the database if it does not exist");
if (run("tsx", ["prisma/create-database.ts"]) !== 0) {
  fail("Could not create the database. Check DATABASE_URL and that the MySQL server is running.");
}

step(4, total, "Applying migrations");
if (run("prisma", ["migrate", "deploy"]) !== 0) {
  fail("Migrations failed. See the Prisma output above for the specific migration that failed.");
}

step(5, total, "Seeding reference data");
if (run("tsx", ["prisma/seed.ts"]) !== 0) {
  fail("Seeding failed. See the error above; the seed is safe to re-run once fixed.");
}

console.log("\nSetup complete.\n");
console.log("  Start the backend:   npm run dev            (in backend/)");
console.log("  Start the frontend:  npm run dev            (in the repo root)");
console.log("  Then open            http://localhost:3000\n");
