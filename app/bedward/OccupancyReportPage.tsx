"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiRefreshCcw } from "react-icons/fi";
import { bedBoardApi, branchApi, errorMessage, type BedBoard, type BranchRecord } from "@/app/lib/api";
import { ToastViewport, type ToastItem } from "@/app/patients/Toast";

interface FlatBed {
  id: number;
  name: string;
  status: string;
  floor: string;
  group: string;
  type: string;
}

function flattenBeds(board: BedBoard | null): FlatBed[] {
  const out: FlatBed[] = [];
  if (!board) return out;
  for (const floor of board.floors) {
    for (const ward of floor.wards) {
      for (const bed of ward.beds) {
        out.push({ id: bed.id, name: bed.name, status: bed.status, floor: floor.name, group: ward.name, type: bed.bedType?.name ?? "—" });
      }
    }
  }
  return out;
}

export function OccupancyReportPage({ onBack }: { onBack?: () => void }) {
  const [beds, setBeds] = useState<FlatBed[]>([]);
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
      setBeds(flattenBeds(result.board));
      setBranchId((prev) => prev ?? result.board.branchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load occupancy");
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

  const totals = beds.reduce(
    (acc, b) => {
      acc.total++;
      if (b.status === "AVAILABLE") acc.available++;
      else if (b.status === "OCCUPIED") acc.occupied++;
      else acc.unused++;
      return acc;
    },
    { total: 0, available: 0, occupied: 0, unused: 0 },
  );

  const byFloor = beds.reduce<Record<string, { total: number; available: number; occupied: number; unused: number }>>((acc, b) => {
    if (!acc[b.floor]) acc[b.floor] = { total: 0, available: 0, occupied: 0, unused: 0 };
    acc[b.floor].total++;
    if (b.status === "AVAILABLE") acc[b.floor].available++;
    else if (b.status === "OCCUPIED") acc[b.floor].occupied++;
    else acc[b.floor].unused++;
    return acc;
  }, {});

  const byType = beds.reduce<Record<string, { total: number; available: number; occupied: number; unused: number }>>((acc, b) => {
    if (!acc[b.type]) acc[b.type] = { total: 0, available: 0, occupied: 0, unused: 0 };
    acc[b.type].total++;
    if (b.status === "AVAILABLE") acc[b.type].available++;
    else if (b.status === "OCCUPIED") acc[b.type].occupied++;
    else acc[b.type].unused++;
    return acc;
  }, {});

  const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);

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
          <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Occupancy Report</h3>
          <p className="text-xs text-[var(--muted)] mt-1.5">
            Current bed occupancy breakdown by floor and bed type.
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

      {error && <p className="text-sm alert-error">{error}</p>}

      {loading ? (
        <div className="py-10 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
        </div>
      ) : (
        <div className="space-y-4">
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
                {totals.total > 0 && t.label !== "Total beds" && (
                  <div className="text-[10px] text-[var(--muted)] mt-0.5">{pct(t.value, totals.total)}%</div>
                )}
              </div>
            ))}
          </div>

          {beds.length === 0 ? (
            <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
              <p className="text-xs text-[var(--muted)]">No beds found for this branch.</p>
            </div>
          ) : (
            <>
              <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-3">
                <h4 className="text-sm font-extrabold text-[var(--text)]">By floor</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                        <th className="py-2 pr-4">Floor</th>
                        <th className="py-2 pr-4 text-right">Total</th>
                        <th className="py-2 pr-4 text-right">Available</th>
                        <th className="py-2 pr-4 text-right">Occupied</th>
                        <th className="py-2 pr-4 text-right">Unused</th>
                        <th className="py-2 pr-4 text-right">Occupancy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byFloor).map(([floor, s]) => (
                        <tr key={floor} className="border-b border-[var(--border)] last:border-0">
                          <td className="py-2 pr-4 font-bold text-[var(--primary-dark)]">{floor}</td>
                          <td className="py-2 pr-4 text-right">{s.total}</td>
                          <td className="py-2 pr-4 text-right text-emerald-600">{s.available}</td>
                          <td className="py-2 pr-4 text-right text-rose-500">{s.occupied}</td>
                          <td className="py-2 pr-4 text-right text-slate-500">{s.unused}</td>
                          <td className="py-2 pr-4 text-right">{pct(s.occupied, s.total)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-3">
                <h4 className="text-sm font-extrabold text-[var(--text)]">By bed type</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                        <th className="py-2 pr-4">Bed type</th>
                        <th className="py-2 pr-4 text-right">Total</th>
                        <th className="py-2 pr-4 text-right">Available</th>
                        <th className="py-2 pr-4 text-right">Occupied</th>
                        <th className="py-2 pr-4 text-right">Unused</th>
                        <th className="py-2 pr-4 text-right">Occupancy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byType).map(([type, s]) => (
                        <tr key={type} className="border-b border-[var(--border)] last:border-0">
                          <td className="py-2 pr-4 font-bold text-[var(--primary-dark)]">{type}</td>
                          <td className="py-2 pr-4 text-right">{s.total}</td>
                          <td className="py-2 pr-4 text-right text-emerald-600">{s.available}</td>
                          <td className="py-2 pr-4 text-right text-rose-500">{s.occupied}</td>
                          <td className="py-2 pr-4 text-right text-slate-500">{s.unused}</td>
                          <td className="py-2 pr-4 text-right">{pct(s.occupied, s.total)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
