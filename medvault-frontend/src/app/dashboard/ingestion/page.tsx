"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fetchHospitals } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

const EVENT_TYPES = [
  { value: "arrival",          label: "Patient Arrival",       icon: "→", desc: "Patient enters the department" },
  { value: "departure",       label: "Patient Departure",     icon: "←", desc: "Patient leaves the department" },
  { value: "transfer",        label: "Transfer",              icon: "⇄", desc: "Patient transferred between departments" },
  { value: "resource_request", label: "Resource Request",     icon: "◇", desc: "Resource was requested (bed, equipment)" },
  { value: "resource_release", label: "Resource Release",     icon: "◆", desc: "Resource was released back to pool" },
  { value: "wait_start",      label: "Wait Start",            icon: "⏳", desc: "Patient began waiting for service" },
  { value: "wait_end",        label: "Wait End",              icon: "✓", desc: "Patient finished waiting" },
];

type FeedbackType = "success" | "error" | null;

function Feedback({ type, message, onClose }: { type: FeedbackType; message: string; onClose: () => void }) {
  if (!type) return null;
  const isSuccess = type === "success";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
      background: isSuccess ? "var(--emerald-dim)" : "var(--red-dim)",
      border: `1px solid ${isSuccess ? "rgba(16,201,138,0.3)" : "rgba(240,68,68,0.3)"}`,
      borderRadius: 10, marginBottom: 16,
      animation: "fade-up 0.3s ease",
    }}>
      <span style={{ fontSize: 16 }}>{isSuccess ? "✓" : "⚠"}</span>
      <span style={{ flex: 1, fontSize: 13, color: isSuccess ? "var(--emerald)" : "var(--red)" }}>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: 4 }}>×</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text-primary)",
  fontFamily: "var(--font-ui)", outline: "none", boxSizing: "border-box",
  transition: "border-color 0.15s",
};

