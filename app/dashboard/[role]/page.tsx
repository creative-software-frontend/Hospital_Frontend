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
        // Validate if role is valid
        const validRoles = ['super-admin', 'admin', 'doctor', 'pharmacist', 'pathologist', 'radiologist', 'accountant', 'receptionist', 'nurse'];

        if (!validRoles.includes(role)) {
            router.push('/login');
        } else {
            // Set role in localStorage
            localStorage.setItem("role", role);
        }
    }, [role, router]);

    return <DashboardLayout />;
}