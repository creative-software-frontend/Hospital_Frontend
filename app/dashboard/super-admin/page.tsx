"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiUser, FiActivity, FiCalendar, FiPlusSquare, FiHome, FiHeart, FiLayers,
  FiFileText, FiBriefcase, FiDatabase, FiUserCheck, FiDollarSign, FiTrendingUp,
  FiFolder, FiTruck, FiMessageSquare, FiPieChart, FiShield, FiLogOut, FiMenu, FiX,
  FiChevronDown, FiChevronUp, FiPlus, FiArrowRight, FiInfo, FiClock, FiSettings, FiUsers
} from "react-icons/fi";

// Sub-feature types
interface SubFeature {
  name: string;
}

// Main feature structure
interface Feature {
  id: number;
  banglaTitle: string;
  englishTitle: string;
  icon: any;
  subFeatures: string[];
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<string>("overview"); // overview, role-permissions, or feature id string
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  // Single expanded feature ID — null means all closed (auto-close accordion)
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);

  useEffect(() => {
    const savedRole = localStorage.getItem("role");
    setRole(savedRole);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("role");
    router.push("/login");
  };

  // Click same item → close it; click different item → close previous, open new
  const toggleFeature = (id: number) => {
    setExpandedFeature(prev => (prev === id ? null : id));
  };

  const keyFeatures: Feature[] = [
    {
      id: 1,
      banglaTitle: "১. Patient Management",
      englishTitle: "Patient Management",
      icon: FiUser,
      subFeatures: [
        "Patient Registration", "Patient Profile Management", "Unique Patient ID",
        "Patient History Tracking", "Previous Treatment Records", "Medical Documents Upload",
        "Patient Visit History", "Emergency Patient Registration"
      ]
    },
    {
      id: 2,
      banglaTitle: "২. Doctor Management",
      englishTitle: "Doctor Management",
      icon: FiActivity,
      subFeatures: [
        "Doctor Profile Management", "Department Assignment", "Doctor Schedule Management",
        "Chamber Management", "Doctor Attendance", "Commission Setup",
        "Appointment Management", "Doctor Performance Report"
      ]
    },
    {
      id: 3,
      banglaTitle: "৩. Appointment Management",
      englishTitle: "Appointment Management",
      icon: FiCalendar,
      subFeatures: [
        "Online Appointment Booking", "Walk-in Appointment", "Doctor-wise Appointment",
        "SMS Confirmation", "Appointment Rescheduling", "Appointment Cancellation",
        "Queue Management", "Daily Appointment Report"
      ]
    },
    {
      id: 4,
      banglaTitle: "৪. OPD Management (Out Patient)",
      englishTitle: "OPD Management",
      icon: FiPlusSquare,
      subFeatures: [
        "OPD Registration", "Consultation Records", "Diagnosis Management",
        "Prescription Management", "Follow-up Schedule", "OPD Billing", "Doctor Notes"
      ]
    },
    {
      id: 5,
      banglaTitle: "৫. IPD Management (Indoor Patient)",
      englishTitle: "IPD Management",
      icon: FiHome,
      subFeatures: [
        "Patient Admission", "Bed Allocation", "Ward Management",
        "Cabin Management", "Nursing Notes", "Treatment Management",
        "Daily Monitoring", "Discharge Management", "Discharge Certificate"
      ]
    },
    {
      id: 6,
      banglaTitle: "৬. Emergency Management",
      englishTitle: "Emergency Management",
      icon: FiHeart,
      subFeatures: [
        "Emergency Registration", "Triage Management", "Emergency Doctor Assignment",
        "Emergency Billing", "Critical Patient Monitoring"
      ]
    },
    {
      id: 7,
      banglaTitle: "৭. Bed & Ward Management",
      englishTitle: "Bed & Ward Management",
      icon: FiLayers,
      subFeatures: [
        "Bed Allocation", "Bed Transfer", "Cabin Management",
        "Ward Status Monitoring", "Occupancy Report", "Available Bed Report"
      ]
    },
    {
      id: 8,
      banglaTitle: "৮. Prescription Management",
      englishTitle: "Prescription Management",
      icon: FiFileText,
      subFeatures: [
        "Digital Prescription", "Doctor Signature", "Medicine Recommendation",
        "Diagnosis Notes", "Follow-up Instructions", "Print Prescription", "Email Prescription"
      ]
    },
    {
      id: 9,
      banglaTitle: "৯. Pharmacy Management",
      englishTitle: "Pharmacy Management",
      icon: FiBriefcase,
      subFeatures: [
        "Medicine Purchase", "Medicine Sales", "Stock Management",
        "Expiry Tracking", "Batch Management", "Supplier Management",
        "Barcode System", "Pharmacy Billing"
      ]
    },
    {
      id: 10,
      banglaTitle: "১০. Laboratory Management",
      englishTitle: "Laboratory Management",
      icon: FiDatabase,
      subFeatures: [
        "Test Booking", "Sample Collection", "Test Processing",
        "Report Generation", "Pathology Management", "Radiology Management",
        "Online Report Delivery", "Lab Billing"
      ]
    },
    {
      id: 11,
      banglaTitle: "১১. Operation Theatre (OT) Management",
      englishTitle: "OT Management",
      icon: FiActivity,
      subFeatures: [
        "Surgery Scheduling", "OT Booking", "Surgeon Assignment",
        "Operation Records", "OT Expense Tracking", "Surgery Reports"
      ]
    },
    {
      id: 12,
      banglaTitle: "১২. Blood Bank Management",
      englishTitle: "Blood Bank Management",
      icon: FiHeart,
      subFeatures: [
        "Donor Management", "Blood Collection", "Blood Issue",
        "Blood Stock Monitoring", "Blood Group Tracking", "Blood Expiry Alert"
      ]
    },
    {
      id: 13,
      banglaTitle: "১৩. Nursing Management",
      englishTitle: "Nursing Management",
      icon: FiUserCheck,
      subFeatures: [
        "Nurse Assignment", "Nursing Notes", "Patient Monitoring",
        "Medication Tracking", "Shift Management"
      ]
    },
    {
      id: 14,
      banglaTitle: "১৪. Billing & Accounts Management",
      englishTitle: "Billing & Accounts Management",
      icon: FiDollarSign,
      subFeatures: [
        "Patient Billing", "OPD Billing", "IPD Billing",
        "Pharmacy Billing", "Lab Billing", "Service Billing",
        "Advance Payment", "Due Collection", "Refund Management"
      ]
    },
    {
      id: 15,
      banglaTitle: "১৫. Financial Accounting",
      englishTitle: "Financial Accounting",
      icon: FiTrendingUp,
      subFeatures: [
        "Income Management", "Expense Management", "General Ledger",
        "Cash Book", "Bank Book", "Trial Balance",
        "Profit & Loss", "Balance Sheet"
      ]
    },
    {
      id: 16,
      banglaTitle: "১৬. Human Resource Management (HRM)",
      englishTitle: "Human Resource Management",
      icon: FiBriefcase,
      subFeatures: [
        "Employee Management", "Attendance Management", "Payroll Management",
        "Leave Management", "Shift Management", "Employee Evaluation"
      ]
    },
    {
      id: 17,
      banglaTitle: "১৭. Inventory Management",
      englishTitle: "Inventory Management",
      icon: FiFolder,
      subFeatures: [
        "Medical Equipment Management", "Asset Management", "Inventory Tracking",
        "Purchase Management", "Stock Transfer", "Reorder Alert"
      ]
    },
    {
      id: 18,
      banglaTitle: "১৮. Ambulance Management",
      englishTitle: "Ambulance Management",
      icon: FiTruck,
      subFeatures: [
        "Ambulance Booking", "Driver Management", "Trip Tracking",
        "Fuel Expense Tracking", "Emergency Dispatch"
      ]
    },
    {
      id: 19,
      banglaTitle: "১৯. SMS & Notification System",
      englishTitle: "SMS & Notification System",
      icon: FiMessageSquare,
      subFeatures: [
        "Appointment Reminder", "Bill Notification", "Medicine Reminder",
        "Follow-up Reminder", "Promotional SMS"
      ]
    },
    {
      id: 20,
      banglaTitle: "২০. Reports & Analytics",
      englishTitle: "Reports & Analytics",
      icon: FiPieChart,
      subFeatures: [
        "Daily Collection Report", "Patient Report", "Doctor Report",
        "Appointment Report", "Pharmacy Sales Report", "Lab Income Report",
        "Financial Report", "Management Dashboard"
      ]
    }
  ];

  const roles = [
    { name: "Super Admin", access: "Full Access", desc: "Complete platform configuration, full settings, and absolute authorization overrides." },
    { name: "Hospital Admin", access: "Hospital Management", desc: "Oversees general operations, staff schedules, and hospital settings." },
    { name: "Doctor", access: "Patient Consultation, Prescription", desc: "Handles patient diagnoses, medical charts, prescriptions, and follow-ups." },
    { name: "Nurse", access: "Patient Monitoring", desc: "Monitors admitted patients, records daily vitals, and logs nursing notes." },
    { name: "Receptionist", access: "Registration, Appointment", desc: "Manages guest walks, registrations, patient admission paperwork, and bookings." },
    { name: "Pharmacist", access: "Medicine Management", desc: "Manages drug inventory, stock checks, expiry details, and sales." },
    { name: "Lab Technician", access: "Lab Reports", desc: "Handles sample gathering, processing tests, and issuing laboratory reports." },
    { name: "Accountant", access: "Financial Management", desc: "Handles bookkeeping, incoming cash collections, billing, and balance sheets." },
    { name: "HR Manager", access: "Employee Management", desc: "Manages staff contracts, payroll processing, leave logs, and shifts." }
  ];

  const stats = [
    { label: "Total Patients", value: "12,840", icon: FiUser },
    { label: "Today's Appointments", value: "342", icon: FiCalendar },
    { label: "Today's Revenue", value: "$18,250", icon: FiDollarSign },
    { label: "Available Beds", value: "48 / 150", icon: FiLayers },
    { label: "Admitted Patients", value: "102", icon: FiHome },
    { label: "Doctors On Duty", value: "28", icon: FiActivity },
    { label: "Lab Tests Completed", value: "195", icon: FiDatabase },
    { label: "Pharmacy Sales", value: "$4,390", icon: FiBriefcase }
  ];

  const handleSelectFeature = (feat: Feature) => {
    setSelectedFeature(feat);
    setActiveSection("feature-detail");
  };

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] font-sans overflow-hidden">

      {/* SIDEBAR */}
      <aside
        className={`${sidebarOpen ? "w-80" : "w-0 -translate-x-full"
          } lg:w-80 lg:translate-x-0 shrink-0 bg-[var(--card)] border-r border-[var(--border)] flex flex-col transition-all duration-300 z-30 h-full`}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--primary)] text-white">
          <div className="flex items-center gap-3">
            <img
              src="/images/hospitalogo.png"
              alt="Dhaka Central Hospital Logo"
              className="w-10 h-10 object-contain bg-white rounded-xl p-1 shadow-md"
            />
            <div>
              <h1 className="font-extrabold text-base leading-none tracking-tight text-white uppercase">Management</h1>
              <span className="text-[10px] text-white/70 tracking-wider font-semibold block uppercase mt-1">Super Admin Portal</span>
            </div>
          </div>
          <button
            className="lg:hidden text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 news-scroll">

          {/* Main Navigation Group */}
          <div>
            <div className="text-[11px] font-bold tracking-wider text-[var(--muted)] uppercase mb-3 px-2">
              General
            </div>
            <button
              onClick={() => {
                setActiveSection("overview");
                setSelectedFeature(null);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeSection === "overview"
                ? "bg-[var(--primary)] text-white shadow-md scale-[1.01]"
                : "text-[var(--muted)] hover:bg-[var(--primary-soft)]/25 hover:text-[var(--primary-dark)] bg-[var(--bg)] border border-[var(--border)]/40"
                }`}
            >
              <FiPieChart className="w-4 h-4" />
              <span>Dashboard Overview</span>
            </button>

            <button
              onClick={() => {
                setActiveSection("role-permissions");
                setSelectedFeature(null);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 mt-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeSection === "role-permissions"
                ? "bg-[var(--primary)] text-white shadow-md scale-[1.01]"
                : "text-[var(--muted)] hover:bg-[var(--primary-soft)]/25 hover:text-[var(--primary-dark)] bg-[var(--bg)] border border-[var(--border)]/40"
                }`}
            >
              <FiShield className="w-4 h-4" />
              <span>Roles & Permissions</span>
            </button>
          </div>

          {/* Key Features Accordion Menu */}
          <div>
            <div className="text-[11px] font-bold tracking-wider text-[var(--muted)] uppercase mb-3 px-2">
              Key Features
            </div>

            <div className="space-y-2.5">
              {keyFeatures.map((feat) => {
                const Icon = feat.icon;
                const isExpanded = expandedFeature === feat.id;
                const isActive = activeSection === "feature-detail" && selectedFeature?.id === feat.id;

                return (
                  <div key={feat.id}>
                    {/* Row trigger — flat nav style, no card border */}
                    <div
                      className={`flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-all duration-200 ${isActive
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--muted)] hover:bg-[var(--primary-soft)]/20 hover:text-[var(--primary-dark)]"
                        }`}
                      onClick={() => {
                        handleSelectFeature(feat);
                        toggleFeature(feat.id);
                      }}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-1.5 rounded-lg shrink-0 ${isActive ? "bg-white/25 text-white" : "bg-[var(--primary-soft)]/40 text-[var(--primary)]"}`}>
                          <Icon className="w-4 h-4 shrink-0" />
                        </div>
                        <span className="text-xs font-semibold truncate text-left">
                          {feat.id}. {feat.englishTitle}
                        </span>
                      </div>
                      <div className={`shrink-0 pl-1 ${isActive ? "text-white/80" : "text-[var(--muted)]"}`}>
                        {isExpanded ? <FiChevronUp className="w-3.5 h-3.5" /> : <FiChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    {/* Dropdown sub-items — hover only */}
                    {isExpanded && (
                      <div className="mt-1 mb-2 ml-6 space-y-0.5">
                        {feat.subFeatures.map((sub, sIdx) => (
                          <div
                            key={sIdx}
                            className="px-3 py-2 rounded-lg cursor-pointer text-[11px] font-medium text-[var(--muted)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary-dark)] hover:pl-4 transition-all duration-200"
                          >
                            {sub}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg)]">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-9 h-9 rounded-full bg-[var(--primary-soft)]/40 border border-[var(--primary)]/30 flex items-center justify-center font-bold text-[var(--primary-dark)]">
              SA
            </div>
            <div className="overflow-hidden">
              <h4 className="text-xs font-bold truncate">Super Administrator</h4>
              <span className="text-[10px] text-[var(--muted)] truncate block">{role || "Active Session"}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--danger)]/10 text-[var(--danger)] rounded-xl text-xs font-bold hover:bg-[var(--danger)]/15 transition-colors"
          >
            <FiLogOut className="w-3.5 h-3.5" />
            <span>Logout Account</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Navbar / Header */}
        <header className="h-16 shrink-0 bg-[var(--card)] border-b border-[var(--border)] flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-[var(--primary-dark)] p-1.5 rounded-lg hover:bg-[var(--primary-soft)]/25 transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <FiMenu className="w-6 h-6" />
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

        {/* Dashboard Dynamic Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 news-scroll">

          {/* 1. OVERVIEW CONTENT VIEW */}
          {activeSection === "overview" && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => {
                  const Icon = stat.icon;
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

              {/* Info & SVG Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Patient Admissions Analytics SVG Chart */}
                <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] p-6 rounded-2xl shadow-sm space-y-5">
                  <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-4">
                    <div>
                      <h3 className="font-extrabold text-[var(--primary-dark)] text-sm">Weekly Patient Admissions</h3>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">Real-time telemetry showing occupancy dynamics</p>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--primary-dark)] bg-[var(--primary-soft)]/30 px-2 py-0.5 rounded border border-[var(--primary)]/20">Operational</span>
                  </div>

                  {/* SVG Chart Layout */}
                  <div className="h-40 w-full relative pt-2">
                    <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.00" />
                        </linearGradient>
                      </defs>
                      {/* Grid Lines */}
                      <line x1="0" y1="20" x2="500" y2="20" stroke="var(--border)" strokeOpacity="0.3" strokeDasharray="5,5" />
                      <line x1="0" y1="60" x2="500" y2="60" stroke="var(--border)" strokeOpacity="0.3" strokeDasharray="5,5" />
                      <line x1="0" y1="100" x2="500" y2="100" stroke="var(--border)" strokeOpacity="0.3" strokeDasharray="5,5" />

                      {/* Chart Area Fill */}
                      <path
                        d="M 0 90 Q 50 30 100 65 T 200 25 T 300 80 T 400 35 T 500 15 L 500 120 L 0 120 Z"
                        fill="url(#chartGrad)"
                      />
                      {/* Chart Line Stroke */}
                      <path
                        d="M 0 90 Q 50 30 100 65 T 200 25 T 300 80 T 400 35 T 500 15"
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      {/* Highlight Dots */}
                      <circle cx="100" cy="65" r="4.5" fill="var(--primary)" stroke="white" strokeWidth="2" />
                      <circle cx="200" cy="25" r="4.5" fill="var(--primary)" stroke="white" strokeWidth="2" />
                      <circle cx="400" cy="35" r="4.5" fill="var(--primary)" stroke="white" strokeWidth="2" />
                    </svg>
                  </div>

                  {/* X-Axis labels */}
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

                {/* Core configuration quick log */}
                <div className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="font-extrabold text-[var(--primary-dark)] text-sm border-b border-[var(--border)]/60 pb-3">
                      Security & Roles Log
                    </h3>
                    <div className="space-y-4">
                      <div className="flex gap-3 items-start">
                        <div className="p-1.5 rounded-lg bg-[var(--primary-soft)]/20 text-[var(--primary-dark)] shrink-0">
                          <FiUserCheck className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold">New Doctor Registration</p>
                          <span className="text-[10px] text-[var(--muted)]">Dr. Shahed Chowdhury • Cardiologist</span>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="p-1.5 rounded-lg bg-[var(--primary-soft)]/20 text-[var(--primary-dark)] shrink-0">
                          <FiClock className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold">Shift Schedule Rotated</p>
                          <span className="text-[10px] text-[var(--muted)]">Ward nurse schedules updated by Admin</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[var(--border)]/60">
                    <button
                      onClick={() => setActiveSection("role-permissions")}
                      className="btn-primary w-full flex items-center justify-center gap-1.5 text-xs py-2"
                    >
                      <span>Manage All User Roles</span>
                      <FiArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>

              {/* Module Cards Grid (Quick Access to 4 selected modules) */}
              <div className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]/60">
                  <h3 className="font-extrabold text-[var(--primary-dark)] text-sm">System Operations Quick Links</h3>
                  <span className="text-[10px] text-[var(--primary)] font-bold">Use sidebar to browse all 20 modules</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {keyFeatures.slice(0, 4).map((feat, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectFeature(feat)}
                      className="bg-[var(--bg)] border border-[var(--border)] p-4 rounded-xl hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/10 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-[var(--primary-soft)]/30 rounded-lg text-[var(--primary-dark)] group-hover:bg-[var(--primary)] group-hover:text-white transition-all">
                          <feat.icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-[var(--text)] group-hover:text-[var(--primary-dark)] transition-colors">{feat.englishTitle}</span>
                      </div>
                      <p className="text-[9px] text-[var(--muted)] mt-3 line-clamp-2 leading-relaxed">
                        Features: {feat.subFeatures.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 2. ROLE & PERMISSIONS VIEW */}
          {activeSection === "role-permissions" && (
            <div className="space-y-6">
              {/* Header Info Block */}
              <div className="bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm">
                <h3 className="font-extrabold text-[var(--primary-dark)] text-lg">Hospital Roles & Access Matrix</h3>
                <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">
                  Review and configure authorization levels mapped to departments. Access levels determine system dashboard views and CRUD capability rights.
                </p>
              </div>

              {/* Grid Layout of Roles */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map((r, idx) => {
                  // Select icon based on role name
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
                            <h4 className="text-sm font-extrabold text-[var(--text)] flex items-center gap-1.5">
                              {r.name}
                            </h4>
                            {r.name === "Super Admin" && (
                              <span className="inline-block text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded mt-1">
                                Full Control
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-[var(--muted)] leading-relaxed pt-1">
                          {r.desc}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[var(--border)]/60 flex items-center justify-between">
                        <span className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-wider">Access Scope</span>
                        <span className="text-[10px] font-extrabold text-[var(--primary-dark)] bg-[var(--primary-soft)]/20 px-2.5 py-1 rounded-md border border-[var(--primary)]/10 truncate max-w-[150px]">
                          {r.access}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. FEATURE DETAIL VIEW */}
          {activeSection === "feature-detail" && selectedFeature && (
            <div className="space-y-6">

              {/* Back to dashboard option */}
              <button
                onClick={() => {
                  setActiveSection("overview");
                  setSelectedFeature(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors"
              >
                <span>← Back to Dashboard Overview</span>
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Feature Description Card */}
                <div className="lg:col-span-2 card p-6 rounded-2xl shadow-sm space-y-6">
                  <div className="flex items-center gap-4 border-b border-[var(--border)] pb-4">
                    <div className="p-3 bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] rounded-xl">
                      {(() => {
                        const Icon = selectedFeature.icon;
                        return <Icon className="w-7 h-7" />;
                      })()}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">Core System Module</span>
                      <h3 className="font-black text-xl text-[var(--primary-dark)]">{selectedFeature.id}. {selectedFeature.englishTitle}</h3>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-extrabold text-[var(--text)] mb-3 uppercase tracking-wider">
                      সুবিধাসমূহ / Sub-Features Available:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedFeature.subFeatures.map((sub, sIdx) => (
                        <div
                          key={sIdx}
                          className="card flex items-center gap-3 p-3 rounded-xl group"
                        >
                          <div className="w-5 h-5 rounded-full bg-[var(--primary-soft)]/35 flex items-center justify-center text-[10px] font-bold text-[var(--primary-dark)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors shrink-0">
                            {sIdx + 1}
                          </div>
                          <span className="text-xs font-bold text-[var(--muted)] group-hover:text-[var(--text)] transition-colors">
                            {sub}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Status / Actions Related to this specific feature */}
                <div className="card p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="font-extrabold text-[var(--primary-dark)] text-base border-b border-[var(--border)] pb-3">
                      Module Status
                    </h3>
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
                    <button className="btn-primary w-full text-xs">
                      Configure Module Settings
                    </button>
                    <button className="w-full py-2.5 bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 border border-[var(--border)] text-[var(--muted)] rounded-xl text-xs font-bold transition-colors">
                      View Audits / Logs
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

        </main>
      </div>

    </div>
  );
}