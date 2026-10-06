import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
} from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import {
  calculateIpdFees,
  loadIpdConfig,
  generateNextInvoiceNumber,
  calculateInvoiceTotals,
} from "../settings/settingsConfig";
import type { AuthUser } from "../../types/auth";
import type {
  CreateAdmissionInput,
  DischargeAdmissionInput,
  ListAdmissionsQuery,
  TransferBedInput,
} from "./ipd.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

function enforceBranch(actor: AuthUser, branchId: number): void {
  if (!isSuperAdmin(actor) && actor.branchId !== branchId) {
    throw new AuthorizationError("You do not have permission to access this branch");
  }
}

/* ------------------------------------------------------------------ *
 * IPD Admission — settings integration point
 *
 * Loads admissionFee, bedCharge, nursingCharge, serviceCharge from
 * IpdSetting and stores them in the invoice at the time of admission.
 * Historical invoices are never recalculated.
 * ------------------------------------------------------------------ */

export async function createAdmission(actor: AuthUser, input: CreateAdmissionInput) {
  const branchId = actor.branchId;

  // Verify patient
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, branchId, deletedAt: null },
    select: { id: true, patientCode: true, name: true },
  });
  if (!patient) throw new NotFoundError("Patient not found in this branch");

  // Verify doctor if provided
  if (input.doctorId) {
    const doctor = await prisma.doctor.findFirst({
      where: { id: input.doctorId, branchId, deletedAt: null },
      select: { id: true },
    });
    if (!doctor) throw new NotFoundError("Doctor not found in this branch");
  }

  // Verify bed and mark it occupied
  let bedInfo: { id: number; bedNumber: string; rate: Prisma.Decimal | null } | null = null;
  if (input.bedId) {
    bedInfo = await prisma.bed.findFirst({
      where: { id: input.bedId, branchId, status: "available" },
      select: { id: true, bedNumber: true, rate: true },
    });
    if (!bedInfo) throw new BusinessRuleError("Bed not found or not available in this branch");
  }

  // ----------------------------------------------------------------
  // SETTINGS INTEGRATION: Load IPD fee configuration at admission time.
  // The fees stored in the invoice items are the values that were
  // configured when the admission was created. Changing IPD settings
  // after this point will NOT affect this admission's invoice.
  // ----------------------------------------------------------------
  const fees = await calculateIpdFees(branchId);
  const config = await loadIpdConfig(branchId);

  const result = await prisma.$transaction(async (tx) => {
    // Generate admission number atomically
    const row = await tx.codeSequence.upsert({
      where: { entity_branchId: { entity: "Admission", branchId } },
      update: { nextNumber: { increment: 1 } },
      create: { entity: "Admission", branchId, nextNumber: 1 },
      select: { nextNumber: true },
    });
    const admissionNumber = `ADM-${String(row.nextNumber).padStart(6, "0")}`;

    // Mark bed as occupied
    if (input.bedId) {
      await tx.bed.update({
        where: { id: input.bedId },
        data: { status: "occupied" },
      });
    }

    // Build invoice items from IPD settings
    const invoiceItems: Prisma.InvoiceItemCreateManyInvoiceInput[] = [];
    let subtotal = new Prisma.Decimal(0);

    if (fees.admissionFee !== null && fees.admissionFee.greaterThan(0)) {
      invoiceItems.push({
        itemType: "admission",
        description: "IPD Admission Fee",
        quantity: 1,
        unitPrice: fees.admissionFee,
        total: fees.admissionFee,
      });
      subtotal = subtotal.plus(fees.admissionFee);
    }

    // Bed charge — use the bed's own rate if set, otherwise fall back to IPD setting
    const effectiveBedCharge = bedInfo?.rate ?? fees.bedCharge;
    if (effectiveBedCharge !== null && effectiveBedCharge.greaterThan(0)) {
      invoiceItems.push({
        itemType: "bed",
        description: `Bed Charge (${bedInfo?.bedNumber ?? "General"}) — Day 1`,
        quantity: 1,
        unitPrice: effectiveBedCharge,
        total: effectiveBedCharge,
      });
      subtotal = subtotal.plus(effectiveBedCharge);
    }

    if (fees.nursingCharge !== null && fees.nursingCharge.greaterThan(0)) {
      invoiceItems.push({
        itemType: "service",
        description: "IPD Nursing Charge — Day 1",
        quantity: 1,
        unitPrice: fees.nursingCharge,
        total: fees.nursingCharge,
      });
      subtotal = subtotal.plus(fees.nursingCharge);
    }

    if (fees.serviceCharge !== null && fees.serviceCharge.greaterThan(0)) {
      invoiceItems.push({
        itemType: "service",
        description: "IPD Service Charge",
        quantity: 1,
        unitPrice: fees.serviceCharge,
        total: fees.serviceCharge,
      });
      subtotal = subtotal.plus(fees.serviceCharge);
    }

    const totals = await calculateInvoiceTotals(branchId, { subtotal });
    const invoiceNumber = await generateNextInvoiceNumber(tx, branchId);

    // Create invoice
    let invoice: { id: number; invoiceNumber: string } | null = null;
    if (invoiceItems.length > 0) {
      invoice = await tx.invoice.create({
        data: {
          branchId,
          patientId: input.patientId,
          invoiceNumber,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          total: totals.grandTotal,
          paidAmount: new Prisma.Decimal(0),
          dueAmount: totals.grandTotal,
          status: "PENDING",
          issuedAt: new Date(),
          createdById: actor.id,
          items: { createMany: { data: invoiceItems } },
        },
        select: { id: true, invoiceNumber: true },
      });
    }

    // Create admission record
    const admission = await tx.admission.create({
      data: {
        branchId,
        patientId: input.patientId,
        doctorId: input.doctorId ?? null,
        bedId: input.bedId ?? null,
        admissionNumber,
        admissionDate: new Date(),
        expectedDischargeDate: input.expectedDischargeDate
          ? new Date(input.expectedDischargeDate)
          : null,
        status: "ADMITTED",
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        invoiceId: invoice?.id ?? null,
        createdById: actor.id,
      },
      select: {
        id: true,
        admissionNumber: true,
        status: true,
        admissionDate: true,
        bedId: true,
      },
    });

    return { admission, invoice };
  });

  await writeAuditLog({
    module: "IPD",
    action: "ADMISSION_CREATED",
    tableName: "Admission",
    recordId: String(result.admission.id),
    newValues: {
      admissionNumber: result.admission.admissionNumber,
      patientId: input.patientId,
      doctorId: input.doctorId,
      bedId: input.bedId,
      // Snapshot of the applied fees at admission time
      appliedAdmissionFee: fees.admissionFee?.toFixed(2) ?? null,
      appliedBedCharge: (bedInfo?.rate ?? fees.bedCharge)?.toFixed(2) ?? null,
      appliedNursingCharge: fees.nursingCharge?.toFixed(2) ?? null,
      appliedServiceCharge: fees.serviceCharge?.toFixed(2) ?? null,
      settingExists: config.exists,
      invoiceNumber: result.invoice?.invoiceNumber ?? null,
    },
    user: actor,
    branchId,
  });

  return {
    admission: result.admission,
    invoice: result.invoice,
    appliedFees: {
      admissionFee: fees.admissionFee?.toFixed(2) ?? null,
      bedCharge: (bedInfo?.rate ?? fees.bedCharge)?.toFixed(2) ?? null,
      nursingCharge: fees.nursingCharge?.toFixed(2) ?? null,
      serviceCharge: fees.serviceCharge?.toFixed(2) ?? null,
    },
  };
}

