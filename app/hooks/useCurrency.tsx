// app/hooks/useCurrency.tsx
// Client-side provider for the hospital-wide localization configuration
// (Settings → Localization). Loads GET /settings/localization once and shares
// it across the dashboard so every screen renders dates, times, numbers and
// currency from a single source: timezone = Asia/Dhaka renders as Asia/Dhaka,
// date format = DD/MM/YYYY renders as DD/MM/YYYY, everywhere.
//
// `useCurrency()` stays as the narrow currency-only subset for existing callers.
// `useLocalization()` exposes the full formatter set. Falls back to the BDT /
// DD-MM-YYYY / Asia/Dhaka defaults while loading or if the request fails (the
// UI never blocks on it).

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { settingsApi, errorMessage } from "@/app/lib/api";
import type { LocalizationSetting } from "@/app/lib/api";
import { fromLocalization } from "@/app/lib/currency";
import type { CurrencyConfig } from "@/app/lib/currency";
import {
  DEFAULT_LOCALIZATION_SETTING,
  buildFormatters,
} from "@/app/lib/localization";
import type { LocalizationFormatter } from "@/app/lib/localization";

interface LocalizationContextValue {
  setting: LocalizationSetting;
  loading: boolean;
  error: string;
  reload: () => void;
}

const LocalizationContext = createContext<LocalizationContextValue>({
  setting: DEFAULT_LOCALIZATION_SETTING,
  loading: true,
  error: "",
  reload: () => {},
});

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [setting, setSetting] = useState<LocalizationSetting>(DEFAULT_LOCALIZATION_SETTING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await settingsApi.localization.get();
        if (!cancelled) {
          setSetting({
            ...DEFAULT_LOCALIZATION_SETTING,
            ...result.localization,
          });
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const value = useMemo(
    () =>
      ({
        setting,
        loading,
        error,
        reload,
      }) satisfies LocalizationContextValue,
    [setting, loading, error, reload],
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

/** Backwards-compatible alias so the existing provider mount keeps working. */
export const CurrencyProvider = LocalizationProvider;

function useLocalizationContext(): LocalizationContextValue {
  return useContext(LocalizationContext);
}

/**
 * Full localization formatters bound to the hospital-wide configuration.
 * The returned object is stable per settings object — safe to destructure.
 */
export function useLocalization(): LocalizationFormatter & {
  loading: boolean;
  error: string;
  reload: () => void;
} {
  const { setting, loading, error, reload } = useLocalizationContext();
  const formatters = useMemo(() => buildFormatters(setting), [setting]);
  return { ...formatters, loading, error, reload };
}

/** The currency-only subset, kept for existing callers. */
export function useCurrency(): {
  currency: CurrencyConfig;
  loading: boolean;
  error: string;
  reload: () => void;
} {
  const { setting, loading, error, reload } = useLocalizationContext();
  const currency = useMemo(
    () => fromLocalization(setting.currency, setting.currencySymbol),
    [setting.currency, setting.currencySymbol],
  );
  return { currency, loading, error, reload };
}