"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiRefreshCcw } from "react-icons/fi";
import { bedBoardApi, branchApi, errorMessage, type BedBoard, type BranchRecord } from "@/app/lib/api";
import { ToastViewport, type ToastItem } from "@/app/patients/Toast";

interface WardRow {
  floor: string;
  ward: string;
  color: string | null;
  total: number;
  available: number;
  occupied: number;
  unused: number;
}

function flattenWards(board: BedBoard | null): WardRow[] {
  const out: WardRow[] = [];
  if (!board) return out;
  for (const floor of board.floors) {
    for (const ward of floor.wards) {
      out.push({
        floor: floor.name,
        ward: ward.name,
        color: ward.color,
        total: ward.total,
        available: ward.available,
        occupied: ward.occupied,
        unused: ward.unused,
      });
    }
  }
  return out;
}

export function WardStatusMonitoringPage({ onBack }: { onBack?: () => void }) {
  const [wards, setWards] = useState<WardRow[]>([]);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const load = useCallback(async (bid?: number | null) => {
    setLoading(true);
    setError("");
    try {
      const result = await bedBoardApi.get(bid ?? undefined);
      setWards(flattenWards(result.board));
      setBranchId((prev) => prev ?? result.board.branchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load wards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    branchApi
      .list({ limit: 100 })
      .then((r) => {
        if (active) setBranches(r.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(branchId), 0);
    return () => clearTimeout(timer);
  }, [load, branchId, reloadKey]);

  const totals = wards.reduce(
    (acc, w) => {
      acc.total += w.total;
      acc.available += w.available;
      acc.occupied += w.occupied;
      acc.unused += w.unused;
      return acc;
    },
    { total: 0, available: 0, occupied: 0, unused: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] cursor-pointer"
            >
              <FiArrowLeft className="w-3 h-3 mr-1 inline" />
              ← Back to Bed & Ward Management
            </button>
          )}
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)] block mt-2">
            Bed & Ward Management
          </span>
          <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Ward Status Monitoring</h3>
          <p className="text-xs text-[var(--muted)] mt-1.5">
            Occupancy overview per ward (bed group) and floor.
          </p>
          {branches.length > 1 && (
            <div className="mt-3">
              <label className="text-[11px] font-bold text-[var(--muted)] block mb-1">Branch</label>
              <select
                value={branchId ?? ""}
                onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : null)}
                className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="h-10 w-10 rounded-xl border border-[var(--border)] text-[var(--muted)] cursor-pointer"
          title="Refresh"
        >
          <FiRefreshCcw className="mx-auto w-4 h-4" />
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total beds", value: totals.total, color: "text-[var(--primary-dark)]" },
          { label: "Available", value: totals.available, color: "text-emerald-600" },
          { label: "Occupied", value: totals.occupied, color: "text-rose-500" },
          { label: "Unused", value: totals.unused, color: "text-slate-500" },
        ].map((t) => (
          <div key={t.label} className="card p-4 rounded-2xl border border-[var(--border)] shadow-sm">
            <div className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">{t.label}</div>
            <div className={`text-2xl font-black mt-1 ${t.color}`}>{t.value}</div>
          </div>
        ))}
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        {error && <p className="text-sm alert-error">{error}</p>}
        {loading ? (
          <div className="py-10 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          </div>
        ) : wards.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No wards / beds found for this branch.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-2 pr-3">Ward</th>
                  <th className="py-2 pr-3">Floor</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3 text-right">Available</th>
                  <th className="py-2 pr-3 text-right">Occupied</th>
                  <th className="py-2 pr-3 text-right">Unused</th>
                  <th className="py-2 pr-3 text-right">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {wards.map((w) => {
                  const pct = w.total > 0 ? Math.round((w.occupied / w.total) * 100) : 0;
                  return (
                    <tr key={`${w.floor}-${w.ward}`} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 pr-3 font-bold text-[var(--primary-dark)]">
                        <span className="inline-flex items-center gap-1.5">
                          {w.color && (
                            <span className="w-2.5 h-2.5 rounded-full border border-[var(--border)]" style={{ background: w.color }} />
                          )}
                          {w.ward}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-[var(--muted)]">{w.floor}</td>
                      <td className="py-2 pr-3 text-right">{w.total}</td>
                      <td className="py-2 pr-3 text-right text-emerald-600">{w.available}</td>
                      <td className="py-2 pr-3 text-right text-rose-500">{w.occupied}</td>
                      <td className="py-2 pr-3 text-right text-slate-500">{w.unused}</td>
                      <td className="py-2 pr-3 text-right">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
