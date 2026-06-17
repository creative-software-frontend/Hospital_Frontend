// components/Dashboard/Sidebar.tsx
"use client";

import { FiPieChart, FiShield, FiLogOut, FiChevronDown, FiChevronUp } from "react-icons/fi";

export const Sidebar = ({
    sidebarOpen, role, permissions, accessibleFeatures,
    activeSection, setActiveSection, selectedFeature,
    setSelectedFeature, expandedFeature, setExpandedFeature,
    setSidebarOpen, openLogoutModal
}: any) => {


    // Search removed (table search remains in DashboardContent)



    const toggleFeature = (id: number) => {
        setExpandedFeature((prev: number | null) => (prev === id ? null : id));
    };

    const handleSelectFeature = (feat: any) => {
        setSelectedFeature(feat);
        setActiveSection("feature-detail");
    };

    return (
        <aside className={`${sidebarOpen ? "w-80" : "w-0 -translate-x-full"} shrink-0 bg-[var(--card)] border-r border-[var(--border)] flex flex-col transition-all duration-300 ease-in-out z-30 h-full overflow-hidden`}>
            {/* Sidebar Header */}
            <div className="p-6 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--primary)] text-white">
                <img src="/images/hospitalogo.png" alt="Hospital Logo" className="w-10 h-10 object-contain bg-white rounded-xl p-1 shadow-md" />
                <div>
                    <h1 className="font-extrabold text-base leading-none tracking-tight text-white uppercase">Management</h1>
                    <span className="text-[10px] text-white/70 tracking-wider font-semibold block uppercase mt-1">
                        {permissions.label} Portal
                    </span>
                </div>
            </div>

            {/* Sidebar Nav Items */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 news-scroll">
                {/* General Group */}
                <div>
                    <div className="text-[11px] font-bold tracking-wider text-[var(--muted)] uppercase mb-3 px-2">General</div>

                    {permissions.canViewOverview && (
                        <button onClick={() => { setActiveSection("overview"); setSelectedFeature(null); }}
                            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeSection === "overview" ? "bg-[var(--primary)] text-white shadow-md" : "text-[var(--muted)] hover:bg-[var(--primary-soft)]/25 bg-[var(--bg)] border border-[var(--border)]/40"}`}>
                            <FiPieChart className="w-4 h-4" />
                            <span>Dashboard Overview</span>
                        </button>
                    )}

                    {permissions.canViewRolePermissions && (
                        <button onClick={() => { setActiveSection("role-permissions"); setSelectedFeature(null); }}
                            className={`w-full flex items-center gap-3 px-3.5 py-3 mt-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeSection === "role-permissions" ? "bg-[var(--primary)] text-white shadow-md" : "text-[var(--muted)] hover:bg-[var(--primary-soft)]/25 bg-[var(--bg)] border border-[var(--border)]/40"}`}>
                            <FiShield className="w-4 h-4" />
                            <span>Roles & Permissions</span>
                        </button>
                    )}
                </div>

                {/* Key Features - Filtered by role permissions */}
                <div>
                    <div className="space-y-2.5">
                        {accessibleFeatures.length === 0 ? (
                            <div className="px-3 py-3 text-xs font-semibold text-[var(--muted)]">
                                No modules found.
                            </div>
                        ) : (
                            accessibleFeatures.map((feat: any) => {
                                const Icon = feat.icon;
                                const isExpanded = expandedFeature === feat.id;
                                const isActive = activeSection === "feature-detail" && selectedFeature?.id === feat.id;

                                return (
                                    <div key={feat.id}>
                                        <div
                                            className={`flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
                                                isActive
                                                    ? "bg-[var(--primary)] text-white"
                                                    : "text-[var(--muted)] hover:bg-[var(--primary-soft)]/20"
                                            }`}
                                            onClick={() => {
                                                handleSelectFeature(feat);
                                                toggleFeature(feat.id);
                                            }}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div
                                                    className={`p-1.5 rounded-lg shrink-0 ${
                                                        isActive
                                                            ? "bg-white/25 text-white"
                                                            : "bg-[var(--primary-soft)]/40 text-[var(--primary)]"
                                                    }`}
                                                >
                                                    <Icon className="w-4 h-4 shrink-0" />
                                                </div>
                                                <span className="text-xs font-semibold truncate text-left">
                                                    {feat.englishTitle}
                                                </span>
                                            </div>
                                            <div className={`shrink-0 pl-1 ${isActive ? "text-white/80" : "text-[var(--muted)]"}`}>
                                                {isExpanded ? (
                                                    <FiChevronUp className="w-3.5 h-3.5" />
                                                ) : (
                                                    <FiChevronDown className="w-3.5 h-3.5" />
                                                )}
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="mt-1 mb-2 ml-6 space-y-0.5">
                                                {feat.subFeatures.map((sub: any, sIdx: any) => {
                                                    const SubIcon = sub.icon;
                                                    return (
                                                        <div
                                                            key={sIdx}
                                                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-[11px] font-medium text-[var(--muted)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary-dark)] hover:pl-4 transition-all duration-200"
                                                        >
                                                            <SubIcon className="w-3 h-3 shrink-0 text-[var(--primary)]/60" />
                                                            <span>{sub.label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--bg)]">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <div className="w-9 h-9 rounded-full bg-[var(--primary-soft)]/40 border border-[var(--primary)]/30 flex items-center justify-center font-bold text-[var(--primary-dark)]">
                        {permissions.label.charAt(0).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                        <h4 className="text-xs font-bold truncate">{permissions.label}</h4>
                        <span className="text-[10px] text-[var(--muted)] truncate block">{role || "Active Session"}</span>
                    </div>
                </div>
                <button onClick={openLogoutModal} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--danger)]/10 text-[var(--danger)] rounded-xl text-xs font-bold hover:bg-[var(--danger)]/15 transition-colors">
                    <FiLogOut className="w-3.5 h-3.5" />
                    <span>Logout Account</span>
                </button>
            </div>
        </aside>
    );
};