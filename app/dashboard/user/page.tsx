"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  FiCalendar,
  FiFileText,
  FiActivity,
  FiHeart,
  FiClock,
  FiBell,
  FiLogOut,
  FiUser,
  FiChevronRight,
  FiPlus,
  FiDroplet,
  FiAlertCircle,
  FiCheckCircle,
  FiMenu,
  FiX,
} from "react-icons/fi";

// --- Mock Data ---
const upcomingAppointments = [
  {
    id: 1,
    doctor: "Dr. Sarah Khan",
    specialty: "Cardiologist",
    date: "Jun 20, 2026",
    time: "10:30 AM",
    status: "confirmed",
    avatar: "SK",
  },
  {
    id: 2,
    doctor: "Dr. Imran Hossain",
    specialty: "General Physician",
    date: "Jun 24, 2026",
    time: "02:00 PM",
    status: "pending",
    avatar: "IH",
  },
];

const recentReports = [
  {
    id: 1,
    name: "CBC Blood Test",
    date: "Jun 10, 2026",
    type: "Lab",
    status: "ready",
  },
  {
    id: 2,
    name: "Chest X-Ray",
    date: "Jun 5, 2026",
    type: "Radiology",
    status: "ready",
  },
  {
    id: 3,
    name: "ECG Report",
    date: "May 28, 2026",
    type: "Cardiology",
    status: "ready",
  },
];

const medications = [
  {
    name: "Metformin 500mg",
    schedule: "Twice daily",
    time: "8:00 AM & 8:00 PM",
    color: "#408A71",
  },
  {
    name: "Amlodipine 5mg",
    schedule: "Once daily",
    time: "9:00 AM",
    color: "#3b82f6",
  },
  {
    name: "Vitamin D3",
    schedule: "Once daily",
    time: "With breakfast",
    color: "#f59e0b",
  },
];

const healthStats = [
  { label: "Blood Pressure", value: "120/80", unit: "mmHg", icon: FiActivity, trend: "normal" },
  { label: "Heart Rate", value: "72", unit: "bpm", icon: FiHeart, trend: "normal" },
  { label: "Blood Sugar", value: "98", unit: "mg/dL", icon: FiDroplet, trend: "normal" },
  { label: "Next Visit", value: "3", unit: "days", icon: FiCalendar, trend: "upcoming" },
];

const navItems = [
  { id: "overview", label: "Overview", icon: FiActivity },
  { id: "appointments", label: "Appointments", icon: FiCalendar },
  { id: "reports", label: "Reports", icon: FiFileText },
  { id: "medications", label: "Medications", icon: FiDroplet },
];

