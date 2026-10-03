import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

/**
 * Every role gets one ready-to-use login so the role dashboards can be tried
 * without creating users by hand. Emails/usernames mirror the "Quick demo
 * access" buttons in `app/admins/login/page.tsx` — keep the two lists in sync.
 *
 * The password is shared by all of them and is overridable with
 * SEED_DEMO_PASSWORD. It is only meant for development; the seed refuses to run
 * against production unless SEED_ALLOW_PRODUCTION=true.
 */
export const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "12345678";

export type DemoRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DOCTOR"
  | "PHARMACIST"
  | "PATHOLOGIST"
  | "RADIOLOGIST"
  | "ACCOUNTANT"
  | "RECEPTIONIST"
  | "NURSE";

export interface DemoAccount {
  role: DemoRole;
  name: string;
  email: string;
  username: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "SUPER_ADMIN",
    name: "System Administrator",
    email: (process.env.SEED_ADMIN_EMAIL || "admin@hospital.com").toLowerCase(),
    username: process.env.SEED_ADMIN_USERNAME || "admin",
  },
  { role: "ADMIN", name: "Branch Administrator", email: "admin2@hospital.com", username: "admin2" },
  { role: "DOCTOR", name: "Demo Doctor", email: "doctor@hospital.com", username: "doctor1" },
  { role: "PHARMACIST", name: "Demo Pharmacist", email: "pharmacist@hospital.com", username: "pharmacist1" },
  { role: "PATHOLOGIST", name: "Demo Pathologist", email: "pathologist@hospital.com", username: "pathologist1" },
  { role: "RADIOLOGIST", name: "Demo Radiologist", email: "radiologist@hospital.com", username: "radiologist1" },
  { role: "ACCOUNTANT", name: "Demo Accountant", email: "accountant@hospital.com", username: "accountant1" },
  { role: "RECEPTIONIST", name: "Demo Receptionist", email: "receptionist@hospital.com", username: "receptionist1" },
  { role: "NURSE", name: "Demo Nurse", email: "nurse@hospital.com", username: "nurse1" },
];

/**
 * Idempotently creates or refreshes one login per role, all sharing
 * DEMO_PASSWORD. Safe to run repeatedly: it always resets the password so the
 * demo logins stay predictable. Requires the roles (and the branch) to exist.
 * Returns the number of accounts written.
 */
export async function seedDemoAccounts(prisma: PrismaClient, branchId: number): Promise<number> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let ready = 0;

  for (const account of DEMO_ACCOUNTS) {
    const role = await prisma.role.findUnique({ where: { seederKey: account.role } });
    if (!role) continue;

    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        username: account.username,
        branchId,
        password: passwordHash,
        status: "ACTIVE",
      },
      create: {
        name: account.name,
        email: account.email,
        username: account.username,
        password: passwordHash,
        branchId,
        status: "ACTIVE",
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    ready++;
  }

  return ready;
}
