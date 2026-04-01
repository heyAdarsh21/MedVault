import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAuthToken } from "@/lib/api";

interface AuthState {
  token: string | null;
  role: string | null;
  username: string | null;
  hydrated: boolean;
  setToken: (token: string, role?: string, username?: string) => void;
  logout: () => void;
  setHydrated: () => void;
}

function clearAuthCookie() {
  if (typeof document === "undefined") return;
  // Expire the cookie immediately
  document.cookie = "medvault_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
}

function setAuthCookie(token: string) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + 60 * 60 * 1000).toUTCString();
  document.cookie = `medvault_token=${token}; path=/; expires=${expires}; SameSite=Strict`;
}

function parseRole(token: string): string | null {
  try {
    return JSON.parse(atob(token.split(".")[1])).role ?? null;
  } catch {
    return null;
  }
}

function parseUsername(token: string): string | null {
  try {
    const p = JSON.parse(atob(token.split(".")[1]));
    return p.sub ?? p.username ?? null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      username: null,
      hydrated: false,

      setToken: (token, role, username) => {
        const resolvedRole = role ?? parseRole(token) ?? "viewer";
        const resolvedUsername = username ?? parseUsername(token) ?? "";
        setAuthToken(token);
        setAuthCookie(token);
        set({ token, role: resolvedRole, username: resolvedUsername });
      },

      logout: () => {
        setAuthToken(null);
        clearAuthCookie();
        // Clear localStorage fully
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("medvault_token");
          localStorage.removeItem("medvault-auth");
        }
        set({ token: null, role: null, username: null });
      },

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "medvault-auth",
      partialize: (s) => ({ token: s.token, role: s.role, username: s.username }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Re-inject token into axios on page load
          if (state.token) {
            setAuthToken(state.token);
            setAuthCookie(state.token);
          }
          state.setHydrated();
        }
      },
    }
  )
);