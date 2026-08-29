"use client";

import { motion } from "motion/react";
import { FiCalendar, FiUser } from "react-icons/fi";
import Image from "next/image";

const doctors = [
    {
        name: "Dr. Sarah Ahmed",
        specialty: "Cardiologist",
        image: "/images/doctor.jpg",
    },
    {
        name: "Dr. John Smith",
        specialty: "Neurologist",
        image: "/images/doctor.jpg",
    },
    {
        name: "Dr. Emily Rose",
        specialty: "Orthopedic Surgeon",
        image: "/images/doctor.jpg",
    },
    {
        name: "Dr. Michael Lee",
        specialty: "General Physician",
        image: "/images/doctor.jpg",
    },
];

export default function DoctorsSection() {
    return (
        <section className="py-16 px-6 md:px-12 bg-[var(--bg)]">

            {/* HEADER */}
            <div className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-[var(--text)]">
                        Our Specialists
                    </h2>
                    <p className="text-[var(--muted)] mt-2">
                        Specialist doctors to solve your problems
                    </p>
                </div>

                <button className="text-[var(--primary)] font-medium hover:underline">
                    View all doctors →
                </button>
            </div>

            {/* GRID */}
            <div className="max-w-7xl mx-auto grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

                {doctors.map((doc, i) => (
                    <motion.div
                        key={i}
                        whileHover={{ y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="group relative rounded-2xl overflow-hidden bg-white shadow-sm border border-[var(--border)] hover:shadow-xl transition"
                    >

                        {/* IMAGE */}
                        <div className="relative h-72 overflow-hidden">
                            <Image
                                src={doc.image}
                                alt={doc.name}
                                fill
                                className="object-cover group-hover:scale-110 transition duration-500"
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            />

                            {/* DARK OVERLAY */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition duration-300" />

                            {/* HOVER BUTTONS */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition duration-300">

                                <button className="px-4 py-2 rounded-lg bg-white text-black font-medium flex items-center gap-2 hover:bg-[var(--primary)] hover:text-white transition">
                                    <FiUser />
                                    View Profile
                                </button>

                                <button className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white font-medium flex items-center gap-2 hover:opacity-90 transition">
                                    <FiCalendar />
                                    Get Appointment
                                </button>

                            </div>
                        </div>

                        {/* INFO */}
                        <div className="p-4">
                            <h3 className="font-semibold text-[var(--text)]">
                                {doc.name}
                            </h3>
                            <p className="text-sm text-[var(--muted)]">
                                {doc.specialty}
                            </p>
                        </div>

                    </motion.div>
                ))}

            </div>
        </section>
    );
}