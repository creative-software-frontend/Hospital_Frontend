"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";

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

const roleRoutes: Record<string, string> = {
  "Super Admin": "super-admin",
  Admin: "admin",
  Doctor: "doctor",
  Pharmacist: "pharmacist",
  Pathologist: "pathologist",
  Radiologist: "radiologist",
  Accountant: "accountant",
  Receptionist: "receptionist",
  Nurse: "nurse",
};

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

export default function AdminLoginPage() {
  const router = useRouter();

  const [selectedRole, setSelectedRole] = useState<string>("Admin");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const handleLogin = () => {
    const role = roleRoutes[selectedRole];
    localStorage.setItem("role", role);
    localStorage.setItem("userType", "admin");

    const adminRoutes: Record<string, string> = {
      "super-admin": "/dashboard/super-admin",
      admin: "/dashboard/admin",
      doctor: "/dashboard/doctor",
      pharmacist: "/dashboard/pharmacist",
      pathologist: "/dashboard/pathologist",
      radiologist: "/dashboard/radiologist",
      accountant: "/dashboard/accountant",
      receptionist: "/dashboard/receptionist",
      nurse: "/dashboard/nurse",
    };

    router.push(adminRoutes[role]);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-6 sm:py-10 relative"
      style={{
        backgroundImage: "url('/images/hospitalbgimg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">

        {/* LEFT LOGIN */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-5 sm:p-8 text-white"
        >

          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center font-bold text-white shrink-0">
              H
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Smart Hospital Login
            </h2>
          </div>

          <p className="text-white/80 text-sm">
            Select your role to continue
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className="px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm border"
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

          <div className="mt-6 space-y-4">

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-4 py-3 rounded-lg bg-white text-black"
            />

            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              className="w-full px-4 py-3 rounded-lg bg-white text-black"
            />

            <button
              onClick={handleLogin}
              className="w-full py-3 rounded-lg font-semibold text-white"
              style={{ background: "var(--primary)" }}
            >
              Login as {selectedRole}
            </button>

            {message && (
              <p className="text-sm text-white/90">{message}</p>
            )}

          </div>

          <div className="mt-6 pt-5 border-t border-white/15 text-center">
            <p className="text-white/50 text-xs">
              Not hospital staff?{" "}
              <Link
                href="/login"
                className="text-[var(--primary-soft)] font-semibold hover:underline"
              >
                Patient / User Login →
              </Link>
            </p>
          </div>
        </motion.div>

        {/* RIGHT NEWS */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-5 sm:p-6 text-white"
        >
          <h2 className="text-xl sm:text-2xl font-bold mb-4">
            What&apos;s New
          </h2>

          <div className="h-[280px] sm:h-[340px] lg:h-[420px] overflow-y-auto space-y-4 pr-2 news-scroll">
            {news.map((item, i) => (
              <div
                key={i}
                className="p-3 sm:p-4 rounded-xl bg-white/10 border border-white/20"
              >
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-white/80 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
