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
      {/* STRONG OVERLAY (FIX CONTRAST ISSUE) */}
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-2 gap-8">

        {/* LEFT LOGIN */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 text-white"
        >
          {/* HEADER */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center font-bold text-white">
              H
            </div>
            <h2 className="text-2xl font-bold text-white">
              Smart Hospital Login
            </h2>
          </div>

          <p className="text-white/80 text-sm">
            Select your role to continue
          </p>

          {/* ROLE GRID */}
          <div className="grid grid-cols-2 gap-2 mt-6">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className="px-3 py-2 rounded-lg text-sm border transition"
                style={{
                  background:
                    selectedRole === role
                      ? "var(--primary)"
                      : "rgba(255,255,255,0.05)",
                  borderColor:
                    selectedRole === role
                      ? "var(--primary)"
                      : "rgba(255,255,255,0.2)",
                  color: "white",
                }}
              >
                {role}
              </button>
            ))}
          </div>

          {/* INPUTS */}
          <div className="mt-6 space-y-4">
            <input
              placeholder="Email"
              className="w-full px-4 py-3 rounded-lg bg-white text-black border border-gray-300 outline-none"
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full px-4 py-3 rounded-lg bg-white text-black border border-gray-300 outline-none"
            />

            {/* BUTTON */}
            <button
              className="w-full py-3 rounded-lg font-semibold text-white transition"
              style={{ background: "var(--primary)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.opacity = "0.9")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.opacity = "1")
              }
            >
              Login as {selectedRole}
            </button>

            {/* FORGOT */}
            <div className="text-right text-sm text-white">
              <span className="opacity-80 hover:opacity-100 cursor-pointer">
                Forgot Password?
              </span>
            </div>
          </div>
        </motion.div>

        {/* RIGHT NEWS */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 text-white"
        >
          <h2 className="text-2xl font-bold mb-4">
            What’s New
          </h2>

          {/* SCROLL AREA */}
         <div className="h-[420px] overflow-y-auto space-y-4 pr-2 news-scroll">
            {news.map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 transition"
              >
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-white/80 mt-1">
                  {item.desc}
                </p>
                <span className="text-xs text-emerald-300 hover:underline cursor-pointer">
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