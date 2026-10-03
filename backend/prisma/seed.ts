import "dotenv/config";
import { PaymentMethodType, PrismaClient } from "@prisma/client";
import { LOOKUP_SPECS, type MasterDataCategory } from "../src/lib/masterDataRegistry";
import { branchScope, lookupDelegate } from "../src/lib/lookupDelegate";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, seedDemoAccounts } from "./demoAccounts";

const prisma = new PrismaClient();

/* ---------------------------------------------------------------------------
 * Production guard
 *
 * This script writes a login with a well-known password and replaces reference
 * data. That is the point in development and unacceptable against a real
 * database, so refuse unless the deployer explicitly opts in.
 * ------------------------------------------------------------------------- */
if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
  console.error(
    "Refusing to seed: NODE_ENV=production.\n" +
      "The seed creates a bootstrap admin with a known password and rewrites reference data.\n" +
      "If this is genuinely intended, re-run with SEED_ALLOW_PRODUCTION=true.",
  );
  process.exit(1);
}

/* ---------------------------------------------------------------------------
 * Configuration (overridable via env)
 * ------------------------------------------------------------------------- */
const SEED_BRANCH = {
  name: process.env.SEED_BRANCH_NAME || "Main Branch",
  code: process.env.SEED_BRANCH_CODE || "MAIN",
  registrationNo: "",
  address: "123 Hospital Road",
  city: "Dhaka",
  country: "Bangladesh",
  phone: "",
  email: "",
  currency: "BDT",
  timezone: "Asia/Dhaka",
};

type RoleKey = "SUPER_ADMIN" | "ADMIN" | "DOCTOR" | "PHARMACIST" | "PATHOLOGIST"
  | "RADIOLOGIST" | "ACCOUNTANT" | "RECEPTIONIST" | "NURSE";

const ROLE_NAMES: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  PHARMACIST: "Pharmacist",
  PATHOLOGIST: "Pathologist",
  RADIOLOGIST: "Radiologist",
  ACCOUNTANT: "Accountant",
  RECEPTIONIST: "Receptionist",
  NURSE: "Nurse",
};

const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  SUPER_ADMIN: "Unrestricted cross-branch system administrator",
  ADMIN: "Branch-level administrator with broad management rights",
  DOCTOR: "Clinical staff managing patients, appointments, records and prescriptions",
  PHARMACIST: "Pharmacy staff managing medicines and stock movements",
  PATHOLOGIST: "Laboratory staff managing lab tests, orders and results",
  RADIOLOGIST: "Imaging staff managing imaging orders and reports",
  ACCOUNTANT: "Finance staff managing invoices, payments and accounts",
  RECEPTIONIST: "Front desk managing patients and appointments",
  NURSE: "Ward staff managing beds, admissions and care records",
};

/* ---------------------------------------------------------------------------
 * Permission matrix: role -> set of "module:action" permissions.
 * SUPER_ADMIN is auto-granted every permission defined below.
 * ------------------------------------------------------------------------- */

type PermissionDef = { module: string; action: string; description: string };

