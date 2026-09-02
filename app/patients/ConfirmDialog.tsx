// app/patients/ConfirmDialog.tsx
// Shared confirmation modal used for destructive / state-changing patient
// actions (delete, activate/deactivate). Mirrors the dashboard logout modal.

"use client";

import { FiAlertTriangle, FiX } from "react-icons/fi";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      onClick={loading ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />

      <div
        className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-[scaleIn_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={loading ? undefined : onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors"
          aria-label="Close"
        >
          <FiX className="w-4 h-4" />
        </button>

        <div className="flex justify-center mb-5">
          <div
            className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center ${
              danger
                ? "bg-red-50 border-red-100 text-red-500"
                : "bg-amber-50 border-amber-100 text-amber-500"
            }`}
          >
            <FiAlertTriangle className="w-7 h-7" />
          </div>
        </div>

        <div className="text-center mb-6">
          <h3 className="text-lg font-extrabold text-[var(--text)] mb-2">{title}</h3>
          <p className="text-xs text-[var(--muted)] leading-relaxed">{message}</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
              danger
                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                : "bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white shadow-lg shadow-[var(--primary)]/20"
            }`}
          >
            {loading ? "Please wait..." : confirmLabel}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full px-4 py-3 bg-[var(--bg)] hover:bg-[var(--primary-soft)]/20 border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}