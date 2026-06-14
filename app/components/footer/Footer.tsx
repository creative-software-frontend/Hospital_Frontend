"use client";

import Link from "next/link";
import {
    FiMapPin,
    FiPhone,
    FiMail,
    FiClock,
} from "react-icons/fi";

export default function Footer() {
    return (
        <footer className="bg-[var(--base)] text-white">

            {/* TOP */}
            <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 grid gap-10 md:grid-cols-2 lg:grid-cols-4">

                {/* LOGO + ABOUT */}
                <div>
                    <img
                        src="/images/hospitalogo.png"
                        alt="Hospital Logo"
                        className="h-14 mb-4"
                    />

                    <p className="text-white/70 leading-relaxed text-sm">
                        Providing quality healthcare with advanced medical
                        technology, experienced doctors, and compassionate care
                        for every patient.
                    </p>
                </div>

                {/* QUICK LINKS */}
                <div>
                    <h3 className="font-semibold text-lg mb-4">
                        Quick Links
                    </h3>

                    <ul className="space-y-3 text-white/70">
                        <li>
                            <Link href="#home" className="hover:text-white transition">
                                Home
                            </Link>
                        </li>

                        <li>
                            <Link href="#about" className="hover:text-white transition">
                                About Us
                            </Link>
                        </li>

                        <li>
                            <Link href="#doctors" className="hover:text-white transition">
                                Doctors
                            </Link>
                        </li>

                        <li>
                            <Link href="#contact" className="hover:text-white transition">
                                Contact
                            </Link>
                        </li>
                    </ul>
                </div>

                {/* DEPARTMENTS */}
                <div>
                    <h3 className="font-semibold text-lg mb-4">
                        Departments
                    </h3>

                    <ul className="space-y-3 text-white/70">
                        <li>Cardiology</li>
                        <li>Neurology</li>
                        <li>Orthopedics</li>
                        <li>Emergency Care</li>
                        <li>Pediatrics</li>
                    </ul>
                </div>

                {/* CONTACT */}
                <div>
                    <h3 className="font-semibold text-lg mb-4">
                        Contact Us
                    </h3>

                    <div className="space-y-4 text-white/70">

                        <div className="flex gap-3">
                            <FiMapPin className="mt-1 shrink-0" />
                            <span>Uttara, Dhaka, Bangladesh</span>
                        </div>

                        <div className="flex gap-3">
                            <FiPhone className="mt-1 shrink-0" />
                            <span>+880 1234-567890</span>
                        </div>

                        <div className="flex gap-3">
                            <FiMail className="mt-1 shrink-0" />
                            <span>info@hospital.com</span>
                        </div>

                        <div className="flex gap-3">
                            <FiClock className="mt-1 shrink-0" />
                            <span>24 Hours Emergency Service</span>
                        </div>

                        {/* MAP */}
                        <div className="mt-5 overflow-hidden rounded-xl border border-white/10 shadow-lg">
                            <iframe
                                src="https://maps.google.com/maps?q=uttara%20dhaka%20bangladesh&t=&z=13&ie=UTF8&iwloc=&output=embed"
                                width="100%"
                                height="180"
                                style={{ border: 0 }}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>

                    </div>
                </div>

            </div>

            {/* BOTTOM */}
            <div className="border-t border-white/10">
                <div className="max-w-7xl mx-auto px-6 md:px-12 py-5 flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-white/60">

                    <p>© 2026 Smart Hospital. All Rights Reserved.</p>

                    <p>Developed by Your Company</p>

                </div>
            </div>

        </footer>
    );
}