// app/dashboard/settings/users/UserFormModal.tsx
// Create / edit a user against POST|PATCH /api/users.
// Mounted conditionally (key = user id or "new") so each open starts fresh.

"use client";

import { useState } from "react";
import { FiX } from "react-icons/fi";
import type { CreateUserInput, RoleRecord, UserRecord } from "@/app/lib/api";

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

export function UserFormModal({
  user,
  roles,
  saving,
  onSubmit,
  onClose,
}: {
  user: UserRecord | null;
  roles: RoleRecord[];
  saving: boolean;
  onSubmit: (input: CreateUserInput) => Promise<void>;
  onClose: () => void;
}) {
  const editing = !!user;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>(
    (user?.userRoles ?? []).map((ur) => ur.role.id),
  );

  const toggleRole = (id: number) => {
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !username.trim()) {
      setError("Name, email and username are required.");
      return;
    }
    if (!editing && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (selectedRoleIds.length === 0) {
      setError("Select at least one role.");
      return;
    }
    try {
      const base = {
        name: name.trim(),
        email: email.trim(),
        username: username.trim(),
        phone: phone.trim() || null,
        roleIds: selectedRoleIds,
      };
      await onSubmit(editing ? { ...base, password: "" } : { ...base, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      onClick={() => !saving && onClose()}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />

      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 animate-[scaleIn_0.25s_ease-out] news-scroll"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <FiX className="w-4 h-4" />
        </button>

        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          User & Role Management
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">
          {editing ? "Edit User" : "Add New User"}
        </h3>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                Full Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jahid Hasan"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                Username *
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. jahid.hasan"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@hospital.com"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className={INPUT_CLS}
              />
            </div>
            {!editing && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                  Temporary Password *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className={INPUT_CLS}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
              Roles *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {roles.map((role) => {
                const checked = selectedRoleIds.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRole(role.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      checked
                        ? "bg-[var(--primary-soft)]/35 border-[var(--primary)] text-[var(--primary-dark)]"
                        : "bg-[var(--bg)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)]/50"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        checked
                          ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                          : "border-[var(--muted)]/50"
                      }`}
                    >
                      {checked && (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5">
                          <path
                            fillRule="evenodd"
                            d="M16.704 5.29a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06L8.6 11.19l6.94-6.94a.75.75 0 011.06 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </span>
                    {role.name}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
              style={{ background: "var(--primary)" }}
            >
              {saving ? "Saving..." : editing ? "Save Changes" : "Create User"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-3 rounded-xl text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}