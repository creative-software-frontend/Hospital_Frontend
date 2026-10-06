// app/admins/account-security/page.tsx
// Self-service account security for every staff role:
//   * change password (also the destination when a password has expired)
//   * two-factor enrollment / recovery codes / disable
//   * active sessions (sign-in devices) and remote sign-out
//   * recent sign-in history
//
// Deliberately a standalone route rather than a dashboard view: an expired
// password blocks every other API call, so this page must work without the
// dashboard shell.

"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiCopy,
  FiLogOut,
  FiShield,
  FiSmartphone,
} from "react-icons/fi";
import {
  authApi,
  errorMessage,
  type LoginAttemptRow,
  type PasswordPolicy,
  type TwoFactorStatus,
  type UserSessionRow,
} from "@/app/lib/api";
import { authStorage } from "@/app/lib/auth";
import { useLocalization } from "@/app/hooks/useCurrency";

const INPUT_CLS =
  "w-full px-4 py-3 rounded-lg bg-white text-black placeholder:text-black/40";

function Card({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-5 sm:p-6 text-white space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-white">{title}</h3>
          <p className="text-white/60 text-xs leading-relaxed">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function AccountSecurityInner() {
  const router = useRouter();
  const params = useSearchParams();
  const forced = params.get("mustChangePassword") === "1";
  const { formatDateTime } = useLocalization();

  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [sessions, setSessions] = useState<UserSessionRow[]>([]);
  const [attempts, setAttempts] = useState<LoginAttemptRow[]>([]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      // Sign-in history is deliberately outside this batch: it is not on the
      // forced-change allow-list, so awaiting it here would blank the whole page.
      const [p, s, sess] = await Promise.all([
        authApi.passwordPolicy(),
        authApi.twoFactorStatus(),
        authApi.sessions(),
      ]);
      setPolicy(p);
      setStatus(s);
      setSessions(sess);
    } catch (err) {
      setError(errorMessage(err));
      return;
    }

    if (forced) {
      setAttempts([]);
      return;
    }

    try {
      setAttempts(await authApi.loginAttempts());
    } catch {
      /* history is supplementary; never let it break the page */
      setAttempts([]);
    }
  }, [forced]);

  useEffect(() => {
    void load();
  }, [load]);

  // Changing the password revokes every session, including this one, so the
  // client has to drop its cached identity and ask the user to sign in again.
  const endSession = useCallback(
    (message: string) => {
      authStorage.clearSession();
      try {
        sessionStorage.setItem("accountSecurityNotice", message);
      } catch {
        /* ignore storage failures */
      }
      router.replace("/admins/login");
    },
    [router]
  );

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const localChecks = useCallback(() => {
    const issues: string[] = [];
    if (newPassword !== confirmPassword) issues.push("The two new passwords do not match.");
    if (policy) {
      if (newPassword && newPassword.length < policy.minLength) {
        issues.push(`Password must be at least ${policy.minLength} characters.`);
      }
      if (policy.requireUppercase && newPassword && !/[A-Z]/.test(newPassword)) {
        issues.push("Add at least one uppercase letter.");
      }
      if (policy.requireLowercase && newPassword && !/[a-z]/.test(newPassword)) {
        issues.push("Add at least one lowercase letter.");
      }
      if (policy.requireNumber && newPassword && !/[0-9]/.test(newPassword)) {
        issues.push("Add at least one number.");
      }
      if (policy.requireSymbol && newPassword && !/[^A-Za-z0-9]/.test(newPassword)) {
        issues.push("Add at least one special character.");
      }
    }
    return issues;
  }, [newPassword, confirmPassword, policy]);

  const checklist = useCallback(() => {
    if (!policy || !newPassword) return [];
    return [
      { ok: newPassword.length >= policy.minLength, label: `At least ${policy.minLength} characters` },
      { ok: !policy.requireUppercase || /[A-Z]/.test(newPassword), label: "An uppercase letter" },
      { ok: !policy.requireLowercase || /[a-z]/.test(newPassword), label: "A lowercase letter" },
      { ok: !policy.requireNumber || /[0-9]/.test(newPassword), label: "A number" },
      { ok: !policy.requireSymbol || /[^A-Za-z0-9]/.test(newPassword), label: "A special character" },
    ];
  }, [newPassword, policy]);

  const submitPassword = () =>
    run("password", async () => {
      const issues = localChecks();
      if (issues.length > 0) throw new Error(issues.join(" "));
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      endSession(
        forced
          ? "Password updated. Sign in again to continue."
          : "Password changed. Every signed-in device was signed out, including this one."
      );
    });

  const startSetup = () =>
    run("setup", async () => {
      const preview = await authApi.twoFactorSetup();
      setSetupSecret(preview.secret);
      setOtpauthUrl(preview.otpauthUrl);
      setRecoveryCodes(null);
    });

  const confirmSetup = () =>
    run("confirm", async () => {
      const result = await authApi.twoFactorConfirm(confirmCode);
      setRecoveryCodes(result.recoveryCodes);
      setConfirmCode("");
      setSetupSecret(null);
      setOtpauthUrl(null);
      setNotice("Two-factor authentication is now active on your account.");
      await load();
    });

  const disable2fa = () =>
    run("disable", async () => {
      await authApi.twoFactorDisable(disablePassword, disableCode || undefined);
      setDisablePassword("");
      setDisableCode("");
      setNotice("Two-factor authentication disabled.");
      await load();
    });

  const regenerate = () =>
    run("regen", async () => {
      const result = await authApi.regenerateRecoveryCodes();
      setRecoveryCodes(result.recoveryCodes);
      setNotice("New recovery codes generated.");
    });

  const revokeAll = () =>
    run("revoke-all", async () => {
      await authApi.revokeSessions();
      endSession("All devices were signed out. Sign in again to continue.");
    });

  return (
    <div
      className="min-h-screen px-4 sm:px-6 py-6 sm:py-10 relative"
      style={{
        backgroundImage: "url('/images/hospitalbgimg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black/70" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-3xl mx-auto space-y-5"
      >
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-5 text-white">
          <h1 className="text-xl font-bold">Account Security</h1>
          <p className="text-white/60 text-xs mt-1 leading-relaxed">
            Password, two-factor authentication and signed-in devices for your own account.
          </p>
          {!forced && (
            <button
              type="button"
              onClick={() => {
                const role = authStorage.getRole();
                router.push(role ? `/dashboard/${role}` : "/admins/login");
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white hover:underline"
            >
              <FiLogOut className="w-3.5 h-3.5" /> Back to dashboard
            </button>
          )}
        </div>

        {forced && (
          <p className="flex items-start gap-2 text-sm text-amber-100 bg-amber-500/20 border border-amber-300/40 rounded-lg px-3 py-2">
            <FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Your password has expired or was reset by an administrator. Set a new password to
              continue using the system.
            </span>
          </p>
        )}

        {error && (
          <p className="text-sm text-red-100 bg-red-500/25 border border-red-300/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {notice && (
          <p className="flex items-start gap-2 text-sm text-emerald-100 bg-emerald-500/20 border border-emerald-300/40 rounded-lg px-3 py-2">
            <FiCheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </p>
        )}

        <Card
          title="Change Password"
          subtitle={
            policy
              ? `At least ${policy.minLength} characters${
                  policy.historyCount > 0
                    ? `, and your last ${policy.historyCount} password${policy.historyCount === 1 ? "" : "s"} cannot be reused`
                    : ""
                }.`
              : "Loading policy…"
          }
          icon={<FiShield className="w-4 h-4" />}
        >
          <div className="space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              autoComplete="current-password"
              className={INPUT_CLS}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              className={INPUT_CLS}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className={INPUT_CLS}
            />

            {newPassword && (
              <ul className="text-xs space-y-1">
                {checklist().map((c) => (
                  <li
                    key={c.label}
                    className={c.ok ? "text-emerald-300" : "text-white/50"}
                  >
                    {c.ok ? "✓" : "○"} {c.label}
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={submitPassword}
              disabled={busy === "password" || !currentPassword || !newPassword}
              className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--primary)" }}
            >
              {busy === "password" ? "Saving…" : "Change Password"}
            </button>
          </div>
        </Card>

        <Card
          title="Two-Factor Authentication"
          subtitle={
            status?.globallyEnabled
              ? "Required at sign-in for accounts that have enrolled."
              : "Not currently required by hospital policy, but you can still protect your account."
          }
          icon={<FiSmartphone className="w-4 h-4" />}
        >
          {status?.enrolled ? (
            <div className="space-y-3 text-sm text-white/80">
              <p className="text-emerald-300">Active — {status.recoveryCodesRemaining} recovery code(s) left.</p>
              <button
                type="button"
                onClick={regenerate}
                disabled={busy === "regen"}
                className="w-full py-2.5 rounded-lg font-semibold bg-white/10 border border-white/20 hover:bg-white/20 text-white text-xs disabled:opacity-50"
              >
                {busy === "regen" ? "Generating…" : "Generate new recovery codes"}
              </button>
              <div className="border-t border-white/15 pt-3 space-y-2">
                <p className="text-xs text-white/60">Disable two-factor (requires your password):</p>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Current password"
                  className={INPUT_CLS}
                />
                <input
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="Current 6-digit code"
                  className={INPUT_CLS}
                />
                <button
                  type="button"
                  onClick={disable2fa}
                  disabled={busy === "disable" || !disablePassword}
                  className="w-full py-2.5 rounded-lg font-semibold bg-red-500/80 hover:bg-red-500 text-white text-xs disabled:opacity-50"
                >
                  {busy === "disable" ? "Disabling…" : "Disable two-factor"}
                </button>
              </div>
            </div>
          ) : setupSecret ? (
            <div className="space-y-3">
              <p className="text-sm text-white/80">
                Add this secret to your authenticator app (Google Authenticator, Authy, 1Password),
                then enter the 6-digit code it shows.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-black/40 font-mono text-xs tracking-widest break-all">
                  {setupSecret}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(setupSecret)}
                  className="p-2.5 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20"
                  title="Copy secret"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
              {otpauthUrl && (
                <p className="text-[10px] text-white/50 break-all">
                  Manual entry URI: {otpauthUrl}
                </p>
              )}
              <input
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="6-digit code"
                className={INPUT_CLS}
              />
              <button
                type="button"
                onClick={confirmSetup}
                disabled={busy === "confirm" || confirmCode.length !== 6}
                className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {busy === "confirm" ? "Verifying…" : "Activate two-factor"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startSetup}
              disabled={busy === "setup"}
              className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {busy === "setup" ? "Preparing…" : "Set up two-factor authentication"}
            </button>
          )}

          {recoveryCodes && (
            <div className="mt-4 rounded-xl bg-black/40 border border-white/20 p-4 space-y-2">
              <p className="text-xs font-bold text-amber-200">
                Save these recovery codes now — they are shown only once.
              </p>
              <ul className="grid grid-cols-2 gap-1.5 font-mono text-xs text-white/90">
                {recoveryCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard?.writeText(recoveryCodes.join("\n"))
                }
                className="text-xs text-white/70 hover:text-white hover:underline"
              >
                Copy all codes
              </button>
            </div>
          )}
        </Card>

        <Card
          title="Signed-In Devices"
          subtitle="Each session is enforced server-side. Sign out anything you do not recognise."
          icon={<FiSmartphone className="w-4 h-4" />}
        >
          {sessions.length === 0 ? (
            <p className="text-sm text-white/60">No active sessions found.</p>
          ) : (
            <ul className="space-y-2 text-xs text-white/70">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-lg bg-white/5 border border-white/15 px-3 py-2">
                  <p className="text-white/90 font-semibold">{s.ipAddress ?? "unknown IP"}</p>
                  <p className="break-all">{s.userAgent ?? "Unknown device"}</p>
                  <p className="mt-0.5">
                    Started {formatDateTime(s.createdAt)} · Last active {formatDateTime(s.lastSeenAt)} · Expires{" "}
                    {formatDateTime(s.expiresAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {sessions.length > 1 && (
            <button
              type="button"
              onClick={revokeAll}
              disabled={busy === "revoke-all"}
              className="w-full py-2.5 rounded-lg font-semibold bg-white/10 border border-white/20 hover:bg-white/20 text-white text-xs disabled:opacity-50"
            >
              {busy === "revoke-all" ? "Signing out…" : "Sign out all other devices"}
            </button>
          )}
        </Card>

        <Card
          title="Recent Sign-In Activity"
          subtitle="Every attempt against your account, successful or not."
          icon={<FiLogOut className="w-4 h-4" />}
        >
          {attempts.length === 0 ? (
            <p className="text-sm text-white/60">No recorded attempts.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {attempts.slice(0, 12).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/5 border border-white/15 px-3 py-2"
                >
                  <span className={a.success ? "text-emerald-300" : "text-red-300"}>
                    {a.success ? "Success" : "Failed"} · {a.reason}
                  </span>
                  <span className="text-white/50">
                    {a.ipAddress ?? "—"} · {formatDateTime(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

// useSearchParams() opts the route out of static prerendering, so the shell is
// rendered on the server and the page itself streams in behind a boundary.
export default function AccountSecurityPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white/70 text-sm">
          Loading account security…
        </div>
      }
    >
      <AccountSecurityInner />
    </Suspense>
  );
}