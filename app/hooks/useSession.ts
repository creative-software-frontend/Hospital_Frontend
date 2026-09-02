// app/hooks/useSession.ts
// Resolves the real backend session (GET /api/auth/me) on the client and maps
// the authenticated user's roles to the dashboard UserRole slug. On an
// unauthenticated/expired session it clears the mock persistence layer and
// redirects to the staff login page.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, type ApiUser, UnauthenticatedError } from "@/app/lib/api";
import { toFrontendRole } from "@/app/lib/roles";
import { authStorage } from "@/app/lib/auth";
import type { UserRole } from "@/app/config/roleConfig";

export interface Session {
  user: ApiUser | null;
  roles: string[];
  role: UserRole | null;
  loading: boolean;
}

export function useSession(): Session {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const me = await authApi.me();
        if (!cancelled) {
          setUser(me.user);
          setRoles(me.roles);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        authStorage.clearSession();
        setLoading(false);
        if (err instanceof UnauthenticatedError) {
          router.replace("/admins/login");
        }
        // Network/other errors: leave the dashboard mount logic to redirect
        // through the "no session" guard without infinite loops.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return { user, roles, role: toFrontendRole(roles), loading };
}