const PERMISSIONS: PermissionDef[] = [
  // Core identity & access (Phase 3B)
  { module: "auth", action: "read", description: "Access own authentication profile" },
  { module: "user", action: "read", description: "View users" },
  { module: "user", action: "create", description: "Create users" },
  { module: "user", action: "update", description: "Update users" },
  { module: "role", action: "read", description: "View roles and their permissions" },
  { module: "role", action: "update", description: "Modify roles and their permissions" },
  { module: "permission", action: "read", description: "View the permission catalog" },
  { module: "audit", action: "read", description: "View audit logs" },

  // Patients & appointments
  { module: "patient", action: "read", description: "View patients" },
  { module: "patient", action: "create", description: "Create patients" },
  { module: "patient", action: "update", description: "Update patients" },
  { module: "patient", action: "delete", description: "Soft-delete patients" },
  { module: "appointment", action: "read", description: "View appointments" },
  { module: "appointment", action: "create", description: "Create appointments" },
  { module: "appointment", action: "update", description: "Update appointments" },

  // Clinical
  { module: "medicalRecord", action: "read", description: "View medical records" },
  { module: "medicalRecord", action: "create", description: "Create medical records" },
  { module: "medicalRecord", action: "update", description: "Update medical records" },
  { module: "prescription", action: "read", description: "View prescriptions" },
  { module: "prescription", action: "create", description: "Create prescriptions" },
  { module: "prescription", action: "update", description: "Update prescriptions" },

  // Admission / bed / ward
  { module: "admission", action: "read", description: "View admissions" },
  { module: "admission", action: "update", description: "Update admissions" },
  { module: "bed", action: "read", description: "View beds" },
  { module: "bed", action: "update", description: "Allocate beds" },

  // Pharmacy / inventory
  { module: "medicine", action: "read", description: "View medicines" },
  { module: "medicine", action: "update", description: "Update medicine catalog" },
  { module: "stockMovement", action: "read", description: "View stock movements" },
  { module: "stockMovement", action: "create", description: "Record stock movements" },
  { module: "inventory", action: "read", description: "View inventory" },
  { module: "inventory", action: "update", description: "Update inventory" },

  // Laboratory
  { module: "labTest", action: "read", description: "View lab tests" },
  { module: "labOrder", action: "read", description: "View lab orders" },
  { module: "labOrder", action: "update", description: "Update lab orders" },
  { module: "labResult", action: "read", description: "View lab results" },
  { module: "labResult", action: "create", description: "Record lab results" },
  { module: "labResult", action: "update", description: "Update lab results" },

  // Imaging
  { module: "imaging", action: "read", description: "View imaging studies" },
  { module: "imaging", action: "create", description: "Capture imaging studies" },
  { module: "imaging", action: "update", description: "Update imaging reports" },

  // Billing & finance
  { module: "invoice", action: "read", description: "View invoices" },
  { module: "invoice", action: "create", description: "Create invoices" },
  { module: "payment", action: "read", description: "View payments" },
  { module: "payment", action: "create", description: "Record payments" },
  { module: "account", action: "read", description: "View accounts" },
  { module: "accountingTransaction", action: "read", description: "View accounting transactions" },
  { module: "accountingTransaction", action: "create", description: "Create accounting transactions" },

  // Settings & configuration (Group A)
  { module: "systemSetting", action: "read", description: "View general/system settings" },
  { module: "systemSetting", action: "update", description: "Update general/system settings" },
  { module: "securitySetting", action: "read", description: "View security settings" },
  { module: "securitySetting", action: "update", description: "Update security settings" },
  { module: "branch", action: "read", description: "View branches" },
  { module: "branch", action: "update", description: "Update branch information" },
  { module: "branch", action: "create", description: "Create branches" },

  // Hospital configuration (Group B)
  { module: "department", action: "read", description: "View departments" },
  { module: "department", action: "create", description: "Create departments" },
  { module: "department", action: "update", description: "Update departments" },
  { module: "doctor", action: "read", description: "View doctors" },
  { module: "doctor", action: "create", description: "Create doctors" },
  { module: "doctor", action: "update", description: "Update doctors" },
  { module: "nurse", action: "read", description: "View nurses" },
  { module: "nurse", action: "create", description: "Create nurses" },
  { module: "nurse", action: "update", description: "Update nurses" },
  { module: "service", action: "read", description: "View billable services" },
  { module: "service", action: "create", description: "Create services" },
  { module: "service", action: "update", description: "Update services" },

  // Patient configuration (Group B)
  { module: "patientSetting", action: "read", description: "View patient registration settings" },
  { module: "patientSetting", action: "update", description: "Update patient registration settings" },

  // Clinical settings (Group B)
  { module: "opdSetting", action: "read", description: "View OPD settings" },
  { module: "opdSetting", action: "update", description: "Update OPD settings" },
  { module: "ipdSetting", action: "read", description: "View IPD settings" },
  { module: "ipdSetting", action: "update", description: "Update IPD settings" },
  { module: "emergencySetting", action: "read", description: "View emergency settings" },
  { module: "emergencySetting", action: "update", description: "Update emergency settings" },
  { module: "prescriptionSetting", action: "read", description: "View prescription settings" },
  { module: "prescriptionSetting", action: "update", description: "Update prescription settings" },

  // Pharmacy settings (Group B)
  { module: "pharmacySetting", action: "read", description: "View pharmacy settings" },
  { module: "pharmacySetting", action: "update", description: "Update pharmacy settings" },

  // Laboratory settings (Group B)
  { module: "labSetting", action: "read", description: "View laboratory settings" },
  { module: "labSetting", action: "update", description: "Update laboratory settings" },

  // Billing settings (Group B)
  { module: "billingSetting", action: "read", description: "View billing settings" },
  { module: "billingSetting", action: "update", description: "Update billing settings" },

  // Accounting settings (Group B)
  { module: "accountingSetting", action: "read", description: "View accounting settings" },
  { module: "accountingSetting", action: "update", description: "Update accounting settings" },

  // HR & Payroll settings (Group B)
  { module: "hrSetting", action: "read", description: "View HR & payroll settings" },
  { module: "hrSetting", action: "update", description: "Update HR & payroll settings" },

  // Inventory settings (Group B)
  { module: "inventorySetting", action: "read", description: "View inventory settings" },
  { module: "inventorySetting", action: "update", description: "Update inventory settings" },

  // Notification settings (Group B)
  { module: "notificationSetting", action: "read", description: "View notification settings" },
  { module: "notificationSetting", action: "update", description: "Update notification settings" },

  // Print & document templates (Group B)
  { module: "printSetting", action: "read", description: "View print & document templates" },
  { module: "printSetting", action: "create", description: "Create print & document templates" },
  { module: "printSetting", action: "update", description: "Update print & document templates" },

  // API & Integration (Group B)
  { module: "integrationSetting", action: "read", description: "View API & integrations" },
  { module: "integrationSetting", action: "create", description: "Create API integrations" },
  { module: "integrationSetting", action: "update", description: "Update and test API integrations" },

  // Backup & Database (Group B)
  { module: "backupSetting", action: "read", description: "View backup & database settings" },
  { module: "backupSetting", action: "update", description: "Update settings and run backups" },

  // Reports (Group B)
  { module: "reportSetting", action: "read", description: "View report configurations" },
  { module: "reportSetting", action: "create", description: "Create report configurations" },
  { module: "reportSetting", action: "update", description: "Update report configurations" },

  // Master Data (Group B)
  { module: "masterData", action: "read", description: "View master/reference data" },
  { module: "masterData", action: "create", description: "Create master data items" },
  { module: "masterData", action: "update", description: "Update master data items" },

  // Localization (Group B)
  { module: "localizationSetting", action: "read", description: "View localization settings" },
  { module: "localizationSetting", action: "update", description: "Update localization settings" },

  // System Maintenance (Group B)
  { module: "systemMaintenance", action: "read", description: "View system health & maintenance" },
  { module: "systemMaintenance", action: "update", description: "Run maintenance tools" },
];

