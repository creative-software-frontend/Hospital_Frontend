// app/dashboard/settings/print-document/PrintDocumentView.tsx
// Live "Print & Document" page backed by GET/POST/PATCH/DELETE /api/settings/print-templates.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2, FiTrash2 } from "react-icons/fi";
import {
  settingsApi,
  type ActiveStatus,
  type CreatePrintTemplateInput,
  type PrintDocumentType,
  type PrintTemplate,
  PRINT_DOCUMENT_TYPE_LABELS,
  PRINT_TEMPLATE_SIZES,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const DOC_TYPES = Object.keys(PRINT_DOCUMENT_TYPE_LABELS) as PrintDocumentType[];

const STATUS_STYLES: Record<ActiveStatus, string> = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
};

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

export function PrintDocumentView() {
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PrintTemplate | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<PrintTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    try {
      const result = await settingsApi.print.list();
      setTemplates(result.templates);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const filtered = useMemo(() => {
    const term = searchInput.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter((t) => {
      const label = PRINT_DOCUMENT_TYPE_LABELS[t.documentType].toLowerCase();
      return (
        t.templateName.toLowerCase().includes(term) ||
        t.documentType.includes(term) ||
        label.includes(term)
      );
    });
  }, [templates, searchInput]);

  const submit = async (input: CreatePrintTemplateInput) => {
    if (editing) {
      await settingsApi.print.update(editing.id, input);
      notify("success", `Template "${input.templateName}" updated.`);
    } else {
      await settingsApi.print.create(input);
      notify("success", `Template "${input.templateName}" created.`);
    }
    setFormOpen(false);
    setEditing(null);
    setReloadKey((k) => k + 1);
  };

  const handleDelete = async () => {
    if (!confirmingDelete || deleting) return;
    setDeleting(true);
    try {
      await settingsApi.print.remove(confirmingDelete.id);
      notify("success", `Template "${confirmingDelete.templateName}" deleted.`);
      setConfirmingDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Print & Document</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: printable document templates for prescriptions, invoices,
          certificates, lab reports, admission forms and employee ID cards.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Document Templates</h4>
            <p className="text-xs text-[var(--muted)]">
              {loading ? "Loading…" : `${templates.length} template(s) total`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search type, template…"
                className="pl-9 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 w-64 max-w-full"
              />
            </div>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="p-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              title="Refresh"
            >
              <FiRefreshCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98]"
              style={{ background: "var(--primary)" }}
            >
              <FiPlus className="w-3.5 h-3.5" />
              Add Template
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[800px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                {["Document Type", "Template", "Layout", "Header", "Footer", "Status", "Actions"].map((col) => (
                  <th key={col} className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center"><div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-xs text-[var(--muted)]">No templates found.</td></tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span className="text-[11px] font-bold text-[var(--primary-dark)]">
                        {PRINT_DOCUMENT_TYPE_LABELS[t.documentType]}
                      </span>
                      <span className="block text-[10px] text-[var(--muted)] font-semibold">{t.documentType}</span>
                    </td>
                    <td className="text-[12px] font-bold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">{t.templateName}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">{PRINT_TEMPLATE_SIZES[t.documentType]}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)] max-w-[200px] truncate">{t.header ?? "—"}</td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)] max-w-[200px] truncate">{t.footer ?? "—"}</td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span className={`inline-block text-[10px] font-bold capitalize px-2 py-0.5 rounded-md border ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setEditing(t); setFormOpen(true); }}
                          className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                          title="Edit template"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(t)}
                          className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-red-600 hover:border-red-300 transition-colors"
                          title="Delete template"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <TemplateFormModal
          key={editing?.id ?? "new"}
          template={editing}
          onSubmit={submit}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => !deleting && setConfirmingDelete(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
          <div onClick={(e) => e.stopPropagation()}
            className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 animate-[scaleIn_0.25s_ease-out]">
            <h3 className="font-black text-lg text-[var(--text)]">Delete template?</h3>
            <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
              The &quot;{confirmingDelete.templateName}&quot; template for{" "}
              {PRINT_DOCUMENT_TYPE_LABELS[confirmingDelete.documentType]} will be permanently removed.
              This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? "Deleting..." : "Delete Template"}
              </button>
              <button
                onClick={() => setConfirmingDelete(null)}
                disabled={deleting}
                className="px-4 py-3 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function TemplateFormModal({
  template,
  onSubmit,
  onClose,
}: {
  template: PrintTemplate | null;
  onSubmit: (input: CreatePrintTemplateInput) => Promise<void>;
  onClose: () => void;
}) {
  const editing = !!template;
  const [documentType, setDocumentType] = useState<PrintDocumentType>(template?.documentType ?? "prescription");
  const [templateName, setTemplateName] = useState(template?.templateName ?? "");
  const [header, setHeader] = useState(template?.header ?? "");
  const [footer, setFooter] = useState(template?.footer ?? "");
  const [status, setStatus] = useState<ActiveStatus>(template?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!templateName.trim()) {
      setError("Template name is required.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        documentType,
        templateName: templateName.trim(),
        header: header.trim() || null,
        footer: footer.trim() || null,
        status,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}
        className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 animate-[scaleIn_0.25s_ease-out]">
        <button type="button" onClick={onClose} disabled={saving} className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors disabled:opacity-50" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Print & Document</span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{editing ? "Edit Template" : "Add Template"}</h3>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Document Type *</label>
            <select value={documentType} disabled={editing} onChange={(e) => setDocumentType(e.target.value as PrintDocumentType)} className={`${INPUT_CLS} ${editing ? "opacity-50" : ""}`}>
              {DOC_TYPES.map((dt) => (
                <option key={dt} value={dt}>{PRINT_DOCUMENT_TYPE_LABELS[dt]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Template Name *</label>
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ActiveStatus)} className={INPUT_CLS}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Default Layout</label>
            <input value={`${PRINT_TEMPLATE_SIZES[documentType]} (fixed)`} readOnly className={`${INPUT_CLS} opacity-60`} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Header</label>
            <textarea value={header} onChange={(e) => setHeader(e.target.value)} rows={2} placeholder="Printed at the top of the document" className={INPUT_CLS} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Footer</label>
            <textarea value={footer} onChange={(e) => setFooter(e.target.value)} rows={2} placeholder="Printed at the bottom of the document" className={INPUT_CLS} />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <button type="submit" disabled={saving}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            style={{ background: "var(--primary)" }}>
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Template"}
          </button>
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-3 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}