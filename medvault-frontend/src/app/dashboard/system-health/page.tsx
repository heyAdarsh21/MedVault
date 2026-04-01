"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fetchHospitals } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tip({ text, children }: { text: string; children: React.ReactNode }) {
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
        }}>{text}</span>
      )}
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, tip }: { label: string; value: string; sub?: string; accent: string; tip: string }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "20px 22px", borderTop: `2px solid ${accent}` }}>
      <Tip text={tip}>
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, borderBottom: "1px dashed var(--border)", paddingBottom: 4, cursor: "help" }}>
          {label}
        </div>
      </Tip>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function StatusDot({ level }: { level: string }) {
  const colors: Record<string, string> = { CRITICAL: "var(--red)", MODERATE: "var(--amber)", LOW: "var(--emerald)", HIGH: "var(--orange)" };
  const c = colors[level] ?? "var(--blue)";
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: c, fontSize: 11, fontWeight: 600 }}>
    <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block" }} />
    {level}
  </span>;
}

// ─── SVG Bar Chart component ──────────────────────────────────────────────────
function HorizontalBarChart({ data, label }: { data: { name: string; value: number; max: number; color: string }[]; label: string }) {
  if (!data.length) return <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>No data available</div>;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>{label}</div>
      {data.map((d, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{d.name}</span>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: d.color }}>{d.value}%</span>
          </div>
          <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${Math.min(d.value, 100)}%`, background: d.color,
              borderRadius: 99, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Donut Chart (SVG) ───────────────────────────────────────────────────────
function DonutChart({ segments, centerLabel, centerValue }: { segments: { value: number; color: string; label: string }[]; centerLabel: string; centerValue: string }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const r = 40, cx = 50, cy = 50, stroke = 10;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dashLen = pct * circumference;
          const dashOffset = -cumulative * circumference;
          cumulative += pct;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color}
              strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          );
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="16" fontWeight="700" fontFamily="var(--font-mono)">{centerValue}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="var(--text-muted)" fontSize="7" letterSpacing="0.1em">{centerLabel.toUpperCase()}</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{seg.label}: <strong style={{ color: "var(--text-primary)" }}>{seg.value}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Network-level aggregation from all hospitals ────────────────────────────
async function fetchNetworkSummary(hospitals: { id: number; name: string; capacity?: number; location: string }[]) {
  const results = await Promise.allSettled(
    hospitals.map(h =>
      api.get(`/intelligence/system-health/${h.id}`).then(r => ({ ...r.data, hospital: h }))
    )
  );
  const fulfilled = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map(r => r.value);
  // If ALL requests failed (e.g. 401 before auth hydration), throw to trigger retry
  if (fulfilled.length === 0 && hospitals.length > 0) {
    throw new Error("All system-health requests failed — auth token may not be ready yet");
  }
  return fulfilled;
}

async function fetchNetworkRecommendations() {
  try {
    const r = await api.get(`/public/recommendations?limit=3`);
    return r.data;
  } catch { return []; }
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SystemHealthPage() {
  const { hydrated } = useAuthStore();
  const { data: hospitals = [] } = useQuery({ queryKey: ["hospitals"], queryFn: fetchHospitals, enabled: hydrated, retry: 2, retryDelay: 1000 });

  const { data: networkData = [], isLoading } = useQuery({
    queryKey: ["network-summary", hospitals.map(h => h.id).join(",")],
    queryFn: () => fetchNetworkSummary(hospitals),
    enabled: hydrated && hospitals.length > 0,
    staleTime: 60_000,
    retry: 2,
    retryDelay: 1500,
  });

  const { data: topRecs = [] } = useQuery({
    queryKey: ["network-recs"],
    queryFn: fetchNetworkRecommendations,
    enabled: hydrated && hospitals.length > 0,
    retry: 2,
    retryDelay: 1000,
  });

  // ── Aggregate KPIs across all hospitals ──
  const totalCapacity   = hospitals.reduce((s, h) => s + (h.capacity ?? 0), 0);
  const avgEfficiency   = networkData.length ? networkData.reduce((s, d) => s + (d.kpis?.efficiency ?? 0), 0) / networkData.length : 0;
  const avgStrain       = networkData.length ? networkData.reduce((s, d) => s + (d.kpis?.strain_index ?? 0), 0) / networkData.length : 0;
  const avgThroughput   = networkData.length ? networkData.reduce((s, d) => s + (d.kpis?.throughput ?? 0), 0) : 0;
  const criticalCount   = networkData.filter(d => d.kpis?.risk_level === "CRITICAL").length;
  const overloadedCount = networkData.filter(d => (d.capacity_profile ?? []).some((c: any) => c.overloaded)).length;

  const systemStatus = criticalCount > 0 ? "CRITICAL" : avgStrain > 0.65 ? "HIGH" : avgStrain > 0.4 ? "MODERATE" : "NOMINAL";
  const statusColor  = systemStatus === "CRITICAL" ? "var(--red)" : systemStatus === "HIGH" ? "var(--orange)" : systemStatus === "MODERATE" ? "var(--amber)" : "var(--emerald)";

  // Build chart data
  const capacityChartData = networkData.flatMap(d =>
    (d.capacity_profile ?? []).map((c: any) => ({
      name: `${d.hospital?.name?.split(" ")[0]} — ${c.resource}`,
      value: Math.round((c.utilization ?? 0) * 100),
      max: 100,
      color: (c.utilization ?? 0) > 0.9 ? "var(--red)" : (c.utilization ?? 0) > 0.7 ? "var(--amber)" : "var(--emerald)",
    }))
  ).slice(0, 8);

  // Risk distribution
  const riskCounts = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
  networkData.forEach(d => {
    const level = d.kpis?.risk_level ?? "LOW";
    if (level in riskCounts) riskCounts[level as keyof typeof riskCounts]++;
  });

  // Bed availability estimates from recommendations
  const totalBedsAvail = (topRecs as any[]).reduce((s: number, r: any) => s + (r.available_beds ?? 0), 0);

  return (
    <div style={{ fontFamily: "var(--font-ui)", color: "var(--text-primary)" }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
          Intelligence · System Health
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>Network-Wide Health</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
              Aggregated metrics across all {hospitals.length} hospitals. Use Hospital Analysis for single-facility deep-dives.
            </p>
          </div>
          {isLoading && <span style={{ fontSize: 11, color: "var(--blue)", fontFamily: "var(--font-mono)" }}>Loading network…</span>}
        </div>
      </div>

      {/* System status banner */}
      <div style={{
        background: systemStatus === "CRITICAL" ? "var(--red-dim)" : systemStatus === "HIGH" ? "var(--orange-dim)" : systemStatus === "MODERATE" ? "var(--amber-dim)" : "var(--emerald-dim)",
        border: `1px solid ${statusColor}22`, borderRadius: 10, padding: "12px 18px",
        display: "flex", alignItems: "center", gap: 12, marginBottom: 24,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, display: "inline-block", boxShadow: `0 0 6px ${statusColor}` }} />
        <div>
          <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>System Status: {systemStatus}</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 12 }}>
            {criticalCount > 0 ? `${criticalCount} hospital(s) in critical state — immediate attention required` :
             systemStatus === "MODERATE" ? "Elevated load across network — monitor closely" :
             "All facilities operating within normal parameters"}
          </span>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
        <KpiCard label="Total hospitals"    value={String(hospitals.length)}       accent="var(--blue)"    sub="In network"                       tip="Total registered hospitals in the MedVault network" />
        <KpiCard label="Total capacity"     value={totalCapacity.toLocaleString()} accent="var(--blue)"    sub="Beds network-wide"                tip="Sum of all hospital capacity (total bed count)" />
        <KpiCard label="Avg efficiency"     value={`${(avgEfficiency * 100).toFixed(0)}%`} accent="var(--emerald)" sub="Flow efficiency score"   tip="Average workflow efficiency across hospitals (0–100%)" />
        <KpiCard label="Avg strain index"   value={(avgStrain).toFixed(2)}         accent={avgStrain > 0.6 ? "var(--red)" : "var(--amber)"} sub="0=relaxed, 1=overloaded" tip="Composite pressure score: occupancy + queue + flow" />
        <KpiCard label="Network throughput" value={avgThroughput.toFixed(1)}       accent="var(--blue)"    sub="Patients/hr total"                tip="Total patient events per hour across all hospitals" />
        <KpiCard label="Critical facilities" value={String(criticalCount)}         accent={criticalCount > 0 ? "var(--red)" : "var(--emerald)"} sub="Requiring attention" tip="Hospitals currently in CRITICAL risk level" />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>

        {/* Risk distribution donut */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Risk Distribution</div>
          <DonutChart
            centerValue={String(hospitals.length)}
            centerLabel="TOTAL"
            segments={[
              { value: riskCounts.LOW, color: "var(--emerald)", label: "Low" },
              { value: riskCounts.MODERATE, color: "var(--amber)", label: "Moderate" },
              { value: riskCounts.HIGH, color: "var(--orange)", label: "High" },
              { value: riskCounts.CRITICAL, color: "var(--red)", label: "Critical" },
            ]}
          />
        </div>

        {/* Efficiency by hospital */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "20px" }}>
          <HorizontalBarChart
            label="Efficiency by Hospital"
            data={networkData.map(d => ({
              name: d.hospital?.name?.replace(/\s+(Hospital|Inst\.|Memorial|Research).*/, "") ?? "Unknown",
              value: Math.round((d.kpis?.efficiency ?? 0) * 100),
              max: 100,
              color: (d.kpis?.efficiency ?? 0) > 0.7 ? "var(--emerald)" : (d.kpis?.efficiency ?? 0) > 0.5 ? "var(--amber)" : "var(--red)",
            }))}
          />
        </div>

        {/* Strain by hospital */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "20px" }}>
          <HorizontalBarChart
            label="Strain Index by Hospital"
            data={networkData.map(d => ({
              name: d.hospital?.name?.replace(/\s+(Hospital|Inst\.|Memorial|Research).*/, "") ?? "Unknown",
              value: Math.round((d.kpis?.strain_index ?? 0) * 100),
              max: 100,
              color: (d.kpis?.strain_index ?? 0) > 0.7 ? "var(--red)" : (d.kpis?.strain_index ?? 0) > 0.4 ? "var(--amber)" : "var(--emerald)",
            }))}
          />
        </div>
      </div>

      {/* Resource utilization chart */}
      {capacityChartData.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "20px", marginBottom: 24 }}>
          <HorizontalBarChart label="Top Resource Utilization Across Network" data={capacityChartData} />
        </div>
      )}

      {/* Per-hospital status table */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Per-hospital status
          </div>
          <Tip text="Click Hospital Analysis in the sidebar for a detailed single-facility view">
            <span style={{ fontSize: 11, color: "var(--text-muted)", cursor: "help", borderBottom: "1px dashed var(--border)" }}>What is this?</span>
          </Tip>
        </div>
        <div style={{ padding: "8px 0" }}>
          {hospitals.length === 0 && (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No hospitals found. Seed the database first.
            </div>
          )}
          {/* Table header */}
          {hospitals.length > 0 && (
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
              padding: "8px 20px", alignItems: "center", gap: 12,
              borderBottom: "1px solid var(--border-subtle)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Hospital</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center" }}>Risk</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center" }}>Efficiency</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center" }}>Strain</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center" }}>Throughput</div>
            </div>
          )}
          {hospitals.map(h => {
            const hData = networkData.find(d => d.hospital?.id === h.id);
            const risk = hData?.kpis?.risk_level ?? "—";
            const eff  = hData ? (hData.kpis?.efficiency * 100).toFixed(0) + "%" : "—";
            const strain = hData ? hData.kpis?.strain_index?.toFixed(2) : "—";
            const tput = hData ? hData.kpis?.throughput?.toFixed(1) : "—";
            return (
              <div key={h.id} style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                padding: "10px 20px", alignItems: "center", gap: 12,
                borderBottom: "1px solid var(--border-subtle)",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{h.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>◎ {h.location} · {h.capacity ?? "—"} beds</div>
                </div>
                <div style={{ textAlign: "center" }}><StatusDot level={risk} /></div>
                <div style={{ textAlign: "center", fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{eff}</div>
                <div style={{ textAlign: "center", fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{strain}</div>
                <div style={{ textAlign: "center", fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{tput}/hr</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      {topRecs.length > 0 && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Top recommendations right now</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Based on current availability, wait times, and capacity</div>
          </div>
          <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {[
              { label: "Best for emergency", rec: topRecs[0], icon: "🚨" },
              { label: "Best availability",   rec: topRecs[1] ?? topRecs[0], icon: "🛏" },
              { label: "Least crowded",       rec: [...topRecs].sort((a: any, b: any) => a.est_wait_min - b.est_wait_min)[0], icon: "⏱" },
            ].map(({ label, rec, icon }) => rec && (
              <div key={label} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid var(--emerald)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{icon} {label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{rec.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{rec.available_beds} beds free · ~{rec.est_wait_min}m wait</div>
                {rec.reasons?.[0] && <div style={{ fontSize: 10, color: "var(--emerald)", marginTop: 4 }}>{rec.reasons[0]}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}