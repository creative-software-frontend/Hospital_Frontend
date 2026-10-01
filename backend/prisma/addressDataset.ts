/**
 * Reads the vendored Bangladesh address dumps in `address-source/` and flattens
 * them into Master Data rows, top level first, so a parent row is always
 * present before the children that reference it by `parentCode`.
 *
 * The dumps are the published `divisions` / `districts` / `upazilas` /
 * `unions` tables. They are parsed rather than imported so the app never needs
 * the legacy tables, and so the hierarchy can be validated (parents resolve,
 * codes are unique) before a single row is written.
 *
 * Codes are derived from the name chain rather than the numeric id, so a row
 * keeps the same code across dataset updates. Where that could collide the
 * loader raises instead of writing a duplicate, because both unique keys on
 * Master Data would reject it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ADDRESS_CATEGORY, addressCode } from "../src/lib/bangladeshAddress";

const SOURCE_DIR = join(import.meta.dirname, "address-source");

export interface AddressRow {
  category: string;
  label: string;
  code: string;
  parentCode: string | null;
  sortOrder: number;
  bnName: string | null;
  lat: number | null;
  lon: number | null;
  url: string | null;
}

interface SourcePlace {
  id: number;
  parentId: number;
  name: string;
  bnName: string;
  lat: number | null;
  lon: number | null;
  url: string;
}

const ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  "0": "\0",
  b: "\b",
  Z: "\x1a",
};

/**
 * Minimal scanner for MySQL `INSERT ... VALUES` lists.
 *
 * A regex is not enough here: the dumps contain both `\'` and `''` escapes and
 * a literal apostrophe inside a name, and lat/lon arrive quoted while the ids
 * do not. This walks the tuples and hands back the raw field values.
 *
 * A dump is not one statement: `unions.sql` alone is seven. Each `VALUES` clause
 * is scanned separately, which also keeps the `INSERT INTO t (col, col)` column
 * list out of the results, since scanning always starts at the parenthesis that
 * follows `VALUES`.
 */
function scanTuples(sql: string): string[][] {
  const valuesRe = /\bVALUES\b/gi;
  const rows: string[][] = [];

  let clause = valuesRe.exec(sql);
  if (!clause) throw new Error("no VALUES clause found in dump");

  while (clause !== null) {
    const open = sql.indexOf("(", clause.index);
    if (open === -1) break;

    let row: string[] = [];
    let field = "";
    let inField = false;
    let inString = false;
    let closed = false;
    let i = open + 1;

    const push = (): void => {
      row.push(inField ? field.trim() : "");
      field = "";
      inField = false;
    };

    while (i < sql.length) {
      const c = sql[i] as string;

      if (inString) {
        if (c === "\\") {
          const next = sql[i + 1] ?? "";
          field += ESCAPES[next] ?? next;
          i += 2;
          continue;
        }
        if (c === "'") {
          if (sql[i + 1] === "'") {
            field += "'";
            i += 2;
            continue;
          }
          inString = false;
          i += 1;
          continue;
        }
        field += c;
        i += 1;
        continue;
      }

      if (c === "'") {
        inString = true;
        inField = true;
        i += 1;
        continue;
      }
      if (c === "(") {
        row = [];
        field = "";
        inField = false;
        i += 1;
        continue;
      }
      if (c === ")") {
        push();
        rows.push(row);
        closed = true;
        i += 1;
        continue;
      }
      if (c === ",") {
        // Two meanings: between tuples (right after a `)`) it is just a
        // separator, inside a tuple it ends the current field.
        if (closed) closed = false;
        else push();
        i += 1;
        continue;
      }
      if (c === ";" && closed) {
        break;
      }
      if (!/\s/.test(c) && !closed) {
        field += c;
        inField = true;
      }
      i += 1;
    }

    // Resume the search after this clause so the next INSERT is picked up.
    valuesRe.lastIndex = i;
    clause = valuesRe.exec(sql);
  }

  return rows;
}

function readDump(file: string): string[][] {
  return scanTuples(readFileSync(join(SOURCE_DIR, file), "utf8"));
}

