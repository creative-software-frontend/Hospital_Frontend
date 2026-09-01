export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Whitelist of fields that can be used for sorting. Extend per module.
export const SORTABLE_FIELDS = [
  "id",
  "createdAt",
  "updatedAt",
  "name",
  "email",
  "username",
  "status",
  "branchId",
  "code",
  "firstName",
  "lastName",
  "patientCode",
  "phone",
  "gender",
  "dateOfBirth",
] as const;

export type SortableField = (typeof SORTABLE_FIELDS)[number];

/**
 * Normalizes raw query parameters into safe pagination params. Only allowed
 * fields may be used for sorting; anything else falls back to a default.
 */
export function parsePagination(raw: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, Number(raw.page) || DEFAULT_PAGE);
  const limitRaw = Number(raw.limit) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(1, limitRaw), MAX_LIMIT);

  const search = typeof raw.search === "string" && raw.search.trim() ? raw.search.trim() : undefined;

  let sortBy = "id";
  if (typeof raw.sortBy === "string" && SORTABLE_FIELDS.includes(raw.sortBy as SortableField)) {
    sortBy = raw.sortBy;
  }

  const sortOrder: "asc" | "desc" = raw.sortOrder === "asc" ? "asc" : "desc";

  return { page, limit, search, sortBy, sortOrder };
}

export function buildPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
