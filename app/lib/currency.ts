// app/lib/currency.ts
// Currency configuration + display formatting. The SINGLE source of truth is the
// Settings → Localization → Currency setting (LocalizationSetting.currency and
// LocalizationSetting.currencySymbol). All financial displays format via
// useCurrency() → formatCurrency(). Changing the config only changes how amounts
// are displayed; numbers are never converted/exchanged.

import { LOCALIZATION_CURRENCIES } from "@/app/lib/api";

export type CurrencyConfig = {
  currencyCode: string;
  currencySymbol: string;
  decimalPlaces: number;
  position: "BEFORE" | "AFTER";
};

export const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  currencyCode: "BDT",
  currencySymbol: "৳",
  decimalPlaces: 2,
  position: "BEFORE",
};

/**
 * Builds the display config from the LocalizationSetting currency fields.
 * The code comes straight from the backend (validated against the shared
 * catalog); the symbol falls back to the catalog symbol when not supplied.
 */
export function fromLocalization(currency?: string | null, currencySymbol?: string | null): CurrencyConfig {
  const code = currency || DEFAULT_CURRENCY_CONFIG.currencyCode;
  const catalog = LOCALIZATION_CURRENCIES.find((c) => c.code === code);
  return {
    currencyCode: code,
    currencySymbol: currencySymbol || catalog?.symbol || code,
    decimalPlaces: DEFAULT_CURRENCY_CONFIG.decimalPlaces,
    position: DEFAULT_CURRENCY_CONFIG.position,
  };
}

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Formats a numeric amount with the hospital-wide currency configuration.
 * Handles negative, zero and large amounts; supports BEFORE/AFTER symbols.
 */
export function formatCurrency(amount: number, config: CurrencyConfig): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const parts = abs.toFixed(config.decimalPlaces).split(".");
  parts[0] = groupThousands(parts[0]);
  const numeric = `${sign}${parts.join(".")}`;
  return config.position === "AFTER"
    ? `${numeric} ${config.currencySymbol}`
    : `${config.currencySymbol}${numeric}`;
}