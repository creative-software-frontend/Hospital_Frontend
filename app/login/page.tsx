"use client";

import { useState } from "react";

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

export default function LoginPage() {
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">

      <div className="w-full max-w-2xl bg-card border border-main rounded-2xl shadow-xl p-8">

        {/* HEADER */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-main">
            Hospital Login
          </h1>
          <p className="text-muted mt-2">
            Select role and login to dashboard
          </p>
        </div>

        {/* ROLES */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-3 py-2 rounded-full text-sm border transition ${
                  role === r
                    ? "bg-primary text-white border-primary"
                    : "bg-card text-main border-main hover:border-primary"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* FORM */}
        <div className="space-y-4">

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-main bg-card text-main focus:outline-none focus:border-primary"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-main bg-card text-main focus:outline-none focus:border-primary"
          />

          <button
            className={`w-full py-3 rounded-xl font-semibold transition ${
              role
                ? "bg-primary text-white hover:opacity-90"
                : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
            disabled={!role}
          >
            Login as {role || "Select Role"}
          </button>
<div className="text-right">
  <a
    href="#"
    className="text-sm text-muted hover-primary transition"
  >
    Forgot password?
  </a>
</div>
        </div>

      </div>
    </div>
  );
}