export async function listAdmissions(actor: AuthUser, query: ListAdmissionsQuery) {
  const branchId = actor.branchId;
  const where: Prisma.AdmissionWhereInput = { branchId, deletedAt: null };
  if (query.status) where.status = query.status as Prisma.EnumAdmissionStatusFilter;
  if (query.patientId) where.patientId = query.patientId;
  if (query.doctorId) where.doctorId = query.doctorId;

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const [total, rows] = await Promise.all([
    prisma.admission.count({ where }),
    prisma.admission.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { admissionDate: "desc" },
      select: {
        id: true,
        admissionNumber: true,
        status: true,
        admissionDate: true,
        dischargeDate: true,
        reason: true,
        invoiceId: true,
        patient: { select: { id: true, patientCode: true, name: true } },
        doctor: { select: { id: true, name: true, doctorCode: true } },
        bed: { select: { id: true, bedNumber: true, bedClass: true } },
      },
    }),
  ]);

  return {
    data: rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function dischargeAdmission(
  actor: AuthUser,
  admissionId: number,
  input: DischargeAdmissionInput,
) {
  const existing = await prisma.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: { id: true, branchId: true, status: true, bedId: true, invoiceId: true, patientId: true },
  });
  if (!existing) throw new NotFoundError("Admission not found");
  enforceBranch(actor, existing.branchId);

  if (existing.status !== "ADMITTED") {
    throw new BusinessRuleError("Only active admissions can be discharged");
  }

  // Load discharge fee from settings
  const fees = await calculateIpdFees(existing.branchId);

  const result = await prisma.$transaction(async (tx) => {
    // Free the bed
    if (existing.bedId) {
      await tx.bed.update({ where: { id: existing.bedId }, data: { status: "available" } });
    }

    // Add discharge fee to the existing invoice if present
    if (existing.invoiceId && fees.dischargeFee !== null && fees.dischargeFee.greaterThan(0)) {
      await tx.invoiceItem.create({
        data: {
          invoiceId: existing.invoiceId,
          itemType: "service",
          description: "IPD Discharge Fee",
          quantity: 1,
          unitPrice: fees.dischargeFee,
          total: fees.dischargeFee,
        },
      });

      // Recalculate invoice total by adding the discharge fee
      const currentInvoice = await tx.invoice.findUnique({
        where: { id: existing.invoiceId },
        select: { total: true, dueAmount: true },
      });
      if (currentInvoice) {
        const newTotal = (currentInvoice.total ?? new Prisma.Decimal(0)).plus(fees.dischargeFee);
        const newDue = (currentInvoice.dueAmount ?? new Prisma.Decimal(0)).plus(fees.dischargeFee);
        await tx.invoice.update({
          where: { id: existing.invoiceId },
          data: { total: newTotal, dueAmount: newDue },
        });
      }
    }

    const updated = await tx.admission.update({
      where: { id: admissionId },
      data: {
        status: "DISCHARGED",
        dischargeDate: input.dischargeDate ? new Date(input.dischargeDate) : new Date(),
        notes: input.notes ?? undefined,
        updatedById: actor.id,
      },
      select: { id: true, admissionNumber: true, status: true, dischargeDate: true },
    });

    return updated;
  });

  await writeAuditLog({
    module: "IPD",
    action: "ADMISSION_DISCHARGED",
    tableName: "Admission",
    recordId: String(admissionId),
    oldValues: { status: existing.status },
    newValues: {
      status: "DISCHARGED",
      appliedDischargeFee: fees.dischargeFee?.toFixed(2) ?? null,
    },
    user: actor,
    branchId: existing.branchId,
  });

  return result;
}

