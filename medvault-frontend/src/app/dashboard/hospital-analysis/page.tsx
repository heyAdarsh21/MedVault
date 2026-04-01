"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHospitals, fetchSystemHealth, fetchAnomalies, fetchRecommendations, fetchBottlenecks, type SystemHealthResponse } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

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

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      {label && <div style={{ fontSize: 12, color: "var(--text-secondary)", width: 140, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>}
      <div style={{ flex: 1, height: 4, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min((value / Math.max(max, 1)) * 100, 100)}%`, background: color, borderRadius: 99, transition: "width 0.7s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", width: 44, textAlign: "right", flexShrink: 0 }}>
        {(value / 60).toFixed(1)}m
      </span>
    </div>
  );
}

export default function HospitalAnalysisPage() {
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const { hydrated } = useAuthStore();
  const enabled = !!hospitalId && hydrated;

  const { data: hospitals = [] } = useQuery({ queryKey: ["hospitals"], queryFn: fetchHospitals });
  const { data, isLoading } = useQuery<SystemHealthResponse>({
    queryKey: ["hospital-analysis", hospitalId],
    queryFn: () => fetchSystemHealth(hospitalId!),
    enabled,
  });
  const { data: anomalies = [] } = useQuery({
    queryKey: ["anomalies-ha", hospitalId],
    queryFn: () => fetchAnomalies(hospitalId!),
    enabled,
  });
  const { data: recs = [] } = useQuery({
    queryKey: ["recs-ha", hospitalId],
    queryFn: () => fetchRecommendations(hospitalId!),
    enabled,
  });
  const { data: bottlenecks = [] } = useQuery({
    queryKey: ["bottlenecks-ha", hospitalId],
    queryFn: () => fetchBottlenecks(hospitalId!),
    enabled,
  });

  const selected = hospitals.find(h => h.id === hospitalId);
  const riskColor = (r: string) => r === "CRITICAL" ? "var(--red)" : r === "HIGH" ? "var(--orange)" : r === "MODERATE" ? "var(--amber)" : "var(--emerald)";
  const sevColor  = (s: string) => s === "critical" ? "var(--red)" : s === "high" ? "var(--orange)" : s === "medium" ? "var(--amber)" : "var(--emerald)";
  const maxDelay = bottlenecks.length ? Math.max(...bottlenecks.map((b: any) => b.average_delay)) : 1;

  return (
    <div style={{ fontFamily: "var(--font-ui)", color: "var(--text-primary)" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
          Intelligence · Hospital Analysis
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>Hospital Deep-Dive</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
              Department-level insights, bottlenecks, and performance for a single facility.
              For network-wide stats, see System Health.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isLoading && <span style={{ fontSize: 11, color: "var(--blue)", fontFamily: "var(--font-mono)" }}>Analysing…</span>}
            <select onChange={e => setHospitalId(e.target.value ? Number(e.target.value) : null)} defaultValue=""
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: 13, borderRadius: "var(--radius)", padding: "8px 12px", outline: "none", fontFamily: "var(--font-ui)", cursor: "pointer" }}>
              <option value="" disabled>Select hospital</option>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} — {h.location}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* What this page shows */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "12px 18px", marginBottom: 24, borderLeft: "3px solid var(--emerald)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--emerald)", marginBottom: 4 }}>About this view</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Select a hospital to see its <strong style={{ color: "var(--text-primary)" }}>department-level performance</strong>:
          which departments are bottlenecks, capacity per resource, anomaly alerts, and operational recommendations.
          This is a single-facility view — for cross-hospital comparison use System Health.
        </div>
      </div>

      {!hospitalId && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "60px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◉</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Select a hospital above to begin analysis</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Showing department load, bottlenecks, capacity, and anomaly data</div>
        </div>
      )}

      {data && selected && (
        <>
          {/* Hospital identity + KPIs */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "18px 22px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>◎ {selected.location} · Capacity: {selected.capacity}</div>
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {[
                  { label: "Risk level",   value: data.kpis.risk_level, color: riskColor(data.kpis.risk_level), tip: "Composite operational risk: CRITICAL requires immediate action" },
                  { label: "Efficiency",   value: `${(data.kpis.efficiency * 100).toFixed(0)}%`, color: "var(--text-primary)", tip: "Patient flow efficiency: how smoothly patients move through departments" },
                  { label: "Strain index", value: data.kpis.strain_index.toFixed(2), color: "var(--text-primary)", tip: "System pressure (0=relaxed, 1=overloaded). >0.7 is critical" },
                  { label: "Throughput",   value: `${data.kpis.throughput.toFixed(1)}/hr`, color: "var(--text-primary)", tip: "Patient events processed per hour at this facility" },
                ].map(k => (
                  <Tip key={k.label} text={k.tip}>
                    <div style={{ textAlign: "right", cursor: "help" }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px dashed var(--border)", paddingBottom: 2, marginBottom: 4 }}>{k.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: k.color }}>{k.value}</div>
                    </div>
                  </Tip>
                ))}
              </div>
            </div>
          </div>

          {/* Three-column grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

            {/* Bottlenecks */}
            <SectionCard title="Department bottlenecks" subtitle="Average delay per department — longer = more congested">
              {(bottlenecks as any[]).length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
                  No bottleneck data yet. Run a simulation or seed flow events.
                </div>
              ) : (
                <>
                  {(bottlenecks as any[]).slice(0, 6).map((b: any) => (
                    <div key={b.department_id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{b.department_name}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: sevColor(b.severity), background: `${sevColor(b.severity)}18`, padding: "1px 6px", borderRadius: 4 }}>{b.severity}</span>
                      </div>
                      <Bar value={b.average_delay} max={maxDelay} color={sevColor(b.severity)} />
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {b.delay_count} events · p95: {(b.percentile_95 / 60).toFixed(1)}m
                      </div>
                    </div>
                  ))}
                </>
              )}
            </SectionCard>

            {/* Capacity profile */}
            <SectionCard title="Resource capacity" subtitle="Current utilisation per resource (demand ÷ capacity)">
              {(data.capacity_profile ?? []).length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>No capacity data.</div>
              ) : (
                (data.capacity_profile ?? []).slice(0, 8).map((c: any) => {
                  const pct = Math.round(c.utilization * 100);
                  const color = pct >= 90 ? "var(--red)" : pct >= 70 ? "var(--amber)" : "var(--emerald)";
                  return (
                    <div key={c.resource} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{c.resource}</span>
                        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color }}>{pct}%{c.overloaded ? " ⚠" : ""}</span>
                      </div>
                      <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 99, transition: "width 0.7s ease" }} />
                      </div>
                    </div>
                  );
                })
              )}
            </SectionCard>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Anomalies */}
            <SectionCard title="Anomaly alerts" subtitle="Statistically unusual patterns detected in this facility">
              {(anomalies as any[]).length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>No anomalies detected — system operating normally.</div>
              ) : (
                (anomalies as any[]).slice(0, 5).map((a: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8, borderLeft: `3px solid ${sevColor(a.severity)}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{a.department}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a.message}</div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: sevColor(a.severity), whiteSpace: "nowrap" }}>{a.severity}</div>
                  </div>
                ))
              )}
            </SectionCard>

            {/* Recommendations */}
            <SectionCard title="Operational recommendations" subtitle="AI-generated actions to improve performance">
              {(recs as any[]).length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>No recommendations at this time.</div>
              ) : (
                (recs as any[]).slice(0, 5).map((r: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8, borderLeft: `3px solid ${sevColor(r.priority)}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.description}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: sevColor(r.priority), whiteSpace: "nowrap" }}>{r.priority}</span>
                  </div>
                ))
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}