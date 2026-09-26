import {
  ADDRESS_CATEGORY,
  addressCode,
  allDivisions,
  allDistricts,
  allThanas,
  allUpazilas,
  districtsOf,
} from "../src/lib/bangladeshAddress";

export interface AddressSeedRow {
  category: string;
  label: string;
  code: string;
  parentCode: string | null;
  sortOrder: number;
}

/**
 * Flattens the national dataset into master data rows, top level first, so a
 * parent row is always inserted before the children that reference it.
 *
 * Upazilas and thanas are both "district children" in the address cascade, so
 * they stay separate categories: a district can have metropolitan thanas
 * (Dhaka has 15) and rural upazilas (Dhaka has 5) at the same level.
 */
export function buildAddressSeedRows(): AddressSeedRow[] {
  const rows: AddressSeedRow[] = [];
  const divisionCode = new Map<string, string>();
  const districtCode = new Map<string, string>();

  const divisions = allDivisions();

  divisions.forEach((division, index) => {
    const code = addressCode("DIV", division);
    divisionCode.set(division, code);
    rows.push({
      category: ADDRESS_CATEGORY.divisions,
      label: division,
      code,
      parentCode: null,
      sortOrder: index,
    });
  });

  // One pass over the divisions gives every district its parent, instead of
  // rescanning all divisions per district.
  const divisionOfDistrict = new Map<string, string>();
  for (const division of divisions) {
    for (const district of districtsOf(division)) {
      if (!divisionOfDistrict.has(district)) divisionOfDistrict.set(district, division);
    }
  }

  allDistricts().forEach((district, index) => {
    const parentDivision = divisionOfDistrict.get(district);
    const code = addressCode("DST", district);
    districtCode.set(district, code);
    rows.push({
      category: ADDRESS_CATEGORY.districts,
      label: district,
      code,
      parentCode: (parentDivision && divisionCode.get(parentDivision)) || null,
      sortOrder: index,
    });
  });

  allUpazilas().forEach((entry, index) => {
    rows.push({
      category: ADDRESS_CATEGORY.upazilas,
      label: entry.upazila,
      code: addressCode("UPA", entry.district, entry.upazila),
      parentCode: districtCode.get(entry.district) ?? null,
      sortOrder: index,
    });
  });

  allThanas().forEach((entry, index) => {
    rows.push({
      category: ADDRESS_CATEGORY.thanas,
      label: entry.thana,
      code: addressCode("THA", entry.district, entry.thana),
      parentCode: districtCode.get(entry.district) ?? null,
      sortOrder: index,
    });
  });

  return rows;
}
