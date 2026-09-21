// app/dashboard/role-permissions/RolePermissionEditorModal.tsx
// SUPER_ADMIN-only editor: loads the live permission catalog, pre-selects the
// role's current grants, and saves the new set via
// PUT /api/roles/:id/permissions (diff-audited on the backend).

"use client";

import { useEffect, useMemo, useState } from "react";
import { FiX, FiSave, FiAlertCircle } from "react-icons/fi";
import {
  permissionApi,
  roleApi,
  type PermissionModule,
  type RoleRecord,
  errorMessage,
} from "@/app/lib/api";

export interface RolePermissionEditorModalProps {
  open: boolean;
  seederKey: string;
  roleName: string;
  onClose: () => void;
  onSaved?: (updated: RoleRecord) => void;
}

export function RolePermissionEditorModal({
  open,
  seederKey,
  roleName,
  onClose,
  onSaved,
}: RolePermissionEditorModalProps) {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [modules, setModules] = useState<PermissionModule[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      let cancelled = false;
      setLoading(true);
      setError("");
      Promise.all([roleApi.list(), permissionApi.list()])
        .then(([roleResult, permResult]) => {
          if (cancelled) return;
          setRoles(roleResult.roles);
          setModules(permResult.modules);
          const match =
            roleResult.roles.find((r) => r.seederKey === seederKey) ??
            roleResult.roles.find((r) => r.name === roleName);
          if (match) {
            setSelectedIds(match.rolePermissions.map((rp) => rp.permission.id));
          }
        })
        .catch((err) => {
          if (!cancelled) setError(`Permission catalog unavailable: ${errorMessage(err)}`);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, 0);
    return () => clearTimeout(t);
  }, [open, seederKey, roleName]);

  const role = useMemo(
    () => roles.find((r) => r.seederKey === seederKey) ?? roles.find((r) => r.name === roleName),
    [roles, seederKey, roleName],
  );

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const save = async () => {
    if (!role) return;
    setSaving(true);
    setError("");
    try {
      const result = await roleApi.updatePermissions(role.id, selectedIds);
      onSaved?.(result.role);
      onClose();
    } catch (err) {
      setError(`Could not save permissions: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="font-black text-[var(--primary-dark)]">Edit Permissions — {roleName}</h3>
            <p className="text-[10px] text-[var(--muted)] mt-0.5">
              Grant or revoke access. Changes are diff-audited to the audit log.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--bg)] text-[var(--muted)] cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading && (
            <div className="text-center py-10 text-xs font-bold text-[var(--muted)]">
              Loading permission catalog…
            </div>
          )}

          {!loading && error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-center gap-2">
              <FiAlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && modules.map((module) => (
            <details key={module.module} open={module.module === "role"} className="group border border-[var(--border)] rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg)] cursor-pointer list-none">
                <span className="text-xs font-black uppercase tracking-wider text-[var(--primary-dark)]">
                  {module.module}
                </span>
                <span className="text-[10px] font-bold text-[var(--muted)]">
                  {module.actions.filter((a) => selectedIds.includes(a.id)).length}/{module.actions.length}
                </span>
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3">
                {module.actions.map((action) => {
                  const checked = selectedIds.includes(action.id);
                  return (
                    <label
                      key={action.id}
                      className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(action.id)}
                        className="mt-0.5 accent-[var(--primary)]"
                      />
                      <span className="text-[11px] leading-tight">
                        <span className="font-black uppercase block">{action.action}</span>
                        {action.description && (
                          <span className="text-[var(--muted)] text-[10px]">{action.description}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </details>
          ))}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
          <span className="text-[10px] font-bold text-[var(--muted)]">
            {selectedIds.length} permission(s) selected for {roleName}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border bg-[var(--card)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !role}
              className="btn-primary inline-flex items-center gap-1.5 text-xs py-2 disabled:opacity-50 cursor-pointer"
            >
              <FiSave className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save Permissions"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}