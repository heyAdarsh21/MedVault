"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

const NAV = [
  {
    group: "Intelligence",
    items: [
      { href: "/dashboard/system-health",      label: "System Health",    icon: "◈", desc: "Network-wide stats" },
      { href: "/dashboard/hospital-analysis",  label: "Hospital Analysis",icon: "◉", desc: "Single-facility deep-dive" },
    ],
  },
  {
    group: "Analytics",
    items: [
      { href: "/dashboard/bottlenecks-analysis", label: "Bottlenecks",    icon: "▲", desc: "Delay hotspots" },
      { href: "/dashboard/simulation",           label: "Simulation",     icon: "⟳", desc: "Run scenarios" },
      { href: "/dashboard/ingestion",            label: "Data Ingestion", icon: "↓", desc: "Import events" },
    ],
  },
  {
    group: "Bookings",
    items: [
      { href: "/dashboard/bookings",  label: "Manage Bookings", icon: "□", desc: "Bed, ambulance, appointments" },
    ],
  },
  {
    group: "Public",
    items: [
      { href: "/dashboard/availability", label: "Hospital Finder", icon: "○", desc: "Real-time availability" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { logout, role, username } = useAuthStore();

  function handleLogout() {
    logout();
    // Small delay so cookie clears before redirect
    setTimeout(() => router.replace("/login"), 50);
  }

  return (
    <aside style={{
      width: 220, minHeight: "100vh",
      background: "var(--bg-surface)", borderRight: "1px solid var(--border-subtle)",
      display: "flex", flexDirection: "column", flexShrink: 0, fontFamily: "var(--font-ui)",
    }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--blue-dim)", border: "1px solid rgba(59,140,248,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
              <polyline points="0,6 3,6 5,1 7,11 9,4 11,8 13,6 18,6" stroke="#3b8cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.04em" }}>MedVault</div>
            <div style={{ fontSize: 9, fontWeight: 500, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 1 }}>Intelligence</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
        {NAV.map(({ group, items }) => (
          <div key={group}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", padding: "0 10px", marginBottom: 4 }}>
              {group}
            </div>
            {items.map(({ href, label, icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link key={href} href={href} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: "var(--radius-sm)", marginBottom: 1,
                    background: active ? "var(--blue-dim)" : "transparent",
                    border: active ? "1px solid rgba(59,140,248,0.18)" : "1px solid transparent",
                    color: active ? "var(--blue)" : "var(--text-secondary)",
                    fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.15s ease",
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "var(--text-primary)"; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}}
                  >
                    <span style={{ fontSize: 10, opacity: active ? 1 : 0.5, width: 14, textAlign: "center" }}>{icon}</span>
                    {label}
                    {active && <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: "var(--blue)" }} />}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: "12px 10px 16px", borderTop: "1px solid var(--border-subtle)" }}>
        {(username || role) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", marginBottom: 4 }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: "var(--bg-overlay)", border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "var(--blue)", flexShrink: 0,
            }}>
              {(username ?? role ?? "U")[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                {username ?? role ?? "User"}
              </div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                {role ?? "authenticated"}
              </div>
            </div>
          </div>
        )}
        <button onClick={handleLogout} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "7px 10px", borderRadius: "var(--radius-sm)",
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--text-muted)", fontSize: 13, fontFamily: "var(--font-ui)", transition: "all 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(240,68,68,0.06)"; e.currentTarget.style.color = "var(--red)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <span style={{ fontSize: 12 }}>⊗</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;