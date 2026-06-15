"use client";

import { FiPhone } from "react-icons/fi";

export default function FloatingCallButton() {
    return (
        <a
            href="tel:+8801234567890"
            className="fixed bottom-20 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-full bg-[var(--primary)] text-white shadow-xl hover:scale-105 transition"
        >
            <div className="relative flex items-center justify-center w-10 h-10">
                <span className="ring-circle"></span>
                <span className="ring-circle ring-circle-delay"></span>

                <FiPhone
                    size={20}
                    className="phone-ring relative z-10"
                />
            </div>

            <span className="hidden sm:block font-semibold">
                01234567890
            </span>
        </a>
    );
}
