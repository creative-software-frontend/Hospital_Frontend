// hooks/useRoleData.ts
import { useEffect, useState } from 'react';
import { UserRole, ROLE_PERMISSIONS, getRoleStats } from '@/app/config/roleConfig';
import { keyFeatures } from '@/app/data/features'; // Move your keyFeatures array to separate file

export const useRoleData = () => {
    const [role, setRole] = useState<UserRole | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedRole = localStorage.getItem("role") as UserRole;
        setRole(savedRole);
        setLoading(false);
    }, []);

    const permissions = role ? ROLE_PERMISSIONS[role] : null;

    const accessibleFeatures = role && permissions
        ? keyFeatures.filter(f => permissions.accessibleFeatureIds.includes(f.id))
        : [];

    const roleStats = role ? getRoleStats(role) : [];

    return {
        role,
        loading,
        permissions,
        accessibleFeatures,
        roleStats,
        isSuperAdmin: role === 'super-admin',
    };
};