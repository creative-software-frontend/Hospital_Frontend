"use client";

import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import { MdKingBed } from "react-icons/md";
import {
  bedBoardApi,
  errorMessage,
  type BedBoard,
  type BedBoardBed,
  type BedBoardWard,
  type BedOccupancyStatus,
} from "@/app/lib/api";

type Filter = "ALL" | BedOccupancyStatus;

interface StatusMeta {
  label: string;
  icon: string;
  card: string;
  dot: string;
  count: string;
}

const STATUS_META: Record<BedOccupancyStatus, StatusMeta> = {
  AVAILABLE: {
    label: "Available",
    icon: "text-emerald-500",
    card: "border-emerald-400/50 bg-emerald-500/10 hover:border-emerald-500",
    dot: "bg-emerald-500",
    count: "text-emerald-600",
  },
  OCCUPIED: {
    label: "Occupied",
    icon: "text-rose-500",
    card: "border-rose-400/50 bg-rose-500/10 hover:border-rose-500",
    dot: "bg-rose-500",
    count: "text-rose-500",
  },
  UNUSED: {
    label: "Unused",
    icon: "text-slate-400",
    card: "border-slate-400/40 bg-slate-500/10 hover:border-slate-400",
    dot: "bg-slate-400",
    count: "text-slate-500",
  },
};

export function BedBoardOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [board, setBoard] = useState<BedBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      setSearch("");
      setFilter("ALL");
      bedBoardApi
        .get()
        .then((result) => {
          if (active) setBoard(result.board);
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const summary = board?.summary;

  const visibleFloors = useMemo(() => {
    if (!board) return [];
    const q = search.trim().toLowerCase();
    return board.floors
      .map((floor) => {
        const wards = floor.wards
          .map((ward) => {
            const beds = ward.beds.filter((bed) => {
              if (filter !== "ALL" && bed.status !== filter) return false;
              if (q && !bed.name.toLowerCase().includes(q) && !ward.name.toLowerCase().includes(q)) {
                return false;
              }
              return true;
            });
            return { ...ward, beds };
          })
          .filter((ward) => ward.beds.length > 0);
        return { ...floor, wards };
      })
      .filter((floor) => floor.wards.length > 0);
  }, [board, filter, search]);

  if (!open) return null;

  const onBedClick = (bed: BedBoardBed, ward: BedBoardWard) => {
    const where = `${ward.name} · ${bed.name}`;
    if (bed.status === "AVAILABLE") setNotice(`${where} — admit a patient (coming soon)`);
    else if (bed.status === "OCCUPIED") setNotice(`${where} — view IPD profile (coming soon)`);
    else setNotice(`${where} — this bed is unused`);
  };

  const chip = (value: Filter, label: string, count: number) => {
    const active = filter === value;
    return (
      <button
        key={value}
        onClick={() => setFilter(value)}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-150 ${
          active
            ? "border-transparent text-white"
            : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--text)]"
        }`}
        style={active ? { background: "var(--primary)" } : undefined}
      >
        {label}
        <span className={active ? "opacity-80" : "opacity-60"}>{count}</span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/45 backdrop-blur-sm sm:p-6">
      <div className="flex w-full max-w-6xl flex-col overflow-hidden bg-[var(--bg)] shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
              style={{ background: "var(--primary)" }}
            >
              <MdKingBed className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-black text-[var(--primary-dark)]">Bed Status</h3>
              <p className="text-[11px] font-semibold text-[var(--muted)]">
                Live occupancy across floors and wards
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2.5 text-[var(--muted)] transition-colors hover:bg-[var(--primary-soft)]/25 hover:text-[var(--text)]"
            title="Close"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="news-scroll flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {loading && (
            <div className="py-24 text-center text-sm font-semibold text-[var(--muted)]">
              Loading bed status…
            </div>
          )}

          {error && !loading && (
            <div className="alert-error">
              {error}
            </div>
          )}

          {!loading && !error && board && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  { label: "Total", value: summary?.total ?? 0, accent: "text-[var(--primary-dark)]" },
                  { label: "Available", value: summary?.available ?? 0, accent: "text-emerald-600" },
                  { label: "Occupied", value: summary?.occupied ?? 0, accent: "text-rose-500" },
                  { label: "Unused", value: summary?.unused ?? 0, accent: "text-slate-500" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-sm"
                  >
                    <p className={`text-2xl font-black ${stat.accent}`}>{stat.value}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                      {stat.label}
                    </p>
                  </div>
                ))}
                <div
                  className="rounded-2xl border px-4 py-3 text-white shadow-sm"
                  style={{ background: "var(--primary-dark)", borderColor: "var(--primary-dark)" }}
                >
                  <p className="text-2xl font-black">{summary?.occupiedPercent ?? 0}%</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">Occupied</p>
                </div>
              </div>

              {/* Search + filters */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2 pl-9 pr-3 text-xs font-semibold text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {chip("ALL", "All", summary?.total ?? 0)}
                  {chip("AVAILABLE", "Available", summary?.available ?? 0)}
                  {chip("OCCUPIED", "Occupied", summary?.occupied ?? 0)}
                  {chip("UNUSED", "Unused", summary?.unused ?? 0)}
                </div>
              </div>

              {/* Floors */}
              {visibleFloors.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center text-sm font-semibold text-[var(--muted)]">
                  No beds match your search or filter.
                </div>
              ) : (
                visibleFloors.map((floor) => (
                  <section key={floor.id} className="space-y-3">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
                      <h4 className="text-sm font-black text-[var(--primary-dark)]">{floor.name}</h4>
                      <span className="text-[11px] font-bold text-[var(--muted)]">
                        {floor.wards.length} Wards · {floor.total} Beds
                      </span>
                    </div>

                    {floor.wards.map((ward) => (
                      <div
                        key={ward.id}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {ward.color && (
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-[var(--border)]"
                                style={{ background: ward.color }}
                              />
                            )}
                            <span className="text-xs font-black text-[var(--text)]">{ward.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] font-bold">
                            <span className="text-emerald-600">{ward.available}</span>
                            <span className="text-rose-500">{ward.occupied}</span>
                            <span className="text-slate-500">{ward.unused}</span>
                            <span className="text-[var(--muted)]">/ {ward.total}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                          {ward.beds.map((bed) => {
                            const meta = STATUS_META[bed.status];
                            return (
                              <button
                                key={bed.id}
                                onClick={() => onBedClick(bed, ward)}
                                title={`${bed.name} · ${meta.label}`}
                                className={`flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 transition-all duration-150 active:scale-95 ${meta.card}`}
                              >
                                <MdKingBed className={`h-8 w-8 ${meta.icon}`} />
                                <span className="text-[10px] font-black text-[var(--text)]">{bed.name}</span>
                                <span className="text-[9px] font-bold text-[var(--muted)]">
                                  {bed.bedType.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </section>
                ))
              )}

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[11px] font-semibold text-[var(--muted)]">
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META.AVAILABLE.dot}`} />
                  Available — click to admit
                </span>
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META.OCCUPIED.dot}`} />
                  Occupied — click to view IPD profile
                </span>
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META.UNUSED.dot}`} />
                  Unused
                </span>
              </div>
            </div>
          )}
        </div>

        {notice && (
          <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-[var(--primary-dark)] px-4 py-2.5 text-xs font-bold text-white shadow-lg">
            {notice}
          </div>
        )}
      </div>
    </div>
  );
}
