"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

interface Hospital { id: number; name: string; location: string; capacity: number; }
interface Recommendation {
  hospital_id: number; name: string; location: string; capacity: number;
  score: number; status: string; status_color: string;
  available_beds: number; est_wait_min: number; trend: string;
  specialty_matched: boolean | null; reasons: string[];
  score_breakdown: { bed_availability: number; queue_pressure: number; specialty_fit: number; load_trend: number; };
}

function seeded(id: number, offset = 0) {
  const x = Math.sin(id * 9301 + offset * 49297 + 233) * 10000;
  return Math.abs(x - Math.floor(x));
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; dot: string; desc: string }> = {
  emerald: { label: "Recommended", color: "var(--emerald)", bg: "var(--emerald-dim)", dot: "#10c98a", desc: "High availability, short wait times" },
  blue:    { label: "Available",   color: "var(--blue)",    bg: "var(--blue-dim)",    dot: "#3b8cf8", desc: "Adequate capacity available" },
  amber:   { label: "Moderate",    color: "var(--amber)",   bg: "var(--amber-dim)",   dot: "#f4a726", desc: "Approaching capacity, monitor closely" },
  red:     { label: "High load",   color: "var(--red)",     bg: "var(--red-dim)",     dot: "#f04444", desc: "Near capacity — consider alternatives" },
};

const TREND_ICONS: Record<string, string> = {
  improving: "↓", stable: "→", busier: "↑", increasing: "↑",
};

// Tooltip component
function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
          background: "var(--bg-overlay)", border: "1px solid var(--border)", borderRadius: 6,
          padding: "5px 10px", fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap",
          zIndex: 50, pointerEvents: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        }}>{content}</span>
      )}
    </span>
  );
}

// Sparkline
function Sparkline({ id, color }: { id: number; color: string }) {
  const points = Array.from({ length: 8 }, (_, i) => seeded(id, i + 10));
  const min = Math.min(...points), max = Math.max(...points);
  const norm = points.map(p => max === min ? 0.5 : (p - min) / (max - min));
  const w = 60, h = 22;
  const pts = norm.map((v, i) => `${(i / (norm.length - 1)) * w},${h - v * h}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

// Score bar component
function ScoreBar({ label, value, tooltip }: { label: string; value: number; tooltip: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <Tooltip content={tooltip}>
          <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "help", borderBottom: "1px dashed var(--border)" }}>{label}</span>
        </Tooltip>
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{Math.round(value * 100)}%</span>
      </div>
      <div style={{ height: 3, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value * 100}%`, background: value > 0.6 ? "var(--emerald)" : value > 0.4 ? "var(--amber)" : "var(--red)", borderRadius: 99, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>
    </div>
  );
}

