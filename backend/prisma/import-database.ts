/**
 * One-command database import for a handover / new PC.
 *
 *   npm run db:import -- path/to/dump.sql
 *
 * Runs the steps in the only order that works:
 *   1. Check environment (.env)
 *   2. Resolve the mysql client binary
 *   3. Create the database if it does not exist
 *   4. Import the SQL dump
 *   5. Print the next steps (prisma generate, build, start)
 *
 * Safe to re-run: it drops and recreates the database first so a partial
 * import never leaves the schema half-applied. NEVER run this against a
 * database that holds data you care about without a backup.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { URL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");

if (!existsSync(envPath)) {
  console.error("\nSetup stopped: backend/.env not found. Copy backend/.env.example to backend/.env and set DATABASE_URL.\n");
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

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error("\nUsage: npm run db:import -- path/to/dump.sql\n");
  process.exit(1);
}
const resolvedDump = resolve(process.cwd(), dumpPath);
if (!existsSync(resolvedDump)) {
  console.error(`\nDump file not found: ${resolvedDump}\n`);
  process.exit(1);
}

const raw = process.env.DATABASE_URL || "mysql://root@localhost:3306/hospital_management";
const parsed = new URL(raw);
const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
const host = parsed.hostname || "localhost";
const port = Number(parsed.port || 3306);
const user = decodeURIComponent(parsed.username || "root");
const password = decodeURIComponent(parsed.password || "");

if (!database) {
  console.error("\nDATABASE_URL is missing a database name.\n");
  process.exit(1);
}

// Resolve mysql client binary (mirror resolveMysqldump).
function resolveMysql(): string {
  const override = process.env.MYSQL_PATH?.trim();
  const isPath = override && (override.includes("\\") || override.includes("/"));
  if (override && isPath && existsSync(override)) return override;
  const candidates = [
    "C:\\xampp\\mysql\\bin\\mysql.exe",
    "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe",
    "C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysql.exe",
    "C:\\MySQL\\bin\\mysql.exe",
    "/usr/bin/mysql",
    "/usr/local/bin/mysql",
    "/opt/homebrew/bin/mysql",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "mysql";
}

const mysqlBin = resolveMysql();

function runMysql(args: string[], input?: Buffer): Promise<{ code: number; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const env = { ...process.env };
    if (password) env.MYSQL_PWD = password;
    const child = spawn(mysqlBin, args, { windowsHide: true, env });
    let stderrBuf = "";
    child.stderr.on("data", (d: Buffer) => { stderrBuf += d.toString(); });
    child.on("error", reject);
    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
    child.on("close", (code) => resolvePromise({ code: code ?? 0, stderr: stderrBuf }));
  });
}

async function main() {
  console.log("[1/4] Checking environment...");
  console.log("  .env configuration is valid.");
  console.log(`  Database: ${database} @ ${host}:${port}`);

  console.log("[2/4] Preparing database (drop + recreate for a clean import)...");
  const dropRes = await runMysql(["-h", host, "-P", String(port), "-u", user, "-e", `DROP DATABASE IF EXISTS \`${database}\`; CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`]);
  if (dropRes.code !== 0) {
    console.error(`  Failed: ${dropRes.stderr}`);
    process.exit(1);
  }
  console.log("  Database ready.");

  console.log("[3/4] Importing dump (this may take a moment)...");
  const { createReadStream } = await import("node:fs");
  const importRes = await new Promise<{ code: number; stderr: string }>((resolvePromise) => {
    const env = { ...process.env };
    if (password) env.MYSQL_PWD = password;
    const child = spawn(mysqlBin, ["-h", host, "-P", String(port), "-u", user, database, "--max_allowed_packet=512M"], { windowsHide: true, env });
    let stderrBuf = "";
    child.stderr.on("data", (d: Buffer) => { stderrBuf += d.toString(); });
    const stream = createReadStream(resolvedDump);
    stream.pipe(child.stdin);
    stream.on("error", (e) => { stderrBuf += `stream error: ${e.message}`; });
    child.stdin.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code !== "EPIPE") stderrBuf += `stdin error: ${e.message}`;
    });
    child.on("close", (code) => resolvePromise({ code: code ?? 0, stderr: stderrBuf }));
  });
  if (importRes.code !== 0) {
    console.error(`  Import failed: ${importRes.stderr}`);
    process.exit(1);
  }
  console.log("  Dump imported successfully.");

  console.log("[4/4] Done.");
  console.log("\nNext steps:");
  console.log("  cd backend");
  console.log("  npx prisma generate");
  console.log("  npm run build");
  console.log("  npm start");
  console.log("\n(Or run `npm run db:import` again with a different dump.)\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
