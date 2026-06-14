"use client";

import { FiPhone } from "react-icons/fi";

export default function FloatingCallButton() {
    return (
        <a
            href="tel:+8801234567890"
            className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-full shadow-lg bg-[var(--primary)] text-white hover:scale-105 transition"
        >
            <FiPhone size={18} />

            <span className="text-sm font-semibold hidden sm:block">
                Call Now
            </span>
        </a>
    );
}