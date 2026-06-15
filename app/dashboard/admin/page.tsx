"use client";

import { useEffect, useState } from "react";

export default function AdminDashboard() {
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        const savedRole = localStorage.getItem("role");
        setRole(savedRole);
    }, []);

    return (
        <div className="p-10">
            <h1 className="text-3xl font-bold">
                Admin Dashboard
            </h1>

            <p className="mt-4">
                Logged in as: {role ?? "Unknown"}
            </p>
        </div>
    );
}
