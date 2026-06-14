"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiMenu, FiX } from "react-icons/fi";
import Link from "next/link";

const navLinks = [
  { name: "Home", href: "#home" },
  { name: "Appointment", href: "#appointment" },
  { name: "About Us", href: "#about" },
  { name: "Notice", href: "#notice" },
  { name: "Contact us", href: "#contact" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        className={`fixed top-0 left-0 right-0 z-40 px-6 md:px-12 transition-all text-main ${
          isScrolled ? "py-3 shadow-sm" : "py-5"
        }`}
        style={{
          /* ✅ FIX: always visible background */
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
              className="lg:hidden p-2 rounded-md transition"
              style={{ color: "var(--primary)" }}
              onClick={() => setMobileMenuOpen(true)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--primary-soft)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <FiMenu size={24} />
            </button>
          </div>

          {/* CENTER */}
          <nav className="hidden lg:flex items-center gap-10">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium relative group transition-colors"
                style={{ color: "var(--text)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--primary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text)")
                }
              >
                {link.name}

                <span
                  className="absolute left-0 -bottom-1 h-[2px] w-0 group-hover:w-full transition-all"
                  style={{ background: "var(--primary)" }}
                />
              </a>
            ))}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--primary)";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--primary)";
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
                    href={link.href}
                    className="text-lg transition-colors"
                    style={{ color: "var(--text)" }}
                    onClick={() => setMobileMenuOpen(false)}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "var(--primary)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--text)")
                    }
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