const MATRIX: Record<RoleKey, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => `${p.module}:${p.action}`),
  ADMIN: [
    "user:read", "user:create", "user:update", "role:read", "permission:read", "audit:read",
    "patient:read", "patient:create", "patient:update", "patient:delete",
    "appointment:read", "appointment:create", "appointment:update",
    "branch:read", "branch:update", "systemSetting:read", "systemSetting:update", "securitySetting:read",
    "department:read", "department:create", "department:update",
    "doctor:read", "doctor:create", "doctor:update",
    "nurse:read", "nurse:create", "nurse:update",
    "service:read", "service:create", "service:update",
    "patientSetting:read", "patientSetting:update",
    "opdSetting:read", "opdSetting:update",
    "ipdSetting:read", "ipdSetting:update",
    "emergencySetting:read", "emergencySetting:update",
    "prescriptionSetting:read", "prescriptionSetting:update",
    "pharmacySetting:read", "pharmacySetting:update",
    "labSetting:read", "labSetting:update",
    "billingSetting:read", "billingSetting:update",
    "accountingSetting:read", "accountingSetting:update",
    "hrSetting:read", "hrSetting:update",
    "inventorySetting:read", "inventorySetting:update",
    "notificationSetting:read", "notificationSetting:update",
    "printSetting:read", "printSetting:create", "printSetting:update",
    "integrationSetting:read", "integrationSetting:create", "integrationSetting:update",
    "backupSetting:read", "backupSetting:update",
    "reportSetting:read", "reportSetting:create", "reportSetting:update",
    "masterData:read", "masterData:create", "masterData:update",
    "localizationSetting:read", "localizationSetting:update",
    "systemMaintenance:read", "systemMaintenance:update",
  ],
  DOCTOR: [
    "localizationSetting:read",
    "auth:read", "patient:read", "patient:create", "patient:update",
    "appointment:read", "appointment:update",
    "medicalRecord:read", "medicalRecord:create", "medicalRecord:update",
    "prescription:read", "prescription:create", "prescription:update",
    "admission:read", "bed:read", "labOrder:read", "labOrder:update",
    "imaging:read", "imaging:create", "imaging:update",
    "department:read", "doctor:read", "service:read",
  ],
  PHARMACIST: [
    "localizationSetting:read",
    "auth:read", "medicine:read", "medicine:update", "prescription:read",
    "stockMovement:read", "stockMovement:create", "inventory:read", "inventory:update",
  ],
  PATHOLOGIST: [
    "localizationSetting:read",
    "auth:read", "labTest:read", "labOrder:read", "labOrder:update",
    "labResult:read", "labResult:create", "labResult:update",
  ],
  RADIOLOGIST: ["localizationSetting:read", "auth:read", "imaging:read", "imaging:create", "imaging:update"],
  ACCOUNTANT: [
    "localizationSetting:read",
    "auth:read", "invoice:read", "invoice:create", "payment:read", "payment:create",
    "account:read", "accountingTransaction:read", "accountingTransaction:create",
  ],
  RECEPTIONIST: [
    "localizationSetting:read",
    "auth:read", "patient:read", "patient:create", "patient:update",
    "appointment:read", "appointment:create", "appointment:update", "bed:read",
  ],
  NURSE: [
    "localizationSetting:read",
    "auth:read", "patient:read", "admission:read", "admission:update",
    "bed:read", "bed:update", "medicalRecord:read", "medicalRecord:create",
    "nurse:read",
  ],
};

/* ---------------------------------------------------------------------------
 * Seeding
 * ------------------------------------------------------------------------- */
