// app/dashboard/[role]/page.tsx
"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/app/dashboard/DashboardLayout";
import { isStaffRole } from "@/app/config/roleConfig";
import { authStorage } from "@/app/lib/auth";

export default function RoleDashboard() {
    const params = useParams();
    const router = useRouter();
    const role = params.role as string;

    // Only staff roles can access /dashboard/[role]; the patient portal
    // lives under /dashboard/user. Anything else redirects to staff login.
    if (!isStaffRole(role)) {
        return <RedirectToLogin router={router} />;
    }

    // Persist the session so the role survives navigation/refresh.
    authStorage.setSession(role, "admin");

    return <DashboardLayout role={role} />;
}

function RedirectToLogin({ router }: { router: ReturnType<typeof useRouter> }) {
    useEffect(() => {
        router.replace("/admins/login");
    }, [router]);
    return null;
}
