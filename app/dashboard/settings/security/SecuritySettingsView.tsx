// app/dashboard/settings/security/SecuritySettingsView.tsx
// Live "Security" page backed by GET/PATCH /api/settings/security.
//
// Every control on this page is enforced by the backend. Where a setting can
// lock operators out, the page warns and the API refuses the change.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiAlertTriangle, FiRefreshCcw, FiSave, FiShield } from "react-icons/fi";
import {
  settingsApi,
  type SecuritySetting,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

const CHECK_CLS =
  "h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)] cursor-pointer";

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5.5 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-emerald-500" : "bg-slate-300"}`}
    >
      <span
        className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all ${checked ? "left-5" : "left-0.5"}`}
      />
    </button>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
      <div>
        <h4 className="text-sm font-extrabold text-[var(--text)]">{title}</h4>
        <p className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5">
      <label className="block text-xs font-bold text-[var(--muted)]">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
        }}
        className={INPUT_CLS}
      />
      {hint && <p className="text-[10px] text-[var(--muted)] leading-snug">{hint}</p>}
    </div>
  );
}

export function SecuritySettingsView() {
  const [data, setData] = useState<SecuritySetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [dirty, setDirty] = useState(false);
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
      const result = await settingsApi.security.get();
      setData(result.security);
      setDirty(false);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const patch = (partial: Partial<SecuritySetting>) => {
    setData((prev) => (prev ? { ...prev, ...partial } : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      await settingsApi.security.update({
        passwordMinLength: data.passwordMinLength,
        passwordExpiryDays: data.passwordExpiryDays,
        maxLoginAttempts: data.maxLoginAttempts,
        sessionTimeout: data.sessionTimeout,
        twoFactorEnabled: data.twoFactorEnabled,
        ipRestrictionEnabled: data.ipRestrictionEnabled,
        deviceRestrictionEnabled: data.deviceRestrictionEnabled,
        auditLogEnabled: data.auditLogEnabled,
        passwordRequireUppercase: data.passwordRequireUppercase,
        passwordRequireLowercase: data.passwordRequireLowercase,
        passwordRequireNumber: data.passwordRequireNumber,
        passwordRequireSymbol: data.passwordRequireSymbol,
        passwordHistoryCount: data.passwordHistoryCount,
        lockoutDurationMinutes: data.lockoutDurationMinutes,
        maxConcurrentSessions: data.maxConcurrentSessions,
        allowedIpRanges: data.allowedIpRanges ?? "",
      });
      setDirty(false);
      notify("success", "Security settings saved and applied immediately.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const ranges = data?.allowedIpRanges?.trim() ?? "";
  const rangeCount = ranges ? ranges.split(/[,\s]+/).filter(Boolean).length : 0;

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Security</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Every control below is enforced by the backend on the next sign-in or request. Settings are
          global and apply to all branches.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted)]">
          {loading ? "Loading…" : "Applies to all branches"}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="p-2.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            title="Refresh"
          >
            <FiRefreshCcw className="w-4 h-4" />
          </button>
          <button
            onClick={save}
            disabled={loading || !dirty || saving || !data}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            style={{ background: "var(--primary)" }}
          >
            <FiSave className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading || !data ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
        </div>
      ) : (
        <>
          <Section
            title="Password Policy"
            subtitle="Applied when a password is created, changed, or reset by an administrator."
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumberField
                label="Minimum Length"
                hint="Characters required in every new password."
                value={data.passwordMinLength}
                min={4}
                max={64}
                onChange={(n) => patch({ passwordMinLength: n })}
              />
              <NumberField
                label="Expiry (days)"
                hint="0 disables expiry. When reached, the user must set a new password before continuing."
                value={data.passwordExpiryDays}
                min={0}
                max={3650}
                onChange={(n) => patch({ passwordExpiryDays: n })}
              />
              <NumberField
                label="Reuse History"
                hint="How many previous passwords a user may not reuse. 0 allows reuse."
                value={data.passwordHistoryCount}
                min={0}
                max={24}
                onChange={(n) => patch({ passwordHistoryCount: n })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  ["passwordRequireLowercase", "Require a lowercase letter"],
                  ["passwordRequireUppercase", "Require an uppercase letter"],
                  ["passwordRequireNumber", "Require a number"],
                  ["passwordRequireSymbol", "Require a special character"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--muted)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className={CHECK_CLS}
                    checked={data[key]}
                    onChange={(e) => patch({ [key]: e.target.checked } as Partial<SecuritySetting>)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </Section>

          <Section
            title="Login Protection"
            subtitle="Every attempt is recorded with its IP and device. Failures lock the account for the configured window."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField
                label="Maximum Login Attempts"
                hint="Failed attempts tolerated before the account locks."
                value={data.maxLoginAttempts}
                min={1}
                max={50}
                onChange={(n) => patch({ maxLoginAttempts: n })}
              />
              <NumberField
                label="Lockout Duration (minutes)"
                hint="How long a locked account stays locked before it can retry."
                value={data.lockoutDurationMinutes}
                min={1}
                max={1440}
                onChange={(n) => patch({ lockoutDurationMinutes: n })}
              />
            </div>
          </Section>

          <Section
            title="Session & Devices"
            subtitle="Sessions are tracked server-side, so a timeout, a logout or a device cap revokes access immediately instead of waiting for the token to expire."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField
                label="Session Timeout (minutes)"
                hint="A session is refused after this long, even if its token has not expired."
                value={data.sessionTimeout}
                min={1}
                max={1440}
                onChange={(n) => patch({ sessionTimeout: n })}
              />
              <NumberField
                label="Maximum Concurrent Sessions"
                hint="Only used while device restriction is enabled."
                value={data.maxConcurrentSessions}
                min={1}
                max={50}
                onChange={(n) => patch({ maxConcurrentSessions: n })}
              />
            </div>

            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[var(--text)]">Device Restriction</span>
                <p className="text-[10px] text-[var(--muted)] mt-0.5">
                  Refuse a sign-in once the account already has the maximum number of active sessions.
                </p>
              </div>
              <Toggle
                label="Device Restriction"
                checked={data.deviceRestrictionEnabled}
                onChange={(v) => patch({ deviceRestrictionEnabled: v })}
              />
            </div>
          </Section>

          <Section
            title="Two-Factor Authentication"
            subtitle="When required, each user enrolls their own authenticator app from their account security panel. Enabling this only activates the requirement for enrolled users."
          >
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[var(--text)]">Require Two-Factor</span>
                <p className="text-[10px] text-[var(--muted)] mt-0.5">
                  Enforced at the next sign-in for accounts that have completed enrollment.
                </p>
              </div>
              <Toggle
                label="Require Two-Factor"
                checked={data.twoFactorEnabled}
                onChange={(v) => patch({ twoFactorEnabled: v })}
              />
            </div>
          </Section>

          <Section
            title="IP Restriction"
            subtitle="Only the listed addresses or CIDR ranges may sign in. If the list is empty the restriction blocks everyone, so add ranges before turning it on."
          >
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[var(--text)]">Enable IP Restriction</span>
                <p className="text-[10px] text-[var(--muted)] mt-0.5">
                  {rangeCount === 0
                    ? "No ranges configured — enabling this would block every sign-in."
                    : `${rangeCount} range${rangeCount === 1 ? "" : "s"} configured.`}
                </p>
              </div>
              <Toggle
                label="Enable IP Restriction"
                checked={data.ipRestrictionEnabled}
                disabled={data.ipRestrictionEnabled && rangeCount === 0}
                onChange={(v) => patch({ ipRestrictionEnabled: v })}
              />
            </div>

            {data.ipRestrictionEnabled && rangeCount === 0 && (
              <p className="flex items-start gap-2 text-xs text-amber-200 bg-amber-500/15 border border-amber-400/40 rounded-lg px-3 py-2">
                <FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  This setting is on with no allow-list, so nobody can sign in. Add at least one range
                  below and save.
                </span>
              </p>
            )}

            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1.5">
              <label className="block text-xs font-bold text-[var(--muted)]">Allowed IP Ranges (CIDR)</label>
              <textarea
                rows={3}
                value={data.allowedIpRanges ?? ""}
                placeholder="10.0.0.0/8, 192.168.1.0/24, 127.0.0.1"
                onChange={(e) => patch({ allowedIpRanges: e.target.value })}
                className={`${INPUT_CLS} font-mono`}
              />
              <p className="text-[10px] text-[var(--muted)]">
                Comma or whitespace separated. Invalid ranges are rejected when you save. The list is
                never written to the audit log.
              </p>
            </div>
          </Section>

          <Section
            title="Audit Logging"
            subtitle="Records who changed what, from which IP. Sign-ins, lockouts, password changes and security-setting edits are always recorded so they cannot be erased by turning this off."
          >
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-start gap-2.5">
                <FiShield className="w-4 h-4 text-[var(--muted)] mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-[var(--text)]">Enable Audit Logging</span>
                  <p className="text-[10px] text-[var(--muted)] mt-0.5">
                    Required for compliance reviews. Disabling only suppresses routine record changes.
                  </p>
                </div>
              </div>
              <Toggle
                label="Enable Audit Logging"
                checked={data.auditLogEnabled}
                onChange={(v) => patch({ auditLogEnabled: v })}
              />
            </div>
          </Section>
        </>
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}