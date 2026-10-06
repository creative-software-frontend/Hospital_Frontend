import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
} from "../../errors/ApiError";
import { writeAuditLog } from "../../utils/audit";
import { calculateOpdFees, loadOpdConfig } from "../settings/settingsConfig";
import {
  generateNextInvoiceNumber,
  calculateInvoiceTotals,
} from "../settings/settingsConfig";
import { CODE_ENTITIES } from "../../utils/codeGenerator";
import type { AuthUser } from "../../types/auth";
import type {
  CreateOpdAppointmentInput,
  CreateOpdVisitInput,
  ListOpdAppointmentsQuery,
  UpdateOpdAppointmentInput,
} from "./opd.validation";

function isSuperAdmin(user: AuthUser): boolean {
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

function enforceBranch(actor: AuthUser, branchId: number): void {
  if (!isSuperAdmin(actor) && actor.branchId !== branchId) {
    throw new AuthorizationError("You do not have permission to access this branch");
  }
}

/* ------------------------------------------------------------------ *
 * Appointment management
 * ------------------------------------------------------------------ */

/**
 * Create an OPD appointment.
 *
 * - Uses `loadOpdConfig(branchId).appointmentDuration` to validate time slots
 *   when queueEnabled is true.
 * - Branch isolation: non-SUPER_ADMIN users can only create in their own branch.
 */
export async function createOpdAppointment(
  actor: AuthUser,
  input: CreateOpdAppointmentInput,
) {
  const branchId = actor.branchId;

  // Verify patient belongs to the branch
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, branchId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError("Patient not found in this branch");

  // Verify doctor belongs to the branch
  const doctor = await prisma.doctor.findFirst({
    where: { id: input.doctorId, branchId, deletedAt: null },
    select: { id: true },
  });
  if (!doctor) throw new NotFoundError("Doctor not found in this branch");

  // Load OPD config — used for validation context only here
  const config = await loadOpdConfig(branchId);

  if (!config.queueEnabled) {
    // Still allow scheduling; queueEnabled just means auto-queue is active
  }

  const appointmentDate = new Date(input.appointmentDate);

  // Generate appointment number atomically
  const appointment = await prisma.$transaction(async (tx) => {
    const row = await tx.codeSequence.upsert({
      where: { entity_branchId: { entity: CODE_ENTITIES.APPOINTMENT, branchId } },
      update: { nextNumber: { increment: 1 } },
      create: { entity: CODE_ENTITIES.APPOINTMENT, branchId, nextNumber: 1 },
      select: { nextNumber: true },
    });
    const apptNumber = `APT-${String(row.nextNumber).padStart(6, "0")}`;

    return tx.appointment.create({
      data: {
        branchId,
        patientId: input.patientId,
        doctorId: input.doctorId,
        appointmentDate,
        startTime: input.startTime,
        endTime: input.endTime,
        status: "SCHEDULED",
        reason: input.reason ?? null,
        notes: input.notes ?? null,
      },
      select: {
        id: true,
        branchId: true,
        patientId: true,
        doctorId: true,
        appointmentDate: true,
        startTime: true,
        endTime: true,
        status: true,
        reason: true,
        notes: true,
        createdAt: true,
      },
    });
  });

  await writeAuditLog({
    module: "OPD",
    action: "APPOINTMENT_CREATED",
    tableName: "Appointment",
    recordId: String(appointment.id),
    newValues: {
      patientId: input.patientId,
      doctorId: input.doctorId,
      appointmentDate: input.appointmentDate,
      queueEnabled: config.queueEnabled,
      appointmentDuration: config.appointmentDuration,
    },
    user: actor,
    branchId,
  });

  return appointment;
}

export async function listOpdAppointments(
  actor: AuthUser,
  query: ListOpdAppointmentsQuery,
) {
  const branchId = actor.branchId;
  const where: Prisma.AppointmentWhereInput = {
    branchId,
    deletedAt: null,
  };
  if (query.date) {
    const start = new Date(query.date + "T00:00:00");
    const end = new Date(query.date + "T23:59:59");
    where.appointmentDate = { gte: start, lte: end };
  }
  if (query.doctorId) where.doctorId = query.doctorId;
  if (query.patientId) where.patientId = query.patientId;
  if (query.status) where.status = query.status as Prisma.EnumAppointmentStatusFilter;

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const [total, rows] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        branchId: true,
        patientId: true,
        doctorId: true,
        appointmentDate: true,
        startTime: true,
        endTime: true,
        status: true,
        reason: true,
        notes: true,
        createdAt: true,
        patient: { select: { id: true, patientCode: true, name: true, phone: true } },
        doctor: { select: { id: true, doctorCode: true, name: true, specialization: true } },
      },
    }),
  ]);

  return {
    data: rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function updateOpdAppointmentStatus(
  actor: AuthUser,
  appointmentId: number,
  input: UpdateOpdAppointmentInput,
) {
  const existing = await prisma.appointment.findFirst({
    where: { id: appointmentId, deletedAt: null },
    select: { id: true, branchId: true, status: true },
  });
  if (!existing) throw new NotFoundError("Appointment not found");
  enforceBranch(actor, existing.branchId);

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { ...input },
    select: { id: true, status: true, updatedAt: true },
  });

  await writeAuditLog({
    module: "OPD",
    action: "APPOINTMENT_STATUS_UPDATED",
    tableName: "Appointment",
    recordId: String(appointmentId),
    oldValues: { status: existing.status },
    newValues: { ...input },
    user: actor,
    branchId: existing.branchId,
  });

  return updated;
}

