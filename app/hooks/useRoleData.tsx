// hooks/useRoleData.ts
import { useState } from 'react';
import { UserRole, ROLE_PERMISSIONS, getRoleStats } from '@/app/config/roleConfig';
import { keyFeatures } from '@/app/data/features';
import { authStorage } from '@/app/lib/auth';

/**
 * Resolves the current role. When a role is passed explicitly (e.g. from the
 * dynamic /dashboard/[role] route) it takes precedence; otherwise it falls back
 * to the persisted session.
 */
export const useRoleData = (initialRole?: UserRole) => {
    const [role, setRole] = useState<UserRole | null>(() => {
        if (initialRole) return initialRole;
        return authStorage.getRole();
    });

    const permissions = role ? ROLE_PERMISSIONS[role] : null;

    const accessibleFeatures = role && permissions
        ? keyFeatures.filter(f => permissions.accessibleFeatureIds.includes(f.id))
        : [];

    const roleStats = role ? getRoleStats(role) : [];

    return {
        role,
        loading: false,
        permissions,
        accessibleFeatures,
        roleStats,
        isSuperAdmin: role === 'super-admin',
        setRole,
    };
};
