import { describe, it, expect } from "vitest";
import { createMasterDataSchema, updateMasterDataSchema } from "../modules/settings/setting.validation";

/** The message the create schema uses when a child row names no parent. */
const PARENT_REQUIRED = /parentCode is required/;

describe("master data address categories", () => {
  it("accepts the four address categories", () => {
    for (const category of ["divisions", "districts", "upazilas", "unions"] as const) {
      const parsed = createMasterDataSchema.safeParse({
        category,
        label: "Example",
        code: `${category}_EXAMPLE`,
        // A district needs a division; an upazila needs a district; a union an upazila.
        ...(category === "divisions" ? {} : { parentCode: "PARENT_1" }),
      });
      expect(parsed.success, `${category}: ${parsed.error?.issues[0]?.message}`).toBe(true);
    }
  });

  it("rejects the retired thanas category", () => {
    const parsed = createMasterDataSchema.safeParse({
      category: "thanas",
      label: "Gulshan",
      code: "THANA_GULSHAN",
      parentCode: "PARENT_1",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a top level division with no parent", () => {
    expect(
      createMasterDataSchema.safeParse({
        category: "divisions",
        label: "Dhaka",
        code: "DIV_DHAKA",
      }).success,
    ).toBe(true);
  });

  it("rejects a district with no parent division", () => {
    const parsed = createMasterDataSchema.safeParse({
      category: "districts",
      label: "Dhaka",
      code: "DST_DHAKA",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toMatch(PARENT_REQUIRED);
    expect(parsed.error?.issues[0]?.path).toEqual(["parentCode"]);
  });

  it("rejects an upazila and a union with no parent", () => {
    for (const category of ["upazilas", "unions"] as const) {
      const parsed = createMasterDataSchema.safeParse({
        category,
        label: "Savar",
        code: `${category}_SAVAR`,
      });
      expect(parsed.success, category).toBe(false);
      expect(parsed.error?.issues[0]?.message).toMatch(PARENT_REQUIRED);
    }
  });

  it("still allows the non-hierarchical categories with no parent", () => {
    for (const category of [
      "cities",
      "areas",
      "visit_types",
      "blood_groups",
      "payment_methods",
      "document_types",
    ] as const) {
      expect(
        createMasterDataSchema.safeParse({ category, label: "Example", code: `${category}_X` }).success,
        category,
      ).toBe(true);
    }
  });
});

describe("master data code is required", () => {
  // Each lookup list is its own table now and every one has a non-null `code`, so a
  // create with no code would fail at the database. The schema catches it first.
  it("rejects a create with no code", () => {
    const parsed = createMasterDataSchema.safeParse({ category: "cities", label: "Dhaka" });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["code"]);
  });

  it("rejects a blank code", () => {
    const parsed = createMasterDataSchema.safeParse({ category: "cities", label: "Dhaka", code: "  " });
    expect(parsed.success).toBe(false);
  });

  it("leaves code optional on update, so editing the label alone works", () => {
    expect(updateMasterDataSchema.safeParse({ label: "Dhaka" }).success).toBe(true);
  });
});

describe("master data code length", () => {
  // A code chains the whole parent path, so the longest one the dataset produces
  // is 77 characters, e.g. a union under a long upazila. A tight cap silently
  // rejects real rows the moment an admin opens one to rename.
  it("accepts the longest code the dataset produces", () => {
    const parsed = createMasterDataSchema.safeParse({
      category: "unions",
      label: "Khagrachhari Sadar",
      code: "UNI_UPA_DST_DIV_CHATTAGRAM_KHAGRACHHARI_KHAGRACHHARI_SADAR_KHAGRACHHARI_SADAR",
      parentCode: "UPA_DST_DIV_CHATTAGRAM_KHAGRACHHARI_KHAGRACHHARI_SADAR",
    });
    expect(parsed.success, parsed.error?.issues[0]?.message).toBe(true);
  });

  it("still rejects a code past the column width", () => {
    const parsed = createMasterDataSchema.safeParse({
      category: "divisions",
      label: "Dhaka",
      code: "X".repeat(192),
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a long parent code on update", () => {
    const parsed = updateMasterDataSchema.safeParse({
      parentCode: "UPA_DST_DIV_CHAPAINAWABGANJ_CHAPAINAWABGANJ_SADAR",
    });
    expect(parsed.success).toBe(true);
  });
});