// dashboard/settings/SettingsPageView.tsx
"use client";

import type { SettingsPageData, SettingsBlock } from "@/app/data/settingsData";

export const SettingsPageView = ({
  page,
}: {
  page: SettingsPageData;
}) => {
  return (
    <div className="space-y-4">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">{page.title}</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">{page.description}</p>
      </div>

      {page.blocks.map((block: SettingsBlock, idx: number) => (
        <div
          key={idx}
          className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4"
        >
          {block.type === "table" && (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="min-w-[640px] w-full">
                <thead>
                  <tr className="bg-[var(--bg)]">
                    {block.columns.map((col: string) => (
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
                  {block.rows.map((row: Record<string, string>, rIdx: number) => (
                    <tr key={rIdx} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                      {block.columns.map((col: string) => (
                        <td
                          key={col}
                          className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]"
                        >
                          {String(row[col] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {block.type === "fields" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {block.values.map((item, fIdx) => (
                <div
                  key={fIdx}
                  className="flex items-center justify-between gap-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3"
                >
                  <span className="text-xs font-bold text-[var(--muted)]">{item.label}</span>
                  <span className="text-xs font-semibold text-[var(--text)] text-right">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {block.type === "list" && (
            <ul className="space-y-2">
              {block.items.map((item, lIdx) => (
                <li
                  key={lIdx}
                  className="flex items-start gap-2.5 text-[13px] text-[var(--text)]"
                >
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[var(--primary)] shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div className="text-[10px] text-[var(--muted)] pt-1">
        Demonstration data – values are illustrative samples.
      </div>
    </div>
  );
};
