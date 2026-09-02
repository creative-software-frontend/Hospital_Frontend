"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import Link from "next/link";
import { authApi, errorMessage } from "@/app/lib/api";
import { toFrontendRole } from "@/app/lib/roles";
import { authStorage } from "@/app/lib/auth";

const DEMO_PASSWORD = "StaffDemo123!";

const demoAccounts = [
  { role: "Super Admin", email: "admin@hospital.com", password: DEMO_PASSWORD },
  { role: "Branch Admin", email: "admin2@hospital.com", password: DEMO_PASSWORD },
  { role: "Doctor", email: "doctor@hospital.com", password: DEMO_PASSWORD },
  { role: "Receptionist", email: "receptionist@hospital.com", password: DEMO_PASSWORD },
  { role: "Nurse", email: "nurse@hospital.com", password: DEMO_PASSWORD },
  { role: "Pharmacist", email: "pharmacist@hospital.com", password: DEMO_PASSWORD },
  { role: "Pathologist", email: "pathologist@hospital.com", password: DEMO_PASSWORD },
  { role: "Radiologist", email: "radiologist@hospital.com", password: DEMO_PASSWORD },
  { role: "Accountant", email: "accountant@hospital.com", password: DEMO_PASSWORD },
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

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const result = await authApi.login(email.trim(), password);
      const role = toFrontendRole(result.roles);
      if (!role) {
        setError("This account has no dashboard role assigned.");
        return;
      }
      authStorage.setSession(role, "admin", result.user.email);
      router.push(`/dashboard/${role}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
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
            Sign in with your staff account to continue
          </p>

          <div className="mt-5">
            <p className="block text-xs font-semibold text-white/70 mb-1.5">
              Quick demo access — pick a role
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setError("");
                    setEmail(acc.email);
                    setPassword(acc.password);
                  }}
                  className="text-left px-3 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition text-sm"
                >
                  <span className="block font-semibold">{acc.role}</span>
                  <span className="block text-white/60 text-xs break-all">
                    {acc.email}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Email or Username
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.com"
                autoComplete="username"
                className="w-full px-4 py-3 rounded-lg bg-white text-black"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg bg-white text-black"
              />
            </div>

            {error && (
              <p className="text-sm text-red-200 bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {message && (
              <p className="text-sm text-white/90">{message}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "var(--primary)" }}
            >
              {submitting ? "Signing in..." : "Login"}
            </button>

          </form>

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