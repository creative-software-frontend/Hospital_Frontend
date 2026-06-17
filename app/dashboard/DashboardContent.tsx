"use client";

import {
  FiUser,
  FiCalendar,
  FiDollarSign,
  FiLayers,
  FiHome,
  FiActivity,
  FiDatabase,
  FiBriefcase,
  FiFileText,
  FiClock,
  FiArrowRight,
  FiShield,
  FiSettings,
  FiUserCheck,
  FiX,
  FiMenu,
  FiPieChart,
  FiSearch,
  FiX as FiXIcon,
} from "react-icons/fi";

import { useMemo, useState } from "react";


import { ADMIN_TABLE_BY_FEATURE_ID } from "@/app/data/adminTableData";

const iconMap: Record<string, any> = {
  FiUser,
  FiCalendar,
  FiDollarSign,
  FiLayers,
  FiHome,
  FiActivity,
  FiDatabase,
  FiBriefcase,
  FiFileText,
  FiClock,
  FiArrowRight,
  FiShield,
  FiSettings,
  FiUserCheck,
};

export const DashboardContent = ({
  sidebarOpen,
  setSidebarOpen,
  activeSection,
  selectedFeature,
  role,
  permissions,
  roleStats,
  accessibleFeatures,
  setActiveSection,
  setSelectedFeature,
}: any) => {
  const [tableSearch, setTableSearch] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);


  const roles = [
    {
      name: "Super Admin",
      access: "Full Access",
      desc: "Complete platform configuration, full settings, and absolute authorization overrides.",
    },
    {
      name: "Hospital Admin",
      access: "Hospital Management",
      desc: "Oversees general operations, staff schedules, and hospital settings.",
    },
    {
      name: "Doctor",
      access: "Patient Consultation, Prescription",
      desc: "Handles patient diagnoses, medical charts, prescriptions, and follow-ups.",
    },
    {
      name: "Nurse",
      access: "Patient Monitoring",
      desc: "Monitors admitted patients, records daily vitals, and logs nursing notes.",
    },
    {
      name: "Receptionist",
      access: "Registration, Appointment",
      desc: "Manages guest walks, registrations, patient admission paperwork, and bookings.",
    },
    {
      name: "Pharmacist",
      access: "Medicine Management",
      desc: "Manages drug inventory, stock checks, expiry details, and sales.",
    },
    {
      name: "Lab Technician",
      access: "Lab Reports",
      desc: "Handles sample gathering, processing tests, and issuing laboratory reports.",
    },
    {
      name: "Accountant",
      access: "Financial Management",
      desc: "Handles bookkeeping, incoming cash collections, billing, and balance sheets.",
    },
    {
      name: "HR Manager",
      access: "Employee Management",
      desc: "Manages staff contracts, payroll processing, leave logs, and shifts.",
    },
  ];

  console.log("DashboardContent selectedFeature.id:", selectedFeature?.id);

  const table = selectedFeature?.id
    ? ADMIN_TABLE_BY_FEATURE_ID[selectedFeature.id]
    : null;


  const filteredTable = useMemo(() => {
    if (!table) return null;
    const q = tableSearch.trim().toLowerCase();
    if (!q) return table;

    const filteredRows = table.rows.filter((row: any) => {
      return table.columns.some((col) => {
        const val = row?.[col];
        return String(val ?? "").toLowerCase().includes(q);
      });
    });

    return {
      ...table,
      rows: filteredRows,
    };
  }, [table, tableSearch]);

  // Pagination (fix: avoid dumping 1000 rows in the UI)
  const totalRows = filteredTable?.rows?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    if (!filteredTable) return [];
    const start = (safeCurrentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredTable.rows.slice(start, end);
  }, [filteredTable, safeCurrentPage, pageSize]);

  // Reset to page 1 when search text changes
  // (prevents showing an empty page after filtering)
  // eslint-disable-next-line react-hooks/exhaustive-deps




  const titleById: Record<number, { section: string; heading: string }> = {
    1: { section: "Patient Management", heading: "Patients" },
    2: { section: "Doctor Management", heading: "Doctors" },
    3: { section: "Appointment Management", heading: "Appointments" },
    14: { section: "Billing & Accounts Management", heading: "Invoices" },
    17: { section: "Inventory Management", heading: "Inventory" },
  };

  const computedTitle =
    selectedFeature?.id && titleById[selectedFeature.id]
      ? titleById[selectedFeature.id]
      : {
          section: selectedFeature?.englishTitle ?? "Module",
          heading: selectedFeature?.englishTitle ?? "Module",
        };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 shrink-0 bg-[var(--card)] border-b border-[var(--border)] flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <button
            className="text-[var(--primary-dark)] p-2 rounded-xl hover:bg-[var(--primary-soft)]/25 transition-all duration-200 active:scale-95"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
          </button>
          <h2 className="font-bold text-lg text-[var(--primary-dark)]">
            {activeSection === "overview" && "Dashboard Analytics Overview"}
            {activeSection === "role-permissions" && "System Roles & Permissions"}
            {activeSection === "feature-detail" && selectedFeature && `${selectedFeature.englishTitle}`}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-[var(--primary-soft)]/35 text-[var(--primary-dark)] text-xs font-semibold px-3 py-1.5 rounded-full border border-[var(--primary)]/20">
            Environment: Production
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 news-scroll">
        {activeSection === "overview" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {roleStats &&
                roleStats.map((stat: any, idx: number) => {
                  const Icon = iconMap[stat.icon] || FiUser;
                  return (
                    <div
                      key={idx}
                      className="bg-[var(--card)] border border-[var(--border)] p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-[var(--primary)] transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--muted)]">{stat.label}</span>
                        <div className="p-2.5 rounded-xl bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors duration-200">
                          <Icon className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="mt-4">
                        <span className="text-2xl font-black tracking-tight text-[var(--text)]">{stat.value}</span>
                        <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-[var(--primary)] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
                          Live Status Update
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] p-6 rounded-2xl shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-4">
                  <div>
                    <h3 className="font-extrabold text-[var(--primary-dark)] text-sm">Weekly Patient Admissions</h3>
                    <p className="text-[10px] text-[var(--muted)] mt-0.5">Real-time telemetry showing occupancy dynamics</p>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--primary-dark)] bg-[var(--primary-soft)]/30 px-2 py-0.5 rounded border border-[var(--primary)]/20">
                    Operational
                  </span>
                </div>

                <div className="h-40 w-full relative pt-2">
                  <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.00" />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="20" x2="500" y2="20" stroke="var(--border)" strokeOpacity="0.3" strokeDasharray="5,5" />
                    <line x1="0" y1="60" x2="500" y2="60" stroke="var(--border)" strokeOpacity="0.3" strokeDasharray="5,5" />
                    <line x1="0" y1="100" x2="500" y2="100" stroke="var(--border)" strokeOpacity="0.3" strokeDasharray="5,5" />
                    <path
                      d="M 0 90 Q 50 30 100 65 T 200 25 T 300 80 T 400 35 T 500 15 L 500 120 L 0 120 Z"
                      fill="url(#chartGrad)"
                    />
                    <path
                      d="M 0 90 Q 50 30 100 65 T 200 25 T 300 80 T 400 35 T 500 15"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <circle cx="100" cy="65" r="4.5" fill="var(--primary)" stroke="white" strokeWidth="2" />
                    <circle cx="200" cy="25" r="4.5" fill="var(--primary)" stroke="white" strokeWidth="2" />
                    <circle cx="400" cy="35" r="4.5" fill="var(--primary)" stroke="white" strokeWidth="2" />
                  </svg>
                </div>

                <div className="flex justify-between px-2 text-[9px] font-extrabold text-[var(--muted)]">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="font-extrabold text-[var(--primary-dark)] text-sm border-b border-[var(--border)]/60 pb-3">Security & Roles Log</h3>
                  <div className="space-y-4">
                    <div className="flex gap-3 items-start">
                      <div className="p-1.5 rounded-lg bg-[var(--primary-soft)]/20 text-[var(--primary-dark)] shrink-0">
                        <FiPieChart className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold">New Doctor Registration</p>
                        <span className="text-[10px] text-[var(--muted)]">Dr. Shahed Chowdhury • Cardiologist</span>
                      </div>
                    </div>
                  </div>
                </div>

                {permissions?.canViewRolePermissions && (
                  <div className="pt-4 border-t border-[var(--border)]/60">
                    <button
                      onClick={() => setActiveSection("role-permissions")}
                      className="btn-primary w-full flex items-center justify-center gap-1.5 text-xs py-2 cursor-pointer"
                    >
                      <span>Manage All User Roles</span>
                      <FiArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]/60">
                <h3 className="font-extrabold text-[var(--primary-dark)] text-sm">System Operations Quick Links</h3>
                <span className="text-[10px] text-[var(--primary)] font-bold">Use sidebar to browse all {accessibleFeatures.length} modules</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {accessibleFeatures.slice(0, 4).map((feat: any, idx: number) => {
                  const FeatIcon = feat.icon || FiUser;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedFeature(feat)}
                      className="bg-[var(--bg)] border border-[var(--border)] p-4 rounded-xl hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/10 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-[var(--primary-soft)]/30 rounded-lg text-[var(--primary-dark)] group-hover:bg-[var(--primary)] group-hover:text-white transition-all">
                          <FeatIcon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-[var(--text)] group-hover:text-[var(--primary-dark)] transition-colors">{feat.englishTitle}</span>
                      </div>
                      <p className="text-[9px] text-[var(--muted)] mt-3 line-clamp-2 leading-relaxed">
                        {feat.subFeatures.map((s: any) => s.label).join(", ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeSection === "role-permissions" && permissions?.canViewRolePermissions && (
          <div className="space-y-6">
            <div className="bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm">
              <h3 className="font-extrabold text-[var(--primary-dark)] text-lg">Hospital Roles & Access Matrix</h3>
              <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">
                Review and configure authorization levels mapped to departments.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roles.map((r, idx) => {
                let RoleIcon = FiUser;
                if (r.name === "Super Admin") RoleIcon = FiShield;
                else if (r.name === "Hospital Admin") RoleIcon = FiSettings;
                else if (r.name === "Doctor") RoleIcon = FiActivity;
                else if (r.name === "Nurse") RoleIcon = FiUserCheck;
                else if (r.name === "Receptionist") RoleIcon = FiUser;
                else if (r.name === "Pharmacist") RoleIcon = FiBriefcase;
                else if (r.name === "Lab Technician") RoleIcon = FiDatabase;
                else if (r.name === "Accountant") RoleIcon = FiDollarSign;
                else if (r.name === "HR Manager") RoleIcon = FiBriefcase;

                return (
                  <div
                    key={idx}
                    className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-[var(--primary)] transition-all duration-200 flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors duration-200">
                          <RoleIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-[var(--text)] flex items-center gap-1.5">{r.name}</h4>
                          {r.name === "Super Admin" && (
                            <span className="inline-block text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded mt-1">
                              Full Control
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-[var(--muted)] leading-relaxed pt-1">{r.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeSection === "feature-detail" && selectedFeature && (
          <div className="space-y-6">
            <button
              onClick={() => {
                setActiveSection("overview");
                setSelectedFeature(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors cursor-pointer"
            >
              <span>← Back to Dashboard Overview</span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 card p-6 rounded-2xl shadow-sm space-y-6">
                {filteredTable ? (

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">{computedTitle.section}</span>
                        <h3 className="font-black text-xl text-[var(--primary-dark)]">{computedTitle.heading}</h3>
                      </div>
                    </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="text-xs text-[var(--muted)]">Showing mock table data for selected module.</div>
                    <div className="w-full max-w-sm">
                      <input
                        type="text"
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        placeholder="Search in this table..."
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                      <table className="min-w-[800px] w-full">
                        <thead>
                          <tr className="bg-[var(--bg)]">
                            {filteredTable.columns.map((col: string) => (

                              <th
                                key={col}
                                className="text-left text-[11px] font-bold text-[var(--muted)] px-4 py-3 border-b border-[var(--border)]"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedRows.map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-[var(--primary-soft)]/10 transition-colors">
                              {filteredTable.columns.map((col: string) => (
                                <td
                                  key={col}
                                  className="text-[12px] text-[var(--text)] px-4 py-3 border-b border-[var(--border)]"
                                >
                                  {String(row[col] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3">
                      <div className="text-xs text-[var(--muted)]">
                        Showing {paginatedRows.length} of {totalRows} rows
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={safeCurrentPage <= 1}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                            safeCurrentPage <= 1
                              ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed"
                              : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"
                          }`}
                        >
                          Previous
                        </button>

                        <span className="text-xs font-bold text-[var(--muted)]">
                          Page {safeCurrentPage} / {totalPages}
                        </span>

                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safeCurrentPage >= totalPages}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                            safeCurrentPage >= totalPages
                              ? "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] cursor-not-allowed"
                              : "bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)] cursor-pointer"
                          }`}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (

                  <>
                    <div className="flex items-center gap-4 border-b border-[var(--border)] pb-4">
                      <div className="p-3 bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] rounded-xl">
                        {(() => {
                          const FeatIcon = selectedFeature.icon || FiUser;
                          return <FeatIcon className="w-7 h-7" />;
                        })()}
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Core System Module</span>
                        <h3 className="font-black text-xl text-[var(--primary-dark)]">{selectedFeature.englishTitle}</h3>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-extrabold text-[var(--text)] mb-3 uppercase tracking-wider">Sub-Features Available</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedFeature.subFeatures.map((sub: any, sIdx: number) => {
                          const SubIcon = sub.icon;
                          return (
                            <div key={sIdx} className="card flex items-center gap-3 p-3 rounded-xl group">
                              <div className="w-7 h-7 rounded-lg bg-[var(--primary-soft)]/35 flex items-center justify-center text-[var(--primary-dark)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors shrink-0">
                                <SubIcon className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-bold text-[var(--muted)] group-hover:text-[var(--text)] transition-colors">{sub.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="card p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="font-extrabold text-[var(--primary-dark)] text-base border-b border-[var(--border)] pb-3">Module Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[var(--muted)] font-medium">Integration Status:</span>
                      <span className="text-[var(--primary-dark)] font-bold bg-[var(--primary-soft)]/30 px-2 py-0.5 rounded border border-[var(--primary)]/25">Active</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[var(--muted)] font-medium">Permissions Level:</span>
                      <span className="text-[var(--primary-dark)] font-bold bg-[var(--primary-soft)]/30 px-2 py-0.5 rounded border border-[var(--primary)]/25">Full Control</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[var(--muted)] font-medium">Sub-components:</span>
                      <span className="font-bold">{selectedFeature.subFeatures.length} Modules</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[var(--border)] mt-6 space-y-2">
                  <button className="btn-primary w-full text-xs cursor-pointer">Configure Module Settings</button>
                  <button className="w-full py-2.5 bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 border border-[var(--border)] text-[var(--muted)] rounded-xl text-xs font-bold transition-colors cursor-pointer">
                    View Audits / Logs
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

