/**
 * One-command database export for handover.
 *
 *   npm run db:export -- "your commit message"
 *
 * Runs the steps in order:
 *   1. Check environment (.env)
 *   2. Resolve mysqldump binary
 *   3. Dump the database with safe flags (skip-extended-insert so the dump
 *      imports without "packet bigger than max_allowed_packet" errors)
 *   4. Update .gitignore so the new dump is NOT ignored (and old ones stay ignored)
 *   5. git add -A && git commit -m "..." && git push origin main
 *
 * After this, your senior only needs:
 *   git pull
 *   cd backend && npm run db:import -- backups/<new_dump>.sql
 *   npx prisma generate && npm run build && npm start
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { URL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const projectRoot = resolve(root, "..");
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

const commitMessage = process.argv.slice(2).join(" ").trim() || `db export ${new Date().toISOString().slice(0, 10)}`;

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

function resolveMysqldump(): string {
  const override = process.env.MYSQLDUMP_PATH?.trim();
  const isPath = override && (override.includes("\\") || override.includes("/"));
  if (override && isPath && existsSync(override)) return override;
  const candidates = [
    "C:\\xampp\\mysql\\bin\\mysqldump.exe",
    "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe",
    "C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysqldump.exe",
    "C:\\MySQL\\bin\\mysqldump.exe",
    "/usr/bin/mysqldump",
    "/usr/local/bin/mysqldump",
    "/opt/homebrew/bin/mysqldump",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "mysqldump";
}

function run(cmd: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd, windowsHide: true, shell: false });
    let stdoutBuf = "";
    let stderrBuf = "";
    child.stdout.on("data", (d: Buffer) => { stdoutBuf += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderrBuf += d.toString(); });
    child.on("close", (code) => resolvePromise({ code: code ?? 0, stdout: stdoutBuf, stderr: stderrBuf }));
  });
}

async function main() {
  console.log("[1/5] Checking environment...");
  console.log("  .env configuration is valid.");

  const ts = new Date().toISOString().replace(/[:T]/g, "").slice(0, 13) + new Date().toISOString().slice(14, 16);
  const stamp = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}_${String(new Date().getHours()).padStart(2, "0")}${String(new Date().getMinutes()).padStart(2, "0")}${String(new Date().getSeconds()).padStart(2, "0")}`;
  const dumpName = `hospital_management_FRESH_${stamp}.sql`;
  const dumpPath = resolve(root, "backups", dumpName);

  console.log("[2/5] Dumping database (skip-extended-insert for safe import)...");
  const bin = resolveMysqldump();
  const env = { ...process.env };
  if (password) env.MYSQL_PWD = password;
  const args = [
    `--host=${host}`,
    `--port=${port}`,
    `--user=${user}`,
    "--single-transaction",
    "--routines",
    "--triggers",
    "--events",
    "--no-tablespaces",
    "--default-character-set=utf8mb4",
    "--skip-extended-insert",
    "--add-drop-table",
    `--result-file=${dumpPath}`,
    database,
  ];
  const dumpRes = await new Promise<{ code: number; stderr: string }>((resolvePromise) => {
    const child = spawn(bin, args, { windowsHide: true, env });
    let stderrBuf = "";
    child.stderr.on("data", (d: Buffer) => { stderrBuf += d.toString(); });
    child.on("close", (code) => resolvePromise({ code: code ?? 0, stderr: stderrBuf }));
  });
  if (dumpRes.code !== 0) {
    console.error(`  Dump failed: ${dumpRes.stderr}`);
    process.exit(1);
  }
  console.log(`  Dump created: backups/${dumpName}`);

  console.log("[3/5] Updating .gitignore to track the new dump...");
  const gitignorePath = resolve(projectRoot, ".gitignore");
  let gi = readFileSync(gitignorePath, "utf8");
  // Remove any previous FRESH exception lines (handle both LF and CRLF)
  const eol = gi.includes("\r\n") ? "\r\n" : "\n";
  gi = gi
    .split(/\r?\n/)
    .filter((line) => !/hospital_management_FRESH_.*\.sql/.test(line))
    .join(eol);
  // Add the new exception after the backups/* rule
  gi = gi.replace(
    `backend/backups/*${eol}`,
    `backend/backups/*${eol}!backend/backups/${dumpName}${eol}`,
  );
  writeFileSync(gitignorePath, gi);
  console.log("  .gitignore updated.");

  console.log("[4/5] Staging changes...");
  const addRes = await run("git", ["add", "-A"], projectRoot);
  if (addRes.code !== 0) {
    console.error(`  git add failed: ${addRes.stderr}`);
    process.exit(1);
  }

  console.log("[5/5] Committing and pushing...");
  const commitRes = await run("git", ["commit", "-m", commitMessage], projectRoot);
  if (commitRes.code !== 0) {
    console.error(`  git commit failed: ${commitRes.stderr}`);
    process.exit(1);
  }
  console.log(commitRes.stdout.trim());

  const pushRes = await run("git", ["push", "origin", "main"], projectRoot);
  if (pushRes.code !== 0) {
    console.error(`  git push failed: ${pushRes.stderr}`);
    process.exit(1);
  }
  console.log(pushRes.stdout.trim() || pushRes.stderr.trim());

  console.log("\nDone! Your senior only needs:");
  console.log("  git pull");
  console.log(`  cd backend && npm run db:import -- backups/${dumpName}`);
  console.log("  npx prisma generate && npm run build && npm start");
  console.log("  cd .. && npm run build && npm start\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
