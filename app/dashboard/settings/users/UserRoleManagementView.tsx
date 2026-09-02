// app/dashboard/settings/users/UserRoleManagementView.tsx
// Live "User & Role Management" settings page. Reads GET /api/users (server
// pagination + search), GET /api/roles, and drives create/edit/status flows.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiRefreshCcw, FiSearch, FiEdit2, FiShield } from "react-icons/fi";
import {
  userApi,
  roleApi,
  type CreateUserInput,
  type PaginationMeta,
  type RoleRecord,
  type UserRecord,
  type UserStatus,
  errorMessage,
  formatDate,
} from "@/app/lib/api";
import { UserFormModal } from "@/app/dashboard/settings/users/UserFormModal";
import { RolePermissionsModal } from "@/app/dashboard/settings/users/RolePermissionsModal";
import { ConfirmDialog } from "@/app/patients/ConfirmDialog";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-600 border-emerald-200",
  INACTIVE: "bg-slate-100 text-slate-500 border-slate-200",
  SUSPENDED: "bg-amber-50 text-amber-600 border-amber-200",
  LOCKED: "bg-rose-50 text-rose-600 border-rose-200",
};

const NEXT_STATUS: Record<UserStatus, UserStatus> = {
  ACTIVE: "INACTIVE",
  INACTIVE: "ACTIVE",
  SUSPENDED: "ACTIVE",
  LOCKED: "ACTIVE",
};

function statusActionLabel(status: UserStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Deactivate";
    case "INACTIVE":
      return "Reactivate";
    case "SUSPENDED":
      return "Resume";
    case "LOCKED":
      return "Unlock";
  }
}

function statusConfirmMessage(user: UserRecord): string {
  const action = statusActionLabel(user.status);
  return action === "Reactivate" || action === "Resume" || action === "Unlock"
    ? `Set user "${user.name}" back to ACTIVE? They can log in again immediately.`
    : `Deactivate user "${user.name}" (${user.email})? They will no longer be able to log in.`;
}

export function UserRoleManagementView() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [roleView, setRoleView] = useState<RoleRecord | null>(null);
  const [confirmUser, setConfirmUser] = useState<UserRecord | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    try {
      const [userResult, rolesResult] = await Promise.all([
        userApi.list({
          page,
          limit: PAGE_SIZE,
          search: searchTerm || undefined,
        }),
        roleApi.list(),
      ]);
      setUsers(userResult.data);
      setPagination(userResult.pagination);
      setRoles(rolesResult.roles);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm]);

  // Deferred first load (avoids set-state-in-effect lint violation).
  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  // Debounce free-text search.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = pagination?.totalPages ?? 1;
  const safePage = Math.min(page, Math.max(1, totalPages));

  const openCreate = () => {
    setEditingUser(null);
    setFormOpen(true);
  };

  const openEdit = (user: UserRecord) => {
    setEditingUser(user);
    setFormOpen(true);
  };

  const submitUser = async (input: CreateUserInput) => {
    setSaving(true);
    try {
      if (editingUser) {
        await userApi.update(editingUser.id, input);
        notify("success", `User "${input.name}" updated.`);
      } else {
        await userApi.create(input);
        notify("success", `User "${input.name}" created.`);
      }
      setFormOpen(false);
      setEditingUser(null);
      setPage(1);
      setSearchTerm("");
      setSearchInput("");
      refreshList();
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const runStatusChange = async () => {
    if (!confirmUser) return;
    setConfirming(true);
    try {
      const next = NEXT_STATUS[confirmUser.status];
      await userApi.updateStatus(confirmUser.id, next);
      notify("success", `${confirmUser.name} is now ${next}.`);
      setConfirmUser(null);
      refreshList();
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setConfirming(false);
    }
  };

  const refreshList = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
          User & Role Management
        </h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: create users, assign roles, and control access.
        </p>
      </div>

      {/* USERS */}
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">System Users</h4>
            <p className="text-xs text-[var(--muted)]">
              {pagination ? `${pagination.total} user(s) total` : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, email, username…"
                className="pl-9 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 w-64 max-w-full"
              />
            </div>
            <button
              onClick={refreshList}
              className="p-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              title="Refresh"
            >
              <FiRefreshCcw className="w-4 h-4" />
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 active:scale-[0.98]"
              style={{ background: "var(--primary)" }}
            >
              <FiPlus className="w-3.5 h-3.5" />
              Add User
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-[900px] w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                {["Name", "Username", "Email", "Roles", "Branch", "Last Login", "Status", "Actions"].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-[var(--muted)]">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                    <td className="text-[12px] font-bold text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {u.name}
                    </td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {u.username ?? "—"}
                    </td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex flex-wrap gap-1">
                        {(u.userRoles ?? []).map((ur) => (
                          <span
                            key={ur.role.id}
                            className="text-[10px] font-bold text-[var(--primary-dark)] bg-[var(--primary-soft)]/30 border border-[var(--primary)]/20 px-1.5 py-0.5 rounded-md"
                          >
                            {ur.role.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]">
                      {u.branch?.name ?? "—"}
                    </td>
                    <td className="text-[12px] text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]">
                      {formatDate(u.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${STATUS_STYLES[u.status]}`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--primary-dark)] hover:border-[var(--primary)] transition-colors"
                          title="Edit user"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmUser(u)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${
                            u.status === "ACTIVE"
                              ? "text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100"
                              : "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                          }`}
                          title={`Change status to ${NEXT_STATUS[u.status]}`}
                        >
                          {statusActionLabel(u.status)}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-[var(--muted)]">
            Showing {users.length} of {pagination?.total ?? 0} rows
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                safePage <= 1
                  ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed"
                  : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"
              }`}
            >
              Previous
            </button>
            <span className="text-xs font-bold text-[var(--muted)]">
              Page {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                safePage >= totalPages
                  ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed"
                  : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ROLES */}
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div>
          <h4 className="text-sm font-extrabold text-[var(--text)]">Roles & Permissions</h4>
          <p className="text-xs text-[var(--muted)]">
            Click a role to view the permissions it grants.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setRoleView(role)}
              className="text-left bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/10 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[var(--primary-soft)]/30 rounded-lg text-[var(--primary-dark)] group-hover:bg-[var(--primary)] group-hover:text-white transition-all">
                  <FiShield className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-extrabold text-[var(--text)] truncate">
                    {role.name}
                  </span>
                  <span className="block text-[10px] text-[var(--muted)]">
                    {role.rolePermissions.length} permissions
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-[var(--muted)] mt-2.5 leading-relaxed line-clamp-2">
                {role.description ?? "No description"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* FORM MODAL (mounted on demand so state resets via key) */}
      {formOpen && (
        <UserFormModal
          key={editingUser?.id ?? "new"}
          user={editingUser}
          roles={roles}
          saving={saving}
          onSubmit={submitUser}
          onClose={() => {
            setFormOpen(false);
            setEditingUser(null);
          }}
        />
      )}

      {/* STATUS CONFIRM */}
      {confirmUser && (
        <ConfirmDialog
          open
          title={
            confirmUser.status === "ACTIVE" ? "Deactivate user?" : "Reactivate user?"
          }
          message={statusConfirmMessage(confirmUser)}
          confirmLabel={statusActionLabel(confirmUser.status)}
          danger={confirmUser.status === "ACTIVE"}
          loading={confirming}
          onConfirm={runStatusChange}
          onClose={() => setConfirmUser(null)}
        />
      )}

      {/* ROLE PERMISSIONS */}
      {roleView && (
        <RolePermissionsModal role={roleView} onClose={() => setRoleView(null)} />
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}