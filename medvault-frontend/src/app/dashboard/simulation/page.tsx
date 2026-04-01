"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { fetchHospitals, fetchScenarios, runScenario, runSimulation, type SimulationRunResponse, type SimulationOutcome } from "@/lib/api";

const SCENARIO_ICONS: Record<string, string> = {
  normal_day:    "◈",
  evening_surge: "▲",
  mass_casualty: "⚠",
  staff_shortage: "◉",
};
const SCENARIO_COLORS: Record<string, string> = {
  normal_day:     "var(--blue)",
  evening_surge:  "var(--amber)",
  mass_casualty:  "var(--red)",
  staff_shortage: "var(--orange)",
};

function KpiBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)", padding: "18px 20px", borderTop: `2px solid ${color}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function SimulationPage() {
  const [hospitalId, setHospitalId]       = useState<number | null>(null);
  const [mode, setMode]                   = useState<"scenario" | "custom">("scenario");
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [duration, setDuration]           = useState(1000);
  const [arrivalRate, setArrivalRate]     = useState(0.1);
  const [seed, setSeed]                   = useState<string>("");
  const { hydrated }                      = useAuthStore();

  const { data: hospitals } = useQuery({ queryKey: ["hospitals"], queryFn: fetchHospitals });
  const { data: scenarios } = useQuery({ queryKey: ["scenarios"], queryFn: fetchScenarios });

  const mutation = useMutation<SimulationRunResponse, Error, void>({
    mutationFn: async () => {
      if (!hospitalId) throw new Error("No hospital selected");
      if (mode === "scenario" && selectedScenario) {
        return runScenario(hospitalId, selectedScenario);
      }
      return runSimulation(hospitalId, duration, arrivalRate, seed ? Number(seed) : undefined);
    },
  });

  // outcome uses SimulationOutcome field names from api.ts
  const outcome: SimulationOutcome | undefined = mutation.data?.outcome;

  const maxUtil = outcome?.capacity_summary?.length
    ? Math.max(...outcome.capacity_summary.map(c => c.utilization_pct))
    : 1;

  // avg_wait_time_seconds → minutes
  const avgWaitMin = outcome ? (outcome.avg_wait_time_seconds / 60).toFixed(1) : "—";

  return (
    <div style={{ fontFamily: "var(--font-ui)", color: "var(--text-primary)" }}>

      {/* Header */}
      <div className="stagger-1" style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
          Analytics · Simulation
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>Simulation Control</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
          Discrete-event patient flow simulation with outcome analytics
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Left panel: controls ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Hospital selector */}
          <div className="stagger-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "18px 20px" }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>
              Hospital
            </label>
            <select
              onChange={e => setHospitalId(e.target.value ? Number(e.target.value) : null)}
              defaultValue=""
              style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: 13, borderRadius: "var(--radius)", padding: "9px 12px", outline: "none", fontFamily: "var(--font-ui)", cursor: "pointer" }}
            >
              <option value="" disabled>Select facility</option>
              {hospitals?.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>

          {/* Mode + params */}
          <div className="stagger-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            {/* Tab toggle */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--border-subtle)" }}>
              {(["scenario", "custom"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding: "11px", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-ui)",
                  cursor: "pointer", border: "none",
                  background: mode === m ? "var(--blue-dim)" : "transparent",
                  color: mode === m ? "var(--blue)" : "var(--text-muted)",
                  borderBottom: mode === m ? "2px solid var(--blue)" : "2px solid transparent",
                  transition: "all 0.15s",
                }}>
                  {m === "scenario" ? "Named Scenario" : "Custom"}
                </button>
              ))}
            </div>

            <div style={{ padding: "16px" }}>
              {mode === "scenario" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(Array.isArray(scenarios) ? scenarios : Object.values(scenarios ?? {})).map((sc: any) => {
                    const key = sc.scenario_id ?? sc.id ?? sc.name;
                    const active = selectedScenario === key;
                    const color = SCENARIO_COLORS[key] ?? "var(--blue)";
                    return (
                      <div key={key} onClick={() => setSelectedScenario(key)} style={{
                        padding: "12px 14px", borderRadius: "var(--radius)", cursor: "pointer",
                        border: `1px solid ${active ? color : "var(--border-subtle)"}`,
                        background: active ? `color-mix(in srgb, ${color} 8%, var(--bg-elevated))` : "var(--bg-elevated)",
                        transition: "all 0.15s",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ color }}>{SCENARIO_ICONS[key] ?? "◈"}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: active ? color : "var(--text-primary)" }}>
                            {sc.name}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sc.description}</div>
                        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 4 }}>
                          rate={sc.arrival_rate}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Duration (time units)", val: String(duration), set: (v: string) => setDuration(Number(v)), type: "number" },
                    { label: "Arrival Rate",          val: String(arrivalRate), set: (v: string) => setArrivalRate(Number(v)), type: "number" },
                    { label: "Random Seed (optional)", val: seed, set: setSeed, type: "text" },
                  ].map(({ label, val, set, type }) => (
                    <div key={label}>
                      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>{label}</label>
                      <input type={type} value={val} onChange={e => set(e.target.value)}
                        style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-mono)", outline: "none" }}
                        onFocus={e => e.target.style.borderColor = "rgba(59,140,248,0.4)"}
                        onBlur={e => e.target.style.borderColor = "var(--border)"}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Run button */}
          <div className="stagger-3">
            <button
              disabled={!hospitalId || mutation.isPending || (mode === "scenario" && !selectedScenario)}
              onClick={() => mutation.mutate()}
              style={{
                width: "100%", padding: "12px", borderRadius: "var(--radius-lg)",
                fontSize: 14, fontWeight: 600, fontFamily: "var(--font-ui)", cursor: "pointer",
                border: "none",
                background: mutation.isPending ? "var(--blue-dim)" : "var(--blue)",
                color: mutation.isPending ? "var(--blue)" : "#fff",
                boxShadow: mutation.isPending ? "none" : "0 2px 12px rgba(59,140,248,0.3)",
                transition: "all 0.15s", letterSpacing: "0.02em",
                opacity: (!hospitalId || (mode === "scenario" && !selectedScenario)) ? 0.4 : 1,
              }}
            >
              {mutation.isPending ? "⟳  Running simulation…" : "▶  Run Simulation"}
            </button>
            {mutation.isError && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--red)", background: "var(--red-dim)", borderRadius: "var(--radius)", padding: "8px 12px" }}>
                {mutation.error?.message ?? "Simulation failed. Check you have Analyst/Admin role."}
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: results ── */}
        <div>
          {!outcome && !mutation.isPending && (
            <div className="stagger-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "80px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>⟳</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>No results yet</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Configure parameters and run a simulation</div>
            </div>
          )}

          {mutation.isPending && (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "80px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--blue)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", marginBottom: 16 }}>
                Running simulation…
              </div>
              <div style={{ width: 160, height: 3, background: "var(--bg-overlay)", borderRadius: 99, margin: "0 auto", overflow: "hidden" }}>
                <div style={{
                  height: "100%", background: "linear-gradient(90deg, transparent, var(--blue), transparent)",
                  backgroundSize: "200% auto", animation: "shimmer 1.2s linear infinite", borderRadius: 99,
                }} />
              </div>
            </div>
          )}

          {outcome && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* KPI grid — using correct SimulationOutcome field names */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <KpiBox label="Patients Simulated"  value={String(outcome.patients_simulated ?? "—")}       color="var(--blue)" />
                <KpiBox label="Avg Wait Time"        value={`${avgWaitMin}m`}                               color="var(--amber)" sub="from avg_wait_time_seconds" />
                <KpiBox label="Peak Utilization"     value={`${outcome.peak_resource_utilization?.toFixed(1) ?? "—"}%`} color="var(--orange)" />
                <KpiBox label="Events Logged"        value={String(outcome.events_logged ?? "—")}           color="var(--emerald)" />
              </div>

              {/* Worst bottleneck */}
              {outcome.worst_bottleneck && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--red)", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Worst Bottleneck</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--red)" }}>{outcome.worst_bottleneck}</div>
                  </div>
                </div>
              )}

              {/* Insights */}
              {outcome.insights?.length > 0 && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-subtle)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Insights ({outcome.insights.length})
                  </div>
                  <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {outcome.insights.map((ins, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                        <span style={{ color: "var(--blue)", flexShrink: 0, marginTop: 2 }}>→</span>
                        <span style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{ins}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottleneck summary */}
              {outcome.bottleneck_summary?.length > 0 && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-subtle)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Bottleneck Summary
                  </div>
                  <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {outcome.bottleneck_summary.map((b, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 110, fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 }}>{b.department}</div>
                        <div style={{ flex: 1, height: 5, background: "var(--bg-overlay)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 99,
                            background: b.severity === "critical" ? "var(--red)" : b.severity === "medium" ? "var(--amber)" : "var(--blue)",
                            width: `${Math.min((b.avg_delay_min / 60) * 100, 100)}%`,
                            transition: "width 0.8s ease",
                          }} />
                        </div>
                        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", width: 40, textAlign: "right", flexShrink: 0 }}>
                          {b.avg_delay_min?.toFixed(1)}m
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Capacity summary */}
              {outcome.capacity_summary?.length > 0 && (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-subtle)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Capacity Utilization
                  </div>
                  <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {outcome.capacity_summary.map((c, i) => (
                      <div key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.resource}</span>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: c.utilization_pct >= 90 ? "var(--red)" : c.utilization_pct >= 75 ? "var(--amber)" : "var(--emerald)" }}>
                            {c.utilization_pct?.toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ height: 5, background: "var(--bg-overlay)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 99,
                            width: `${(c.utilization_pct / maxUtil) * 100}%`,
                            background: c.utilization_pct >= 90 ? "var(--red)" : c.utilization_pct >= 75 ? "var(--amber)" : "var(--emerald)",
                            transition: "width 0.8s ease",
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}