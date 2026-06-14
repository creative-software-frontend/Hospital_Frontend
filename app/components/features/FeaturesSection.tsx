"use client";

import {
    FiFileText,
    FiActivity,
    FiClock,
    FiArrowRight,
} from "react-icons/fi";

type AccentType = "blue" | "green" | "red";

type FeatureItem = {
    title: string;
    desc: string;
    icon: any;
    accent: AccentType;
};

const features: FeatureItem[] = [
    {
        title: "Clinic News",
        desc: "Latest updates, medical announcements, and hospital information for patients and staff.",
        icon: FiFileText,
        accent: "blue",
    },
    {
        title: "Top Doctors",
        desc: "Meet our experienced specialists dedicated to providing world-class healthcare services.",
        icon: FiActivity,
        accent: "green",
    },
    {
        title: "24 Hours Service",
        desc: "Emergency and critical care available round the clock for all patients in need.",
        icon: FiClock,
        accent: "red",
    },
];

const accentMap: Record<AccentType, any> = {
    blue: {
        bg: "bg-blue-50 dark:bg-blue-950/40",
        icon: "text-blue-600 dark:text-blue-400",
        link: "text-blue-600 dark:text-blue-400",
        blob: "bg-blue-100 dark:bg-blue-900/30",
    },
    green: {
        bg: "bg-green-50 dark:bg-green-950/40",
        icon: "text-green-600 dark:text-green-400",
        link: "text-green-600 dark:text-green-400",
        blob: "bg-green-100 dark:bg-green-900/30",
    },
    red: {
        bg: "bg-red-50 dark:bg-red-950/40",
        icon: "text-red-600 dark:text-red-400",
        link: "text-red-600 dark:text-red-400",
        blob: "bg-red-100 dark:bg-red-900/30",
    },
};

export default function FeaturesSection() {
    return (
        <section className="py-16 px-6 md:px-12 bg-[var(--bg)]">
            <div className="max-w-7xl mx-auto grid gap-6 md:grid-cols-4">

                {/* LEFT FEATURE CARDS */}
                <div className="md:col-span-3 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

                    {features.map((item, i) => {
                        const Icon = item.icon;
                        const accent = accentMap[item.accent];

                        return (
                            <div
                                key={i}
                                className="relative p-6 rounded-2xl border border-[var(--border)] bg-white shadow-sm transition hover:shadow-md hover:-translate-y-1 overflow-hidden"
                            >
                                {/* Decorative blob */}
                                <div
                                    className={`absolute -top-5 -right-5 w-20 h-20 rounded-full ${accent.blob}`}
                                />

                                {/* Icon */}
                                <div
                                    className={`relative w-11 h-11 rounded-xl ${accent.bg} flex items-center justify-center mb-4`}
                                >
                                    <Icon className={`w-5 h-5 ${accent.icon}`} />
                                </div>

                                <h3 className="text-lg font-semibold text-[var(--text)]">
                                    {item.title}
                                </h3>

                                <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
                                    {item.desc}
                                </p>

                                <button
                                    className={`mt-5 inline-flex items-center gap-1 text-sm font-medium ${accent.link} hover:underline`}
                                >
                                    Read More
                                    <FiArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}

                </div>

                {/* RIGHT SIDEBAR - OPENING HOURS */}
                <div className="p-6 rounded-2xl bg-[var(--primary)] text-white shadow-md">

                    <h3 className="text-lg font-semibold border-b border-white/20 pb-3">
                        Opening Hours
                    </h3>

                    <div className="mt-4 space-y-3 text-sm">
                        <div className="flex justify-between border-b border-white/10 pb-2">
                            <span>Monday - Friday</span>
                            <span>8.00 - 17.00</span>
                        </div>

                        <div className="flex justify-between border-b border-white/10 pb-2">
                            <span>Saturday</span>
                            <span>9.30 - 17.30</span>
                        </div>

                        <div className="flex justify-between">
                            <span>Sunday</span>
                            <span>9.30 - 15.00</span>
                        </div>
                    </div>

                    <button className="mt-6 w-full py-2 rounded-lg bg-white text-[var(--primary)] font-semibold hover:opacity-90 transition">
                        Book Appointment
                    </button>

                </div>

            </div>
        </section>
    );
}