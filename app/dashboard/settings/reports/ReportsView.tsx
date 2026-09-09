// app/dashboard/settings/reports/ReportsView.tsx
// Live "Reports" page backed by GET / POST / PATCH / DELETE /api/settings/reports.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2, FiTrash2 } from "react-icons/fi";
import {
  settingsApi,
  type ActiveStatus,
  type CreateReportSettingInput,
  type PrintTemplate,
  type ReportSetting,
  type ReportType,
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  PRINT_DOCUMENT_TYPE_LABELS,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const STATUS_STYLES: Record<ActiveStatus, string> = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
};

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-slate-300"}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-4" : "left-0.5"}`}
      />
    </button>
  );
}

function FeatureChip({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={`inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
        enabled
          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
          : "bg-slate-100 text-slate-400 border-slate-200"
      }`}
    >
      {label}
    </span>
  );
}

export function ReportsView() {
  const [reports, setReports] = useState<ReportSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReportSetting | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<ReportSetting | null>(null);
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
      const result = await settingsApi.reports.list();
      setReports(result.reports);
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
    if (!term) return reports;
    return reports.filter((r) => {
      const label = REPORT_TYPE_LABELS[r.reportType].toLowerCase();
      return (
        r.reportName.toLowerCase().includes(term) ||
        r.reportType.includes(term) ||
        label.includes(term)
      );
    });
  }, [reports, searchInput]);

  const submit = async (input: CreateReportSettingInput) => {
    if (editing) {
      await settingsApi.reports.update(editing.id, input);
      notify("success", `Report "${input.reportName}" updated.`);
    } else {
      await settingsApi.reports.create(input);
      notify("success", `Report "${input.reportName}" created.`);
    }
    setFormOpen(false);
    setEditing(null);
    setReloadKey((k) => k + 1);
  };

  const handleDelete = async () => {
    if (!confirmingDelete || deleting) return;
    setDeleting(true);
    try {
      await settingsApi.reports.remove(confirmingDelete.id);
      notify("success", `Report "${confirmingDelete.reportName}" deleted.`);
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
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Reports</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: report configurations for collections, patient statistics,
          doctor performance, pharmacy and lab income, financials and the management dashboard.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Report Configurations</h4>
            <p className="text-xs text-[var(--muted)]">
              {loading ? "Loading…" : `${reports.length} report(s) total`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search report…"
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
              Add Report
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[900px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                {["Report", "Type", "Template", "Elements", "Export", "Status", "Actions"].map((col) => (
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
                <tr><td colSpan={7} className="px-4 py-10 text-center text-xs text-[var(--muted)]">No reports found.</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span className="text-[12px] font-bold text-[var(--text)]">{r.reportName}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span className="text-[11px] font-bold text-[var(--primary-dark)]">
                        {REPORT_TYPE_LABELS[r.reportType]}
                      </span>
                      <span className="block text-[10px] text-[var(--muted)] font-semibold">{r.reportType}</span>
                    </td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                      {r.template ? (
                        <span>
                          {r.template.templateName}
                          <span className="block text-[10px] text-[var(--muted)] font-semibold">
                            {PRINT_DOCUMENT_TYPE_LABELS[r.template.documentType]}
                          </span>
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-1">
                        <FeatureChip label="Logo" enabled={r.showLogo} />
                        <FeatureChip label="Hdr" enabled={r.showHeader} />
                        <FeatureChip label="Ftr" enabled={r.showFooter} />
                        <FeatureChip label="Sig" enabled={r.showSignature} />
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-1">
                        <FeatureChip label="PDF" enabled={r.exportPdf} />
                        <FeatureChip label="Excel" enabled={r.exportExcel} />
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span className={`inline-block text-[10px] font-bold capitalize px-2 py-0.5 rounded-md border ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setEditing(r); setFormOpen(true); }}
                          className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                          title="Edit report"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(r)}
                          className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-red-600 hover:border-red-300 transition-colors"
                          title="Delete report"
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
        <ReportFormModal
          key={editing?.id ?? "new"}
          report={editing}
          onSubmit={submit}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => !deleting && setConfirmingDelete(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
          <div onClick={(e) => e.stopPropagation()}
            className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 animate-[scaleIn_0.25s_ease-out]">
            <h3 className="font-black text-lg text-[var(--text)]">Delete report?</h3>
            <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
              The &quot;{confirmingDelete.reportName}&quot; configuration will be permanently removed.
              This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? "Deleting..." : "Delete Report"}
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

function ReportFormModal({
  report,
  onSubmit,
  onClose,
}: {
  report: ReportSetting | null;
  onSubmit: (input: CreateReportSettingInput) => Promise<void>;
  onClose: () => void;
}) {
  const editing = !!report;
  const [reportName, setReportName] = useState(report?.reportName ?? "");
  const [reportType, setReportType] = useState<ReportType>(report?.reportType ?? "collection");
  const [templateId, setTemplateId] = useState<string>(
    report?.templateId != null ? String(report.templateId) : "",
  );
  const [showLogo, setShowLogo] = useState(report?.showLogo ?? true);
  const [showHeader, setShowHeader] = useState(report?.showHeader ?? true);
  const [showFooter, setShowFooter] = useState(report?.showFooter ?? true);
  const [showSignature, setShowSignature] = useState(report?.showSignature ?? true);
  const [exportPdf, setExportPdf] = useState(report?.exportPdf ?? true);
  const [exportExcel, setExportExcel] = useState(report?.exportExcel ?? true);
  const [status, setStatus] = useState<ActiveStatus>(report?.status ?? "active");
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    settingsApi.print
      .list()
      .then((res) => setTemplates(res.templates))
      .catch(() => setTemplates([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!reportName.trim()) {
      setError("Report name is required.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        reportName: reportName.trim(),
        reportType,
        templateId: templateId ? Number(templateId) : null,
        showLogo,
        showHeader,
        showFooter,
        showSignature,
        exportPdf,
        exportExcel,
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
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Reports</span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{editing ? "Edit Report" : "Add Report"}</h3>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Report Name *</label>
            <input value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="e.g. Monthly Pharmacy Sales" className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Report Type *</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)} className={INPUT_CLS}>
              {REPORT_TYPES.map((rt) => (
                <option key={rt} value={rt}>{REPORT_TYPE_LABELS[rt]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Print Template</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={INPUT_CLS}>
              <option value="">— No template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.templateName} ({PRINT_DOCUMENT_TYPE_LABELS[t.documentType]})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ActiveStatus)} className={INPUT_CLS}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Exports</label>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              <Toggle checked={exportPdf} onChange={setExportPdf} />
              <span className="text-xs font-bold text-[var(--muted)]">PDF</span>
              <Toggle checked={exportExcel} onChange={setExportExcel} />
              <span className="text-xs font-bold text-[var(--muted)]">Excel</span>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Document Elements</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                ["Logo", showLogo, setShowLogo],
                ["Header", showHeader, setShowHeader],
                ["Footer", showFooter, setShowFooter],
                ["Signature", showSignature, setShowSignature],
              ] as const).map(([label, checked, setChecked]) => (
                <div key={label} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-[var(--muted)]">{label}</span>
                    <Toggle checked={checked} onChange={setChecked} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <button type="submit" disabled={saving}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            style={{ background: "var(--primary)" }}>
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Report"}
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