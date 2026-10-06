"use client";

import { useEffect, useState } from "react";
import { FiRefreshCw, FiAlertTriangle } from "react-icons/fi";

export default function MaintenancePage() {
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      window.location.reload();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
      <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 sm:p-12 text-center shadow-sm">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
          <FiAlertTriangle className="w-8 h-8 text-amber-500" />
        </div>

        <h1 className="text-2xl font-bold text-[var(--text)] mb-3">System Under Maintenance</h1>

        <p className="text-[var(--muted)] mb-6 leading-relaxed">
          We&apos;re performing scheduled maintenance to improve your experience.
          Please check back in a few minutes.
        </p>

        <div className="space-y-4">
          <button
            onClick={handleRetry}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ background: "var(--primary)" }}
          >
            <FiRefreshCw className="w-4 h-4" />
            Retry Now
          </button>

          <p className="text-xs text-[var(--muted)]">
            Auto-retry in 30 seconds &middot; Attempt {retryCount + 1}
          </p>
        </div>
      </div>
    </div>
  );
}