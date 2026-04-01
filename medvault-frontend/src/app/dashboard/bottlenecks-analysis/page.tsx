"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { fetchHospitals, fetchBottlenecks, type BottleneckAnalysis } from "@/lib/api";

function SeverityBadge({ s }: { s: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    critical: { bg: "var(--red-dim)",    color: "var(--red)"     },
    high:     { bg: "var(--orange-dim)", color: "var(--orange)"  },
    medium:   { bg: "var(--amber-dim)",  color: "var(--amber)"   },
    low:      { bg: "var(--emerald-dim)",color: "var(--emerald)" },
  };
  const c = map[s] ?? { bg: "var(--blue-dim)", color: "var(--blue)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: c.bg, color: c.color, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 99 }}>
      {s}
    </span>
  );
}

export default function BottlenecksPage() {
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [sort, setSort] = useState<"delay" | "volume" | "p95">("delay");
  const { hydrated } = useAuthStore();

  const { data: hospitals } = useQuery({ queryKey: ["hospitals"], queryFn: fetchHospitals });

  // fetchBottlenecks returns BottleneckAnalysis[] directly (an array)
  const { data: rawItems = [], isLoading } = useQuery<BottleneckAnalysis[]>({
    queryKey: ["bottlenecks", hospitalId],
    queryFn: () => fetchBottlenecks(hospitalId!),
    enabled: !!hospitalId && hydrated,
  });

  const items = [...rawItems].sort((a, b) => {
    if (sort === "delay")  return b.average_delay - a.average_delay;
    if (sort === "volume") return b.delay_count - a.delay_count;
    return (b.percentile_95 ?? 0) - (a.percentile_95 ?? 0);
  });

  const worst = items[0];
  const totalEvents = items.reduce((s, b) => s + (b.delay_count ?? 0), 0);
  const avgDelay = items.length
    ? items.reduce((s, b) => s + b.average_delay, 0) / items.length
    : 0;

  const barColor = (s: string) =>
    s === "critical" ? "var(--red)" : s === "high" ? "var(--orange)" : s === "medium" ? "var(--amber)" : "var(--emerald)";
  const maxDelay = items.length ? Math.max(...items.map(b => b.average_delay)) : 1;

  // Convert seconds → minutes for display
  const toMin = (sec: number) => (sec / 60).toFixed(1);

  return (
    <div style={{ fontFamily: "var(--font-ui)", color: "var(--text-primary)" }}>

      {/* Header */}
      <div className="stagger-1" style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
          Analytics · Bottlenecks
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>Bottleneck Analysis</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
              Department-level delay and throughput profiling
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isLoading && <span style={{ fontSize: 11, color: "var(--blue)", fontFamily: "var(--font-mono)" }}>Loading…</span>}
            <select
              onChange={e => setHospitalId(e.target.value ? Number(e.target.value) : null)}
              defaultValue=""
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: 13, borderRadius: "var(--radius)", padding: "8px 12px", outline: "none", fontFamily: "var(--font-ui)", cursor: "pointer" }}
            >
              <option value="" disabled>Select hospital</option>
              {hospitals?.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!hospitalId && (
        <div className="stagger-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "60px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>▲</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>Select a hospital to analyse bottlenecks</div>
        </div>
      )}

      {rawItems.length > 0 && (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Departments",    value: String(items.length),           accent: "var(--blue)",    delay: 2 },
              { label: "Worst Dept",     value: worst?.department_name ?? "—",  accent: "var(--red)",     delay: 2 },
              { label: "Avg Delay",      value: `${toMin(avgDelay)}m`,          accent: "var(--amber)",   delay: 3 },
              { label: "Total Events",   value: String(totalEvents),            accent: "var(--emerald)", delay: 3 },
            ].map((c) => (
              <div key={c.label} className={`stagger-${c.delay}`} style={{
                background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                borderTop: `2px solid ${c.accent}`, borderRadius: "var(--radius-lg)", padding: "18px 20px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="stagger-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Delay Profile</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["delay", "volume", "p95"] as const).map(s => (
                  <button key={s} onClick={() => setSort(s)} style={{
                    padding: "4px 10px", borderRadius: "var(--radius-sm)", fontSize: 11, fontWeight: 500,
                    cursor: "pointer", border: "none", fontFamily: "var(--font-ui)",
                    background: sort === s ? "var(--blue-dim)" : "transparent",
                    color: sort === s ? "var(--blue)" : "var(--text-muted)",
                    transition: "all 0.15s",
                  }}>
                    {s === "delay" ? "Avg Delay" : s === "volume" ? "Events" : "P95"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: "20px" }}>
              {items.map((b, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{b.department_name}</span>
                      <SeverityBadge s={b.severity} />
                    </div>
                    <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                      {sort === "delay"  ? `${toMin(b.average_delay)}m`
                       : sort === "volume" ? `${b.delay_count} events`
                       : `${toMin(b.percentile_95 ?? 0)}m`}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "var(--bg-overlay)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 99,
                      width: `${(b.average_delay / maxDelay) * 100}%`,
                      background: barColor(b.severity),
                      transition: "width 0.7s ease",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail table */}
          <div className="stagger-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Detail Table</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {["Department", "Severity", "Avg Delay", "P95 Delay", "Max Delay", "Events"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap", fontFamily: "var(--font-ui)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((b, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "10px 16px", color: "var(--text-primary)", fontWeight: 500 }}>{b.department_name}</td>
                      <td style={{ padding: "10px 16px" }}><SeverityBadge s={b.severity} /></td>
                      <td style={{ padding: "10px 16px", color: barColor(b.severity), fontFamily: "var(--font-mono)" }}>{toMin(b.average_delay)}m</td>
                      <td style={{ padding: "10px 16px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{toMin(b.percentile_95 ?? 0)}m</td>
                      <td style={{ padding: "10px 16px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{toMin(b.max_delay ?? 0)}m</td>
                      <td style={{ padding: "10px 16px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{b.delay_count ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {hospitalId && !isLoading && rawItems.length === 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "48px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No bottleneck data available for this hospital.</div>
        </div>
      )}
    </div>
  );
}