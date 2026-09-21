// app/dashboard/settings/audit/AuditCenterView.tsx
// Live "Audit Center" page backed by GET /api/audit (list/filter/paginate)
// and the CSV export endpoint.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCcw, FiSearch, FiDownload } from "react-icons/fi";
import {
  auditApi,
  type AuditLogRecord,
  errorMessage,
} from "@/app/lib/api";

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

const PAGE_SIZE = 20;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionBadge(action: string) {
  if (action.startsWith("LOGIN")) return "bg-sky-50 text-sky-600 border-sky-200";
  if (action.includes("DELETE") || action.includes("REMOVE")) return "bg-rose-50 text-rose-600 border-rose-200";
  if (action.includes("BLOCKED") || action.includes("LOCKED")) return "bg-amber-50 text-amber-600 border-amber-200";
  return "bg-emerald-50 text-emerald-600 border-emerald-200";
}

export function AuditCenterView() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [applied, setApplied] = useState(false);

  const load = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const result = await auditApi.list({
        page,
        limit: PAGE_SIZE,
        module: moduleFilter.trim() || undefined,
        action: actionFilter.trim() || undefined,
        from: fromFilter || undefined,
        to: toFilter || undefined,
      });
      setLogs(result.data);
      setPagination(result.pagination);
      setError("");
    } catch (err) {
      setError(`Audit log unavailable: ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, actionFilter, fromFilter, toFilter]);

  useEffect(() => {
    const t = setTimeout(() => load(1), 0);
    return () => clearTimeout(t);
  }, [applied]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildExportUrl = () => {
    const params = new URLSearchParams();
    if (moduleFilter.trim()) params.set("module", moduleFilter.trim());
    if (actionFilter.trim()) params.set("action", actionFilter.trim());
    if (fromFilter) params.set("from", fromFilter);
    if (toFilter) params.set("to", toFilter);
    const q = params.toString();
    return `/api/audit/export${q ? `?${q}` : ""}`;
  };

  const totalPages = Math.max(1, pagination.totalPages);
  const safePage = Math.min(pagination.page, totalPages);

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Audit Center</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Append-only access log of every significant action. Filter by module, action and date range;
          export the matching rows as CSV.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]" />
            <input
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              placeholder="Module (e.g. AUTH)"
              className={`${INPUT_CLS} pl-9`}
            />
          </div>
          <input
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="Action (e.g. USER_CREATED)"
            className={INPUT_CLS}
          />
          <input
            type="date"
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
            title="From"
            className={INPUT_CLS}
          />
          <input
            type="date"
            value={toFilter}
            onChange={(e) => setToFilter(e.target.value)}
            title="To"
            className={INPUT_CLS}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setApplied((v) => !v)}
            className="btn-primary inline-flex items-center gap-1.5 text-xs py-2 cursor-pointer"
          >
            <FiRefreshCcw className="w-3.5 h-3.5" /> Apply Filters
          </button>
          <a
            href={buildExportUrl()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] transition-colors"
            title="Export matching rows as CSV"
          >
            <FiDownload className="w-3.5 h-3.5" /> Export CSV
          </a>
          <span className="text-[10px] text-[var(--muted)]">
            Matching {pagination.total} event(s) · page {safePage}/{totalPages}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="card border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-xs font-bold text-[var(--muted)]">Loading audit log…</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-xs font-bold text-[var(--muted)]">
            No audit events match. Adjust the filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full">
              <thead>
                <tr className="bg-[var(--bg)]">
                  <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">When</th>
                  <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Module</th>
                  <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Action</th>
                  <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Target</th>
                  <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Actor</th>
                  <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">Branch</th>
                  <th className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="text-[11px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)] whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="text-[11px] font-bold text-[var(--primary-dark)] px-4 py-3 border-b border-[var(--border)] uppercase">
                      {log.module}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase border ${actionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="text-[11px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {log.tableName ? `${log.tableName}#${log.recordId ?? ""}` : "—"}
                    </td>
                    <td className="text-[11px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {log.user ? log.user.name : "System"}
                    </td>
                    <td className="text-[11px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                      {log.branch?.name ?? "—"}
                    </td>
                    <td className="text-[11px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                      {log.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && logs.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => load(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className="px-3 py-2 rounded-xl text-xs font-bold border transition-colors bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] disabled:opacity-50 cursor-pointer"
          >
            Previous
          </button>
          <span className="text-xs font-bold text-[var(--muted)]">Page {safePage} / {totalPages}</span>
          <button
            type="button"
            onClick={() => load(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
            className="px-3 py-2 rounded-xl text-xs font-bold border transition-colors bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] disabled:opacity-50 cursor-pointer"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}