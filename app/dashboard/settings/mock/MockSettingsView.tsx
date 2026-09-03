// app/dashboard/settings/mock/MockSettingsView.tsx
// Polished, structured mock views for settings pages that have no live backend yet.
// Content comes from the static settingsData registry; toggles are local-only demo state.

"use client";

import { useMemo, useState } from "react";
import type { SettingsPageData } from "@/app/data/settingsData";
import { FiCheckCircle } from "react-icons/fi";

const ON_OFF = new Set([
  "enabled",
  "disabled",
  "yes",
  "no",
  "required",
  "on",
  "off",
]);

function normalize(v: string): string {
  return v.trim().toLowerCase();
}

function isToggleValue(v: string): boolean {
  return ON_OFF.has(normalize(v));
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5.5 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-slate-300"}`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all ${checked ? "left-5" : "left-0.5"}`}
      />
    </button>
  );
}

function StatusPill({ value }: { value: string }) {
  const v = normalize(value);
  const on = v === "enabled" || v === "yes" || v === "on" || v === "required";
  const neutral = v === "connected" || v === "active" || v === "healthy" || v === "optimal";
  const off = v === "disabled" || v === "no" || v === "off" || v === "pending";

  let cls = "bg-slate-100 text-slate-500 border-slate-200";
  if (on) cls = "bg-emerald-50 text-emerald-600 border-emerald-200";
  else if (neutral) cls = "bg-sky-50 text-sky-600 border-sky-200";
  else if (off) cls = "bg-amber-50 text-amber-600 border-amber-200";

  return (
    <span
      className={`inline-block text-[10px] font-bold capitalize px-2 py-0.5 rounded-md border ${cls}`}
    >
      {value}
    </span>
  );
}

export function MockSettingsView({ page }: { page: SettingsPageData }) {
  // Local-only toggle state keyed by "label" so toggles are interactive within the demo.
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  const toggleState = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const block of page.blocks) {
      if (block.type === "fields") {
        for (const item of block.values) {
          if (isToggleValue(item.value)) {
            map[item.label] = normalize(item.value) === "enabled" || normalize(item.value) === "yes" || normalize(item.value) === "on" || normalize(item.value) === "required";
          }
        }
      }
    }
    return map;
  }, [page.blocks]);

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{page.title}</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">{page.description}</p>
      </div>

      {page.blocks.map((block, idx) => (
        <div
          key={idx}
          className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4"
        >
          {block.type === "table" && (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="min-w-[640px] w-full">
                <thead>
                  <tr className="bg-[var(--bg)]">
                    {block.columns.map((col) => (
                      <th
                        key={col}
                        className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                      {block.columns.map((col) => {
                        const value = row[col] ?? "";
                        return (
                          <td
                            key={col}
                            className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]"
                          >
                            {isToggleValue(value) ? <StatusPill value={value} /> : value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {block.type === "fields" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {block.values.map((item, fIdx) => {
                const isToggle = isToggleValue(item.value);
                const checked =
                  toggles[item.label] !== undefined
                    ? toggles[item.label]
                    : toggleState[item.label] ?? false;
                return (
                  <div
                    key={fIdx}
                    className="flex items-center justify-between gap-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3"
                  >
                    <div>
                      <span className="block text-xs font-bold text-[var(--muted)]">{item.label}</span>
                      {!isToggle && (
                        <span className="block text-xs font-semibold text-[var(--text)] mt-0.5">
                          {item.value}
                        </span>
                      )}
                    </div>
                    {isToggle ? (
                      <Toggle
                        checked={checked}
                        onChange={(v) => setToggles((prev) => ({ ...prev, [item.label]: v }))}
                      />
                    ) : (
                      <StatusPill value={item.value} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {block.type === "list" && (
            <ul className="space-y-2">
              {block.items.map((item, lIdx) => (
                <li
                  key={lIdx}
                  className="flex items-start gap-2.5 text-[13px] text-[var(--text)]"
                >
                  <FiCheckCircle className="mt-0.5 w-4 h-4 text-[var(--primary)] shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div className="text-[10px] text-[var(--muted)] pt-1">
        Demonstration view with mock data — no backend connected.
      </div>
    </div>
  );
}
