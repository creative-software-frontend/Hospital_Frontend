"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiMenu, FiX, FiChevronDown } from "react-icons/fi";
import Link from "next/link";

// 👉 ADD YOUR LOGO PATH HERE
import logo from "../../../public/images/hospitalogo.png";

const navLinks = [
  { name: "Home", href: "#home" },
  { name: "About Us", href: "#about" },
  { name: "Doctors", href: "#doctors" },

  {
    name: "Departments",
    dropdown: [
      { name: "Cardiology", href: "#cardiology" },
      { name: "Neurology", href: "#neurology" },
      { name: "Orthopedics", href: "#orthopedics" },
    ],
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

  { name: "Cafeteria", href: "#cafeteria" },
  { name: "Contact Us", href: "#contact" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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
        className={`fixed top-0 left-0 right-0 z-40 px-6 md:px-12 transition-all text-main ${isScrolled ? "py-3 shadow-sm" : "py-5"
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

          {/* LEFT (LOGO + MENU BUTTON) */}
          <div className="flex items-center gap-3">

            <button
              className="lg:hidden p-2 rounded-md transition"
              style={{ color: "var(--primary)" }}
              onClick={() => setMobileMenuOpen(true)}
            >
              <FiMenu size={24} />
            </button>

            {/* ✅ LOGO ADDED HERE */}
            <Link href="/" className="flex items-center gap-2">
              <img
                src={logo.src}
                alt="Logo"
                className="h-10 md:h-12 object-contain"
              />
            </Link>

          </div>

          {/* CENTER */}
          <nav className="hidden lg:flex items-center gap-10">
            {navLinks.map((link) => {
              const hasDropdown = !!link.dropdown;

              return (
                <div
                  key={link.name}
                  className="relative group"
                  onMouseEnter={() =>
                    hasDropdown && setOpenDropdown(link.name)
                  }
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <a
                    href={link.href || "#"}
                    className="text-sm font-medium flex items-center gap-1 relative"
                    style={{ color: "var(--text)" }}
                  >
                    {link.name}

                    {hasDropdown && <FiChevronDown size={14} />}

                    <span
                      className="absolute left-0 -bottom-1 h-[2px] w-0 group-hover:w-full transition-all"
                      style={{ background: "var(--primary)" }}
                    />
                  </a>

                  {hasDropdown &&
                    openDropdown === link.name && (
                      <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-[var(--border)] rounded-lg shadow-lg overflow-hidden z-50">
                        {link.dropdown.map((item) => (
                          <a
                            key={item.name}
                            href={item.href}
                            className="block px-4 py-2 text-sm hover:bg-[var(--primary-soft)] transition"
                            style={{ color: "var(--text)" }}
                          >
                            {item.name}
                          </a>
                        ))}
                      </div>
                    )}
                </div>
              );
            })}
          </nav>

          {/* RIGHT */}
          <div className="hidden lg:flex gap-3">
            <Link
              href="/login"
              className="px-4 py-2 border rounded-lg transition"
              style={{
                borderColor: "var(--primary)",
                color: "var(--primary)",
              }}
            >
              Login
            </Link>
          </div>

        </div>
      </header>

      {/* MOBILE */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50"
              style={{ background: "rgba(0,0,0,0.4)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
            />

            <motion.div
              className="fixed left-0 top-0 bottom-0 w-72 z-50 shadow-xl"
              style={{ background: "var(--card)" }}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
            >
              <div className="p-6 flex justify-between">
                <FiX
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ color: "var(--text)", cursor: "pointer" }}
                />
              </div>

              <div className="p-6 flex flex-col gap-4">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href || "#"}
                    className="text-lg"
                    style={{ color: "var(--text)" }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.name}
                  </a>
                ))}

                <Link href="/login" className="btn-primary text-center">
                  Login
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}