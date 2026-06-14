"use client";


import { motion } from "framer-motion";
import { useLottie } from "lottie-react";
import financeAnimation from "../../lottie/finance.json";

export default function Hero() {
    const { View } = useLottie({
        animationData: financeAnimation,
        loop: true,
    });

    return (
        <section className="flex items-center px-6 md:px-12 pt-28 pb-12 md:pt-32 md:pb-16 relative overflow-hidden bg-white">

            {/* BACKGROUND GLOW */}
            <div className="absolute inset-0 opacity-30">
                <motion.div
                    animate={{ x: [0, 80, 0], y: [0, -40, 0] }}
                    transition={{ repeat: Infinity, duration: 12 }}
                    className="absolute top-20 left-10 w-72 h-72 bg-[var(--primary)]/20 rounded-full blur-3xl"
                />

                <motion.div
                    animate={{ x: [0, -60, 0], y: [0, 60, 0] }}
                    transition={{ repeat: Infinity, duration: 15 }}
                    className="absolute bottom-10 right-10 w-80 h-80 bg-[var(--primary)]/10 rounded-full blur-3xl"
                />
            </div>

            {/* MAIN GRID */}
            <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">

                {/* LEFT CONTENT */}
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left">

                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-3xl sm:text-4xl md:text-5xl font-bold text-main leading-tight"
                    >
                        Smart Healthcare. Trusted Care.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-4 text-base sm:text-lg text-main/80 max-w-2xl"
                    >
                        Delivering advanced medical services with compassion, precision, and innovation. We are committed to improving patient outcomes through modern healthcare systems, skilled professionals, and community-focused care.
                    </motion.p>

                    {/* BUTTONS */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="mt-8 flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
                    >
                        <button className="w-full sm:w-auto px-8 py-3.5 bg-nav text-main font-semibold rounded-xl hover:opacity-80 transition shadow-md">
                            Get Started
                        </button>

                        <button className="w-full sm:w-auto px-8 py-3.5 border border-gray-300 rounded-xl hover:bg-gray-100 transition font-medium">
                            Learn More
                        </button>
                    </motion.div>

                    {/* STATS */}
                    <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 w-full pt-8 border-t border-gray-100 lg:border-none lg:pt-0">

                        {[
                            { value: "45+", label: "Years Experience" },
                            { value: "3K+", label: "Happy Members" },
                            { value: "৳27Cr+", label: "Yearly Turnover" },
                        ].map((stat, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 + i * 0.1 }}
                                className="text-center"
                            >
                                <div className="text-2xl font-bold text-main">
                                    {stat.value}
                                </div>
                                <div className="text-sm text-main/70 mt-1">
                                    {stat.label}
                                </div>
                            </motion.div>
                        ))}

                    </div>
                </div>

                {/* RIGHT LOTTIE */}
                <div className="flex items-center justify-center w-full">
                    <div className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
                        {View}
                    </div>
                </div>

            </div>
        </section>
    );
}