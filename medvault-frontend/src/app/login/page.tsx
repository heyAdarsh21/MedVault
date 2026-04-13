"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

const ROLES = [
  { key: "patient", label: "Patient",        icon: "👤" },
  { key: "staff",   label: "Doctor / Staff", icon: "🩺" },
  { key: "analyst", label: "Analyst / Admin",icon: "📊" },
];

function parseRole(token: string): string | null {
  try { return JSON.parse(atob(token.split(".")[1])).role ?? null; }
  catch { return null; }
}

export default function LoginPage() {
  const router  = useRouter();
  const params  = useSearchParams();
  const { token: storeToken, hydrated, setToken } = useAuthStore();
  const [roleHint, setRoleHint] = useState(params.get("role") ?? "patient");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // Auto-redirect if already authenticated — use zustand store (not raw localStorage)
  useEffect(() => {
    if (hydrated && storeToken) {
      const role = parseRole(storeToken);
      router.replace(role === "patient" ? "/patient" : "/dashboard/system-health");
    }
  }, [hydrated, storeToken, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const fd = new URLSearchParams();
      fd.append("username", username);
      fd.append("password", password);
      const res = await axios.post(`${API}/auth/token`, fd, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const token = res.data.access_token;
      const role = res.data.role ?? parseRole(token);

      // Use zustand store — this sets token, cookie, and localStorage together
      setToken(token, role ?? undefined, username);

      // Route based on actual role
      if (role === "patient") {
        router.push("/patient");
      } else {
        router.push("/dashboard/system-health");
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Invalid username or password.");
      console.error("Login error:", err?.response?.status, detail);
    } finally { setLoading(false); }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--text-primary)",
    fontFamily: "var(--font-ui)", outline: "none", transition: "border-color 0.15s", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", fontFamily: "var(--font-ui)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ position: "absolute", top: 20, left: 24 }}>
        <Link href="/landing" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--text-muted)", fontSize: 13 }}>
          ← MedVault
        </Link>
      </div>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Welcome back</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Sign in to your MedVault account</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
          {ROLES.map(r => (
            <div key={r.key} onClick={() => setRoleHint(r.key)} style={{
              padding: "10px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
              border: `1px solid ${roleHint === r.key ? "rgba(59,140,248,0.4)" : "var(--border-subtle)"}`,
              background: roleHint === r.key ? "var(--blue-dim)" : "var(--bg-surface)", transition: "all 0.15s",
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{r.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: roleHint === r.key ? "var(--blue)" : "var(--text-secondary)" }}>{r.label}</div>
            </div>
          ))}
        </div>

        {/* Demo credentials hint */}
        <div style={{ background: "var(--blue-dim)", border: "1px solid rgba(59,140,248,0.2)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--blue)", marginBottom: 6 }}>Demo credentials</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
            <span>admin / admin123</span><span style={{ color: "var(--text-muted)" }}>Full access</span>
            <span>staff / staff123</span><span style={{ color: "var(--text-muted)" }}>Analyst view</span>
            <span>viewer / viewer123</span><span style={{ color: "var(--text-muted)" }}>Read-only</span>
          </div>
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "28px" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Username</label>
              <input style={inp} value={username} onChange={e => setUsername(e.target.value)} required placeholder="Enter username"
                onFocus={e => (e.target.style.borderColor = "rgba(59,140,248,0.5)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Password</label>
              <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                onFocus={e => (e.target.style.borderColor = "rgba(59,140,248,0.5)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            </div>
            {error && (
              <div style={{ background: "var(--red-dim)", border: "1px solid rgba(240,68,68,0.2)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "var(--red)", display: "flex", gap: 7 }}>
                ⚠ {error}
              </div>
            )}
            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "11px", background: "var(--blue)", border: "none", borderRadius: 8,
              color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-ui)",
              cursor: loading ? "not-allowed" : "pointer", marginTop: 4, opacity: loading ? 0.7 : 1,
            }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border-subtle)", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            New patient?{" "}
            <Link href="/signup" style={{ color: "var(--blue)", textDecoration: "none", fontWeight: 500 }}>Create account →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}