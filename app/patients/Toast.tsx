// app/patients/Toast.tsx
// Lightweight toast notifications for the Patient module.

"use client";

import { useEffect } from "react";
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from "react-icons/fi";

export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const STYLES: Record<ToastKind, { border: string; icon: React.ReactNode }> = {
  success: {
    border: "border-emerald-300",
    icon: <FiCheckCircle className="w-4 h-4 text-emerald-600" />,
  },
  error: {
    border: "border-rose-300",
    icon: <FiAlertCircle className="w-4 h-4 text-rose-600" />,
  },
  info: {
    border: "border-sky-300",
    icon: <FiInfo className="w-4 h-4 text-sky-600" />,
  },
};

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((toast) => (
        <ToastToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastToast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  const style = STYLES[toast.kind];

  return (
    <div
      className={`bg-[var(--card)] border ${style.border} border-l-4 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 animate-[scaleIn_0.2s_ease-out]`}
    >
      <div className="shrink-0 mt-0.5">{style.icon}</div>
      <p className="flex-1 text-xs font-semibold text-[var(--text)] leading-relaxed">
        {toast.message}
      </p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-1 rounded-lg text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors"
        aria-label="Dismiss notification"
      >
        <FiX className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}