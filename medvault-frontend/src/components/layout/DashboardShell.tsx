"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Sidebar } from "./Sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, hydrated } = useAuthStore();

  useEffect(() => {
    if (hydrated && !token) router.push("/login");
  }, [token, hydrated, router]);

  if (!hydrated) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <svg width="32" height="20" viewBox="0 0 32 20" fill="none">
            <polyline points="0,10 5,10 8,2 12,18 16,6 19,13 22,10 32,10"
              stroke="#3b8cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
              strokeDasharray="60" strokeDashoffset="60"
              style={{ animation: "ecg-load 1.2s ease forwards" }}
            />
          </svg>
          <style>{`@keyframes ecg-load { to { stroke-dashoffset: 0; } }`}</style>
          <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
            Loading...
          </span>
        </div>
      </div>
    );
  }

  if (!token) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)", fontFamily: "var(--font-ui)" }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: "auto", padding: "32px 36px", minWidth: 0 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          {children}
        </div>
      </main>
    </div>
  );
}