import { Prisma } from "@prisma/client";

export const CODE_ENTITIES = {
  PATIENT: "Patient",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  SERVICE: "Service",
  EMPLOYEE: "Employee",
  INVOICE: "Invoice",
  RECEIPT: "Receipt",
  ADMISSION: "Admission",
  APPOINTMENT: "Appointment",
  LAB_ORDER: "LabOrder",
  PRESCRIPTION: "Prescription",
  EMERGENCY: "Emergency",
  BRANCH: "Branch",
} as const;

export type CodeEntity = (typeof CODE_ENTITIES)[keyof typeof CODE_ENTITIES];

const ENTITY_PREFIX: Record<CodeEntity, string> = {
  [CODE_ENTITIES.PATIENT]: "PAT",
  [CODE_ENTITIES.DOCTOR]: "DOC",
  [CODE_ENTITIES.NURSE]: "NUR",
  [CODE_ENTITIES.SERVICE]: "SRV",
  [CODE_ENTITIES.EMPLOYEE]: "EMP",
  [CODE_ENTITIES.INVOICE]: "INV",
  [CODE_ENTITIES.RECEIPT]: "RCT",
  [CODE_ENTITIES.ADMISSION]: "ADM",
  [CODE_ENTITIES.APPOINTMENT]: "APT",
  [CODE_ENTITIES.LAB_ORDER]: "LAB",
  [CODE_ENTITIES.PRESCRIPTION]: "RX",
  [CODE_ENTITIES.EMERGENCY]: "EMR",
  [CODE_ENTITIES.BRANCH]: "BR",
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

/**
 * Reads the next sequence number without claiming it, so a form can preview the
 * code it is about to receive. The real code is still issued atomically at
 * create time by `nextCodeNumber`.
 *
 * `CodeSequence.nextNumber` holds the number of the LAST code issued (it starts
 * at 1 on the first claim and increments on every claim after that), so the
 * next code is one past it — or 1 when no row exists yet.
 */
export async function peekNextCodeNumber(
  tx: Prisma.TransactionClient,
  entity: CodeEntity,
  branchId: number,
): Promise<number> {
  const row = await tx.codeSequence.findUnique({
    where: { entity_branchId: { entity, branchId } },
    select: { nextNumber: true },
  });
  return (row?.nextNumber ?? 0) + 1;
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
