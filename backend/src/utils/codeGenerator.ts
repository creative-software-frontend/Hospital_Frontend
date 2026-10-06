import { Prisma } from "@prisma/client";

export const CODE_ENTITIES = {
  PATIENT: "Patient",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  SERVICE: "Service",
} as const;

export type CodeEntity = (typeof CODE_ENTITIES)[keyof typeof CODE_ENTITIES];

const ENTITY_PREFIX: Record<CodeEntity, string> = {
  [CODE_ENTITIES.PATIENT]: "PAT",
  [CODE_ENTITIES.DOCTOR]: "DOC",
  [CODE_ENTITIES.NURSE]: "NUR",
  [CODE_ENTITIES.SERVICE]: "SRV",
};

const DEFAULT_PADDING = 6;

/**
 * Strips trailing separators so a configured prefix may be stored either as
 * "PAT" or "PAT-" without producing "PAT--000001".
 */
export function normalizeCodePrefix(prefix: string | null | undefined): string {
  return (prefix ?? "").trim().replace(/[-\s]+$/, "");
}

export function formatBusinessCode(
  prefix: string,
  sequence: number,
  padding = DEFAULT_PADDING,
): string {
  return `${normalizeCodePrefix(prefix)}-${String(sequence).padStart(padding, "0")}`;
}

/**
 * Atomically claims the next sequence number for a (branch, entity) pair.
 * Must be called inside a $transaction so the increment is rolled back
 * together with the record it belongs to. The MySQL upsert serialises
 * concurrent claims on the unique (entity, branchId) row.
 */
export async function nextCodeNumber(
  tx: Prisma.TransactionClient,
  entity: CodeEntity,
  branchId: number,
): Promise<number> {
  const row = await tx.codeSequence.upsert({
    where: { entity_branchId: { entity, branchId } },
    update: { nextNumber: { increment: 1 } },
    create: { entity, branchId, nextNumber: 1 },
    select: { nextNumber: true },
  });
  return row.nextNumber;
}

export async function generateBusinessCode(
  tx: Prisma.TransactionClient,
  entity: CodeEntity,
  branchId: number,
  options?: { prefix?: string | null; padding?: number },
): Promise<string> {
  const sequence = await nextCodeNumber(tx, entity, branchId);
  // A branch-configured prefix wins; the built-in one is the fallback for the
  // entities that have no configurable prefix (doctor, nurse, service).
  const prefix = options?.prefix?.trim() ? options.prefix : ENTITY_PREFIX[entity];
  return formatBusinessCode(prefix, sequence, options?.padding ?? DEFAULT_PADDING);
}
