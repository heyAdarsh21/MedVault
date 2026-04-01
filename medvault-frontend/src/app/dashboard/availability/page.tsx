"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

interface Recommendation {
  hospital_id: number; name: string; location: string; capacity: number;
  score: number; status: string; status_color: string;
  available_beds: number; est_wait_min: number; trend: string;
  specialty_matched: boolean | null; reasons: string[];
  score_breakdown: { bed_availability: number; queue_pressure: number; specialty_fit: number; load_trend: number; };
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  emerald: { label: "Recommended", color: "var(--emerald)", bg: "var(--emerald-dim)", dot: "#10c98a" },
  blue:    { label: "Available",   color: "var(--blue)",    bg: "var(--blue-dim)",    dot: "#3b8cf8" },
  amber:   { label: "Moderate",    color: "var(--amber)",   bg: "var(--amber-dim)",   dot: "#f4a726" },
  red:     { label: "High load",   color: "var(--red)",     bg: "var(--red-dim)",     dot: "#f04444" },
};

const TREND_ICONS: Record<string, string> = { improving: "↓", stable: "→", busier: "↑", increasing: "↑" };
const SPECIALTIES = ["", "emergency", "icu", "cardiology", "radiology", "surgery", "orthopaedics", "maternity"];

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
          zIndex: 50, pointerEvents: "none",
        }}>{content}</span>
      )}
    </span>
  );
}

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
        <div style={{ height: "100%", width: `${value * 100}%`, background: value > 0.6 ? "var(--emerald)" : value > 0.4 ? "var(--amber)" : "var(--red)", borderRadius: 99, transition: "width 0.8s ease" }} />
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

  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 80 + 100); return () => clearTimeout(t); }, [index]);

  return (
    <div style={{
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.4s ease, transform 0.4s ease",
      background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
      borderRadius: 14, overflow: "hidden", borderTop: `2px solid ${status.color}`,
    }}>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.color, display: "inline-block", boxShadow: `0 0 4px ${status.color}` }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: status.color, textTransform: "uppercase", letterSpacing: "0.12em" }}>{status.label}</span>
              {index === 0 && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--emerald)", background: "var(--emerald-dim)", borderRadius: 4, padding: "1px 6px", marginLeft: 4 }}>BEST MATCH</span>}
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 2px" }}>{rec.name}</h3>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>◎ {rec.location}</div>
          </div>
          <div style={{ flexShrink: 0, marginLeft: 12, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--bg-elevated)", border: `2px solid ${status.color}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color: status.color }}>{Math.round(rec.score * 100)}</span>
              <span style={{ fontSize: 8, color: "var(--text-muted)" }}>SCORE</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
          {[
            { label: "Beds free", value: String(rec.available_beds), tooltip: "Estimated available beds" },
            { label: "Est. wait", value: `${rec.est_wait_min}m`, tooltip: "Estimated queue wait time" },
            { label: "Trend", value: trendIcon, color: trendColor, tooltip: `Load is ${rec.trend}` },
            { label: "Capacity", value: String(rec.capacity), tooltip: "Total bed capacity" },
          ].map(m => (
            <div key={m.label} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "7px 9px" }}>
              <Tooltip content={m.tooltip}>
                <span style={{ fontSize: 8, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", cursor: "help" }}>{m.label}</span>
              </Tooltip>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: m.color ?? "var(--text-primary)", marginTop: 2 }}>{m.value}</div>
            </div>
          ))}
        </div>

        {rec.reasons.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {rec.reasons.map((r, i) => (
              <span key={i} style={{ fontSize: 10, color: "var(--text-secondary)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "2px 7px" }}>{r}</span>
            ))}
          </div>
        )}

        <button onClick={() => setExpanded(!expanded)} style={{
          background: "none", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "3px 10px",
          fontSize: 10, color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-ui)",
        }}>
          {expanded ? "Less ▲" : "Score breakdown ▼"}
        </button>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "14px 20px", background: "var(--bg-elevated)" }}>
          <ScoreBar label="Bed availability" value={rec.score_breakdown.bed_availability} tooltip="Ratio of available beds to total. Weight: 35%" />
          <ScoreBar label="Queue pressure"   value={rec.score_breakdown.queue_pressure}   tooltip="Inverse of queue length. Weight: 25%" />
          <ScoreBar label="Specialty fit"    value={rec.score_breakdown.specialty_fit}    tooltip="Specialty availability. Weight: 15%" />
          <ScoreBar label="Load trend"       value={rec.score_breakdown.load_trend}       tooltip="Load direction. Weight: 5%" />
        </div>
      )}
    </div>
  );
}

export default function AvailabilityPage() {
  const [recommendations, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [specialty, setSpecialty] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [searching, setSearching] = useState(false);

  async function fetchData(spec: string, emerg: boolean, attempt = 0) {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (spec) params.set("specialty", spec);
      if (emerg) params.set("emergency", "true");
      params.set("limit", "10");
      const rRes = await api.get(`/public/recommendations?${params}`, { timeout: 15000 });
      setRecs(rRes.data);
    } catch {
      // Retry up to 2 times with a delay (backend may be slow on first call)
      if (attempt < 2) {
        setTimeout(() => fetchData(spec, emerg, attempt + 1), 2000);
        return;
      }
      setRecs([]);
    } finally { setLoading(false); setSearching(false); }
  }

  useEffect(() => { fetchData("", false); }, []);

  const nominal  = recommendations.filter(r => r.status_color === "emerald" || r.status_color === "blue").length;
  const high     = recommendations.filter(r => r.status_color === "amber").length;
  const critical = recommendations.filter(r => r.status_color === "red").length;

  return (
    <div style={{ fontFamily: "var(--font-ui)", color: "var(--text-primary)" }}>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
          Public · Hospital Finder
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>Real-Time Availability</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
          Intelligent hospital recommendations based on current load, wait times, and capacity.
        </p>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total", value: recommendations.length, color: "var(--text-primary)" },
          { label: "Available", value: nominal, color: "var(--emerald)" },
          { label: "Moderate", value: high, color: "var(--amber)" },
          { label: "High load", value: critical, color: "var(--red)" },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: k.color }}>{loading ? "—" : k.value}</div>
          </div>
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
            {SPECIALTIES.map(s => <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "Any specialty"}</option>)}
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
          <div style={{
            width: 36, height: 20, borderRadius: 99, position: "relative",
            background: emergency ? "var(--red)" : "var(--bg-elevated)", border: "1px solid var(--border)", transition: "background 0.2s",
          }} onClick={() => setEmergency(!emergency)}>
            <div style={{ position: "absolute", top: 2, left: emergency ? 17 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
          <span style={{ fontSize: 12, color: emergency ? "var(--red)" : "var(--text-secondary)", fontWeight: emergency ? 600 : 400 }}>Emergency</span>
        </label>

        <button onClick={() => fetchData(specialty, emergency)} disabled={searching} style={{
          padding: "8px 18px", background: "var(--blue)", border: "none", borderRadius: 8,
          color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-ui)", cursor: "pointer", opacity: searching ? 0.7 : 1,
        }}>
          {searching ? "Searching…" : "Find hospitals"}
        </button>
      </div>

      {/* Hospital cards */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 14 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 14, height: 180, opacity: 0.4 }} />)}
        </div>
      ) : recommendations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 14 }}>
          No hospitals found. Try adjusting your filters or seeding hospital data.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 14 }}>
          {recommendations.map((rec, i) => <HospitalCard key={rec.hospital_id} rec={rec} index={i} />)}
        </div>
      )}
    </div>
  );
}
