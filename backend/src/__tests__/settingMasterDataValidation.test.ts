import { describe, it, expect } from "vitest";
import { createMasterDataSchema, updateMasterDataSchema } from "../modules/settings/setting.validation";

/** The message the create schema uses when a child row names no parent. */
const PARENT_REQUIRED = /parentCode is required/;

describe("master data address categories", () => {
  it("accepts the four seeded address categories", () => {
    for (const category of ["divisions", "districts", "upazilas", "thanas"] as const) {
      const parsed = createMasterDataSchema.safeParse({
        category,
        label: "Example",
        // A district needs a division; an upazila or thana needs a district.
        ...(category === "divisions" ? {} : { parentCode: "PARENT_1" }),
      });
      expect(parsed.success, `${category}: ${parsed.error?.issues[0]?.message}`).toBe(true);
    }
  });

  it("accepts a top level division with no parent", () => {
    expect(createMasterDataSchema.safeParse({ category: "divisions", label: "Dhaka" }).success).toBe(
      true,
    );
  });

  it("rejects a district with no parent division", () => {
    const parsed = createMasterDataSchema.safeParse({ category: "districts", label: "Dhaka" });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toMatch(PARENT_REQUIRED);
    expect(parsed.error?.issues[0]?.path).toEqual(["parentCode"]);
  });

  it("rejects an upazila and a thana with no parent district", () => {
    for (const category of ["upazilas", "thanas"] as const) {
      const parsed = createMasterDataSchema.safeParse({ category, label: "Savar" });
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
      expect(createMasterDataSchema.safeParse({ category, label: "Example" }).success, category).toBe(
        true,
      );
    }
  });
});

describe("master data code length", () => {
  // The generated codes run to ~41 characters, e.g. an upazila whose name
  // repeats its district. A 32 character cap silently rejected real seeded rows
  // the moment an admin opened one to rename.
  it("accepts the longest code the seeder produces", () => {
    const parsed = createMasterDataSchema.safeParse({
      category: "upazilas",
      label: "Chapai Nawabganj Sadar",
      code: "UPA_CHAPAINAWABGANJ_CHAPAINAWABGANJ_SADAR",
      parentCode: "DST_CHAPAINAWABGANJ",
    });
    expect(parsed.success, parsed.error?.issues[0]?.message).toBe(true);
  });

  it("still rejects an absurdly long code", () => {
    const parsed = createMasterDataSchema.safeParse({
      category: "divisions",
      label: "Dhaka",
      code: "X".repeat(65),
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a long parent code on update", () => {
    const parsed = updateMasterDataSchema.safeParse({
      parentCode: "UPA_CHAPAINAWABGANJ_CHAPAINAWABGANJ_SADAR",
    });
    expect(parsed.success).toBe(true);
  });
});
