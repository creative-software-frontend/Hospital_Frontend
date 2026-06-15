"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiMenu, FiX, FiChevronDown } from "react-icons/fi";
import Link from "next/link";

import logo from "../../../public/images/hospitalogo.png";

/* ================= DATA ================= */

const departments = [
  "Cardiology", "Neurology", "Orthopedics", "Dermatology", "Gastroenterology",
  "Nephrology", "Pulmonology", "Rheumatology", "Hematology", "Oncology",
  "Endocrinology", "Psychiatry", "Radiology", "Pathology",

  "General Surgery", "Neurosurgery", "Cardiac Surgery", "Plastic Surgery",
  "Orthopedic Surgery", "Urology Surgery", "Vascular Surgery", "GI Surgery",
  "ENT Surgery", "Trauma Surgery", "Burn Surgery", "Laparoscopic Surgery",
  "Transplant Surgery", "Pediatric Surgery",

  "ICU", "CCU", "NICU", "Emergency", "Dialysis",
  "Physiotherapy", "Rehabilitation", "Laboratory", "Blood Bank",
  "Ambulance", "Health Checkup", "Pharmacy", "Nutrition", "Ophthalmology"
];

const navLinks = [
  { name: "Home", href: "#home" },

  {
    name: "About Us",
    dropdown: [
      { name: "Mission & Vision", href: "#mission-vision" },
      { name: "What We Have", href: "#what-we-have" },
      { name: "Message From Chairman", href: "#chairman-message" },
      { name: "Message From Managing Director", href: "#md-message" },
    ],
  },

  { name: "Doctors", href: "#doctors" },

  {
    name: "Departments",
    mega: true,
  },

  {
    name: "Services",
    dropdown: [
      { name: "Online Services", href: "#services" },
      { name: "Appointment", href: "#appointment" },
      { name: "Emergency", href: "#emergency" },
    ],
  },

  {
    name: "Centers of Excellence",
    dropdown: [
      { name: "Liver Care Center", href: "#liver-care" },
      { name: "Colorectal & Biofeedback Center", href: "#colorectal" },
      { name: "Mother Care Unit", href: "#mother-care" },
    ],
  },

  {
    name: "Media",
    dropdown: [
      { name: "News", href: "#news" },
      { name: "Gallery", href: "#gallery" },
      { name: "Events", href: "#events" },
    ],
  },

  { name: "Contact Us", href: "#contact" },
];

/* ================= NAVBAR ================= */

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const closeTimeout = useRef<NodeJS.Timeout | null>(null);

  const chunkSize = Math.ceil(departments.length / 3);
  const col1 = departments.slice(0, chunkSize);
  const col2 = departments.slice(chunkSize, chunkSize * 2);
  const col3 = departments.slice(chunkSize * 2);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "unset";
  }, [mobileMenuOpen]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 px-6 md:px-12 transition-all ${isScrolled ? "py-3 shadow-sm" : "py-5"
          }`}
        style={{
          background: isScrolled
            ? "rgba(255,255,255,0.85)"
            : "rgba(255,255,255,0.6)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">

          {/* LEFT */}
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2"
              onClick={() => setMobileMenuOpen(true)}
            >
              <FiMenu size={24} />
            </button>

            <Link href="/" className="flex items-center">
              <img src={logo.src} alt="logo" className="h-11 object-contain" />
            </Link>
          </div>

          {/* ================= CENTER NAV ================= */}
          <nav className="hidden lg:flex items-center gap-10">

            {navLinks.map((link) => {
              const hasDropdown = !!link.dropdown;
              const isMega = link.mega;

              return (
                <div
                  key={link.name}
                  className="relative"
                  onMouseEnter={() => {
                    if (closeTimeout.current) clearTimeout(closeTimeout.current);
                    setOpenDropdown(link.name);
                  }}
                  onMouseLeave={() => {
                    closeTimeout.current = setTimeout(() => {
                      setOpenDropdown(null);
                    }, 120);
                  }}
                >
                  <button className="flex items-center gap-1 text-sm font-medium">
                    {link.name}
                    {(hasDropdown || isMega) && <FiChevronDown size={14} />}
                  </button>

                  {/* NORMAL DROPDOWN */}
                  {hasDropdown && openDropdown === link.name && (
                    <div
                      className="absolute top-full left-0 mt-2 w-56 bg-white z-50"
                      onMouseEnter={() => {
                        if (closeTimeout.current) clearTimeout(closeTimeout.current);
                        setOpenDropdown(link.name);
                      }}
                      onMouseLeave={() => {
                        closeTimeout.current = setTimeout(() => {
                          setOpenDropdown(null);
                        }, 120);
                      }}
                    >
                      {link.dropdown.map((item) => (
                        <a
                          key={item.name}
                          href={item.href}
                          className="dropdown-item"
                        >
                          {item.name}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* MEGA MENU */}
                  {isMega && openDropdown === link.name && (
                    <div
                      className="fixed left-0 top-[70px] w-full bg-white border-t border-gray-200 shadow-xl p-8 z-50"
                      style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
                      onMouseEnter={() => {
                        if (closeTimeout.current) clearTimeout(closeTimeout.current);
                        setOpenDropdown(link.name);
                      }}
                      onMouseLeave={() => {
                        closeTimeout.current = setTimeout(() => {
                          setOpenDropdown(null);
                        }, 120);
                      }}
                    >
                      <div className="max-w-7xl mx-auto grid grid-cols-3 gap-10 text-sm">

                        <div className="space-y-2">
                          {col1.map((item) => (
                            <a key={item} href="#" className="dropdown-item">
                              {item}
                            </a>
                          ))}
                        </div>

                        <div className="space-y-2">
                          {col2.map((item) => (
                            <a key={item} href="#" className="dropdown-item ">
                              {item}
                            </a>
                          ))}
                        </div>

                        <div className="space-y-2">
                          {col3.map((item) => (
                            <a key={item} href="#" className="dropdown-item">
                              {item}
                            </a>
                          ))}
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* RIGHT */}
          <Link
            href="/login"
            className="hidden lg:block px-4 py-2 border rounded-lg transition hover:bg-[var(--primary)] hover:text-white"
          >
            Login
          </Link>

        </div>
      </header>

      {/* MOBILE (UNCHANGED) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setMobileMenuOpen(false)}
            />

            <motion.div
              className="fixed left-0 top-0 bottom-0 w-72 bg-white z-50 p-6"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
            >
              <button onClick={() => setMobileMenuOpen(false)}>
                <FiX size={22} />
              </button>

              <div className="mt-6 flex flex-col gap-4">
                {navLinks.map((link) => (
                  <a key={link.name} href={link.href || "#"}>
                    {link.name}
                  </a>
                ))}

                <Link href="/login">Login</Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}