// app/hooks/useCurrency.tsx
// Client-side provider for the hospital-wide display currency.
// Single source of truth: Settings → Localization → Currency (LocalizationSetting).
// Loads GET /api/settings/localization once and shares it across the dashboard so
// every monetary display uses one source. Falls back to the BDT default while
// loading or if the request fails (UI never blocks on it).

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { settingsApi, errorMessage } from "@/app/lib/api";
import { DEFAULT_CURRENCY_CONFIG, fromLocalization } from "@/app/lib/currency";
import type { CurrencyConfig } from "@/app/lib/currency";

interface CurrencyContextValue {
  currency: CurrencyConfig;
  loading: boolean;
  error: string;
  reload: () => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY_CONFIG,
  loading: true,
  error: "",
  reload: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyConfig>(DEFAULT_CURRENCY_CONFIG);
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
          setCurrency(fromLocalization(result.localization.currency, result.localization.currencySymbol));
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

  return (
    <CurrencyContext.Provider value={{ currency, loading, error, reload }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}