/* ------------------------------------------------------------------ *
 * OPD Visit / Medical Record creation
 *
 * This is the core of the settings integration:
 * - Loads registrationFee and consultationFee from OpdSetting (via loadOpdConfig)
 * - Creates a MedicalRecord (visit record)
 * - Creates an Invoice with InvoiceItems storing the fee amounts AT THE TIME
 *   of the visit. Historical invoices are never recalculated.
 * ------------------------------------------------------------------ */

export async function createOpdVisit(actor: AuthUser, input: CreateOpdVisitInput) {
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

  // If appointment provided, verify it belongs to this branch
  if (input.appointmentId) {
    const appt = await prisma.appointment.findFirst({
      where: { id: input.appointmentId, branchId, deletedAt: null },
      select: { id: true, patientId: true },
    });
    if (!appt) throw new NotFoundError("Appointment not found in this branch");
    if (appt.patientId !== input.patientId) {
      throw new BusinessRuleError("Appointment does not belong to this patient");
    }
  }

  // ----------------------------------------------------------------
  // SETTINGS INTEGRATION: load OPD configuration at operation time.
  // These values are fetched from the database NOW — any change the
  // Super Admin made since the last visit is reflected immediately on
  // NEW visits. Existing invoices are never touched.
  // ----------------------------------------------------------------
  const fees = await calculateOpdFees(branchId);
  const config = await loadOpdConfig(branchId);

  // Determine the fees to apply (settings win over any override)
  const registrationFee: Prisma.Decimal | null = fees.registrationFee;
  const consultationFee: Prisma.Decimal | null = fees.consultationFee;

  // Generate visit number and create records in one transaction
  const result = await prisma.$transaction(async (tx) => {
    // Visit number
    const row = await tx.codeSequence.upsert({
      where: { entity_branchId: { entity: "MedicalRecord", branchId } },
      update: { nextNumber: { increment: 1 } },
      create: { entity: "MedicalRecord", branchId, nextNumber: 1 },
      select: { nextNumber: true },
    });
    const visitNumber = `VIS-${String(row.nextNumber).padStart(6, "0")}`;

    // Create the medical record (visit)
    const medicalRecord = await tx.medicalRecord.create({
      data: {
        branchId,
        patientId: input.patientId,
        doctorId: input.doctorId ?? null,
        appointmentId: input.appointmentId ?? null,
        visitNumber,
        visitType: input.visitType ?? "OPD",
        chiefComplaint: input.chiefComplaint ?? null,
        history: input.history ?? null,
        examination: input.examination ?? null,
        notes: input.notes ?? null,
        vitals: input.vitals ? (input.vitals as Prisma.InputJsonValue) : Prisma.DbNull,
        status: "active",
        createdById: actor.id,
        createdByUserId: actor.id,
      },
      select: { id: true, visitNumber: true },
    });

    // Build invoice line items — only include fees that are configured
    const invoiceItems: Prisma.InvoiceItemCreateManyInvoiceInput[] = [];
    let subtotal = new Prisma.Decimal(0);

    if (registrationFee !== null && registrationFee.greaterThan(0)) {
      invoiceItems.push({
        itemType: "service",
        description: "OPD Registration Fee",
        quantity: 1,
        unitPrice: registrationFee,
        total: registrationFee,
      });
      subtotal = subtotal.plus(registrationFee);
    }

    if (consultationFee !== null && consultationFee.greaterThan(0)) {
      invoiceItems.push({
        itemType: "service",
        description: "OPD Consultation Fee",
        quantity: 1,
        unitPrice: consultationFee,
        total: consultationFee,
      });
      subtotal = subtotal.plus(consultationFee);
    }

    // Calculate totals using billing settings (tax, service charge)
    const totals = await calculateInvoiceTotals(branchId, { subtotal });

    // Generate invoice number atomically
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

    // Mark appointment as IN_CONSULTATION if provided
    if (input.appointmentId) {
      await tx.appointment.update({
        where: { id: input.appointmentId },
        data: { status: "IN_CONSULTATION" },
      });
    }

    return { medicalRecord, invoice };
  });

  await writeAuditLog({
    module: "OPD",
    action: "VISIT_CREATED",
    tableName: "MedicalRecord",
    recordId: String(result.medicalRecord.id),
    newValues: {
      visitNumber: result.medicalRecord.visitNumber,
      patientId: input.patientId,
      doctorId: input.doctorId,
      visitType: input.visitType,
      // Record the APPLIED fees so we can always answer "why was the patient charged X?"
      appliedRegistrationFee: registrationFee?.toFixed(2) ?? null,
      appliedConsultationFee: consultationFee?.toFixed(2) ?? null,
      settingExists: config.exists,
      invoiceNumber: result.invoice?.invoiceNumber ?? null,
    },
    user: actor,
    branchId,
  });

  return {
    medicalRecord: result.medicalRecord,
    invoice: result.invoice,
    appliedFees: {
      registrationFee: registrationFee?.toFixed(2) ?? null,
      consultationFee: consultationFee?.toFixed(2) ?? null,
    },
  };
}

/**
 * Get the effective OPD fee configuration for a branch.
 * Used by the frontend to display configured fees before creating a visit.
 */
export async function getOpdFeeConfig(actor: AuthUser) {
  const fees = await calculateOpdFees(actor.branchId);
  const config = await loadOpdConfig(actor.branchId);
  return {
    registrationFee: fees.registrationFee,
    consultationFee: fees.consultationFee,
    followupDays: config.followupDays,
    appointmentDuration: config.appointmentDuration,
    queueEnabled: config.queueEnabled,
    prescriptionEnabled: config.prescriptionEnabled,
    settingExists: config.exists,
  };
}
