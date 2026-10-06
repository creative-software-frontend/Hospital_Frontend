// app/lib/localization.ts
// Pure formatting helpers driven by the hospital-wide Settings → Localization
// configuration. Every value comes from LocalizationSetting (currency, currency
// symbol, date format, time format, timezone, number format, week start day).
// `language` is deliberately not consumed here: there is no string i18n layer,
// so it only labels UI that is rendered via React itself.
//
// All helpers are total: an invalid/absent value renders "—" and an invalid
// locale/timezone falls back instead of throwing, so a bad stored value can
// never crash a screen.

import type { LocalizationSetting } from "@/app/lib/api";
import { LOCALIZATION_CURRENCIES } from "@/app/lib/api";

export const DEFAULT_LOCALIZATION_SETTING: LocalizationSetting = {
  id: 0,
  branchId: 0,
  language: "English",
  currency: "BDT",
  currencySymbol: "৳",
  dateFormat: "DD-MM-YYYY",
  timeFormat: "24h",
  timezone: "Asia/Dhaka",
  numberFormat: "en-US",
  weekStartDay: 1,
};

const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The numeric calendar parts of `value` projected into the configured timezone. */
function partsInTimeZone(
  value: string | number | Date | null | undefined,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const d = toDate(value);
  if (!d) return null;
  try {
    const fmt = new Intl.DateTimeFormat("en-US-u-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const p: Record<string, string> = {};
    for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
    return {
      year: Number(p.year),
      month: Number(p.month),
      day: Number(p.day),
      hour: Number(p.hour) % 24,
      minute: Number(p.minute),
    };
  } catch {
    // Unknown/legacy timezone: fall back to the viewer's local wall clock.
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
    };
  }
}

function safeLocale(numberFormat: string | null | undefined): string {
  const locale = numberFormat || "en-US";
  try {
    new Intl.NumberFormat(locale);
    return locale;
  } catch {
    return "en-US";
  }
}

function buildNumberFormatter(locale: string, decimals: number): Intl.NumberFormat {
  return new Intl.NumberFormat(safeLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
}

export type LocalizationFormatter = {
  settings: LocalizationSetting;
  formatDate: (value: string | number | Date | null | undefined) => string;
  formatTime: (value: string | number | Date | null | undefined) => string;
  formatDateTime: (value: string | number | Date | null | undefined) => string;
  formatNumber: (value: number | string | null | undefined) => string;
  formatAmount: (value: number | string | null | undefined) => string;
  formatCurrency: (value: number | string | null | undefined) => string;
  currencySymbol: string;
  weekDays: string[];
};

/**
 * Builds a bound set of formatters for one localization configuration. Pure —
 * memoize with the `settings` object identity in the provider.
 */
export function buildFormatters(settings: LocalizationSetting): LocalizationFormatter {
  const { timezone, dateFormat, timeFormat, numberFormat, currency, currencySymbol, weekStartDay } =
    settings;

  const date = (value: string | number | Date | null | undefined): string => {
    const p = partsInTimeZone(value, timezone);
    if (!p) return "—";

    let out = dateFormat || "DD-MM-YYYY";
    if (out.includes("MMM")) {
      const locale = safeLocale(numberFormat);
      let monthName = MONTHS_FULL[p.month - 1];
      try {
        monthName = new Intl.DateTimeFormat(locale, { month: "short", timeZone: timezone }).format(
          new Date(Date.UTC(p.year, p.month - 1, p.day)),
        );
      } catch {
        monthName = MONTHS_FULL[p.month - 1];
      }
      out = out.replace("MMM", monthName);
    }
    return out
      .replace("DD", pad(p.day))
      .replace(/MM/g, pad(p.month))
      .replace("YYYY", String(p.year));
  };

  const time = (value: string | number | Date | null | undefined): string => {
    const p = partsInTimeZone(value, timezone);
    if (!p) return "—";
    if (timeFormat === "12h") {
      const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
      const period = p.hour < 12 ? "AM" : "PM";
      return `${hour12}:${pad(p.minute)} ${period}`;
    }
    return `${pad(p.hour)}:${pad(p.minute)}`;
  };

  const catalog = LOCALIZATION_CURRENCIES.find((c) => c.code === currency);
  const symbol = currencySymbol || catalog?.symbol || currency;

  return {
    settings,
    formatDate: date,
    formatTime: time,
    formatDateTime: (value) => {
      const d = date(value);
      return d === "—" ? "—" : `${d} ${time(value)}`;
    },
    formatNumber: (value) => {
      const n = Number(value);
      if (value === null || value === undefined || value === "" || Number.isNaN(n)) return "—";
      return buildNumberFormatter(safeLocale(numberFormat), 2).format(n);
    },
    formatAmount: (value) => {
      const n = Number(value);
      if (value === null || value === undefined || value === "" || Number.isNaN(n)) return "—";
      return buildNumberFormatter(safeLocale(numberFormat), 2).format(n);
    },
    formatCurrency: (value) => {
      const n = Number(value);
      if (value === null || value === undefined || value === "" || Number.isNaN(n)) return "—";
      const fmt = buildNumberFormatter(safeLocale(numberFormat), 2);
      const sign = n < 0 ? "-" : "";
      const numeric = fmt.format(Math.abs(n));
      return `${sign}${symbol}${numeric}`;
    },
    currencySymbol: symbol,
    weekDays: (() => {
      const names = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const start = weekStartDay >= 0 && weekStartDay <= 6 ? weekStartDay : 0;
      return [...names.slice(start), ...names.slice(0, start)];
    })(),
  };
}