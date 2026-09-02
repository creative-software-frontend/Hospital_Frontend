// app/dashboard/settings/users/RolePermissionsModal.tsx
// Read-only view of every permission granted to a role, grouped by module.

"use client";

import { FiX, FiShield } from "react-icons/fi";
import type { RoleRecord } from "@/app/lib/api";

export function RolePermissionsModal({
  role,
  onClose,
}: {
  role: RoleRecord;
  onClose: () => void;
}) {
  const grouped = role.rolePermissions.reduce<
    Record<string, { action: string; description: string | null }[]>
  >((acc, rp) => {
    const m = rp.permission.module;
    if (!acc[m]) acc[m] = [];
    acc[m].push({
      action: rp.permission.action,
      description: rp.permission.description,
    });
    return acc;
  }, {});

  const modules = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 animate-[scaleIn_0.25s_ease-out] news-scroll"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors"
          aria-label="Close"
        >
          <FiX className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--primary-soft)]/30 text-[var(--primary-dark)]">
            <FiShield className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
              Role Permissions
            </span>
            <h3 className="font-black text-xl text-[var(--primary-dark)]">{role.name}</h3>
          </div>
        </div>

        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">
          {role.description ?? "No description."} · {role.rolePermissions.length} permission(s)
        </p>

        <div className="mt-5 space-y-4">
          {modules.map(([module, actions]) => (
            <div
              key={module}
              className="bg-[var(--bg)] border border-[var(--border)] rounded-xl overflow-hidden"
            >
              <div className="px-4 py-2.5 bg-[var(--primary-soft)]/20 border-b border-[var(--border)] text-xs font-extrabold uppercase tracking-wider text-[var(--primary-dark)]">
                {module}
              </div>
              <ul className="divide-y divide-[var(--border)]/60">
                {actions
                  .slice()
                  .sort((a, b) => a.action.localeCompare(b.action))
                  .map((p) => (
                    <li
                      key={`${module}.${p.action}`}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <span className="px-1.5 py-0.5 rounded-md bg-[var(--card)] border border-[var(--border)] text-[10px] font-black uppercase text-[var(--primary-dark)]">
                        {p.action}
                      </span>
                      <span className="text-xs text-[var(--text)]">
                        {p.description ?? p.action}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}