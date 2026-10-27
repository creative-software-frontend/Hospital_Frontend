// app/components/FileUploadField.tsx
// A small reusable attachment picker used by the Doctor and Nurse forms. It
// uploads the chosen file to POST /api/uploads immediately and hands the
// returned URL back to the parent form, which stores it on the record.

"use client";

import { useRef, useState } from "react";
import { FiUpload, FiX, FiFileText } from "react-icons/fi";
import { uploadApi, errorMessage, type UploadedFile, type UploadKind } from "@/app/lib/api";

export function FileUploadField({
  label,
  kind,
  value,
  onChange,
  onUploaded,
  hint,
  preview = "image",
}: {
  label: string;
  kind: UploadKind;
  value: string;
  onChange: (url: string) => void;
  /** Full upload result (original name, MIME type, byte size) when needed. */
  onUploaded?: (file: UploadedFile) => void;
  hint?: string;
  /** `image` renders a thumbnail; `file` renders a "View file" link (CV). */
  preview?: "image" | "file";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const accept =
    preview === "image" ? "image/png,image/jpeg,image/webp,image/gif" : ".pdf,.doc,.docx,image/*";

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const uploaded = await uploadApi.file(file, kind);
      onChange(uploaded.url);
      onUploaded?.(uploaded);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--muted)] mb-1">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--primary-soft)]/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          <FiUpload className="w-3.5 h-3.5" />
          {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>
        {value && !uploading && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] text-rose-500 hover:text-rose-600 transition-colors"
          >
            <FiX className="w-3.5 h-3.5" />
            Remove
          </button>
        )}
      </div>

      {error && <p className="text-[10px] font-bold text-rose-500 mt-1">{error}</p>}
      {!error && hint && <p className="text-[10px] text-[var(--muted)] mt-1">{hint}</p>}

      {value && preview === "image" && (
        <img
          src={value}
          alt={label}
          className="mt-2 h-20 w-20 object-cover rounded-xl border border-[var(--border)] bg-[var(--bg)]"
        />
      )}
      {value && preview === "file" && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--primary)] hover:text-[var(--primary-dark)]"
        >
          <FiFileText className="w-3.5 h-3.5" />
          View uploaded file
        </a>
      )}
    </div>
  );
}
