"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import Link from "next/link";
import { authStorage } from "@/app/lib/auth";

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

export default function UserLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const handleLogin = () => {
    if (!email || !password) {
      setMessage("Please enter your email and password.");
      return;
    }
    setMessage("");
    authStorage.setSession(null, "user", email);
    router.push("/dashboard/user");
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
              Patient Login
            </h2>
          </div>

          <p className="text-white/80 text-sm">
            Sign in to access your health dashboard
          </p>

          <div className="mt-6 space-y-4">

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Email"
              className="w-full px-4 py-3 rounded-lg bg-white text-black"
            />

            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              type="password"
              placeholder="Password"
              className="w-full px-4 py-3 rounded-lg bg-white text-black"
            />

            <button
              onClick={handleLogin}
              className="w-full py-3 rounded-lg font-semibold text-white"
              style={{ background: "var(--primary)" }}
            >
              Login
            </button>

            {message && (
              <p className="text-sm text-white/90">{message}</p>
            )}

          </div>

          <div className="mt-6 pt-5 border-t border-white/15 text-center">
            <p className="text-white/50 text-xs">
              Hospital staff?{" "}
              <Link
                href="/admins/login"
                className="text-[var(--primary-soft)] font-semibold hover:underline"
              >
                Staff / Admin Login →
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