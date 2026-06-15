// config/roleConfig.ts
export type UserRole = 'super-admin' | 'admin' | 'doctor' | 'pharmacist' | 'pathologist' | 'radiologist' | 'accountant' | 'receptionist' | 'nurse';

export interface RolePermission {
    role: UserRole;
    label: string;
    canViewOverview: boolean;
    canViewRolePermissions: boolean;
    accessibleFeatureIds: number[]; // Which features this role can see
    allowedSubFeatures?: Record<number, string[]>; // Feature ID -> allowed sub-features
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermission> = {
    'super-admin': {
        role: 'super-admin',
        label: 'Super Administrator',
        canViewOverview: true,
        canViewRolePermissions: true,
        accessibleFeatureIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], // All features
    },
    'admin': {
        role: 'admin',
        label: 'Hospital Admin',
        canViewOverview: true,
        canViewRolePermissions: false,
        accessibleFeatureIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 20], // Admin-specific features
    },
    'doctor': {
        role: 'doctor',
        label: 'Doctor',
        canViewOverview: true,
        canViewRolePermissions: false,
        accessibleFeatureIds: [1, 2, 3, 4, 8, 20], // Doctor-specific features
    },
    'pharmacist': {
        role: 'pharmacist',
        label: 'Pharmacist',
        canViewOverview: true,
        canViewRolePermissions: false,
        accessibleFeatureIds: [9, 20], // Pharmacy + Reports
    },
    'pathologist': {
        role: 'pathologist',
        label: 'Pathologist',
        canViewOverview: true,
        canViewRolePermissions: false,
        accessibleFeatureIds: [10, 20], // Lab + Reports
    },
    'radiologist': {
        role: 'radiologist',
        label: 'Radiologist',
        canViewOverview: true,
        canViewRolePermissions: false,
        accessibleFeatureIds: [10, 20], // Same as pathologist
    },
    'accountant': {
        role: 'accountant',
        label: 'Accountant',
        canViewOverview: true,
        canViewRolePermissions: false,
        accessibleFeatureIds: [14, 15, 20], // Billing + Accounting + Reports
    },
    'receptionist': {
        role: 'receptionist',
        label: 'Receptionist',
        canViewOverview: true,
        canViewRolePermissions: false,
        accessibleFeatureIds: [1, 3, 4], // Patient, Appointment, OPD
    },
    'nurse': {
        role: 'nurse',
        label: 'Nurse',
        canViewOverview: true,
        canViewRolePermissions: false,
        accessibleFeatureIds: [5, 13], // IPD + Nursing
    },
};

// Role-specific dashboard stats configuration
export const getRoleStats = (role: UserRole) => {
    const baseStats = {
        'super-admin': [
            { label: "Total Patients", value: "12,840", icon: "FiUser" },
            { label: "Today's Appointments", value: "342", icon: "FiCalendar" },
            { label: "Today's Revenue", value: "$18,250", icon: "FiDollarSign" },
            { label: "Available Beds", value: "48 / 150", icon: "FiLayers" },
        ],
        'doctor': [
            { label: "Today's Patients", value: "24", icon: "FiUser" },
            { label: "Pending Reports", value: "12", icon: "FiFileText" },
            { label: "Upcoming Appointments", value: "8", icon: "FiCalendar" },
        ],
        'pharmacist': [
            { label: "Today's Sales", value: "$1,240", icon: "FiDollarSign" },
            { label: "Low Stock Items", value: "5", icon: "FiBriefcase" },
            { label: "Expiring Soon", value: "3", icon: "FiClock" },
        ],
        // Add more role-specific stats as needed
    };

    return (baseStats as any)[role] || baseStats['super-admin'];
};