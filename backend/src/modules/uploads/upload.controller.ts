import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { ValidationError } from "../../errors/ApiError";
import {
  UPLOAD_ROOT,
  UPLOAD_URL_PREFIX,
  UPLOAD_RULES,
  isUploadKind,
  resolveExtension,
} from "./upload.paths";

// The largest cap across all kinds; the per-kind check in the controller then
// applies the tighter limit and a kind-specific message.
const MAX_BYTES = Math.max(...Object.values(UPLOAD_RULES).map((r) => r.maxBytes));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

/**
 * Accepts a single multipart field named `file`, mapping multer's own errors
 * onto the API's ValidationError so the client gets the same `{ field: message }`
 * shape it uses everywhere else.
 */
export function singleFile(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      next(new ValidationError("File is too large", { file: `File exceeds the ${MAX_BYTES / 1024 / 1024} MB limit` }));
      return;
    }
    if (err) {
      next(err instanceof Error ? err : new ValidationError("Upload failed"));
      return;
    }
    next();
  });
}

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  const kind = String(req.body?.kind ?? "").trim().toLowerCase();
  if (!isUploadKind(kind)) {
    throw new ValidationError("Invalid upload kind", { kind: "kind must be one of photo, signature, cv" });
  }

  const file = req.file;
  if (!file) {
    throw new ValidationError("No file uploaded", { file: "A file is required" });
  }

  const rule = UPLOAD_RULES[kind];
  if (!rule.mimes.includes(file.mimetype)) {
    throw new ValidationError("Unsupported file type", { file: `Allowed types: ${rule.mimes.join(", ")}` });
  }
  if (file.size > rule.maxBytes) {
    throw new ValidationError("File is too large", { file: `File exceeds the ${rule.label} limit` });
  }

  const extension = resolveExtension(file.originalname, file.mimetype);
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
  const dir = path.join(UPLOAD_ROOT, rule.subdir);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, filename), file.buffer);

  success(res, {
    url: `${UPLOAD_URL_PREFIX}/${rule.subdir}/${filename}`,
    kind,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  });
});
