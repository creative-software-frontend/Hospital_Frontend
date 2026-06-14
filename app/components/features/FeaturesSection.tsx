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
        bg: "bg-blue-50",
        icon: "text-blue-600",
        border: "hover:border-blue-300",
        shadow: "hover:shadow-blue-100/50",
        blob: "bg-blue-100",
    },
    green: {
        bg: "bg-green-50",
        icon: "text-green-600",
        border: "hover:border-green-300",
        shadow: "hover:shadow-green-100/50",
        blob: "bg-green-100",
    },
    red: {
        bg: "bg-red-50",
        icon: "text-red-600",
        border: "hover:border-red-300",
        shadow: "hover:shadow-red-100/50",
        blob: "bg-red-100",
    },
};

export default function FeaturesSection() {
    return (
        <section className="py-16 px-6 md:px-12 bg-[var(--bg)]">
            <div className="max-w-7xl mx-auto grid gap-6 md:grid-cols-4">

                {/* CARDS */}
                <div className="md:col-span-3 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

                    {features.map((item, i) => {
                        const Icon = item.icon;
                        const accent = accentMap[item.accent];

                        return (
                            <div
                                key={i}
                                className={`
                                    relative p-6 rounded-2xl border border-[var(--border)]
                                    bg-white shadow-sm
                                    transition-all duration-300
                                    hover:-translate-y-2
                                    hover:shadow-xl
                                    ${accent.border}
                                    ${accent.shadow}
                                `}
                            >
                                {/* decorative blob */}
                                <div
                                    className={`absolute -top-6 -right-6 w-24 h-24 rounded-full ${accent.blob} opacity-60`}
                                />

                                {/* icon */}
                                <div
                                    className={`relative w-12 h-12 rounded-xl ${accent.bg} flex items-center justify-center mb-5`}
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
                                    className="
                                        mt-5 inline-flex items-center gap-1 text-sm font-medium
                                        text-[var(--primary)]
                                        transition-all
                                        hover:gap-2
                                        hover:opacity-80
                                    "
                                >
                                    Read More
                                    <FiArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}

                </div>

                {/* SIDEBAR */}
                <div className="p-6 rounded-2xl bg-[var(--primary)] text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">

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

                    <button className="mt-6 w-full py-2 rounded-lg bg-white text-[var(--primary)] font-semibold transition hover:scale-[1.02] hover:shadow-md">
                        Book Appointment
                    </button>

                </div>

            </div>
        </section>
    );
}