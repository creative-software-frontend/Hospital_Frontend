// app/lib/auth.ts
// Client-side session helpers for the (mock) authentication layer.
// Centralizes all localStorage session keys/logic in one place so that a
// real server-side auth (cookies + proxy guards) can be swapped in later
// without touching individual pages.

import type { UserRole } from "@/app/config/roleConfig";

export type UserType = "admin" | "user";

const ROLE_KEY = "role";
const USER_TYPE_KEY = "userType";
const USER_EMAIL_KEY = "userEmail";

/**
 * Reads a value from localStorage safely (no-op during SSR).
 */
function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore quota/privacy errors */
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const authStorage = {
  getRole(): UserRole | null {
    return (read(ROLE_KEY) as UserRole) || null;
  },

  getUserType(): UserType | null {
    return (read(USER_TYPE_KEY) as UserType) || null;
  },

  getUserEmail(): string | null {
    return read(USER_EMAIL_KEY);
  },

  /**
   * Persists a signed-in session for the current user. `role` is required for
   * staff/admin sessions, but omitted for patient (user) sessions.
   */
  setSession(role: UserRole | null, userType: UserType, email?: string): void {
    if (role) {
      write(ROLE_KEY, role);
    } else {
      remove(ROLE_KEY);
    }
    write(USER_TYPE_KEY, userType);
    if (email) write(USER_EMAIL_KEY, email);
  },

  /**
   * Returns true when an active session role is present.
   */
  isAuthenticated(): boolean {
    return this.getRole() !== null;
  },

  /**
   * Removes the current session.
   */
  clearSession(): void {
    remove(ROLE_KEY);
    remove(USER_TYPE_KEY);
    remove(USER_EMAIL_KEY);
  },
};
