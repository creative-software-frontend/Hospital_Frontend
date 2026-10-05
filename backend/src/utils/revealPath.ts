import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors/ApiError";

/**
 * Development convenience: open a file that lives under the Next.js `public/`
 * folder in the operating system's file manager, so an admin editing the hospital
 * logo can jump straight to the file on disk instead of hunting for it.
 *
 * This shells out to Explorer/Finder/open, which only makes sense on the machine
 * running the app, so it is refused outright in production. Everything is
 * confined to `public/`: the input is resolved against that root and rejected if
 * it escapes, so this cannot be used to browse the filesystem.
 */

const PUBLIC_DIR_NAME = "public";

/**
 * `backend/src/utils` and `backend/dist/utils` are both one level below the
 * backend folder, so three levels up is the repository root in either layout.
 * Override with PUBLIC_ASSETS_PATH if the frontend lives elsewhere.
 */
function publicRoot(): string {
  const root = path.resolve(process.env.PUBLIC_ASSETS_PATH || path.join(__dirname, "..", "..", "..", PUBLIC_DIR_NAME));
  if (!fs.existsSync(root)) {
    throw new NotFoundError(`The public assets folder was not found (${root})`);
  }
  return root;
}

export interface RevealedPath {
  /** Absolute path that was handed to the file manager. */
  folder: string;
  /** Absolute path of the file itself, when one was given. */
  file: string | null;
}

export function revealPublicAsset(inputPath: string): RevealedPath {
  if (config.env === "production") {
    throw new AuthorizationError("Opening local folders is disabled in production");
  }

  const requested = (inputPath ?? "").trim();
  if (!requested) {
    throw new ValidationError("A path is required");
  }

  // A URL has no folder to open on this machine; only site-relative paths do.
  if (/^[a-z][a-z0-9+.-]*:/i.test(requested) || requested.startsWith("//")) {
    throw new ValidationError("Only a path under /public can be opened, not a URL");
  }

  const root = publicRoot();
  const target = path.resolve(root, requested.replace(/^[/\\]+/, ""));
  const relative = path.relative(root, target);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ValidationError("Path is outside the public folder");
  }

  if (!fs.existsSync(target)) {
    throw new NotFoundError(`Not found in the public folder: ${relative}`);
  }

  const isDirectory = fs.statSync(target).isDirectory();
  const file = isDirectory ? null : target;
  const folder = isDirectory ? target : path.dirname(target);

  openInFileManager(folder, file);

  return { folder, file };
}

function openInFileManager(folder: string, file: string | null): void {
  let command: string;
  let args: string[];

  if (process.platform === "win32") {
    command = "explorer.exe";
    // Explorer takes `/select,<path>` as one argument with no space, and
    // happily opens a folder when given the folder itself.
    args = file ? [`/select,${file}`] : [folder];
  } else if (process.platform === "darwin") {
    command = "open";
    args = file ? ["-R", file] : [folder];
  } else {
    command = "xdg-open";
    args = [folder];
  }

  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {
      // Explorer routinely exits non-zero even when it opened the window, and a
      // headless machine has no file manager at all. Nothing actionable here.
    });
    child.unref();
  } catch {
    // Same as above: opening a window is best-effort.
  }
}