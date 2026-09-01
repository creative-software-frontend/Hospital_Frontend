// Shared authentication types used by middleware, controllers and services.

export interface AuthRole {
  id: number;
  seederKey: string;
  name: string;
}

/**
 * The authenticated identity attached to every protected request.
 * It is derived entirely from the server-side JWT + DB lookup, NEVER from
 * client input. `branchId` and `roles` come from the trusted server identity.
 */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  username?: string | null;
  branchId: number;
  status: string;
  roles: AuthRole[];
}
