/**
 * Shape of the Bangladesh address hierarchy and the rules that go with it.
 *
 * The dataset is the four vendored SQL dumps in `prisma/address-source`
 * (divisions -> districts -> upazilas -> unions), which is the only source of
 * truth for places. It used to come from the `@bangladeshi/bangladesh-address`
 * package, but that package ships no unions, no Bengali names and no
 * coordinates, so the data the hospital actually wants could not be stored.
 *
 * Nothing in here reads the dataset: `prisma/addressDataset.ts` does that. This
 * module only describes the categories so the API, the validation schema and
 * the delete guard all agree on one hierarchy.
 */

export const ADDRESS_CATEGORY = {
  divisions: "divisions",
  districts: "districts",
  upazilas: "upazilas",
  unions: "unions",
} as const;

export type AddressCategory = (typeof ADDRESS_CATEGORY)[keyof typeof ADDRESS_CATEGORY];

/** Active address categories, top level first. This is what gets loaded. */
export const ADDRESS_CATEGORY_ORDER: AddressCategory[] = [
  ADDRESS_CATEGORY.divisions,
  ADDRESS_CATEGORY.districts,
  ADDRESS_CATEGORY.upazilas,
  ADDRESS_CATEGORY.unions,
];

/**
 * `thanas` came from the old package. The vendored dataset has no thanas, so
 * nothing loads it and the existing rows are dropped on import, but the name is
 * still recognised as address data: without it a leftover row would silently
 * become editable in Master Data and lose the delete guard.
 */
export const LEGACY_ADDRESS_CATEGORIES: string[] = ["thanas"];

/** Everything that must be treated as read-only national address data. */
export const isAddressCategory = (category: string): category is AddressCategory =>
  (ADDRESS_CATEGORY_ORDER as string[]).includes(category) ||
  LEGACY_ADDRESS_CATEGORIES.includes(category);

export const isActiveAddressCategory = (category: string): category is AddressCategory =>
  (ADDRESS_CATEGORY_ORDER as string[]).includes(category);

/**
 * Which category each address level hangs from, or null for the top level.
 * Single source of truth: the Master Data validation schema and the delete
 * guard both read this rather than repeating the mapping.
 */
export const ADDRESS_CATEGORY_PARENT: Record<AddressCategory, AddressCategory | null> = {
  [ADDRESS_CATEGORY.divisions]: null,
  [ADDRESS_CATEGORY.districts]: ADDRESS_CATEGORY.divisions,
  [ADDRESS_CATEGORY.upazilas]: ADDRESS_CATEGORY.districts,
  [ADDRESS_CATEGORY.unions]: ADDRESS_CATEGORY.upazilas,
};

/** The categories that can have children, and so must be guarded on delete. */
export const ADDRESS_PARENT_CATEGORIES: AddressCategory[] = [
  ADDRESS_CATEGORY.divisions,
  ADDRESS_CATEGORY.districts,
  ADDRESS_CATEGORY.upazilas,
];

export const isAddressParentCategory = (category: string): category is AddressCategory =>
  (ADDRESS_PARENT_CATEGORIES as string[]).includes(category);

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
