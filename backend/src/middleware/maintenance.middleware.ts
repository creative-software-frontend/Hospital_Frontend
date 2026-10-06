import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { config } from "../config";
import { AuthenticationError } from "../errors/ApiError";
import { verifyToken } from "./auth.middleware";

interface MaintenanceCheckResult {
  maintenanceMode: boolean;
}

let maintenanceCache: MaintenanceCheckResult | null = null;
let maintenanceCacheTime = 0;
const MAINTENANCE_CACHE_TTL = 5000;

async function getMaintenanceStatus(): Promise<MaintenanceCheckResult> {
  const now = Date.now();
  if (maintenanceCache && now - maintenanceCacheTime < MAINTENANCE_CACHE_TTL) {
    return maintenanceCache;
  }

  const record = await prisma.systemMaintenance.findFirst({
    select: { maintenanceMode: true },
  });

  const result = {
    maintenanceMode: record?.maintenanceMode ?? false,
  };

  maintenanceCache = result;
  maintenanceCacheTime = now;
  return result;
}

function invalidateMaintenanceCache(): void {
  maintenanceCache = null;
  maintenanceCacheTime = 0;
}

export { invalidateMaintenanceCache };

const PUBLIC_PATHS = [
  "/health",
  "/auth/login",
  "/auth/logout",
];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

interface BypassUser {
  roles: Array<{ seederKey: string }>;
}

function hasMaintenanceBypass(user: BypassUser | null | undefined): boolean {
  if (!user) return false;
  return user.roles.some((r) => r.seederKey === "SUPER_ADMIN");
}

export function requireMaintenanceAccess(req: Request, _res: Response, next: NextFunction): void {
  if (isPublicPath(req.path)) {
    next();
    return;
  }

  void (async () => {
    try {
      const { maintenanceMode } = await getMaintenanceStatus();

      if (!maintenanceMode) {
        next();
        return;
      }

      const token = req.cookies?.[config.jwtCookieName];
      if (!token) {
        next();
        return;
      }

      let user: BypassUser | null = null;
      try {
        const payload = await verifyToken(token);
        const userId = Number(payload.sub);
        if (!Number.isInteger(userId)) {
          next();
          return;
        }

        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            userRoles: { select: { role: { select: { seederKey: true } } } },
          },
        });

        if (!dbUser) {
          next();
          return;
        }

        user = {
          roles: dbUser.userRoles.map((ur) => ({
            seederKey: ur.role.seederKey,
          })),
        };
      } catch {
        next();
        return;
      }

      if (hasMaintenanceBypass(user)) {
        next();
        return;
      }

      const accept = req.headers.accept ?? "";
      const wantsJson = accept.includes("application/json");

      if (wantsJson) {
        _res.set("Retry-After", "300");
        _res.status(503).json({
          success: false,
          message: "System is under maintenance. Please try again later.",
          code: "MAINTENANCE_MODE",
        });
      } else {
        _res.set("Retry-After", "300");
        _res.status(503).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>System Maintenance</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 48px 40px; max-width: 420px; text-align: center; }
    .icon { width: 80px; height: 80px; margin: 0 auto 24px; background: #fef3c7; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .icon svg { width: 40px; height: 40px; color: #f59e0b; }
    h1 { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 12px; }
    p { color: #6b7280; line-height: 1.6; margin-bottom: 24px; }
    .retry { font-size: 13px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 002.573-1.066c-1.543-.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
    <h1>System Under Maintenance</h1>
    <p>We&apos;re performing scheduled maintenance to improve your experience. Please check back in a few minutes.</p>
    <p class="retry">This page will automatically retry.</p>
    <script>
      setTimeout(() => window.location.reload(), 30000);
    </script>
  </div>
</body>
</html>
        `);
      }
    } catch (err) {
      console.error("[maintenance] check failed:", err);
      next();
    }
  })().catch(next);
}