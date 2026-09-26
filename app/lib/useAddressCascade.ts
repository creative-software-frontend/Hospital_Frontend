"use client";

import { useCallback, useEffect, useState } from "react";
import { settingsApi, type AddressChoice, type AddressLocality } from "@/app/lib/api";

export interface AddressCascade {
  divisions: AddressChoice[];
  districts: AddressChoice[];
  localities: AddressLocality[];
  divisionsLoading: boolean;
  districtsLoading: boolean;
  localitiesLoading: boolean;
  /** Set when a level failed to load, so the UI can say so instead of showing an empty dropdown. */
  addressError: string | null;
  /** Re-runs the failed load. */
  retryAddress: () => void;
  /** Loads one level, e.g. after the parent changed. */
  loadDistricts: (divisionCode: string) => void;
  loadLocalities: (districtCode: string) => void;
  resetDistricts: () => void;
  resetLocalities: () => void;
}

/**
 * Drives the Bangladesh address cascade (division -> district -> upazila | thana).
 *
 * Every level is read from Master Data through the settings API, so an admin
 * adding a unit in Settings -> Master Data makes it selectable here. Children
 * are fetched only once a parent is chosen, which is also what keeps the
 * dropdowns honest: a district list is always the children of one division.
 */
export function useAddressCascade(): AddressCascade {
  const [divisions, setDivisions] = useState<AddressChoice[]>([]);
  const [districts, setDistricts] = useState<AddressChoice[]>([]);
  const [localities, setLocalities] = useState<AddressLocality[]>([]);
  const [divisionsLoading, setDivisionsLoading] = useState(true);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [localitiesLoading, setLocalitiesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDivisionsLoading(true);
    setError(null);
    settingsApi.address
      .divisions()
      .then((res) => {
        if (!cancelled) setDivisions(res.items);
      })
      .catch((err) => {
        // An empty list and a failed request look identical in a <select>, so
        // the reason is kept and shown rather than swallowed into a blank box.
        if (cancelled) return;
        setDivisions([]);
        setError(err instanceof Error ? err.message : "Could not load divisions");
      })
      .finally(() => {
        if (!cancelled) setDivisionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const loadDistricts = useCallback((divisionCode: string) => {
    if (!divisionCode) return;
    setDistrictsLoading(true);
    settingsApi.address
      .districts(divisionCode)
      .then((res) => setDistricts(res.items))
      .catch((err) => {
        setDistricts([]);
        setError(err instanceof Error ? err.message : "Could not load districts");
      })
      .finally(() => setDistrictsLoading(false));
  }, []);

  const loadLocalities = useCallback((districtCode: string) => {
    if (!districtCode) return;
    setLocalitiesLoading(true);
    settingsApi.address
      .localities(districtCode)
      .then((res) => setLocalities(res.items))
      .catch((err) => {
        setLocalities([]);
        setError(err instanceof Error ? err.message : "Could not load thanas / upazilas");
      })
      .finally(() => setLocalitiesLoading(false));
  }, []);

  const resetDistricts = useCallback(() => {
    setDistricts([]);
    setDistrictsLoading(false);
  }, []);

  const resetLocalities = useCallback(() => {
    setLocalities([]);
    setLocalitiesLoading(false);
  }, []);

  return {
    divisions,
    districts,
    localities,
    divisionsLoading,
    districtsLoading,
    localitiesLoading,
    addressError: error,
    retryAddress: () => setAttempt((n) => n + 1),
    loadDistricts,
    loadLocalities,
    resetDistricts,
    resetLocalities,
  };
}