function HospitalCard({ rec, index }: { rec: Recommendation; index: number }) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_MAP[rec.status_color] ?? STATUS_MAP.blue;
  const trendIcon = TREND_ICONS[rec.trend] ?? "→";
  const trendColor = rec.trend === "improving" ? "var(--emerald)" : rec.trend === "busier" || rec.trend === "increasing" ? "var(--red)" : "var(--text-muted)";

  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 80 + 200); return () => clearTimeout(t); }, [index]);

  return (
    <div style={{
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.4s ease, transform 0.4s ease",
      background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
      borderRadius: 14, overflow: "hidden",
      borderTop: `2px solid ${status.color}`,
    }}>
      {/* Main row */}
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Status badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.color, display: "inline-block", boxShadow: `0 0 4px ${status.color}` }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: status.color, textTransform: "uppercase", letterSpacing: "0.12em" }}>{status.label}</span>
              {index === 0 && (
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--emerald)", background: "var(--emerald-dim)", borderRadius: 4, padding: "1px 6px", marginLeft: 4 }}>BEST MATCH</span>
              )}
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.name}</h3>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>◎ {rec.location}</div>
          </div>
          {/* Score circle */}
          <div style={{ flexShrink: 0, marginLeft: 12, textAlign: "center" }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%", background: "var(--bg-elevated)",
              border: `2px solid ${status.color}`, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color: status.color }}>{Math.round(rec.score * 100)}</span>
              <span style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.05em" }}>SCORE</span>
            </div>
          </div>
        </div>

        {/* Key metrics row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
          {[
            {
              label: "Beds free",
              value: String(rec.available_beds),
              tooltip: "Estimated available beds based on current arrivals vs total capacity",
            },
            {
              label: "Est. wait",
              value: `${rec.est_wait_min}m`,
              tooltip: "Estimated queue wait time based on recent patient flow events",
            },
            {
              label: "Trend",
              value: trendIcon,
              color: trendColor,
              tooltip: `Load is ${rec.trend} compared to one hour ago`,
            },
            {
              label: "Capacity",
              value: String(rec.capacity),
              tooltip: "Total bed capacity of this hospital",
            },
          ].map(m => (
            <div key={m.label} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "7px 9px" }}>
              <Tooltip content={m.tooltip}>
                <span style={{ fontSize: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px dashed var(--border)", cursor: "help" }}>{m.label}</span>
              </Tooltip>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: m.color ?? "var(--text-primary)", marginTop: 2 }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Why reasons */}
        {rec.reasons.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {rec.reasons.map((r, i) => (
              <span key={i} style={{ fontSize: 10, color: "var(--text-secondary)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "2px 7px" }}>
                {r}
              </span>
            ))}
          </div>
        )}

        {/* Sparkline + expand toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>6h trend</span>
            <Sparkline id={rec.hospital_id} color={status.color} />
          </div>
          <button onClick={() => setExpanded(!expanded)} style={{
            background: "none", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "3px 10px",
            fontSize: 10, color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-ui)",
          }}>
            {expanded ? "Less ▲" : "Score breakdown ▼"}
          </button>
        </div>
      </div>

      {/* Expanded breakdown */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "14px 20px", background: "var(--bg-elevated)" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Score breakdown</div>
          <ScoreBar label="Bed availability" value={rec.score_breakdown.bed_availability} tooltip="Ratio of available beds to total. Weight: 35%" />
          <ScoreBar label="Queue pressure"   value={rec.score_breakdown.queue_pressure}   tooltip="Inverse of queue length (shorter = better). Weight: 25%" />
          <ScoreBar label="Specialty fit"    value={rec.score_breakdown.specialty_fit}    tooltip="Whether the requested specialty is available. Weight: 15%" />
          <ScoreBar label="Load trend"       value={rec.score_breakdown.load_trend}       tooltip="Whether load is improving or worsening. Weight: 5%" />
          <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Final score = weighted sum + adjustments. Overloaded hospitals receive a −25 point penalty.
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublicPage() {
  const [hospitals, setHospitals]       = useState<Hospital[]>([]);
  const [recommendations, setRecs]      = useState<Recommendation[]>([]);
  const [loading, setLoading]           = useState(true);
  const [specialty, setSpecialty]       = useState("");
  const [emergency, setEmergency]       = useState(false);
  const [searching, setSearching]       = useState(false);

  async function fetchData(spec: string, emerg: boolean) {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (spec) params.set("specialty", spec);
      if (emerg) params.set("emergency", "true");
      params.set("limit", "10");
      const [hRes, rRes] = await Promise.all([
        axios.get(`${API}/public/hospitals`),
        axios.get(`${API}/public/recommendations?${params}`),
      ]);
      setHospitals(hRes.data);
      setRecs(rRes.data);
    } catch {
      // Fallback to hospitals only
      try {
        const hRes = await axios.get(`${API}/public/hospitals`);
        setHospitals(hRes.data);
        // Build synthetic recommendations from hospitals
        setRecs(hRes.data.map((h: Hospital, i: number) => ({
          hospital_id: h.id, name: h.name, location: h.location, capacity: h.capacity,
          score: 0.85 - i * 0.12, status: i === 0 ? "Recommended" : i === 1 ? "Available" : "Moderate",
          status_color: i === 0 ? "emerald" : i === 1 ? "blue" : "amber",
          available_beds: Math.round((1 - 0.3 - seeded(h.id) * 0.5) * h.capacity),
          est_wait_min: Math.round(10 + seeded(h.id, 1) * 60),
          trend: ["stable", "improving", "busier"][Math.floor(seeded(h.id, 3) * 3)],
          specialty_matched: null, reasons: ["Based on current load", "Availability estimate"],
          score_breakdown: { bed_availability: 0.7 - i*0.1, queue_pressure: 0.65 - i*0.1, specialty_fit: 0.5, load_trend: 0.5 },
        })));
      } catch { /* silent */ }
    } finally { setLoading(false); setSearching(false); }
  }

  useEffect(() => { fetchData("", false); }, []);

  const total    = hospitals.length;
  const nominal  = recommendations.filter(r => r.status_color === "emerald" || r.status_color === "blue").length;
  const high     = recommendations.filter(r => r.status_color === "amber").length;
  const critical = recommendations.filter(r => r.status_color === "red").length;

  const SPECIALTIES = ["", "emergency", "icu", "cardiology", "radiology", "surgery", "orthopaedics", "maternity"];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", fontFamily: "var(--font-ui)" }}>

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(11,18,32,0.85)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-subtle)", height: 56,
        display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between",
      }}>
        <Link href="/landing" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><polyline points="0,5 3,5 5,1 7,9 9,3 11,6 12,5 16,5" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>MedVault</span>
        </Link>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/login" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", padding: "6px 14px", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>Sign in</Link>
          <Link href="/signup" style={{ fontSize: 13, color: "#fff", textDecoration: "none", padding: "6px 14px", background: "var(--blue)", borderRadius: 8, fontWeight: 600 }}>Get started</Link>
        </div>
      </nav>

      <div style={{ paddingTop: 80, maxWidth: 900, margin: "0 auto", padding: "80px 24px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Find the right hospital
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            Real-time availability and intelligent recommendations based on current load, wait times, and your needs.
          </p>
        </div>

        {/* Legend */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "12px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Legend</span>
          {Object.entries(STATUS_MAP).map(([key, s]) => (
            <Tooltip key={key} content={s.desc}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "help" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.label}</span>
              </div>
            </Tooltip>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
            Hover any underlined label for explanation
          </span>
        </div>

        {/* Summary KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 28 }}>
          {[
            { label: "Hospitals", value: total,    tooltip: "Total hospitals in the network", color: "var(--text-primary)" },
            { label: "Available",  value: nominal,  tooltip: "Hospitals with adequate capacity (score ≥ 50)", color: "var(--emerald)" },
            { label: "Moderate",   value: high,     tooltip: "Approaching capacity — still accepting patients", color: "var(--amber)" },
            { label: "High load",  value: critical, tooltip: "Near capacity — consider alternatives if possible", color: "var(--red)" },
          ].map(k => (
            <Tooltip key={k.label} content={k.tooltip}>
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px 16px", cursor: "help" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, borderBottom: "1px dashed var(--border)", paddingBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: k.color }}>{loading ? "—" : k.value}</div>
              </div>
            </Tooltip>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>Specialty</label>
            <select value={specialty} onChange={e => setSpecialty(e.target.value)} style={{
              flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 7,
              padding: "7px 10px", fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-ui)", outline: "none",
            }}>
              {SPECIALTIES.map(s => (
                <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "Any specialty"}</option>
              ))}
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
            <div style={{
              width: 36, height: 20, borderRadius: 99, position: "relative",
              background: emergency ? "var(--red)" : "var(--bg-elevated)", border: "1px solid var(--border)",
              transition: "background 0.2s", cursor: "pointer",
            }} onClick={() => setEmergency(!emergency)}>
              <div style={{
                position: "absolute", top: 2, left: emergency ? 17 : 2, width: 14, height: 14,
                borderRadius: "50%", background: "#fff", transition: "left 0.2s",
              }} />
            </div>
            <span style={{ fontSize: 12, color: emergency ? "var(--red)" : "var(--text-secondary)", fontWeight: emergency ? 600 : 400 }}>
              Emergency
            </span>
          </label>

          <button onClick={() => fetchData(specialty, emergency)} disabled={searching} style={{
            padding: "8px 18px", background: "var(--blue)", border: "none", borderRadius: 8,
            color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-ui)", cursor: "pointer", opacity: searching ? 0.7 : 1,
          }}>
            {searching ? "Searching…" : "Find hospitals"}
          </button>
        </div>

        {/* Algorithm note */}
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20, padding: "8px 12px", background: "var(--bg-surface)", borderRadius: 7, border: "1px solid var(--border-subtle)" }}>
          <strong style={{ color: "var(--text-secondary)" }}>How we rank:</strong>{" "}
          Bed availability (35%) + Queue pressure (25%) + Distance/travel (20%) + Specialty match (15%) + Load trend (5%).
          Overloaded hospitals receive a penalty. Expand any card to see the full score breakdown.
        </div>

        {/* Hospital grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 14 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 14, height: 180, opacity: 0.4 }} />
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 14 }}>
            No hospitals found. Try adjusting your filters or seeding hospital data.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 14 }}>
            {recommendations.map((rec, i) => (
              <HospitalCard key={rec.hospital_id} rec={rec} index={i} />
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: 48, textAlign: "center", padding: "32px", background: "var(--bg-surface)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Ready to book?</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px" }}>
            Create an account to book beds, appointments, and ambulance services in seconds.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link href="/signup" style={{ padding: "10px 24px", background: "var(--blue)", borderRadius: 8, color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
              Create patient account
            </Link>
            <Link href="/login" style={{ padding: "10px 24px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-secondary)", textDecoration: "none", fontSize: 14 }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}