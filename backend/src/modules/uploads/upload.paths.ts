import path from "path";

/**
 * Where uploaded files (photos, signatures, CVs) are written on disk. The
 * backend is always started from its own directory (`npm run dev` / the tsx
 * command), so `process.cwd()` resolves to `backend/`.
 */
export const UPLOAD_ROOT = path.resolve(process.cwd(), "public", "uploads");

/**
 * Public URL prefix the files are served under. It lives under `/api` on
 * purpose: the Next.js dev proxy only forwards `/api/*` to this backend, so a
 * bare `/uploads/...` URL would 404 in the browser.
 */
export const UPLOAD_URL_PREFIX = "/api/uploads";

export type UploadKind = "photo" | "signature" | "cv" | "document";

interface UploadRule {
  /** Accepted MIME types. */
  mimes: readonly string[];
  /** Hard size cap in bytes. */
  maxBytes: number;
  /** Sub-directory under UPLOAD_ROOT. */
  subdir: string;
  /** Human-readable size cap, for error messages. */
  label: string;
}

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const DOC_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const UPLOAD_RULES: Record<UploadKind, UploadRule> = {
  photo: { mimes: IMAGE_MIMES, maxBytes: 5 * 1024 * 1024, subdir: "photos", label: "5 MB" },
  signature: { mimes: IMAGE_MIMES, maxBytes: 5 * 1024 * 1024, subdir: "signatures", label: "5 MB" },
  cv: {
    mimes: [...IMAGE_MIMES, ...DOC_MIMES],
    maxBytes: 10 * 1024 * 1024,
    subdir: "cvs",
    label: "10 MB",
  },
  document: {
    mimes: [...DOC_MIMES, ...IMAGE_MIMES],
    maxBytes: 10 * 1024 * 1024,
    subdir: "documents",
    label: "10 MB",
  },
};

export function isUploadKind(value: string): value is UploadKind {
  return Object.prototype.hasOwnProperty.call(UPLOAD_RULES, value);
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

/**
 * Resolves a safe file extension: prefers the (sanitised) extension from the
 * original name, else falls back to the one implied by the MIME type. Only a
 * short alphanumeric extension is ever returned so a crafted name cannot escape
 * the upload directory.
 */
export function resolveExtension(originalName: string, mimeType: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if (/^\.[a-z0-9]{1,10}$/.test(ext)) return ext;
  return MIME_EXTENSIONS[mimeType] ?? "";
}
