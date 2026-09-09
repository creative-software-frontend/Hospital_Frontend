// app/dashboard/settings/notification/NotificationSettingsView.tsx
// Live "Notification" page backed by GET/PATCH /api/settings/notification.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCcw, FiSave } from "react-icons/fi";
import {
  settingsApi,
  type NotificationSetting,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

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
    >
      <span
        className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all ${checked ? "left-5" : "left-0.5"}`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--muted)]">{label}</span>
        <Toggle checked={checked} onChange={onChange} />
      </div>
    </div>
  );
}

export function NotificationSettingsView() {
  const [data, setData] = useState<NotificationSetting | null>(null);
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
      const result = await settingsApi.notification.get();
      setData(result.notificationSetting);
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

  const patch = (partial: Partial<NotificationSetting>) => {
    setData((prev) => (prev ? { ...prev, ...partial } : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      await settingsApi.notification.update({
        smsEnabled: data.smsEnabled,
        emailEnabled: data.emailEnabled,
        whatsappEnabled: data.whatsappEnabled,
        appointmentNotification: data.appointmentNotification,
        billingNotification: data.billingNotification,
        labNotification: data.labNotification,
        followupNotification: data.followupNotification,
        paymentNotification: data.paymentNotification,
        status: data.status,
      });
      setDirty(false);
      notify("success", "Notification settings saved.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Notification</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: SMS, email and WhatsApp channels plus event notification triggers.
        </p>
      </div>

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Delivery Channels</h4>
            <p className="text-xs text-[var(--muted)]">
              {loading ? "Loading…" : "Applies to this branch"}
            </p>
          </div>
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
          <div className="space-y-4">
            <div>
              <h5 className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)] mb-2">
                Channels
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ToggleRow label="SMS" checked={data.smsEnabled} onChange={(v) => patch({ smsEnabled: v })} />
                <ToggleRow label="Email" checked={data.emailEnabled} onChange={(v) => patch({ emailEnabled: v })} />
                <ToggleRow label="WhatsApp" checked={data.whatsappEnabled} onChange={(v) => patch({ whatsappEnabled: v })} />
              </div>
            </div>
            <div>
              <h5 className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)] mb-2">
                Event Triggers
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ToggleRow
                  label="Appointment Reminder"
                  checked={data.appointmentNotification}
                  onChange={(v) => patch({ appointmentNotification: v })}
                />
                <ToggleRow
                  label="Billing Notification"
                  checked={data.billingNotification}
                  onChange={(v) => patch({ billingNotification: v })}
                />
                <ToggleRow
                  label="Lab Result"
                  checked={data.labNotification}
                  onChange={(v) => patch({ labNotification: v })}
                />
                <ToggleRow
                  label="Follow-up Reminder"
                  checked={data.followupNotification}
                  onChange={(v) => patch({ followupNotification: v })}
                />
                <ToggleRow
                  label="Payment Received"
                  checked={data.paymentNotification}
                  onChange={(v) => patch({ paymentNotification: v })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}