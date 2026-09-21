// app/dashboard/superadmin/SuperAdminOverviewStats.tsx
// Live SUPER_ADMIN-only dashboard: real counts and recent activity from
// GET /api/superadmin/stats. Falls back to an honest "Not available yet"
// state when the API is unreachable.

"use client";

import { useEffect, useState } from "react";
import { FiUsers, FiUser, FiShield, FiClock, FiDatabase, FiActivity, FiAlertCircle } from "react-icons/fi";
import { superAdminApi, type SuperAdminStats, errorMessage } from "@/app/lib/api";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({ icon: Icon, label, value }: { icon: typeof FiUsers; label: string; value: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-[var(--primary)] transition-all duration-200 group">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--muted)]">{label}</span>
        <div className="p-2.5 rounded-xl bg-[var(--primary-soft)]/30 text-[var(--primary-dark)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors duration-200">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4">
        <span className="text-2xl font-black tracking-tight text-[var(--text)]">{value}</span>
        <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-[var(--primary)] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
          Live Status Update
        </div>
      </div>
    </div>
  );
}

export const SuperAdminOverviewStats = () => {
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    superAdminApi
      .stats()
      .then((result) => {
        if (!cancelled) setStats(result.stats);
      })
      .catch((err) => {
        if (!cancelled) setError(`Live data not available yet: ${errorMessage(err)}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-center gap-2">
        <FiAlertCircle className="w-4 h-4 shrink-0" />
        {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] p-10 rounded-2xl shadow-sm text-center text-xs font-bold text-[var(--muted)]">
        Loading live platform statistics…
      </div>
    );
  }

  const s = stats.summary;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={FiUsers} label="Total Users" value={String(s.users?.total ?? 0)} />
        <StatCard icon={FiUser} label="Total Patients" value={String(s.patients ?? 0)} />
        <StatCard icon={FiDatabase} label="Active Branches" value={String(s.branches?.active ?? 0)} />
        <StatCard icon={FiShield} label="System Roles" value={String(s.roles ?? 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-4">
            <div>
              <h3 className="font-extrabold text-[var(--primary-dark)] text-sm">Platform Activity Breakdown</h3>
              <p className="text-[10px] text-[var(--muted)] mt-0.5">Changes by module tracked via audit log</p>
            </div>
            <span className="text-[10px] font-bold text-[var(--primary-dark)] bg-[var(--primary-soft)]/30 px-2 py-0.5 rounded border border-[var(--primary)]/20">
              Operational
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(stats.breakdown?.usersByStatus ?? []).map((b, idx) => (
              <div key={idx} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
                <span className="block text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
                  {b.status} users
                </span>
                <span className="block mt-1 text-base font-black text-[var(--text)]">{b.count}</span>
              </div>
            ))}
            {(stats.breakdown?.usersByBranch ?? []).map((b, idx) => (
              <div key={`ub-${idx}`} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
                <span className="block text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
                  {b.branchName ?? `Branch #${b.branchId}`}
                </span>
                <span className="block mt-1 text-base font-black text-[var(--text)]">{b.count} users</span>
              </div>
            ))}
            {(stats.breakdown?.patientsByBranch ?? []).map((b, idx) => (
              <div key={`pb-${idx}`} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3">
                <span className="block text-[10px] uppercase font-extrabold tracking-widest text-[var(--muted)]">
                  Patients · {b.branchName ?? `Branch #${b.branchId}`}
                </span>
                <span className="block mt-1 text-base font-black text-[var(--text)]">{b.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-extrabold text-[var(--primary-dark)] text-sm border-b border-[var(--border)]/60 pb-3">Recent Activity</h3>
            <div className="space-y-4">
              {(stats.recentActivity ?? []).slice(0, 5).map((a, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="p-1.5 rounded-lg bg-[var(--primary-soft)]/20 text-[var(--primary-dark)] shrink-0">
                    {a.action?.startsWith("LOGIN") ? (
                      <FiClock className="w-3.5 h-3.5" />
                    ) : (
                      <FiActivity className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate">{a.action}</p>
                    <span className="text-[10px] text-[var(--muted)]">
                      {a.user?.name ?? "System"} · {formatDate(a.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};