export default function UserDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userEmail, setUserEmail] = useState("user@example.com");

  useEffect(() => {
    const email = localStorage.getItem("userEmail");
    if (email) setUserEmail(email);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userType");
    localStorage.removeItem("userEmail");
    router.push("/login");
  };

  const firstName = userEmail.split("@")[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* ---- SIDEBAR ---- */}
      <aside
        className={`${
          sidebarOpen ? "w-72" : "w-0 -translate-x-full"
        } shrink-0 flex flex-col transition-all duration-300 ease-in-out z-30 h-full overflow-hidden border-r`}
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Sidebar Header */}
        <div
          className="p-5 border-b flex items-center gap-3"
          style={{ background: "var(--primary)", borderColor: "var(--border)" }}
        >
          <img
            src="/images/hospitalogo.png"
            alt="Hospital Logo"
            className="w-9 h-9 object-contain bg-white rounded-xl p-1 shadow-md"
          />
          <div>
            <h1 className="font-extrabold text-sm text-white uppercase tracking-tight leading-none">
              Patient Portal
            </h1>
            <span className="text-[10px] text-white/60 tracking-wider font-semibold block mt-0.5 uppercase">
              My Health Dashboard
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto news-scroll">
          <div
            className="text-[10px] font-bold tracking-widest mb-3 px-2 uppercase"
            style={{ color: "var(--muted)" }}
          >
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "text-white shadow-md"
                    : "hover:opacity-80"
                }`}
                style={{
                  background: isActive ? "var(--primary)" : "transparent",
                  color: isActive ? "white" : "var(--muted)",
                  border: isActive ? "none" : `1px solid transparent`,
                }}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3 mb-3 px-1">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white shrink-0"
              style={{ background: "var(--primary)" }}
            >
              {displayName.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-xs font-bold truncate" style={{ color: "var(--text)" }}>
                {displayName}
              </h4>
              <span
                className="text-[10px] truncate block"
                style={{ color: "var(--muted)" }}
              >
                Patient Account
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
            style={{
              background: "rgba(239,68,68,0.08)",
              color: "var(--danger)",
            }}
          >
            <FiLogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ---- MAIN ---- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header
          className="shrink-0 h-16 flex items-center justify-between px-5 sm:px-6 border-b shadow-sm"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: "var(--muted)" }}
            >
              {sidebarOpen ? (
                <FiX className="w-5 h-5" />
              ) : (
                <FiMenu className="w-5 h-5" />
              )}
            </button>
            <div>
              <h2
                className="text-base font-bold capitalize"
                style={{ color: "var(--text)" }}
              >
                {activeTab === "overview"
                  ? `Good morning, ${displayName} 👋`
                  : navItems.find((n) => n.id === activeTab)?.label}
              </h2>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="relative p-2 rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: "var(--muted)" }}
            >
              <FiBell className="w-5 h-5" />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: "var(--danger)" }}
              />
            </button>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
              style={{ background: "var(--primary)" }}
            >
              {displayName.charAt(0)}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-6 news-scroll">
          {activeTab === "overview" && <OverviewTab displayName={displayName} setActiveTab={setActiveTab} />}
          {activeTab === "appointments" && <AppointmentsTab />}
          {activeTab === "reports" && <ReportsTab />}
          {activeTab === "medications" && <MedicationsTab />}
        </main>
      </div>
    </div>
  );
}

// ====================== OVERVIEW TAB ======================
function OverviewTab({ displayName, setActiveTab }: { displayName: string; setActiveTab: (t: string) => void }) {
  return (
    <div className="space-y-6">
      {/* Health Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {healthStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl p-4 border"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(64,138,113,0.12)" }}
                >
                  <Icon className="w-4 h-4" style={{ color: "var(--primary)" }} />
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background:
                      stat.trend === "normal"
                        ? "rgba(64,138,113,0.12)"
                        : "rgba(245,158,11,0.12)",
                    color:
                      stat.trend === "normal" ? "var(--primary)" : "#d97706",
                  }}
                >
                  {stat.trend === "normal" ? "Normal" : "Soon"}
                </span>
              </div>
              <div className="text-2xl font-extrabold" style={{ color: "var(--text)" }}>
                {stat.value}
                <span
                  className="text-xs font-normal ml-1"
                  style={{ color: "var(--muted)" }}
                >
                  {stat.unit}
                </span>
              </div>
              <p className="text-xs mt-1 font-medium" style={{ color: "var(--muted)" }}>
                {stat.label}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Appointments + Reports Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming Appointments */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border p-5"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>
              Upcoming Appointments
            </h3>
            <button
              onClick={() => setActiveTab("appointments")}
              className="text-xs font-semibold flex items-center gap-1 hover:opacity-70 transition-opacity"
              style={{ color: "var(--primary)" }}
            >
              View all <FiChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {upcomingAppointments.map((appt) => (
              <div
                key={appt.id}
                className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
                  style={{ background: "var(--primary)" }}
                >
                  {appt.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>
                    {appt.doctor}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {appt.specialty}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                    {appt.date}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {appt.time}
                  </p>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    background:
                      appt.status === "confirmed"
                        ? "rgba(64,138,113,0.12)"
                        : "rgba(245,158,11,0.12)",
                    color:
                      appt.status === "confirmed" ? "var(--primary)" : "#d97706",
                  }}
                >
                  {appt.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Reports */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="rounded-2xl border p-5"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>
              Recent Reports
            </h3>
            <button
              onClick={() => setActiveTab("reports")}
              className="text-xs font-semibold flex items-center gap-1 hover:opacity-70 transition-opacity"
              style={{ color: "var(--primary)" }}
            >
              View all <FiChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {recentReports.map((rep) => (
              <div
                key={rep.id}
                className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(64,138,113,0.12)" }}
                >
                  <FiFileText className="w-4 h-4" style={{ color: "var(--primary)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>
                    {rep.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {rep.type} · {rep.date}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: "var(--primary)" }}>
                  <FiCheckCircle className="w-3.5 h-3.5" />
                  Ready
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Medications Quick View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="rounded-2xl border p-5"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>
            Today&apos;s Medications
          </h3>
          <button
            onClick={() => setActiveTab("medications")}
            className="text-xs font-semibold flex items-center gap-1 hover:opacity-70 transition-opacity"
            style={{ color: "var(--primary)" }}
          >
            Full schedule <FiChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {medications.map((med, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl border"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            >
              <div
                className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                style={{ background: med.color }}
              />
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--text)" }}>
                  {med.name}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
                  {med.schedule}
                </p>
                <p className="text-[10px] font-semibold" style={{ color: med.color }}>
                  {med.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ====================== APPOINTMENTS TAB ======================
function AppointmentsTab() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold" style={{ color: "var(--text)" }}>
          My Appointments
        </h2>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: "var(--primary)" }}
        >
          <FiPlus className="w-4 h-4" />
          Book New
        </button>
      </div>
      <div className="space-y-3">
        {upcomingAppointments.map((appt) => (
          <motion.div
            key={appt.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border p-5 flex items-center gap-4"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-white text-lg shrink-0"
              style={{ background: "var(--primary)" }}
            >
              {appt.avatar}
            </div>
            <div className="flex-1">
              <h3 className="font-bold" style={{ color: "var(--text)" }}>
                {appt.doctor}
              </h3>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {appt.specialty}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  <FiCalendar className="w-3.5 h-3.5" /> {appt.date}
                </span>
                <span
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  <FiClock className="w-3.5 h-3.5" /> {appt.time}
                </span>
              </div>
            </div>
            <span
              className="px-3 py-1 rounded-full text-xs font-bold shrink-0"
              style={{
                background:
                  appt.status === "confirmed"
                    ? "rgba(64,138,113,0.12)"
                    : "rgba(245,158,11,0.12)",
                color:
                  appt.status === "confirmed" ? "var(--primary)" : "#d97706",
              }}
            >
              {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ====================== REPORTS TAB ======================
function ReportsTab() {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-extrabold" style={{ color: "var(--text)" }}>
        Medical Reports
      </h2>
      <div className="space-y-3">
        {recentReports.map((rep, i) => (
          <motion.div
            key={rep.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl border p-5 flex items-center gap-4"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(64,138,113,0.1)" }}
            >
              <FiFileText
                className="w-5 h-5"
                style={{ color: "var(--primary)" }}
              />
            </div>
            <div className="flex-1">
              <h3 className="font-bold" style={{ color: "var(--text)" }}>
                {rep.name}
              </h3>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {rep.type} · {rep.date}
              </p>
            </div>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
              style={{ background: "var(--primary)", color: "white" }}
            >
              Download
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ====================== MEDICATIONS TAB ======================
function MedicationsTab() {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-extrabold" style={{ color: "var(--text)" }}>
        Medications & Reminders
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {medications.map((med, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-2xl border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${med.color}18` }}
            >
              <FiDroplet className="w-5 h-5" style={{ color: med.color }} />
            </div>
            <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>
              {med.name}
            </h3>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              {med.schedule}
            </p>
            <div
              className="mt-3 flex items-center gap-2 text-xs font-semibold"
              style={{ color: med.color }}
            >
              <FiClock className="w-3.5 h-3.5" />
              {med.time}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