const toNumber = (raw: string | undefined): number | null => {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** Empty and the literal string "null" both mean "not published". */
const toUrl = (raw: string | undefined): string | null => {
  const v = (raw ?? "").trim();
  return v === "" || v.toLowerCase() === "null" ? null : v;
};

/**
 * Approximates the `utf8mb4_unicode_ci` collation used by the unique key, so
 * labels that MySQL would consider equal ("Purba" vs "purba") are treated as a
 * collision here too, before the write fails.
 */
const ciKey = (label: string): string =>
  label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

function parse(file: string, kind: "root" | "child"): SourcePlace[] {
  return readDump(file).map((cols, index) => {
    if (kind === "root") {
      const [id, name, bnName, url] = cols as [string, string, string, string];
      return {
        id: Number(id),
        parentId: 0,
        name: name.trim(),
        bnName: bnName.trim(),
        lat: null,
        lon: null,
        url: toUrl(url) ?? "",
      };
    }
    if (cols.length === 7) {
      // districts: id, parent, name, bn_name, lat, lon, url
      const [id, parent, name, bnName, lat, lon, url] = cols as string[];
      return {
        id: Number(id),
        parentId: Number(parent),
        name: name.trim(),
        bnName: bnName.trim(),
        lat: toNumber(lat),
        lon: toNumber(lon),
        url: toUrl(url) ?? "",
      };
    }
    // upazilas / unions: id, parent, name, bn_name, url
    const [id, parent, name, bnName, url] = cols as string[];
    return {
      id: Number(id),
      parentId: Number(parent),
      name: name.trim(),
      bnName: bnName.trim(),
      lat: null,
      lon: null,
      url: toUrl(url) ?? "",
    };
  });
}

/**
 * Builds every address row, in hierarchy order.
 *
 * The published dataset repeats a handful of union names inside one upazila
 * (Natai under Palashpur, Awajpur under Khagrachhari, Talimpur under Mithamoin
 * and Bhojoanpur under Adamtighat). Both are real rows upstream but the second
 * of each pair cannot be stored as-is, because Master Data has a unique key on
 * (branch, category, parent, label). They are kept, not dropped, with a numeric
 * suffix on the label so no upstream record is lost.
 */
export function buildAddressRows(): AddressRow[] {
  const divisions = parse("divisions.sql", "root");
  const districts = parse("districts.sql", "child");
  const upazilas = parse("upazilas.sql", "child");
  const unions = parse("unions.sql", "child");

  const rows: AddressRow[] = [];
  const divisionCode = new Map<number, string>();
  const districtCode = new Map<number, string>();
  const upazilaCode = new Map<number, string>();
  const seenCode = new Set<string>();
  const seenLabel = new Set<string>();

  const toRow = (
    place: SourcePlace,
    category: string,
    prefix: string,
    parentCode: string | null,
    sortOrder: number,
  ): AddressRow => {
    let label = place.name;
    // (parent, label) is a unique key, so a repeat gets a numeric suffix rather
    // than being dropped. The code follows the label, keeping both keys unique.
    const labelKey = `${category}|${parentCode ?? ""}|${ciKey(label)}`;
    if (seenLabel.has(labelKey)) {
      for (let n = 2; ; n += 1) {
        const candidate = `${label} (${n})`;
        const candidateKey = `${category}|${parentCode ?? ""}|${ciKey(candidate)}`;
        if (!seenLabel.has(candidateKey)) {
          label = candidate;
          seenLabel.add(candidateKey);
          break;
        }
      }
    } else {
      seenLabel.add(labelKey);
    }

    const code = addressCode(prefix, ...(parentCode ? [parentCode] : []), label);
    if (seenCode.has(`${category}|${code}`)) {
      throw new Error(
        `code collision in ${category}: "${code}" is produced by more than one place. ` +
          `The dataset changed shape and the code scheme needs a look.`,
      );
    }
    seenCode.add(`${category}|${code}`);

    return {
      category,
      label,
      code,
      parentCode,
      sortOrder,
      bnName: place.bnName || null,
      lat: place.lat,
      lon: place.lon,
      url: place.url || null,
    };
  };

  const requireParent = (
    id: number,
    code: string | undefined,
    kind: string,
  ): string => {
    if (!code) throw new Error(`${kind} id=${id} has no parent in the dataset`);
    return code;
  };

  divisions.forEach((division, index) => {
    const row = toRow(division, ADDRESS_CATEGORY.divisions, "DIV", null, index);
    divisionCode.set(division.id, row.code);
    rows.push(row);
  });

  districts.forEach((district, index) => {
    const parent = requireParent(
      district.parentId,
      divisionCode.get(district.parentId),
      "district",
    );
    const row = toRow(district, ADDRESS_CATEGORY.districts, "DST", parent, index);
    districtCode.set(district.id, row.code);
    rows.push(row);
  });

  upazilas.forEach((upazila, index) => {
    const parent = requireParent(
      upazila.parentId,
      districtCode.get(upazila.parentId),
      "upazila",
    );
    const row = toRow(upazila, ADDRESS_CATEGORY.upazilas, "UPA", parent, index);
    upazilaCode.set(upazila.id, row.code);
    rows.push(row);
  });

  unions.forEach((union, index) => {
    const parent = requireParent(union.parentId, upazilaCode.get(union.parentId), "union");
    rows.push(toRow(union, ADDRESS_CATEGORY.unions, "UNI", parent, index));
  });

  return rows;
}
