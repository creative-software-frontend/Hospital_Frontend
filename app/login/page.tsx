"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const roles = [
  "Super Admin",
  "Admin",
  "Doctor",
  "Pharmacist",
  "Pathologist",
  "Radiologist",
  "Accountant",
  "Receptionist",
  "Nurse",
];

const news = [
  {
    title: "National Pharmacist Day",
    desc: "Celebrating pharmacists for their contribution in healthcare.",
  },
  {
    title: "International Day of Persons with Disabilities",
    desc: "Raising awareness for inclusion and accessibility worldwide.",
  },
  {
    title: "World Neuroendocrine Cancer Day",
    desc: "Every stripe tells a story about awareness and support.",
  },
  {
    title: "Diabetes and Well-being Camps",
    desc: "Free health camps focusing on diabetes care and awareness.",
  },
  {
    title: "Free Dental Treatment Camp",
    desc: "Free dental care services for underprivileged patients.",
  },
];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState("Admin");

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 relative"
      style={{
        backgroundImage: "url('/images/hospitalbgimg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* DARK OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-blue-900/50 to-emerald-900/40" />

      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-2 gap-8">

        {/* LEFT LOGIN */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.01 }}
          className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 text-white transition"
        >
          {/* HEADER */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-bold">
              H
            </div>
            <h2 className="text-2xl font-bold">Smart Hospital Login</h2>
          </div>

          <p className="text-white/60 text-sm">
            Select your role to continue
          </p>

          {/* ROLE GRID */}
          <div className="grid grid-cols-2 gap-2 mt-6">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className="px-3 py-2 rounded-lg text-sm border transition duration-200"
                style={{
                  background:
                    selectedRole === role
                      ? "var(--primary)"
                      : "transparent",
                  borderColor:
                    selectedRole === role
                      ? "var(--primary)"
                      : "rgba(255,255,255,0.2)",
                  color: "white",
                }}
                onMouseEnter={(e) => {
                  if (selectedRole !== role) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.background = "rgba(16,185,129,0.15)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedRole !== role) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {role}
              </button>
            ))}
          </div>

          {/* INPUTS */}
          <div className="mt-6 space-y-3">
            <input
              placeholder="Email"
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder-white/60 outline-none transition"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.2)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder-white/60 outline-none transition"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.2)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />

            {/* LOGIN BUTTON */}
            <button
              className="w-full py-3 rounded-lg font-semibold transition duration-200"
              style={{
                background: "var(--primary)",
                color: "white",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.opacity = "1";
              }}
            >
              Login as {selectedRole}
            </button>

            {/* FORGOT */}
            <div className="text-right text-sm text-white/60">
              <span
                className="cursor-pointer transition"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "";
                }}
              >
                Forgot Password?
              </span>
            </div>
          </div>
        </motion.div>

        {/* RIGHT NEWS */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/10 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 text-white"
        >
          <h2 className="text-2xl font-bold mb-4">
            What’s New
          </h2>

          {/* SCROLL AREA */}
          <div className="news-scroll h-[420px] overflow-y-auto pr-2 space-y-4">
            {news.map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/10 border border-white/10 transition duration-200"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateX(4px)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateX(0)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.10)";
                }}
              >
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-white/70 mt-1">
                  {item.desc}
                </p>
                <span className="text-xs text-emerald-300 cursor-pointer hover:underline">
                  Read More
                </span>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}