export async function transferBed(
  actor: AuthUser,
  admissionId: number,
  input: TransferBedInput,
) {
  const existing = await prisma.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: { id: true, branchId: true, status: true, bedId: true },
  });
  if (!existing) throw new NotFoundError("Admission not found");
  enforceBranch(actor, existing.branchId);

  if (existing.status !== "ADMITTED") {
    throw new BusinessRuleError("Only active admissions can have beds transferred");
  }

  // Verify new bed is available
  const newBed = await prisma.bed.findFirst({
    where: { id: input.newBedId, branchId: existing.branchId, status: "available" },
    select: { id: true, bedNumber: true },
  });
  if (!newBed) throw new BusinessRuleError("New bed not found or not available");

  await prisma.$transaction(async (tx) => {
    // Free the old bed
    if (existing.bedId) {
      await tx.bed.update({ where: { id: existing.bedId }, data: { status: "available" } });
    }
    // Occupy the new bed
    await tx.bed.update({ where: { id: input.newBedId }, data: { status: "occupied" } });
    // Update admission
    await tx.admission.update({
      where: { id: admissionId },
      data: { bedId: input.newBedId, status: "TRANSFERRED", updatedById: actor.id },
    });
  });

  await writeAuditLog({
    module: "IPD",
    action: "BED_TRANSFERRED",
    tableName: "Admission",
    recordId: String(admissionId),
    oldValues: { bedId: existing.bedId },
    newValues: { bedId: input.newBedId, reason: input.reason },
    user: actor,
    branchId: existing.branchId,
  });

  return { admissionId, oldBedId: existing.bedId, newBedId: input.newBedId };
}

/**
 * Get the effective IPD fee configuration for a branch.
 */
export async function getIpdFeeConfig(actor: AuthUser) {
  const fees = await calculateIpdFees(actor.branchId);
  const config = await loadIpdConfig(actor.branchId);
  return { ...fees, settingExists: config.exists };
}
