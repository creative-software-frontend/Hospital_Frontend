// components/Dashboard/DashboardLayout.tsx
"use client";

import { useState } from "react";
import { useRoleData } from "@/app/hooks/useRoleData";
import { keyFeatures } from "@/app/data/features";
import { Sidebar } from "@/app/dashboard/Sidebar";
import { DashboardContent } from "@/app/dashboard/DashboardContent";
import { useRouter } from "next/navigation";
import { FiX, FiLogOut } from "react-icons/fi";

export default function DashboardLayout() {
    const router = useRouter();
    const { role, loading, permissions, accessibleFeatures, roleStats } = useRoleData();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeSection, setActiveSection] = useState<string>("overview");
    const [selectedFeature, setSelectedFeature] = useState<any>(null);
    const [expandedFeature, setExpandedFeature] = useState<number | null>(null);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem("role");
        router.push("/login");
    };

    const openLogoutModal = () => setShowLogoutModal(true);
    const closeLogoutModal = () => setShowLogoutModal(false);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto"></div>
                    <p className="mt-4 text-[var(--muted)]">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (!role || !permissions) {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
                <div className="text-center">
                    <p className="text-[var(--danger)]">Access denied. Please login again.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] font-sans overflow-hidden">
            <Sidebar
                sidebarOpen={sidebarOpen}
                role={role}
                permissions={permissions}
                accessibleFeatures={accessibleFeatures}
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                selectedFeature={selectedFeature}
                setSelectedFeature={setSelectedFeature}
                expandedFeature={expandedFeature}
                setExpandedFeature={setExpandedFeature}
                setSidebarOpen={setSidebarOpen}
                openLogoutModal={openLogoutModal}
            />

            <DashboardContent
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                activeSection={activeSection}
                selectedFeature={selectedFeature}
                role={role}
                permissions={permissions}
                roleStats={roleStats}
                accessibleFeatures={accessibleFeatures}
                setActiveSection={setActiveSection}
                setSelectedFeature={setSelectedFeature}
            />

            {/* LOGOUT CONFIRMATION MODAL */}
            {showLogoutModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={closeLogoutModal}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />

                    {/* Modal Card */}
                    <div
                        className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-[scaleIn_0.25s_ease-out]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={closeLogoutModal}
                            className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors"
                        >
                            <FiX className="w-4 h-4" />
                        </button>

                        {/* Icon */}
                        <div className="flex justify-center mb-5">
                            <div className="w-16 h-16 rounded-2xl bg-red-50 border-2 border-red-100 flex items-center justify-center">
                                <FiLogOut className="w-7 h-7 text-red-500" />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-extrabold text-[var(--text)] mb-2">Logout Confirmation</h3>
                            <p className="text-xs text-[var(--muted)] leading-relaxed">
                                Are you sure you want to log out of your account? You will need to sign in again to access the dashboard.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 active:scale-[0.98]"
                            >
                                <FiLogOut className="w-4 h-4" />
                                <span>Yes, Logout</span>
                            </button>
                            <button
                                onClick={closeLogoutModal}
                                className="w-full px-4 py-3 bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] rounded-xl text-sm font-bold transition-all duration-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyframe animations for modal */}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.9) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
}