export default function IngestionPage() {
  const { data: hospitals = [] } = useQuery({ queryKey: ["hospitals"], queryFn: fetchHospitals });

  // Single event form state
  const [hospitalId, setHospitalId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [eventType, setEventType] = useState("arrival");
  const [timestamp, setTimestamp] = useState("");
  const [patientId, setPatientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: FeedbackType; message: string }>({ type: null, message: "" });

  // Bulk upload state
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: FeedbackType; message: string }>({ type: null, message: "" });

  // Fetch departments for selected hospital
  const { data: departments = [] } = useQuery({
    queryKey: ["departments", hospitalId],
    queryFn: () => api.get(`/departments?hospital_id=${hospitalId}`).then((r: any) => r.data),
    enabled: !!hospitalId,
  });

  // Fetch resources for selected department
  const { data: resources = [] } = useQuery({
    queryKey: ["resources", departmentId],
    queryFn: () => api.get(`/resources?department_id=${departmentId}`).then((r: any) => r.data),
    enabled: !!departmentId,
  });

  // Stats
  const { data: recentEvents } = useQuery({
    queryKey: ["recent-events", hospitalId],
    queryFn: () => api.get(`/flow-events?hospital_id=${hospitalId}&limit=5`).then((r: any) => r.data),
    enabled: !!hospitalId,
  });

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: null, message: "" });
    try {
      await api.post(`/ingestion/events`, [{
        hospital_id: Number(hospitalId),
        department_id: departmentId ? Number(departmentId) : null,
        resource_id: resourceId ? Number(resourceId) : null,
        event_type: eventType,
        timestamp: timestamp || new Date().toISOString(),
        patient_id: patientId || null,
      }]);
      setFeedback({ type: "success", message: "Event ingested successfully! The analytics will update shortly." });
      // Reset some fields
      setPatientId("");
      setTimestamp("");
    } catch (err: any) {
      setFeedback({ type: "error", message: err.response?.data?.detail ?? "Failed to ingest event. Check your inputs and try again." });
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkGenerate() {
    if (!hospitalId) return;
    setBulkLoading(true);
    setBulkFeedback({ type: null, message: "" });
    try {
      // Generate 50 sample events for the hospital
      const now = new Date();
      const events = [];
      for (let i = 0; i < 50; i++) {
        const depts = departments as any[];
        const dept = depts.length > 0 ? depts[Math.floor(Math.random() * depts.length)] : null;
        const offsetHours = Math.floor(Math.random() * 72);
        const ts = new Date(now.getTime() - offsetHours * 60 * 60 * 1000);
        events.push({
          hospital_id: Number(hospitalId),
          department_id: dept?.id ?? null,
          resource_id: null,
          event_type: EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)].value,
          timestamp: ts.toISOString(),
          patient_id: `P-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        });
      }
      await api.post(`/ingestion/events`, events);
      setBulkFeedback({ type: "success", message: `Successfully generated and ingested 50 flow events for analytics.` });
    } catch (err: any) {
      setBulkFeedback({ type: "error", message: err.response?.data?.detail ?? "Bulk ingestion failed." });
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "var(--font-ui)", color: "var(--text-primary)" }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
          Analytics · Data Ingestion
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>Data Ingestion</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
          Import patient flow events into the analytics pipeline. Events drive bottleneck detection, capacity analysis, and system health metrics.
        </p>
      </div>

      {/* About section */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "12px 18px", marginBottom: 24, borderLeft: "3px solid var(--blue)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--blue)", marginBottom: 4 }}>How it works</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Flow events represent patient movements through hospital departments: arrivals, transfers, resource requests, and departures.
          Each event feeds into the analytics engines that compute KPIs, detect bottlenecks, and generate recommendations on the dashboard.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>

        {/* Single event form */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "24px 28px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Manual Event Entry</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>Add a single flow event to the analytics pipeline.</div>

          <Feedback type={feedback.type} message={feedback.message} onClose={() => setFeedback({ type: null, message: "" })} />

          <form onSubmit={handleSingleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Hospital">
                <select value={hospitalId} onChange={e => { setHospitalId(e.target.value); setDepartmentId(""); setResourceId(""); }} required style={inp}>
                  <option value="">Select hospital…</option>
                  {hospitals.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </Field>
              <Field label="Department">
                <select value={departmentId} onChange={e => { setDepartmentId(e.target.value); setResourceId(""); }} style={inp} disabled={!hospitalId}>
                  <option value="">Any department</option>
                  {(departments as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Resource">
                <select value={resourceId} onChange={e => setResourceId(e.target.value)} style={inp} disabled={!departmentId}>
                  <option value="">Any resource</option>
                  {(resources as any[]).map((r: any) => <option key={r.id} value={r.id}>{r.name} ({r.resource_type})</option>)}
                </select>
              </Field>
              <Field label="Timestamp">
                <input type="datetime-local" value={timestamp} onChange={e => setTimestamp(e.target.value)} style={inp} />
              </Field>
            </div>

            <Field label="Event Type">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6 }}>
                {EVENT_TYPES.map(et => (
                  <div key={et.value} onClick={() => setEventType(et.value)} style={{
                    padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                    background: eventType === et.value ? "var(--blue-dim)" : "var(--bg-elevated)",
                    border: `1px solid ${eventType === et.value ? "rgba(59,140,248,0.4)" : "var(--border-subtle)"}`,
                    transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, opacity: 0.6 }}>{et.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: eventType === et.value ? 600 : 400, color: eventType === et.value ? "var(--blue)" : "var(--text-secondary)" }}>{et.label}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{et.desc}</div>
                  </div>
                ))}
              </div>
            </Field>

            <Field label="Patient ID (optional)">
              <input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="e.g. P-A3F2B1" style={inp} />
            </Field>

            <button type="submit" disabled={loading || !hospitalId} style={{
              padding: "11px", background: "var(--blue)", border: "none", borderRadius: 8,
              color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "var(--font-ui)", opacity: loading ? 0.7 : 1, transition: "opacity 0.15s",
            }}>
              {loading ? "Ingesting…" : "Submit Event"}
            </button>
          </form>
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Quick generate */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "20px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Quick Generate</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Generate 50 sample flow events for the selected hospital. Useful for quickly populating analytics data.
            </div>
            <Feedback type={bulkFeedback.type} message={bulkFeedback.message} onClose={() => setBulkFeedback({ type: null, message: "" })} />
            <button onClick={handleBulkGenerate} disabled={bulkLoading || !hospitalId} style={{
              width: "100%", padding: "10px", background: "var(--emerald)", border: "none", borderRadius: 8,
              color: "#fff", fontSize: 13, fontWeight: 600, cursor: bulkLoading || !hospitalId ? "not-allowed" : "pointer",
              fontFamily: "var(--font-ui)", opacity: bulkLoading || !hospitalId ? 0.5 : 1,
            }}>
              {bulkLoading ? "Generating…" : "Generate 50 events"}
            </button>
          </div>

          {/* Recently ingested */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "20px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Recent Events</div>
            {!hospitalId ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>Select a hospital to see recent events</div>
            ) : !(recentEvents as any[])?.length ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>No events yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(recentEvents as any[]).slice(0, 5).map((ev: any, i: number) => (
                  <div key={ev.id ?? i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--bg-elevated)", borderRadius: 6, borderLeft: "3px solid var(--blue)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                        {ev.event_type?.replace(/_/g, " ")}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {ev.patient_id ? `Patient: ${ev.patient_id}` : "System event"} · {new Date(ev.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event type legend */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "20px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Event Types</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {EVENT_TYPES.map(et => (
                <div key={et.value} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, width: 16, textAlign: "center", opacity: 0.5 }}>{et.icon}</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{et.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}