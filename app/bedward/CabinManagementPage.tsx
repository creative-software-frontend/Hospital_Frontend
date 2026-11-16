"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiRefreshCcw } from "react-icons/fi";
import { MdKingBed } from "react-icons/md";
import { bedBoardApi, bedWardApi, branchApi, errorMessage, type BedBoard, type BranchRecord } from "@/app/lib/api";
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
        out.push({ id: bed.id, name: bed.name, status: bed.status, floor: floor.name, group: ward.name, type: bed.bedType?.name ?? "" });
      }
    }
  }
  return out;
}

const isCabin = (bed: FlatBed) => /cabin/i.test(bed.type);

export function CabinManagementPage({ onBack }: { onBack?: () => void }) {
  const [beds, setBeds] = useState<FlatBed[]>([]);
  const [cabinTypes, setCabinTypes] = useState<string[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
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
      const [boardResult, typesResult] = await Promise.all([
        bedBoardApi.get(bid ?? undefined),
        bedWardApi.list("bed-types", { limit: 100, branchId: bid ?? undefined }),
      ]);
      setBeds(flattenBeds(boardResult.board));
      setBranchId((prev) => prev ?? boardResult.board.branchId);
      setCabinTypes(
        (typesResult.data ?? [])
          .map((t) => t.name)
          .filter((n) => /cabin/i.test(n)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load cabins");
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

  const cabins = beds.filter(isCabin);

  const notify = useCallback((message: string, kind: ToastItem["kind"] = "success") => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current.slice(-3), { id, kind, message }]);
  }, []);

  const colorFor = (status: string) =>
    status === "AVAILABLE" ? "text-emerald-500" : status === "OCCUPIED" ? "text-rose-500" : "text-slate-400";
  const labelFor = (status: string) =>
    status === "AVAILABLE" ? "Available" : status === "OCCUPIED" ? "Occupied" : "Unused";

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
          <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Cabin Management</h3>
          <p className="text-xs text-[var(--muted)] mt-1.5">
            Cabins (beds of type &ldquo;Cabin&rdquo;) with their occupancy status.
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

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        {error && <p className="text-sm alert-error">{error}</p>}
        {loading ? (
          <div className="py-10 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          </div>
        ) : cabins.length === 0 ? (
          <div className="py-10 text-center text-xs text-[var(--muted)] space-y-1">
            <p>No cabin beds found.</p>
            {cabinTypes.length > 0 && (
              <p className="text-[10px]">
                Cabin bed type(s) exist: {cabinTypes.join(", ")}. Add beds of that type under Bed & Ward → Bed.
              </p>
            )}
            {cabinTypes.length === 0 && (
              <p className="text-[10px]">
                Create a bed type named &ldquo;Cabin&rdquo; under Bed & Ward → Bed Type, then add beds of that type.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {cabins.map((bed) => (
              <div
                key={bed.id}
                className="flex flex-col items-center gap-1 w-24 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2"
                title={`${bed.name} — ${bed.status} (${bed.group}, ${bed.floor})`}
              >
                <MdKingBed className={`w-8 h-8 ${colorFor(bed.status)}`} />
                <span className="text-[9px] font-mono text-[var(--muted)]">#{bed.id}</span>
                <span className="text-[10px] font-bold text-[var(--primary-dark)] truncate w-full text-center">
                  {bed.name}
                </span>
                <span
                  className={`text-[9px] font-bold ${
                    bed.status === "AVAILABLE"
                      ? "text-emerald-600"
                      : bed.status === "OCCUPIED"
                      ? "text-rose-500"
                      : "text-slate-500"
                  }`}
                >
                  {labelFor(bed.status)}
                </span>
                <span className="text-[9px] text-[var(--muted)] truncate w-full text-center">{bed.group}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
