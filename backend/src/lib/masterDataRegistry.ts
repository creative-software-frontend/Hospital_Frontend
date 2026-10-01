/**
 * One entry per lookup list, mapping the `category` string the API and UI speak
 * onto the table that now backs it.
 *
 * Every lookup used to share one `masterdata` table discriminated by a `category`
 * string. That made a single table hold 15,000+ address rows next to a handful of
 * blood groups, forced four columns (`bnName`, `lat`, `lon`, `url`) to be null for
 * most rows, and left `parentCode` as an unenforced string pointing at another
 * row's `code`. Each list now has its own table, and this registry is what lets the
 * service layer keep serving one flat, category-keyed contract on top of them.
 *
 * Adding a lookup list now means: a model in schema.prisma, an entry here, and a
 * branch in the seed. It is no longer a one-line change, and that is the trade for
 * real foreign keys and per-list constraints.
 */
import { ADDRESS_CATEGORY } from "./bangladeshAddress";

export const MASTER_DATA_CATEGORIES = [
  "cities",
  "areas",
  "visit_types",
  "blood_groups",
  "document_types",
  "payment_methods",
  "divisions",
  "districts",
  "upazilas",
  "unions",
] as const;

export type MasterDataCategory = (typeof MASTER_DATA_CATEGORIES)[number];

/** Model name on the Prisma client, e.g. `Division` -> `prisma.division`. */
export type LookupModelName =
  | "city"
  | "area"
  | "visitType"
  | "bloodGroup"
  | "documentType"
  | "paymentMethod"
  | "division"
  | "district"
  | "upazila"
  | "union";

/** How a lower address level reaches the level above it. */
export interface LookupParent {
  /** FK column on this table, e.g. `district.divisionId`. */
  readonly field: "divisionId" | "districtId" | "upazilaId";
  /** The model this FK points at. */
  readonly model: "division" | "district" | "upazila";
  /** The category that model backs, used in error messages. */
  readonly category: "divisions" | "districts" | "upazilas";
}

export interface LookupSpec {
  readonly model: LookupModelName;
  /**
   * Payment methods are global reference data and the one lookup with no
   * `branchId`, so it is listed and edited by every branch rather than filtered
   * to one.
   */
  readonly branchScoped: boolean;
  readonly parent: LookupParent | null;
  /** National address data: imported, never edited through the API. */
  readonly address: boolean;
  /** Carries the dataset's Bengali name. */
  readonly hasBnName: boolean;
  /** Carries a centroid. Only districts do in the national dataset. */
  readonly hasCoordinates: boolean;
}

const flat = (model: LookupModelName): LookupSpec => ({
  model,
  branchScoped: true,
  parent: null,
  address: false,
  hasBnName: false,
  hasCoordinates: false,
});

export const LOOKUP_SPECS: Record<MasterDataCategory, LookupSpec> = {
  cities: flat("city"),
  areas: flat("area"),
  visit_types: flat("visitType"),
  blood_groups: flat("bloodGroup"),
  document_types: flat("documentType"),
  payment_methods: {
    model: "paymentMethod",
    branchScoped: false,
    parent: null,
    address: false,
    hasBnName: false,
    hasCoordinates: false,
  },
  divisions: {
    model: "division",
    branchScoped: true,
    parent: null,
    address: true,
    hasBnName: true,
    hasCoordinates: false,
  },
  districts: {
    model: "district",
    branchScoped: true,
    parent: { field: "divisionId", model: "division", category: "divisions" },
    address: true,
    hasBnName: true,
    hasCoordinates: true,
  },
  upazilas: {
    model: "upazila",
    branchScoped: true,
    parent: { field: "districtId", model: "district", category: "districts" },
    address: true,
    hasBnName: true,
    hasCoordinates: false,
  },
  unions: {
    model: "union",
    branchScoped: true,
    parent: { field: "upazilaId", model: "upazila", category: "upazilas" },
    address: true,
    hasBnName: true,
    hasCoordinates: false,
  },
};

export const isMasterDataCategory = (value: string): value is MasterDataCategory =>
  (MASTER_DATA_CATEGORIES as readonly string[]).includes(value);

/** Throws unless the category is one this registry can serve. */
export function lookupSpec(category: string): LookupSpec {
  if (!isMasterDataCategory(category)) {
    throw new Error(`Unknown master data category "${category}"`);
  }
  return LOOKUP_SPECS[category];
}

/** The address levels, in cascade order. Mirrors the address import. */
export const ADDRESS_LOOKUP_ORDER: readonly MasterDataCategory[] = [
  ADDRESS_CATEGORY.divisions,
  ADDRESS_CATEGORY.districts,
  ADDRESS_CATEGORY.upazilas,
  ADDRESS_CATEGORY.unions,
];