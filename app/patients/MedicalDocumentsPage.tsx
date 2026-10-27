// app/patients/MedicalDocumentsPage.tsx
// "Medical Documents Upload" sub-feature of the Patient Management module.
// Pick a patient, attach scans (NID, passport, referral letter, insurance ...)
// with a type, title and optional notes, then browse / open / remove them.
// Files are uploaded to /api/uploads (kind `document`); the row stores the URL
// plus the metadata this page renders.

"use client";

import { useEffect, useState } from "react";
import {
  FiExternalLink,
  FiFileText,
  FiPaperclip,
  FiRefreshCcw,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";
import {
  patientDocumentApi,
  calcAge,
  errorMessage,
  formatDate,
  type PatientDocumentRecord,
  type PatientListRecord,
  type UploadedFile,
} from "@/app/lib/api";
import { genderLabel } from "@/app/patients/constants";
import { useMasterDataOptions } from "@/app/lib/useMasterData";
import { PatientSearchPicker } from "@/app/patients/PatientSearchPicker";
import { FileUploadField } from "@/app/components/FileUploadField";
import { ConfirmDialog } from "@/app/patients/ConfirmDialog";

/** Shipped Master Data seeds, used only if Settings → Master Data is empty. */
const DOCUMENT_TYPE_FALLBACK = ["NID", "PP", "BC", "DL", "TIN", "SC"];

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

const LABEL_CLS =
  "block text-[9px] uppercase tracking-widest font-extrabold text-[var(--muted)] mb-1";

/** `20480` → `20 KB`. */
function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MedicalDocumentsPage() {
  const { options: typeOptions } = useMasterDataOptions("document_types", DOCUMENT_TYPE_FALLBACK);

  const [selected, setSelected] = useState<PatientListRecord | null>(null);
  const [documents, setDocuments] = useState<PatientDocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  // Upload form
  const [documentType, setDocumentType] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileMeta, setFileMeta] = useState<Omit<UploadedFile, "url" | "kind"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete
  const [confirming, setConfirming] = useState<PatientDocumentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    // Deferred a tick so the effect body never sets state synchronously
    // (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      setLoading(true);
      patientDocumentApi
        .list(selected.id)
        .then((r) => {
          if (!active) return;
          setDocuments(r.documents);
          setError("");
        })
        .catch((err) => {
          if (active) setError(errorMessage(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selected, reload]);

  const resetForm = () => {
    setDocumentType("");
    setTitle("");
    setNotes("");
    setFileUrl("");
    setFileMeta(null);
    setFormError("");
  };

  const pick = (patient: PatientListRecord) => {
    setSelected(patient);
    setDocuments([]);
    setError("");
    setNotice("");
    resetForm();
  };

  const save = async () => {
    if (!selected) return;
    setFormError("");
    setNotice("");
    if (!fileUrl) {
      setFormError("Choose a file to upload first.");
      return;
    }
    if (!title.trim()) {
      setFormError("Give the document a title.");
      return;
    }

    setSaving(true);
    try {
      await patientDocumentApi.create(selected.id, {
        title: title.trim(),
        fileUrl,
        documentType: documentType || undefined,
        fileName: fileMeta?.originalName,
        mimeType: fileMeta?.mimeType,
        fileSize: fileMeta?.size,
        notes: notes.trim() || undefined,
      });
      resetForm();
      setNotice("Document uploaded successfully.");
      setReload((t) => t + 1);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || !confirming) return;
    setDeleting(true);
    try {
      await patientDocumentApi.remove(selected.id, confirming.id);
      setConfirming(null);
      setNotice(`"${confirming.title}" was removed.`);
      setReload((t) => t + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PatientSearchPicker
        title="Medical Documents Upload"
        description="Search a patient to attach and manage their scans, reports and other paperwork."
        selectedId={selected?.id ?? null}
        onPick={pick}
      />

      {selected && (
        <div className="card p-6 rounded-2xl shadow-sm space-y-5 w-full">
          {/* Patient header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] flex items-center justify-center shrink-0">
                <FiPaperclip className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-lg text-[var(--text)]">{selected.name}</h4>
                <p className="text-[11px] text-[var(--muted)] font-semibold">
                  {[
                    selected.patientCode,
                    genderLabel(selected.gender),
                    calcAge(selected.dateOfBirth),
                    selected.phone,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
                {documents.length} document{documents.length === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => setReload((t) => t + 1)}
                title="Refresh documents"
                className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                <FiRefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Upload form */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FiUploadCloud className="w-3.5 h-3.5 text-[var(--primary)]" />
              <h5 className="text-xs font-black text-[var(--text)]">Upload a document</h5>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-3">
              <div>
                <label htmlFor="doc-type" className={LABEL_CLS}>
                  Document type
                </label>
                <select
                  id="doc-type"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className={`${INPUT_CLS} h-[34px]`}
                >
                  <option value="">Unclassified</option>
                  {typeOptions.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="doc-title" className={LABEL_CLS}>
                  Title *
                </label>
                <input
                  id="doc-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. NID front side, referral from Dr. Rahman..."
                  className={INPUT_CLS}
                />
              </div>
            </div>

            <div>
              <label htmlFor="doc-notes" className={LABEL_CLS}>
                Notes
              </label>
              <textarea
                id="doc-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Anything the next reader should know about this file (optional)."
                className={`${INPUT_CLS} resize-none`}
              />
            </div>

            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="min-w-[15rem]">
                <FileUploadField
                  label="File *"
                  kind="document"
                  value={fileUrl}
                  onChange={(url) => {
                    setFileUrl(url);
                    if (!url) setFileMeta(null);
                    setFormError("");
                  }}
                  onUploaded={(uploaded) =>
                    setFileMeta({
                      originalName: uploaded.originalName,
                      size: uploaded.size,
                      mimeType: uploaded.mimeType,
                    })
                  }
                  preview="file"
                  hint="PDF, DOC, DOCX or an image up to 10 MB."
                />
              </div>
              <button
                onClick={save}
                disabled={saving || !fileUrl}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <FiUploadCloud className="w-3.5 h-3.5" />
                {saving ? "Saving…" : "Save document"}
              </button>
            </div>

            {formError && <div className="alert-error text-xs">{formError}</div>}
            {notice && (
              <div className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-400/30 rounded-lg px-3 py-2">
                {notice}
              </div>
            )}
          </div>

          {error && (
            <div className="alert-error text-xs flex items-center justify-between">
              {error}
              <button
                onClick={() => setReload((t) => t + 1)}
                className="text-xs font-bold underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Document list */}
          {loading ? (
            <div className="py-10 text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
              <p className="text-xs font-bold text-[var(--muted)] mt-3">Loading documents…</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center">
              <FiFileText className="w-6 h-6 mx-auto mb-2 text-[var(--muted)] opacity-50" />
              <p className="text-xs font-bold text-[var(--muted)]">
                No documents uploaded for this patient yet.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 flex-wrap hover:bg-[var(--primary-soft)]/10 transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className="w-8 h-8 rounded-lg bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] flex items-center justify-center shrink-0">
                      <FiFileText className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[var(--text)]">{doc.title}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wide border border-[var(--border)] rounded-full px-2 py-0.5 text-[var(--muted)]">
                          {doc.documentType?.name ?? "Unclassified"}
                        </span>
                      </div>
                      {doc.notes && (
                        <p className="text-[11px] text-[var(--muted)] mt-0.5">{doc.notes}</p>
                      )}
                      <p className="text-[10px] text-[var(--muted)] font-semibold mt-0.5">
                        {[
                          formatBytes(doc.fileSize),
                          doc.uploadedBy?.name ? `Uploaded by ${doc.uploadedBy.name}` : null,
                          formatDate(doc.createdAt),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[var(--primary)] hover:bg-[var(--primary-soft)]/20 transition-colors"
                    >
                      <FiExternalLink className="w-3 h-3" />
                      Open
                    </a>
                    <button
                      onClick={() => setConfirming(doc)}
                      title="Delete document"
                      className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete document?"
        message={`"${confirming?.title ?? ""}" will be removed from this patient's documents. The file stays on the server and the record can be restored by an administrator.`}
        confirmLabel="Delete document"
        danger
        loading={deleting}
        onConfirm={remove}
        onClose={() => (deleting ? undefined : setConfirming(null))}
      />
    </div>
  );
}
