"use client";

import { useEffect, useMemo, useState } from "react";
import { settingsApi, type MasterDataCategory, type MasterDataOption } from "@/app/lib/api";

export type MasterDataChoice = MasterDataOption & { value: string };

/**
 * Reads a master data category for use in a dropdown.
 *
 * Master data is the source of truth, so an admin adding a value in
 * Settings → Master Data makes it appear here without a code change. If the
 * request fails or the category is empty, `fallback` keeps the caller usable
 * (the backend also falls back to the built-in enum for enum-backed columns).
 */
export function useMasterDataOptions(
  category: MasterDataCategory,
  fallback: readonly string[] = [],
): { options: MasterDataChoice[]; loading: boolean; isFallback: boolean } {
  const [options, setOptions] = useState<MasterDataChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    settingsApi.masterData
      .options(category)
      .then((res) => {
        if (cancelled) return;
        const mapped: MasterDataChoice[] = res.options.map((o) => ({ ...o, value: o.code }));
        setOptions(mapped);
        // Server-side fallback or a genuinely empty list: keep the caller usable.
        setIsFallback(mapped.length === 0 || mapped.every((o) => o.fallback));
      })
      .catch(() => {
        if (cancelled) return;
        setOptions([]);
        setIsFallback(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  const resolved: MasterDataChoice[] =
    options.length > 0
      ? options
      : fallback.map((code, index) => ({ code, label: code, value: code, sortOrder: index, fallback: true }));

  return { options: resolved, loading, isFallback };
}

/**
 * Label resolver for values already stored on a record, so read-only views use
 * the same wording as the dropdown that wrote them.
 */
export function useMasterDataLabels(
  category: MasterDataCategory,
): (value: string | null | undefined) => string {
  const { options } = useMasterDataOptions(category);

  return useMemo(() => {
    const map = new Map(options.map((o) => [o.code, o.label]));
    return (value) => {
      if (!value) return "-";
      return map.get(value) ?? value.replace(/_/g, " ");
    };
  }, [options]);
}
