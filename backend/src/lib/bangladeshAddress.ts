// Single point of contact with @bangladeshi/bangladesh-address.
//
// Version 2.1.0 ships `main: "./build/index.js"`, but the file it actually
// publishes is `build/src/index.js`, so a bare `import "@bangladeshi/bangladesh-address"`
// fails to resolve. The package declares no `exports` map, so the deep path is
// the supported escape hatch and is kept here to contain the workaround.

import * as bd from "@bangladeshi/bangladesh-address/build/src/index.js";

export type { Upazila, Thana, DistrictName } from "@bangladeshi/bangladesh-address/build/src/index.js";

export const allDivisions = (): string[] => bd.allDivision();
export const allDistricts = (): string[] => bd.allDistricts();
export const allUpazilas = (): bd.Upazila[] => bd.upazilaData;
// allThana() rather than the raw thanaData export: the JSON's `type` widens to
// `string`, while allThana() is declared to return the `type: "thana"` literal.
export const allThanas = (): bd.Thana[] => bd.allThana();

export const districtsOf = (division: string): string[] => bd.districtsOf(division as never);
export const upazilasOf = (district: string): bd.Upazila[] => bd.upazilasOf(district);
export const thanasOf = (district: string): bd.Thana[] => bd.thanasOf(district);

export const divisionOfDistrict = (district: string): string | undefined =>
  bd.getDivisionOfDistrict(district);
export const districtOfUpazila = (upazila: string, division?: string): string | undefined =>
  bd.getDistrictOfUpazila(upazila, division);

/**
 * Stable, collision-free code for a master data row. Name alone is not unique:
 * "Kotwali" is a thana in both Dhaka and Chattogram, and "Kaliganj" is an
 * upazila in four districts, so the parent is always part of the code.
 */
export const addressCode = (prefix: string, ...parts: string[]): string =>
  [prefix, ...parts]
    .map((part) =>
      part
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, ""),
    )
    .filter(Boolean)
    .join("_");

export const ADDRESS_CATEGORY = {
  divisions: "divisions",
  districts: "districts",
  upazilas: "upazilas",
  thanas: "thanas",
} as const;

export type AddressCategory = (typeof ADDRESS_CATEGORY)[keyof typeof ADDRESS_CATEGORY];

/** Hierarchical address categories, top level first. */
export const ADDRESS_CATEGORY_ORDER: AddressCategory[] = [
  ADDRESS_CATEGORY.divisions,
  ADDRESS_CATEGORY.districts,
  ADDRESS_CATEGORY.upazilas,
  ADDRESS_CATEGORY.thanas,
];

/**
 * Which category each address level hangs from, or null for the top level.
 * Single source of truth: the Master Data validation schema and the delete
 * guard both read this rather than repeating the mapping.
 */
export const ADDRESS_CATEGORY_PARENT: Record<AddressCategory, AddressCategory | null> = {
  [ADDRESS_CATEGORY.divisions]: null,
  [ADDRESS_CATEGORY.districts]: ADDRESS_CATEGORY.divisions,
  [ADDRESS_CATEGORY.upazilas]: ADDRESS_CATEGORY.districts,
  [ADDRESS_CATEGORY.thanas]: ADDRESS_CATEGORY.districts,
};

/** The categories that can have children, and so must be guarded on delete. */
export const ADDRESS_PARENT_CATEGORIES: AddressCategory[] = [
  ADDRESS_CATEGORY.divisions,
  ADDRESS_CATEGORY.districts,
];

export const isAddressParentCategory = (category: string): category is AddressCategory =>
  (ADDRESS_PARENT_CATEGORIES as string[]).includes(category);

export const isAddressCategory = (category: string): category is AddressCategory =>
  (ADDRESS_CATEGORY_ORDER as string[]).includes(category);