async function seed() {
  // 1. Branch
  const branch = await prisma.branch.upsert({
    where: { code: SEED_BRANCH.code },
    update: {
      name: SEED_BRANCH.name,
      address: SEED_BRANCH.address,
      city: SEED_BRANCH.city,
      country: SEED_BRANCH.country,
      currency: SEED_BRANCH.currency,
      timezone: SEED_BRANCH.timezone,
      status: "active",
    },
    create: {
      name: SEED_BRANCH.name,
      code: SEED_BRANCH.code,
      registrationNo: SEED_BRANCH.registrationNo,
      address: SEED_BRANCH.address,
      city: SEED_BRANCH.city,
      country: SEED_BRANCH.country,
      phone: SEED_BRANCH.phone,
      email: SEED_BRANCH.email,
      currency: SEED_BRANCH.currency,
      timezone: SEED_BRANCH.timezone,
      status: "active",
    },
  });
  console.log(`Branch ready: ${branch.code} (id=${branch.id})`);

  // 2. Permissions (create/update rows, idempotent)
  const permissionByKey = new Map<string, number>();
  for (const def of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { module_action: { module: def.module, action: def.action } },
      update: { description: def.description },
      create: { module: def.module, action: def.action, description: def.description },
    });
    permissionByKey.set(`${def.module}:${def.action}`, perm.id);
  }
  console.log(`Permissions ready: ${PERMISSIONS.length}`);

  // 3. Roles + role-permission mapping
  const roleKeys = Object.keys(ROLE_NAMES) as RoleKey[];
  for (const key of roleKeys) {
    const role = await prisma.role.upsert({
      where: { seederKey: key },
      update: { name: ROLE_NAMES[key], description: ROLE_DESCRIPTIONS[key], status: "ACTIVE" },
      create: {
        seederKey: key,
        name: ROLE_NAMES[key],
        description: ROLE_DESCRIPTIONS[key],
        status: "ACTIVE",
      },
    });

    const allowed = new Set(MATRIX[key]);
    let granted = 0;
    for (const def of PERMISSIONS) {
      if (!allowed.has(`${def.module}:${def.action}`)) continue;
      const permissionId = permissionByKey.get(`${def.module}:${def.action}`)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
      granted++;
    }
    console.log(`Role ready: ${key} (permissions=${granted})`);
  }

  // 4. Demo logins: one account per role, all sharing SEED_DEMO_PASSWORD.
  //    The Super Admin is part of this set (email/username overridable via
  //    SEED_ADMIN_EMAIL / SEED_ADMIN_USERNAME).
  const demoReady = await seedDemoAccounts(prisma, branch.id);
  console.log(`Demo accounts ready: ${demoReady} (shared password: ${DEMO_PASSWORD})`);

  // 5. Default system settings (branch-scoped; idempotent per (branchId, group, key))
  // Locale & formatting keys (currency, date/time formats, timezone, language) are owned by
  // Settings → Localization, so they are intentionally NOT seeded into the "general" group.
  const generalDefaults: Array<{ key: string; value: string; dataType: string }> = [
    { key: "system_name", value: "MediCare HMS", dataType: "string" },
    { key: "version", value: "v2.4.1", dataType: "string" },
    { key: "maintenance_mode", value: "off", dataType: "boolean" },
  ];
  const SETTING_GROUP_GENERAL = "general";
  for (const def of generalDefaults) {
    await prisma.systemSetting.upsert({
      where: {
        branchId_settingGroup_settingKey: {
          branchId: branch.id,
          settingGroup: SETTING_GROUP_GENERAL,
          settingKey: def.key,
        },
      },
      update: { settingValue: def.value, dataType: def.dataType },
      create: {
        branchId: branch.id,
        settingGroup: SETTING_GROUP_GENERAL,
        settingKey: def.key,
        settingValue: def.value,
        dataType: def.dataType,
        status: "active",
      },
    });
  }
  console.log(`System settings ready: ${generalDefaults.length}`);

  // 5b. Default hospital identity settings (branch-scoped; single source of truth
  // for central hospital info shown in Settings → Hospital Configuration).
  const hospitalDefaults: Array<{ key: string; value: string; dataType: string }> = [
    { key: "hospital_name", value: "MediCare Hospital", dataType: "string" },
    { key: "hospital_logo", value: "/images/hospitalogo.png", dataType: "string" },
    { key: "hospital_address", value: "12 Dhaka Medical Road", dataType: "string" },
    { key: "hospital_phone", value: "+880 2 0000000", dataType: "string" },
    { key: "hospital_email", value: "info@medicare.example", dataType: "string" },
    { key: "hospital_website", value: "https://medicare.example", dataType: "string" },
    { key: "hospital_district", value: "Dhaka", dataType: "string" },
    { key: "hospital_thana", value: "Motijheel", dataType: "string" },
    { key: "hospital_registration_no", value: "HD-2024-0001", dataType: "string" },
  ];
  const SETTING_GROUP_HOSPITAL = "hospital";
  for (const def of hospitalDefaults) {
    await prisma.systemSetting.upsert({
      where: {
        branchId_settingGroup_settingKey: {
          branchId: branch.id,
          settingGroup: SETTING_GROUP_HOSPITAL,
          settingKey: def.key,
        },
      },
      update: { settingValue: def.value, dataType: def.dataType },
      create: {
        branchId: branch.id,
        settingGroup: SETTING_GROUP_HOSPITAL,
        settingKey: def.key,
        settingValue: def.value,
        dataType: def.dataType,
        status: "active",
      },
    });
  }
  console.log(`Hospital settings ready: ${hospitalDefaults.length}`);

  // 6. Default security settings (single global row)
  const securityExists = await prisma.securitySetting.findFirst();
  if (!securityExists) {
    await prisma.securitySetting.create({
      data: {
        passwordMinLength: 8,
        passwordExpiryDays: 90,
        maxLoginAttempts: 5,
        sessionTimeout: 30,
        twoFactorEnabled: false,
        ipRestrictionEnabled: false,
        deviceRestrictionEnabled: false,
        auditLogEnabled: true,
        status: "active",
      },
    });
  }
  console.log("Security settings ready.");

  // 7. Hospital configuration (Group B): departments, service categories, services, doctors
  const DEPARTMENTS: Array<{ name: string; code: string; type: string }> = [
    { name: "Cardiology", code: "CARD", type: "CLINICAL" },
    { name: "Neurology", code: "NEURO", type: "CLINICAL" },
    { name: "Orthopedics", code: "ORTHO", type: "CLINICAL" },
    { name: "Pediatrics", code: "PED", type: "CLINICAL" },
    { name: "Radiology", code: "RAD", type: "DIAGNOSTIC" },
    { name: "Pathology", code: "PATH", type: "DIAGNOSTIC" },
    { name: "General Medicine", code: "MED", type: "CLINICAL" },
    { name: "Emergency", code: "EMRG", type: "CLINICAL" },
  ];
  const departmentByCode = new Map<string, number>();
  for (const d of DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: { branchId_code: { branchId: branch.id, code: d.code } },
      update: { name: d.name, departmentType: d.type, status: "active" },
      create: {
        branchId: branch.id,
        name: d.name,
        code: d.code,
        departmentType: d.type,
        description: `${d.name} department`,
        status: "active",
      },
    });
    departmentByCode.set(d.code, row.id);
  }
  console.log(`Departments ready: ${DEPARTMENTS.length}`);

  const SERVICE_CATEGORIES: Array<{ name: string; description: string }> = [
    { name: "Consultation", description: "Doctor consultation fees" },
    { name: "Diagnostics", description: "Lab and imaging services" },
    { name: "Room & Board", description: "Inpatient accommodation" },
    { name: "Procedure", description: "Surgical and medical procedures" },
  ];
  const categoryByCode = new Map<string, number>();
  for (const c of SERVICE_CATEGORIES) {
    const row = await prisma.serviceCategory.upsert({
      where: { name: c.name },
      update: { description: c.description, status: "active" },
      create: { name: c.name, description: c.description, status: "active" },
    });
    categoryByCode.set(c.name, row.id);
  }
  console.log(`Service categories ready: ${SERVICE_CATEGORIES.length}`);

  const SERVICES: Array<{
    code: string;
    name: string;
    dept: string | null;
    category: string;
    price: string;
    description: string;
  }> = [
    { code: "SVC-CONS-01", name: "General Consultation", dept: "MED", category: "Consultation", price: "500", description: "Standard outpatient consultation" },
    { code: "SVC-CARD-01", name: "Cardiology Consultation", dept: "CARD", category: "Consultation", price: "1500", description: "Specialist cardiology visit" },
    { code: "SVC-LAB-01", name: "Complete Blood Count", dept: "PATH", category: "Diagnostics", price: "600", description: "CBC panel" },
    { code: "SVC-RAD-01", name: "Chest X-Ray", dept: "RAD", category: "Diagnostics", price: "1200", description: "2 views, chest" },
    { code: "SVC-WARD-01", name: "Private Room (per day)", dept: null, category: "Room & Board", price: "3000", description: "Private ward accommodation" },
  ];
  let servicesReady = 0;
  for (const s of SERVICES) {
    const existing = await prisma.service.findUnique({
      where: { branchId_serviceCode: { branchId: branch.id, serviceCode: s.code } },
    });
    if (!existing) {
      await prisma.service.create({
        data: {
          branchId: branch.id,
          departmentId: s.dept ? departmentByCode.get(s.dept) : null,
          categoryId: categoryByCode.get(s.category) ?? null,
          serviceCode: s.code,
          name: s.name,
          description: s.description,
          price: s.price,
          taxPercent: "0",
          discountAllowed: true,
          status: "active",
        },
      });
    }
    servicesReady++;
  }
  console.log(`Services ready: ${servicesReady}`);

  // Doctors (linked to the branch; not linked to user accounts by default).
  const DOCTORS: Array<{ code: string; name: string; dept: string; specialization: string; fee: string }> = [
    { code: "DOC-001", name: "Dr. Shahed Chowdhury", dept: "CARD", specialization: "Cardiologist", fee: "1500" },
    { code: "DOC-002", name: "Dr. Nusrat Kabir", dept: "NEURO", specialization: "Neurologist", fee: "1200" },
    { code: "DOC-003", name: "Dr. Rafiq Uddin", dept: "ORTHO", specialization: "Orthopedic", fee: "1000" },
    { code: "DOC-004", name: "Dr. Farhana Akter", dept: "PED", specialization: "Pediatrician", fee: "800" },
  ];
  let doctorsReady = 0;
  for (const doc of DOCTORS) {
    const existing = await prisma.doctor.findUnique({
      where: { branchId_doctorCode: { branchId: branch.id, doctorCode: doc.code } },
    });
    if (!existing) {
      await prisma.doctor.create({
        data: {
          branchId: branch.id,
          departmentId: departmentByCode.get(doc.dept) ?? null,
          doctorCode: doc.code,
          name: doc.name,
          specialization: doc.specialization,
          consultationFee: doc.fee,
          followupFee: String(Number(doc.fee) * 0.6),
          emergencyFee: String(Number(doc.fee) * 1.5),
          status: "active",
        },
      });
    }
    doctorsReady++;
  }
  console.log(`Doctors ready: ${doctorsReady}`);

  // 8. Default patient settings (branch-scoped, single row per branch)
  const existingPatientSetting = await prisma.patientSetting.findFirst({
    where: { branchId: branch.id },
  });
  if (!existingPatientSetting) {
    await prisma.patientSetting.create({
      data: {
        branchId: branch.id,
        patientIdPrefix: "PT-",
        autoGenerateId: true,
        defaultPatientType: "NEW",
        requireGuardian: "MINORS_ONLY",
        duplicateDetection: true,
        phoneRequired: true,
        emailRequired: false,
        status: "active",
      },
    });
  }
  console.log("Patient settings ready.");

  // 9. Default clinical settings (branch-scoped, single row per branch)
  const existingOpd = await prisma.opdSetting.findFirst({ where: { branchId: branch.id } });
  if (!existingOpd) {
    await prisma.opdSetting.create({
      data: {
        branchId: branch.id,
        registrationFee: "100",
        consultationFee: "500",
        followupDays: 14,
        appointmentDuration: 15,
        queueEnabled: true,
        prescriptionEnabled: true,
        status: "active",
      },
    });
  }
  console.log("OPD settings ready.");

  const existingIpd = await prisma.ipdSetting.findFirst({ where: { branchId: branch.id } });
  if (!existingIpd) {
    await prisma.ipdSetting.create({
      data: {
        branchId: branch.id,
        admissionFee: "200",
        dischargeFee: "100",
        bedCharge: "800",
        nursingCharge: "300",
        serviceCharge: "0",
        status: "active",
      },
    });
  }
  console.log("IPD settings ready.");

  const existingEmergency = await prisma.emergencySetting.findFirst({
    where: { branchId: branch.id },
  });
  if (!existingEmergency) {
    await prisma.emergencySetting.create({
      data: {
        branchId: branch.id,
        registrationFee: "150",
        consultationFee: "800",
        serviceCharge: "0",
        triageEnabled: true,
        status: "active",
      },
    });
  }
  console.log("Emergency settings ready.");

  const existingPrescription = await prisma.prescriptionSetting.findFirst({
    where: { branchId: branch.id },
  });
  if (!existingPrescription) {
    await prisma.prescriptionSetting.create({
      data: {
        branchId: branch.id,
        showPatientHistory: true,
        showDiagnosis: true,
        showMedicine: true,
        showDosage: true,
        showInstruction: true,
        showDoctorSignature: true,
        showQrCode: false,
        status: "active",
      },
    });
  }
  console.log("Prescription settings ready.");

  const existingPharmacy = await prisma.pharmacySetting.findFirst({
    where: { branchId: branch.id },
  });
  if (!existingPharmacy) {
    await prisma.pharmacySetting.create({
      data: {
        branchId: branch.id,
        taxPercent: null,
        defaultDiscount: null,
        expiryAlertDays: 30,
        lowStockAlert: true,
        barcodeEnabled: true,
        batchEnabled: true,
        status: "active",
      },
    });
  }
  console.log("Pharmacy settings ready.");

  const existingLab = await prisma.labSetting.findFirst({
    where: { branchId: branch.id },
  });
  if (!existingLab) {
    await prisma.labSetting.create({
      data: {
        branchId: branch.id,
        sampleTrackingEnabled: true,
        barcodeEnabled: true,
        onlineReportEnabled: true,
        reportApprovalRequired: false,
        defaultReportTemplate: null,
        status: "active",
      },
    });
  }
  console.log("Laboratory settings ready.");

  const existingBilling = await prisma.billingSetting.findFirst({
    where: { branchId: branch.id },
  });
  if (!existingBilling) {
    await prisma.billingSetting.create({
      data: {
        branchId: branch.id,
        invoicePrefix: "INV-",
        invoiceStartNumber: 1,
        receiptPrefix: "RCT-",
        taxPercent: null,
        serviceChargePercent: null,
        discountEnabled: true,
        partialPaymentEnabled: true,
        refundEnabled: true,
        duePaymentEnabled: true,
        status: "active",
      },
    });
  }
  console.log("Billing settings ready.");

  const existingAccounting = await prisma.accountingSetting.findFirst({
    where: { branchId: branch.id },
  });
  if (!existingAccounting) {
    await prisma.accountingSetting.create({
      data: {
        branchId: branch.id,
        fiscalYear: "July 2025 - June 2026",
        baseCurrency: "BDT",
        chartOfAccounts: "Hospital Standard",
        autoPostToLedger: true,
        trialBalanceFrequency: "monthly",
        voucherEnabled: true,
        status: "active",
      },
    });
  }
  console.log("Accounting settings ready.");

  const existingHr = await prisma.hrSetting.findFirst({
    where: { branchId: branch.id },
  });
  if (!existingHr) {
    await prisma.hrSetting.create({
      data: {
        branchId: branch.id,
        payrollCycle: "monthly",
        salaryDisbursementDay: 1,
        annualLeaveDays: 18,
        overtimeRate: null,
        status: "active",
      },
    });
  }
  console.log("HR settings ready.");

  const existingInventory = await prisma.inventorySetting.findFirst({
    where: { branchId: branch.id },
  });
  if (!existingInventory) {
    await prisma.inventorySetting.create({
      data: {
        branchId: branch.id,
        trackMedicalEquipment: true,
        assetBarcode: true,
        lowStockAlert: true,
        autoReorder: true,
        stockTransferApproval: true,
        status: "active",
      },
    });
  }
  console.log("Inventory settings ready.");

  const existingNotification = await prisma.notificationSetting.findFirst({
    where: { branchId: branch.id },
  });
  if (!existingNotification) {
    await prisma.notificationSetting.create({
      data: {
        branchId: branch.id,
        smsEnabled: false,
        emailEnabled: false,
        whatsappEnabled: false,
        appointmentNotification: true,
        billingNotification: true,
        labNotification: true,
        followupNotification: true,
        paymentNotification: true,
        status: "active",
      },
    });
  }
  console.log("Notification settings ready.");

  const DEFAULT_PRINT_TEMPLATES = [
    {
      documentType: "prescription",
      templateName: "A4 Standard",
      header: "City Care Hospital",
      footer: "This prescription is valid only with the doctor's signature.",
    },
    {
      documentType: "invoice",
      templateName: "Thermal 80mm",
      header: "City Care Hospital",
      footer: "Payment receipt. Subject to hospital billing policy.",
    },
    {
      documentType: "discharge_certificate",
      templateName: "A4",
      header: "City Care Hospital",
      footer: "We wish you a speedy recovery.",
    },
    {
      documentType: "lab_report",
      templateName: "A4",
      header: "City Care Hospital Laboratory",
      footer: "Results verified and approved by the laboratory.",
    },
    {
      documentType: "admission_form",
      templateName: "A4",
      header: "City Care Hospital",
      footer: "Please complete all sections before admission.",
    },
    {
      documentType: "employee_id_card",
      templateName: "CR80",
      header: "City Care Hospital",
      footer: "",
    },
  ];

  for (const template of DEFAULT_PRINT_TEMPLATES) {
    const existing = await prisma.documentTemplate.findUnique({
      where: {
        branchId_documentType_templateName: {
          branchId: branch.id,
          documentType: template.documentType,
          templateName: template.templateName,
        },
      },
    });
    if (!existing) {
      await prisma.documentTemplate.create({
        data: {
          branchId: branch.id,
          documentType: template.documentType,
          templateName: template.templateName,
          header: template.header,
          footer: template.footer,
          status: "active",
        },
      });
    }
  }
  console.log("Print & document templates ready.");

  const DEFAULT_INTEGRATIONS = [
    {
      integrationType: "sms",
      providerName: "BulkSMS BD",
      apiUrl: "https://api.bulksmsbd.example/sms",
      apiKey: "sk-live-9f2c14d8",
      secretKey: "sc-live-5a1b61ac",
    },
    {
      integrationType: "payment",
      providerName: "SSLCommerz",
      apiUrl: "https://sandbox.sslcommerz.example",
      apiKey: "sslc-live-8f3a9c25",
      secretKey: "sslc-secret-71d0e3",
    },
    {
      integrationType: "email",
      providerName: "SMTP",
      apiUrl: "smtp://smtp.citycare.example:587",
      apiKey: null,
      secretKey: null,
    },
    {
      integrationType: "lab",
      providerName: "HL7 Lab Interface",
      apiUrl: "https://lims.citycare.example/hl7",
      apiKey: null,
      secretKey: null,
      status: "inactive",
    },
  ];

  for (const integration of DEFAULT_INTEGRATIONS) {
    const existing = await prisma.integration.findFirst({
      where: {
        branchId: branch.id,
        integrationType: integration.integrationType,
        providerName: integration.providerName,
      },
    });
    if (!existing) {
      await prisma.integration.create({
        data: {
          branchId: branch.id,
          integrationType: integration.integrationType,
          providerName: integration.providerName,
          apiUrl: integration.apiUrl,
          apiKey: integration.apiKey,
          secretKey: integration.secretKey,
          status: integration.status ?? "active",
        },
      });
    }
  }
  console.log("API & Integration ready.");

  const printTemplates = await prisma.documentTemplate.findMany({
    where: { branchId: branch.id },
    select: { documentType: true, id: true },
  });
  const templateIdByType = new Map(printTemplates.map((t) => [t.documentType, t.id]));

  const DEFAULT_REPORTS = [
    {
      reportName: "Daily Collection Report",
      reportType: "collection",
      templateDocumentType: "invoice" as string | null,
      exportPdf: true,
      exportExcel: true,
    },
    {
      reportName: "Patient Statistics Report",
      reportType: "patient_stats",
      templateDocumentType: null,
      exportPdf: true,
      exportExcel: true,
    },
    {
      reportName: "Doctor Performance Report",
      reportType: "doctor_performance",
      templateDocumentType: null,
      exportPdf: true,
      exportExcel: false,
    },
    {
      reportName: "Pharmacy Sales Report",
      reportType: "pharmacy_sales",
      templateDocumentType: "invoice",
      exportPdf: true,
      exportExcel: true,
    },
    {
      reportName: "Lab Income Report",
      reportType: "lab_income",
      templateDocumentType: "lab_report",
      exportPdf: true,
      exportExcel: true,
    },
    {
      reportName: "Financial (P&L / Balance Sheet)",
      reportType: "financial",
      templateDocumentType: "invoice",
      exportPdf: true,
      exportExcel: true,
    },
    {
      reportName: "Management Dashboard",
      reportType: "management",
      templateDocumentType: null,
      exportPdf: false,
      exportExcel: true,
    },
  ];

  for (const report of DEFAULT_REPORTS) {
    const existing = await prisma.reportSetting.findFirst({
      where: { branchId: branch.id, reportType: report.reportType, reportName: report.reportName },
    });
    if (!existing) {
      await prisma.reportSetting.create({
        data: {
          branchId: branch.id,
          reportName: report.reportName,
          reportType: report.reportType,
          templateId: report.templateDocumentType
            ? (templateIdByType.get(report.templateDocumentType) ?? null)
            : null,
          showLogo: true,
          showHeader: true,
          showFooter: true,
          showSignature: true,
          exportPdf: report.exportPdf,
          exportExcel: report.exportExcel,
          status: "active",
        },
      });
    }
  }
  console.log("Reports ready.");

  /**
   * App-owned lookup lists. Each has its own table now (see
   * `src/lib/masterDataRegistry.ts`), so this walks the registry instead of
   * filtering one shared table by a category string.
   *
   * The national address hierarchy is NOT seeded here: it is reference data, so a
   * fresh install loads it by uploading `sql/address-master-data.sql` (or running
   * `npm run seed:address`) rather than having it re-inserted on every setup run.
   *
   * `code` is required on every table now, so each row carries a stable one. The
   * address hierarchy is a separate, imported dataset rather than a seeded one,
   * which is why only the flat app-owned lists appear below.
   */
  const DEFAULT_LOOKUPS: Array<{ category: MasterDataCategory; label: string; code: string }> = [
    // Visit types
    { category: "visit_types", label: "New", code: "NEW" },
    { category: "visit_types", label: "Follow-up", code: "FOLLOW_UP" },
    { category: "visit_types", label: "Emergency", code: "EMERGENCY" },
    { category: "visit_types", label: "Check-up", code: "CHECKUP" },
    // Blood groups. `Patient.bloodGroup` is a database enum, so these codes must
    // stay in step with BLOOD_GROUP_VALUES or a patient cannot be saved.
    { category: "blood_groups", label: "A+", code: "A_POS" },
    { category: "blood_groups", label: "A-", code: "A_NEG" },
    { category: "blood_groups", label: "B+", code: "B_POS" },
    { category: "blood_groups", label: "B-", code: "B_NEG" },
    { category: "blood_groups", label: "AB+", code: "AB_POS" },
    { category: "blood_groups", label: "AB-", code: "AB_NEG" },
    { category: "blood_groups", label: "O+", code: "O_POS" },
    { category: "blood_groups", label: "O-", code: "O_NEG" },
    // Document types
    { category: "document_types", label: "National ID", code: "NID" },
    { category: "document_types", label: "Passport", code: "PP" },
    { category: "document_types", label: "Birth Certificate", code: "BC" },
    { category: "document_types", label: "Driving License", code: "DL" },
    { category: "document_types", label: "TIN Certificate", code: "TIN" },
    { category: "document_types", label: "Smart Card ID", code: "SC" },
  ];

  for (const item of DEFAULT_LOOKUPS) {
    const spec = LOOKUP_SPECS[item.category];
    // Payment methods are the one global lookup, so they are seeded once and not
    // per branch.
    const table = lookupDelegate(spec.model);
    const existing = await table.findFirst({
      where: {
        ...branchScope(spec, branch.id),
        code: item.code,
      },
    });
    if (!existing) {
      await table.create({
        data: {
          ...branchScope(spec, branch.id),
          name: item.label,
          code: item.code,
          status: "active",
        },
      });
    }
  }
  console.log("Lookup lists ready.");

  /**
   * Payment methods are seeded into the real `PaymentMethod` table rather than a
   * lookup table: `Payment.paymentMethodId` points at it, so these are rows other
   * records depend on. `type` is a database enum, so it has to be set explicitly.
   * Matched on `code`, which is unique across the table.
   */
  const DEFAULT_PAYMENT_METHODS: Array<{
    label: string;
    code: string;
    type: PaymentMethodType;
  }> = [
    { label: "Cash", code: "CASH", type: PaymentMethodType.CASH },
    { label: "Card", code: "CARD", type: PaymentMethodType.CARD },
    { label: "bKash", code: "BKASH", type: PaymentMethodType.MOBILE },
    { label: "Rocket", code: "ROCKET", type: PaymentMethodType.MOBILE },
    { label: "Nagad", code: "NAGAD", type: PaymentMethodType.MOBILE },
  ];

  for (const method of DEFAULT_PAYMENT_METHODS) {
    const existing = await prisma.paymentMethod.findUnique({ where: { code: method.code } });
    if (!existing) {
      await prisma.paymentMethod.create({
        data: { name: method.label, code: method.code, type: method.type, status: "active" },
      });
    }
  }
  console.log("Payment methods ready.");

  const localizationDefault = await prisma.localizationSetting.findFirst({
    where: { branchId: branch.id, language: "English" },
  });
  if (!localizationDefault) {
    await prisma.localizationSetting.create({
      data: {
        branchId: branch.id,
        language: "English",
        currency: "BDT",
        currencySymbol: "৳",
        dateFormat: "DD-MM-YYYY",
        timeFormat: "24h",
        timezone: "Asia/Dhaka",
        numberFormat: "en-US",
        weekStartDay: 1,
      },
    });
  }
  console.log("Localization ready.");

  const systemMaintenanceFirst = await prisma.systemMaintenance.findFirst();
  if (!systemMaintenanceFirst) {
    await prisma.systemMaintenance.create({
      data: {
        maintenanceMode: false,
        cacheEnabled: true,
        systemVersion: "2.1.0",
        status: "active",
      },
    });
  }
  console.log("System maintenance ready.");

  // Shift types. The nurse registration form reads these for its Shift dropdown,
  // so without them the field is permanently empty. `name` is the unique key on
  // this table, so it is what the seed matches on.
  const SHIFT_TYPES: Array<{ name: string; startTime: string; endTime: string }> = [
    { name: "Morning", startTime: "06:00", endTime: "14:00" },
    { name: "Evening", startTime: "14:00", endTime: "22:00" },
    { name: "Night", startTime: "22:00", endTime: "06:00" },
  ];
  for (const shift of SHIFT_TYPES) {
    await prisma.shiftType.upsert({
      where: { name: shift.name },
      update: { startTime: shift.startTime, endTime: shift.endTime },
      create: {
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: "active",
      },
    });
  }
  console.log(`Shift types ready (${SHIFT_TYPES.length}).`);

  // The address hierarchy is deliberately NOT seeded here. Those rows are loaded
  // from a SQL file and owned by whoever maintains that file, so running the
  // setup must never overwrite labels or deactivate rows by hand. To apply the
  // bundled dataset once, run `npm run seed:address` explicitly.

  console.log("Seed complete.");
  console.log("");
  console.log("  Sign in with any demo role (shared password):");
  for (const account of DEMO_ACCOUNTS) {
    console.log(`    ${account.role.padEnd(13)} ${account.email}  /  ${account.username}`);
  }
  console.log(`    password: ${DEMO_PASSWORD}`);
  if (!process.env.SEED_DEMO_PASSWORD) {
    console.log("    (development default - set SEED_DEMO_PASSWORD before any real deployment)");
  }
}

seed()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
