import { describe, it, expect } from "vitest";
import { buildAddressRows } from "../../prisma/addressDataset";
import { ADDRESS_CATEGORY_ORDER } from "../lib/bangladeshAddress";

/**
 * The dataset is parsed out of the vendored SQL dumps rather than imported, so
 * the parser is the only thing standing between a malformed dump and a silent
 * half-loaded hierarchy. These tests pin the invariants the loader relies on.
 */
describe("address dataset", () => {
  const rows = buildAddressRows();

  it("parses the whole published hierarchy", () => {
    const byCategory = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {});

    expect(byCategory).toEqual({
      divisions: 8,
      districts: 64,
      upazilas: 494,
      unions: 4540,
    });
  });

  it("keeps every row in one of the active address categories", () => {
    for (const row of rows) {
      expect(ADDRESS_CATEGORY_ORDER).toContain(row.category);
    }
  });

  it("gives every row a code, and no two rows in a category share one", () => {
    for (const row of rows) {
      expect(row.code, `${row.category}/${row.label}`).toBeTruthy();
    }
    const seen = new Set<string>();
    for (const row of rows) {
      const key = `${row.category}|${row.code}`;
      expect(seen.has(key), `duplicate code ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("resolves every parentCode to a row in the same category", () => {
    const codes = new Set(rows.map((r) => r.code));
    for (const row of rows) {
      if (row.parentCode === null) continue;
      expect(codes.has(row.parentCode), `${row.code} -> ${row.parentCode}`).toBe(true);
    }
  });

  it("parents every level below the top one", () => {
    const top = rows.filter((r) => r.parentCode === null);
    expect(top.every((r) => r.category === "divisions")).toBe(true);
    for (const row of rows) {
      if (row.category === "divisions") continue;
      expect(row.parentCode, `${row.category}/${row.label}`).toBeTruthy();
    }
  });

  it("chains a union through an upazila to a district", () => {
    const upazila = rows.find((r) => r.category === "upazilas")!;
    const union = rows.find((r) => r.category === "unions" && r.parentCode === upazila.code)!;
    const district = rows.find((r) => r.code === upazila.parentCode)!;
    const division = rows.find((r) => r.code === district.parentCode)!;

    expect(division.category).toBe("divisions");
    expect(district.category).toBe("districts");
    expect(union.category).toBe("unions");
  });

  // Master Data has a unique key on (branch, category, parent, label), and the
  // dumps repeat four union names inside a single upazila. They are kept and
  // suffixed rather than dropped, so nothing upstream goes missing.
  it("suffixes the union names the dataset repeats inside one upazila", () => {
    const suffixed = rows.filter((r) => /\(\d+\)$/.test(r.label));
    expect(suffixed.map((r) => r.label).sort()).toEqual([
      "Awajpur (2)",
      "Bhojoanpur (2)",
      "Natai (2)",
      "Talimpur (2)",
    ]);
    for (const row of suffixed) {
      expect(row.category).toBe("unions");
    }
  });

  it("never repeats a (parent, label) pair, comparing the way MySQL does", () => {
    // The column collation is utf8mb4_unicode_ci, so case and accents are folded.
    const fold = (s: string) =>
      s
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
    const seen = new Set<string>();
    for (const row of rows) {
      const key = `${row.category}|${row.parentCode ?? ""}|${fold(row.label)}`;
      expect(seen.has(key), `duplicate ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("carries the Bengali name for every row, the URL for almost all, and coordinates for districts only", () => {
    for (const row of rows) {
      expect(row.bnName, `${row.category}/${row.label}`).toBeTruthy();
    }
    // Three upazilas publish no LGED page at all.
    expect(rows.filter((r) => r.url === null)).toHaveLength(3);

    const withCoords = rows.filter((r) => r.lat !== null || r.lon !== null);
    expect(withCoords).toHaveLength(64);
    expect(new Set(withCoords.map((r) => r.category))).toEqual(new Set(["districts"]));
    for (const row of withCoords) {
      expect(row.lat).not.toBeNull();
      expect(row.lon).not.toBeNull();
    }
  });

  it("keeps every code inside the column width", () => {
    for (const row of rows) {
      expect(row.code.length).toBeLessThanOrEqual(191);
      expect((row.label ?? "").length).toBeLessThanOrEqual(191);
      expect((row.bnName ?? "").length).toBeLessThanOrEqual(191);
      expect((row.url ?? "").length).toBeLessThanOrEqual(191);
    }
  });
});
