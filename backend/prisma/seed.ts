import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
];

const MATRIX: Record<RoleKey, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => `${p.module}:${p.action}`),
  ADMIN: [
    "user:read", "user:create", "user:update", "role:read", "permission:read", "audit:read",
    "patient:read", "patient:create", "patient:update", "patient:delete",
    "appointment:read", "appointment:create", "appointment:update",
  ],
  DOCTOR: [
    "auth:read", "patient:read", "patient:create", "patient:update",
    "appointment:read", "appointment:update",
    "medicalRecord:read", "medicalRecord:create", "medicalRecord:update",
    "prescription:read", "prescription:create", "prescription:update",
    "admission:read", "bed:read", "labOrder:read", "labOrder:update",
    "imaging:read", "imaging:create", "imaging:update",
  ],
  PHARMACIST: [
    "auth:read", "medicine:read", "medicine:update", "prescription:read",
    "stockMovement:read", "stockMovement:create", "inventory:read", "inventory:update",
  ],
  PATHOLOGIST: [
    "auth:read", "labTest:read", "labOrder:read", "labOrder:update",
    "labResult:read", "labResult:create", "labResult:update",
  ],
  RADIOLOGIST: ["auth:read", "imaging:read", "imaging:create", "imaging:update"],
  ACCOUNTANT: [
    "auth:read", "invoice:read", "invoice:create", "payment:read", "payment:create",
    "account:read", "accountingTransaction:read", "accountingTransaction:create",
  ],
  RECEPTIONIST: [
    "auth:read", "patient:read", "patient:create", "patient:update",
    "appointment:read", "appointment:create", "appointment:update", "bed:read",
  ],
  NURSE: [
    "auth:read", "patient:read", "admission:read", "admission:update",
    "bed:read", "bed:update", "medicalRecord:read", "medicalRecord:create",
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

  // 4. Bootstrap SUPER_ADMIN user
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@hospital.com").toLowerCase();
  const username = process.env.SEED_ADMIN_USERNAME || "admin";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 10);

  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { seederKey: "SUPER_ADMIN" } });

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name: "System Administrator", username, branchId: branch.id, status: "ACTIVE" },
    create: {
      name: "System Administrator",
      email,
      username,
      password: passwordHash,
      branchId: branch.id,
      status: "ACTIVE",
    },
  });

  // idempotent role link
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id },
  });

  console.log(`Super admin ready: ${email}`);
  console.log("Seed complete.");
}

seed()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
