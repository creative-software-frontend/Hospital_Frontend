import { prisma } from "../../lib/prisma";
import { AuthorizationError } from "../../errors/ApiError";
import type { AuthUser } from "../../types/auth";

/**
 * SUPER_ADMIN exclusive. Every endpoint in this module refuses to run unless
 * the authenticated user actually holds the SUPER_ADMIN role (checked server
 * side from the DB-loaded identity — never trusts client claims).
 */
function assertSuperAdmin(actor: AuthUser): void {
  if (!actor.roles.some((r) => r.seederKey === "SUPER_ADMIN")) {
    throw new AuthorizationError("SUPER_ADMIN role required");
  }
}

/**
 * Real, database-backed dashboard statistics. Only values that actually exist
 * are returned — a count of zero (e.g. patients before any are registered) is
 * reported as zero, never fabricated.
 */
export async function getDashboardStats(actor: AuthUser) {
  assertSuperAdmin(actor);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalBranches,
    activeBranches,
    totalUsers,
    activeUsers,
    lockedUsers,
    suspendedUsers,
    totalPatients,
    totalDoctors,
    totalDepartments,
    totalServices,
    totalRoles,
    loginsToday,
    activeUsersLast7Days,
    totalAuditEvents,
    branches,
    usersByStatus,
    usersByBranch,
    patientsByBranch,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.branch.count(),
    prisma.branch.count({ where: { status: "active" } }),
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "LOCKED" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.patient.count(),
    prisma.doctor.count(),
    prisma.department.count(),
    prisma.service.count(),
    prisma.role.count(),
    prisma.user.count({ where: { lastLoginAt: { gte: startOfToday } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: sevenDaysAgo } } }),
    prisma.auditLog.count(),
    prisma.branch.findMany({ select: { id: true, name: true, code: true, status: true } }),
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.groupBy({ by: ["branchId"], _count: { _all: true } }),
    prisma.patient.groupBy({ by: ["branchId"], _count: { _all: true } }),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { id: "desc" },
      select: {
        id: true,
        module: true,
        action: true,
        tableName: true,
        recordId: true,
        ipAddress: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  return {
    summary: {
      branches: {
        total: totalBranches,
        active: activeBranches,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        locked: lockedUsers,
        suspended: suspendedUsers,
      },
      patients: totalPatients,
      doctors: totalDoctors,
      departments: totalDepartments,
      services: totalServices,
      roles: totalRoles,
    },
    activity: {
      loginsToday: loginsToday,
      activeUsersLast7Days: activeUsersLast7Days,
      auditEventsTotal: totalAuditEvents,
    },
    breakdown: {
      usersByStatus: usersByStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      usersByBranch: usersByBranch.map((row) => ({
        branchId: row.branchId,
        branchName: branchNameById.get(row.branchId) ?? null,
        count: row._count._all,
      })),
      patientsByBranch: patientsByBranch.map((row) => ({
        branchId: row.branchId,
        branchName: branchNameById.get(row.branchId) ?? null,
        count: row._count._all,
      })),
    },
    recentActivity: recentAuditLogs,
    generatedAt: new Date().toISOString(),
    live: true,
  };
}

export { assertSuperAdmin };