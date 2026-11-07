// app/nurses/NursePicker.tsx
// Shared debounced nurse search dropdown used by the nursing round pages
// (Patient Monitoring vitals log, Medication Tracking dose log).

"use client";

import { useEffect, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { nurseApi, type NurseRecord } from "@/app/lib/api";

export function NursePicker({
  selected,
  onPick,
}: {
  selected: NurseRecord | null;
  onPick: (nurse: NurseRecord | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NurseRecord[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = search.trim();
    let active = true;
    const timer = setTimeout(() => {
      if (!term) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      nurseApi
        .list({ search: term, limit: 8 })
        .then((result) => {
          if (active) setResults(result.data);
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <div className="relative">
      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]" />
      <input
        value={selected ? `${selected.name} (${selected.nurseCode})` : search}
        onChange={(e) => {
          onPick(null);
          setSearch(e.target.value);
        }}
        placeholder="Search nurse by name or ID"
        aria-label="Recording nurse"
        className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold outline-none focus:border-[var(--primary)]"
      />
      {!selected && search.trim() && (
        <div className="absolute z-20 top-full mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
          {searching ? (
            <div className="px-3 py-3 text-center text-[11px] text-[var(--muted)]">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-center text-[11px] text-[var(--muted)]">No nurses match.</div>
          ) : (
            results.map((nurse) => (
              <button
                key={nurse.id}
                type="button"
                onClick={() => {
                  onPick(nurse);
                  setSearch("");
                  setResults([]);
                }}
                className="block w-full text-left px-3 py-2 text-xs hover:bg-[var(--primary-soft)]/20 cursor-pointer"
              >
                <span className="font-bold">{nurse.name}</span>
                <span className="text-[var(--muted)]"> · {nurse.nurseCode}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
