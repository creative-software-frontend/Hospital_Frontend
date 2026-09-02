import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "StaffDemo123!";

const accounts = [
  {
    email: "admin@hospital.com",
    username: "admin",
    name: "System Administrator",
    branchId: 1,
    roleKey: "SUPER_ADMIN" as const,
  },
  {
    email: "admin2@hospital.com",
    username: "admin2",
    name: "Branch Two Admin",
    branchId: 2,
    roleKey: "ADMIN" as const,
  },
  {
    email: "doctor@hospital.com",
    username: "doctor1",
    name: "Dr. Test",
    branchId: 1,
    roleKey: "DOCTOR" as const,
  },
  {
    email: "pharmacist@hospital.com",
    username: "pharmacist1",
    name: "Staff Pharmacist",
    branchId: 1,
    roleKey: "PHARMACIST" as const,
  },
  {
    email: "pathologist@hospital.com",
    username: "pathologist1",
    name: "Staff Pathologist",
    branchId: 1,
    roleKey: "PATHOLOGIST" as const,
  },
  {
    email: "radiologist@hospital.com",
    username: "radiologist1",
    name: "Staff Radiologist",
    branchId: 1,
    roleKey: "RADIOLOGIST" as const,
  },
  {
    email: "accountant@hospital.com",
    username: "accountant1",
    name: "Staff Accountant",
    branchId: 1,
    roleKey: "ACCOUNTANT" as const,
  },
  {
    email: "receptionist@hospital.com",
    username: "receptionist1",
    name: "Staff Receptionist",
    branchId: 1,
    roleKey: "RECEPTIONIST" as const,
  },
  {
    email: "nurse@hospital.com",
    username: "nurse1",
    name: "Staff Nurse",
    branchId: 1,
    roleKey: "NURSE" as const,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const acct of accounts) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { seederKey: acct.roleKey },
    });

    const user = await prisma.user.upsert({
      where: { email: acct.email },
      update: {
        name: acct.name,
        username: acct.username,
        branchId: acct.branchId,
        password: passwordHash,
        status: "ACTIVE",
      },
      create: {
        name: acct.name,
        email: acct.email,
        username: acct.username,
        password: passwordHash,
        branchId: acct.branchId,
        status: "ACTIVE",
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    console.log(`OK: ${acct.roleKey} → ${acct.email}`);
  }

  console.log("All demo accounts ready.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
