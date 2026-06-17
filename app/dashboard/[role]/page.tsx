// app/dashboard/[role]/page.tsx
"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/app/dashboard/DashboardLayout";

export default function RoleDashboard() {
    const params = useParams();
    const router = useRouter();
    const role = params.role as string;

    useEffect(() => {
        // Valid admin/staff roles only — 'user' is handled by /dashboard/user separately
        const validAdminRoles = ['super-admin', 'admin', 'doctor', 'pharmacist', 'pathologist', 'radiologist', 'accountant', 'receptionist', 'nurse'];

        if (!validAdminRoles.includes(role)) {
            // Invalid role → redirect to admin login
            router.push('/admins/login');
        } else {
            // Set role in localStorage
            localStorage.setItem("role", role);
            localStorage.setItem("userType", "admin");
        }
    }, [role, router]);

    return <DashboardLayout />;
}