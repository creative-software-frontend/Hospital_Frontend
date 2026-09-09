// app/dashboard/settings/localization/LocalizationView.tsx
// Live "Localization" page backed by GET / PATCH /api/settings/localization.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FiRefreshCcw, FiSave, FiGlobe } from "react-icons/fi";
import {
  settingsApi,
  type LocalizationSetting,
  type UpdateLocalizationInput,
  LOCALIZATION_LANGUAGES,
  LOCALIZATION_CURRENCIES,
  LOCALIZATION_DATE_FORMATS,
  LOCALIZATION_TIMEZONES,
  LOCALIZATION_WEEK_DAYS,
  errorMessage,
} from "@/app/lib/api";
import { ToastViewport, type ToastItem, type ToastKind } from "@/app/patients/Toast";

const INPUT_CLS =
  "w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 text-[var(--text)]";

const FIELD_LABEL =
  "block text-xs font-semibold text-[var(--muted)] mb-1";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={FIELD_LABEL}>{label}</label>
      {children}
    </div>
  );
}

export function LocalizationView() {
  const [data, setData] = useState<LocalizationSetting | null>(null);
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
      const { localization } = await settingsApi.localization.get();
      setData(localization);
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

  const patch = (partial: UpdateLocalizationInput) => {
    setData((prev) => (prev ? { ...prev, ...partial } : prev));
    setDirty(true);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      await settingsApi.localization.update({
        language: data.language,
        currency: data.currency,
        currencySymbol: data.currencySymbol,
        dateFormat: data.dateFormat,
        timeFormat: data.timeFormat,
        timezone: data.timezone,
        numberFormat: data.numberFormat,
        weekStartDay: data.weekStartDay,
      });
      setDirty(false);
      notify("success", "Localization settings saved.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const symbolFor = (code: string) =>
    LOCALIZATION_CURRENCIES.find((c) => c.code === code)?.symbol ?? "";

  const handleCurrency = (code: string) => {
    patch({ currency: code, currencySymbol: symbolFor(code) || data?.currencySymbol || "" });
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
          Settings Module
        </span>
        <h3 className="font-black text-xl text-[var(--primary-dark)] mt-0.5">Localization</h3>
        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed max-w-3xl">
          Live from the backend: language, currency, date/time formats, timezone and regional
          defaults used across the system.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="card p-5 rounded-2xl border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-[var(--text)]">Regional Settings</h4>
            <p className="text-xs text-[var(--muted)]">
              {data
                ? `${data.language} · ${data.currency} (${data.currencySymbol}) · ${data.timezone}`
                : "Loading…"}
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

        {loading || !data ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Primary Language">
              <div className="relative">
                <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] w-3.5 h-3.5" />
                <select
                  value={data.language}
                  onChange={(e) => patch({ language: e.target.value })}
                  className={`${INPUT_CLS} pl-9`}
                >
                  {LOCALIZATION_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
            </Field>

            <Field label="Currency">
              <select
                value={data.currency}
                onChange={(e) => handleCurrency(e.target.value)}
                className={INPUT_CLS}
              >
                {LOCALIZATION_CURRENCIES.map((cur) => (
                  <option key={cur.code} value={cur.code}>
                    {cur.label} ({cur.code})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Currency Symbol">
              <input
                value={data.currencySymbol}
                onChange={(e) => patch({ currencySymbol: e.target.value })}
                className={INPUT_CLS}
                placeholder="e.g. ৳"
              />
            </Field>

            <Field label="Date Format">
              <select
                value={data.dateFormat}
                onChange={(e) => patch({ dateFormat: e.target.value })}
                className={INPUT_CLS}
              >
                {LOCALIZATION_DATE_FORMATS.map((format) => (
                  <option key={format} value={format}>{format}</option>
                ))}
              </select>
            </Field>

            <Field label="Time Format">
              <select
                value={data.timeFormat}
                onChange={(e) => patch({ timeFormat: e.target.value as "12h" | "24h" })}
                className={INPUT_CLS}
              >
                <option value="24h">24-hour (15:30)</option>
                <option value="12h">12-hour (03:30 PM)</option>
              </select>
            </Field>

            <Field label="Timezone">
              <select
                value={data.timezone}
                onChange={(e) => patch({ timezone: e.target.value })}
                className={INPUT_CLS}
              >
                {LOCALIZATION_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </Field>

            <Field label="Number / Locale Format">
              <input
                value={data.numberFormat ?? ""}
                onChange={(e) => patch({ numberFormat: e.target.value || null })}
                placeholder="e.g. en-US"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="Week Starts On">
              <select
                value={data.weekStartDay}
                onChange={(e) => patch({ weekStartDay: Number(e.target.value) })}
                className={INPUT_CLS}
              >
                {Object.entries(LOCALIZATION_WEEK_DAYS).map(([day, label]) => (
                  <option key={day} value={day}>{label}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}