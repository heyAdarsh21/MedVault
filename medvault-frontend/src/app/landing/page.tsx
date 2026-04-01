"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

const STATS = [
  { value: "6+",    label: "Network Hospitals"    },
  { value: "50+",   label: "Specialist Doctors"   },
  { value: "24/7",  label: "Emergency Services"   },
  { value: "500+",  label: "Beds Available"        },
];

const FEATURES = [
  { icon: "🛏", title: "Bed Booking",           desc: "Reserve a bed in real-time across wards — general, ICU, maternity and more." },
  { icon: "🩺", title: "Doctor Appointments",   desc: "Browse specialists by department and book confirmed slots instantly."        },
  { icon: "🚑", title: "Emergency Ambulance",   desc: "Request a dispatched ambulance to your location in under 2 minutes."        },
  { icon: "📋", title: "Medical Records",       desc: "Your complete consultation history and prescriptions, always accessible."   },
  { icon: "📊", title: "Live Availability",     desc: "See real-time bed and resource availability across all facilities."        },
  { icon: "🔔", title: "Booking Alerts",        desc: "Get instant confirmation and reminders for every service you book."        },
];

function ECGLine() {
  return (
    <svg viewBox="0 0 400 60" style={{ width: "100%", opacity: 0.15 }} fill="none">
      <polyline
        points="0,30 40,30 55,30 65,5 75,55 85,10 95,50 105,30 145,30 160,30 170,20 180,40 190,30 400,30"
        stroke="#3b8cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ strokeDasharray: 600, strokeDashoffset: 600, animation: "ecg-draw 3s ease forwards 0.5s" }}
      />
      <style>{`@keyframes ecg-draw { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", fontFamily: "var(--font-ui)", color: "var(--text-primary)", overflowX: "hidden" }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(11,18,32,0.97)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border-subtle)" : "1px solid transparent",
        padding: "0 40px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all 0.3s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--blue-dim)", border: "1px solid rgba(59,140,248,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
              <polyline points="0,6 3,6 5,1 7,11 9,4 11,8 13,6 18,6" stroke="#3b8cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>MedVault</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/public" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", padding: "6px 14px", borderRadius: 6, transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}>
            Hospital Status
          </Link>
          <Link href="/login" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(59,140,248,0.4)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
            Sign in
          </Link>
          <Link href="/signup" style={{ fontSize: 13, fontWeight: 600, color: "#fff", textDecoration: "none", padding: "7px 18px", borderRadius: 6, background: "var(--blue)", boxShadow: "0 2px 10px rgba(59,140,248,0.3)", transition: "all 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#2d7ef7")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--blue)")}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px 60px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Background glow */}
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(59,140,248,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        {/* Grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(59,140,248,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(59,140,248,0.025) 1px,transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />

        <div style={{ position: "relative", maxWidth: 720, animation: "fade-up 0.6s ease both" }}>
          {/* Pill badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(16,201,138,0.08)", border: "1px solid rgba(16,201,138,0.2)", borderRadius: 99, padding: "5px 14px", marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10c98a", display: "inline-block", animation: "pulse-dot 2s ease infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#10c98a", letterSpacing: "0.1em" }}>NETWORK OPERATIONAL · 6 HOSPITALS</span>
          </div>

          <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", margin: "0 0 20px", color: "var(--text-primary)" }}>
            Healthcare at your<br />
            <span style={{ color: "var(--blue)" }}>fingertips.</span>
          </h1>

          <p style={{ fontSize: 18, color: "var(--text-secondary)", lineHeight: 1.7, margin: "0 auto 36px", maxWidth: 540 }}>
            Book beds, schedule doctors, request ambulances — and let our clinical intelligence platform ensure you receive care when it matters most.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--blue)", color: "#fff", textDecoration: "none", padding: "13px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600, boxShadow: "0 4px 20px rgba(59,140,248,0.35)", transition: "all 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
              Book a Service <span style={{ fontSize: 17 }}>→</span>
            </Link>
            <Link href="/public" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", color: "var(--text-secondary)", textDecoration: "none", padding: "13px 24px", borderRadius: 10, fontSize: 15, border: "1px solid var(--border)", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(59,140,248,0.3)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
              View Hospital Status
            </Link>
          </div>
        </div>

        {/* ECG decoration */}
        <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, padding: "0 80px" }}>
          <ECGLine />
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", padding: "40px 40px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0 }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{ textAlign: "center", padding: "8px 0", borderRight: i < STATS.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--blue)", fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "80px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 12 }}>PLATFORM CAPABILITIES</div>
          <h2 style={{ fontSize: "clamp(24px,4vw,38px)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 14px" }}>Everything in one place</h2>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto" }}>
            From patient bookings to real-time clinical intelligence — one unified platform for the entire care journey.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "24px", transition: "all 0.2s", animation: `fade-up 0.5s ${i * 0.08}s ease both` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(59,140,248,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.transform = "none"; }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px", color: "var(--text-primary)" }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Role CTA ── */}
      <section style={{ padding: "60px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[
            { role: "Patient",       icon: "🧑‍⚕️", desc: "Register to book beds, appointments and ambulances. Track your medical history.",      href: "/signup?role=patient",  color: "var(--blue)",    cta: "Register as Patient"   },
            { role: "Doctor",        icon: "👨‍⚕️", desc: "Access your schedule, manage appointments and view patient consultations.",             href: "/login?role=doctor",    color: "var(--emerald)", cta: "Doctor Sign In"        },
            { role: "Analyst/Admin", icon: "📊",  desc: "Full access to intelligence dashboards, bottleneck analysis and simulation tools.",     href: "/login?role=staff",     color: "var(--amber)",   cta: "Staff Sign In"         },
          ].map(r => (
            <div key={r.role} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: "28px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>{r.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: r.color, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>{r.role}</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 20px" }}>{r.desc}</p>
              <Link href={r.href} style={{ display: "block", padding: "10px", borderRadius: 8, background: `${r.color === "var(--blue)" ? "var(--blue)" : "transparent"}`, border: `1px solid ${r.color}`, color: r.color === "var(--blue)" ? "#fff" : r.color, fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "all 0.15s" }}
                onMouseEnter={e => { if (r.color !== "var(--blue)") { e.currentTarget.style.background = r.color; e.currentTarget.style.color = r.color === "var(--emerald)" ? "#0b1220" : "#fff"; }}}
                onMouseLeave={e => { if (r.color !== "var(--blue)") { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = r.color; }}}>
                {r.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border-subtle)", padding: "28px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><polyline points="0,5 3,5 5,1 7,9 9,3 11,6 12,5 16,5" stroke="#3b8cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>MedVault</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>© 2026 MedVault. Healthcare intelligence platform.</div>
        <div style={{ display: "flex", gap: 20 }}>
          {["Hospital Status", "Book Services", "Sign In"].map((l, i) => (
            <Link key={l} href={["/public", "/signup", "/login"][i]} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
              {l}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}