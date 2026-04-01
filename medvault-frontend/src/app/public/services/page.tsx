"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Hospital { id: number; name: string; location: string; capacity: number; }
interface Bed       { id: number; ward: string; bed_number: string; bed_type: string; is_available: boolean; }
interface Doctor    { id: number; name: string; specialty: string; qualification?: string; available_days: string; start_time: string; end_time: string; fee: number; slot_duration_min: number; }
interface Slot      { time: string; available: boolean; }

type ServiceType = "bed" | "appointment" | "ambulance" | null;
type Step        = "select" | "form" | "confirmed";

// ── Helpers ───────────────────────────────────────────────────────────────────
function useHospitals() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loaded, setLoaded]       = useState(false);
  if (!loaded) {
    setLoaded(true);
    axios.get(`${API}/public/hospitals`).then(r => setHospitals(r.data)).catch(() => {});
  }
  return hospitals;
}

async function fetchBeds(hospitalId: number): Promise<Bed[]> {
  const r = await axios.get(`${API}/public/services/beds`, { params: { hospital_id: hospitalId } });
  return r.data;
}
async function fetchDoctors(hospitalId: number): Promise<Doctor[]> {
  const r = await axios.get(`${API}/public/services/doctors`, { params: { hospital_id: hospitalId } });
  return r.data;
}
async function fetchSlots(doctorId: number, date: string): Promise<Slot[]> {
  const r = await axios.get(`${API}/public/services/doctors/${doctorId}/slots`, { params: { date } });
  return r.data;
}

// ── Shared UI components ───────────────────────────────────────────────────────
const input = {
  width: "100%", background: "#0f1a2e", border: "1px solid #1e3350",
  borderRadius: 8, padding: "10px 14px", fontSize: 14,
  color: "#ddeeff", fontFamily: "var(--font-ui, 'Plus Jakarta Sans', sans-serif)",
  outline: "none", boxSizing: "border-box" as const,
};
const label = { fontSize: 11, fontWeight: 600 as const, color: "#7a9ec0", textTransform: "uppercase" as const, letterSpacing: "0.08em", display: "block", marginBottom: 5 };
const btn = (primary = true) => ({
  padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600 as const,
  cursor: "pointer", border: "none", fontFamily: "inherit",
  background: primary ? "#3b8cf8" : "transparent",
  color: primary ? "#fff" : "#7a9ec0",
  transition: "all 0.15s",
  ...(primary ? { boxShadow: "0 2px 10px rgba(59,140,248,0.25)" } : { border: "1px solid #1e3350" }),
});

function Field({ label: l, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={label}>{l}</label>{children}</div>;
}

function ConfirmationCard({ title, reference, icon, detail, color, onNew }:
  { title: string; reference: string; icon: string; detail: React.ReactNode; color: string; onNew: () => void }) {
  return (
    <div style={{ background: "#0f1a2e", border: `1px solid ${color}30`, borderRadius: 16, padding: 32, textAlign: "center", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>{icon}</div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${color}15`, borderRadius: 99, padding: "4px 14px", marginBottom: 16 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
        <span style={{ fontSize: 11, fontWeight: 600, color, letterSpacing: "0.1em", textTransform: "uppercase" }}>Confirmed</span>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ddeeff", margin: "0 0 8px" }}>{title}</h3>
      <div style={{ background: "#132038", borderRadius: 8, padding: "10px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "#7a9ec0", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Booking Reference</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color, letterSpacing: "0.15em" }}>{reference}</div>
      </div>
      <div style={{ fontSize: 13, color: "#7a9ec0", textAlign: "left", marginBottom: 20 }}>{detail}</div>
      <div style={{ fontSize: 11, color: "#3d5878", marginBottom: 20 }}>Save this reference to track your booking status.</div>
      <button onClick={onNew} style={btn()}>Make another booking</button>
    </div>
  );
}

// ── BED BOOKING FLOW ─────────────────────────────────────────────────────────
function BedFlow({ hospitals, onBack }: { hospitals: Hospital[]; onBack: () => void }) {
  const [step, setStep]           = useState<"setup" | "select" | "form" | "done">("setup");
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [beds, setBeds]           = useState<Bed[]>([]);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<any>(null);
  const [form, setForm]           = useState({ patient_name: "", patient_phone: "", patient_age: "", reason: "" });

  async function loadBeds(hid: number) {
    setLoading(true);
    const data = await fetchBeds(hid).catch(() => []);
    setBeds(data); setLoading(false); setStep("select");
  }

  async function submit() {
    if (!selectedBed || !hospitalId) return;
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/services/beds/book`, {
        bed_id: selectedBed.id, hospital_id: hospitalId,
        patient_name: form.patient_name, patient_phone: form.patient_phone,
        patient_age: form.patient_age ? Number(form.patient_age) : null,
        reason: form.reason,
      });
      setResult(r.data); setStep("done");
    } catch (e: any) {
      alert(e.response?.data?.detail ?? "Booking failed");
    } finally { setLoading(false); }
  }

  const typeColors: Record<string, string> = { general: "#3b8cf8", icu: "#f04444", emergency: "#f97316", maternity: "#a78bfa", paediatric: "#10c98a" };
  const available = beds.filter(b => b.is_available);

  if (step === "done" && result) {
    return <ConfirmationCard title="Bed Booked Successfully" reference={result.reference} icon="🏥"
      color="#10c98a"
      detail={<>Your bed has been reserved. Please arrive at the hospital reception and present this reference number.</>}
      onNew={() => { setStep("setup"); setResult(null); setForm({ patient_name: "", patient_phone: "", patient_age: "", reason: "" }); }} />;
  }

  return (
    <div>
      <button onClick={onBack} style={{ ...btn(false), marginBottom: 24, padding: "6px 12px", fontSize: 12 }}>← Back</button>

      {step === "setup" && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ddeeff", marginBottom: 4 }}>Book a Hospital Bed</h3>
          <p style={{ fontSize: 13, color: "#7a9ec0", marginBottom: 20 }}>Select a hospital to see available beds.</p>
          <Field label="Hospital">
            <select style={input} onChange={e => setHospitalId(e.target.value ? Number(e.target.value) : null)} defaultValue="">
              <option value="" disabled>Choose hospital</option>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} — {h.location}</option>)}
            </select>
          </Field>
          <button onClick={() => hospitalId && loadBeds(hospitalId)} disabled={!hospitalId || loading}
            style={{ ...btn(), width: "100%", padding: "11px" }}>
            {loading ? "Loading beds…" : "Find Available Beds →"}
          </button>
        </div>
      )}

      {step === "select" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ddeeff", margin: 0 }}>Available Beds</h3>
              <p style={{ fontSize: 12, color: "#7a9ec0", margin: "3px 0 0" }}>{available.length} beds available</p>
            </div>
            <button onClick={() => setStep("setup")} style={{ ...btn(false), padding: "5px 10px", fontSize: 11 }}>← Change hospital</button>
          </div>
          {available.length === 0
            ? <div style={{ textAlign: "center", padding: 32, color: "#3d5878", fontSize: 13 }}>No beds currently available at this hospital.</div>
            : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                {available.map(b => {
                  const c = typeColors[b.bed_type] ?? "#3b8cf8";
                  const active = selectedBed?.id === b.id;
                  return (
                    <div key={b.id} onClick={() => setSelectedBed(b)} style={{
                      padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${active ? c : "#1e3350"}`,
                      background: active ? `${c}12` : "#132038",
                      transition: "all 0.15s",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? c : "#ddeeff", fontFamily: "monospace" }}>{b.bed_number}</div>
                      <div style={{ fontSize: 11, color: "#7a9ec0", marginTop: 3 }}>{b.ward}</div>
                      <div style={{ marginTop: 6, display: "inline-block", background: `${c}18`, color: c, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "2px 7px", borderRadius: 99 }}>
                        {b.bed_type}
                      </div>
                    </div>
                  );
                })}
              </div>
          }
          <button onClick={() => setStep("form")} disabled={!selectedBed}
            style={{ ...btn(), width: "100%", padding: "11px", opacity: selectedBed ? 1 : 0.4 }}>
            Continue with {selectedBed?.bed_number ?? "selected bed"} →
          </button>
        </div>
      )}

      {step === "form" && selectedBed && (
        <div>
          <div style={{ background: "#132038", borderRadius: 8, padding: "10px 14px", marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 18 }}>🛏</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#ddeeff" }}>Bed {selectedBed.bed_number} — {selectedBed.ward}</div>
              <div style={{ fontSize: 11, color: "#7a9ec0" }}>{selectedBed.bed_type} bed</div>
            </div>
            <button onClick={() => setStep("select")} style={{ marginLeft: "auto", ...btn(false), padding: "4px 10px", fontSize: 11 }}>Change</button>
          </div>
          <Field label="Patient Name"><input style={input} placeholder="Full name" value={form.patient_name} onChange={e => setForm({ ...form, patient_name: e.target.value })} /></Field>
          <Field label="Phone Number"><input style={input} placeholder="+91 XXXXX XXXXX" value={form.patient_phone} onChange={e => setForm({ ...form, patient_phone: e.target.value })} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Age"><input style={input} type="number" placeholder="Age" value={form.patient_age} onChange={e => setForm({ ...form, patient_age: e.target.value })} /></Field>
          </div>
          <Field label="Reason for Admission"><textarea style={{ ...input, minHeight: 72, resize: "vertical" as const }} placeholder="Brief reason or diagnosis (optional)" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></Field>
          <button onClick={submit} disabled={loading || !form.patient_name || !form.patient_phone}
            style={{ ...btn(), width: "100%", padding: "11px", opacity: (!form.patient_name || !form.patient_phone) ? 0.4 : 1 }}>
            {loading ? "Confirming…" : "Confirm Bed Booking"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── APPOINTMENT FLOW ──────────────────────────────────────────────────────────
function AppointmentFlow({ hospitals, onBack }: { hospitals: Hospital[]; onBack: () => void }) {
  const [step, setStep]           = useState<"setup" | "doctor" | "slot" | "form" | "done">("setup");
  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [doctors, setDoctors]     = useState<Doctor[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Doctor | null>(null);
  const [slots, setSlots]         = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<any>(null);
  const [form, setForm]           = useState({ patient_name: "", patient_phone: "", patient_age: "", symptoms: "" });

  const today = new Date().toISOString().split("T")[0];

  async function loadDoctors(hid: number) {
    setLoading(true);
    const data = await fetchDoctors(hid).catch(() => []);
    setDoctors(data); setLoading(false); setStep("doctor");
  }

  async function loadSlots(doc: Doctor, d: string) {
    if (!d) return;
    setLoading(true);
    const data = await fetchSlots(doc.id, d).catch(() => []);
    setSlots(data); setLoading(false);
  }

  async function submit() {
    if (!selectedDoc || !hospitalId || !selectedSlot || !selectedDate) return;
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/services/appointments/book`, {
        doctor_id: selectedDoc.id, hospital_id: hospitalId,
        patient_name: form.patient_name, patient_phone: form.patient_phone,
        patient_age: form.patient_age ? Number(form.patient_age) : null,
        symptoms: form.symptoms,
        appointment_date: selectedDate, appointment_time: selectedSlot,
      });
      setResult(r.data); setStep("done");
    } catch (e: any) {
      alert(e.response?.data?.detail ?? "Booking failed");
    } finally { setLoading(false); }
  }

  if (step === "done" && result) {
    return <ConfirmationCard title="Appointment Confirmed" reference={result.reference} icon="👨‍⚕️"
      color="#3b8cf8"
      detail={<>Your appointment with <strong style={{ color: "#ddeeff" }}>{selectedDoc?.name}</strong> is confirmed for <strong style={{ color: "#ddeeff" }}>{selectedDate}</strong> at <strong style={{ color: "#ddeeff" }}>{selectedSlot}</strong>.</>}
      onNew={() => { setStep("setup"); setResult(null); setForm({ patient_name: "", patient_phone: "", patient_age: "", symptoms: "" }); }} />;
  }

  return (
    <div>
      <button onClick={onBack} style={{ ...btn(false), marginBottom: 24, padding: "6px 12px", fontSize: 12 }}>← Back</button>

      {step === "setup" && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ddeeff", marginBottom: 4 }}>Book a Doctor Appointment</h3>
          <p style={{ fontSize: 13, color: "#7a9ec0", marginBottom: 20 }}>Select a hospital to browse available doctors.</p>
          <Field label="Hospital">
            <select style={input} onChange={e => setHospitalId(e.target.value ? Number(e.target.value) : null)} defaultValue="">
              <option value="" disabled>Choose hospital</option>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} — {h.location}</option>)}
            </select>
          </Field>
          <button onClick={() => hospitalId && loadDoctors(hospitalId)} disabled={!hospitalId || loading}
            style={{ ...btn(), width: "100%", padding: "11px" }}>
            {loading ? "Loading doctors…" : "Find Doctors →"}
          </button>
        </div>
      )}

      {step === "doctor" && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ddeeff", marginBottom: 4 }}>Choose a Doctor</h3>
          <p style={{ fontSize: 12, color: "#7a9ec0", marginBottom: 16 }}>{doctors.length} doctors available</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 380, overflowY: "auto", paddingRight: 4, marginBottom: 16 }}>
            {doctors.map(d => {
              const active = selectedDoc?.id === d.id;
              return (
                <div key={d.id} onClick={() => setSelectedDoc(d)} style={{
                  padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                  border: `1px solid ${active ? "#3b8cf8" : "#1e3350"}`,
                  background: active ? "rgba(59,140,248,0.08)" : "#132038",
                  transition: "all 0.15s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: active ? "#3b8cf8" : "#ddeeff" }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: "#7a9ec0", marginTop: 2 }}>{d.specialty}</div>
                      {d.qualification && <div style={{ fontSize: 10, color: "#3d5878", marginTop: 2 }}>{d.qualification}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#10c98a", fontFamily: "monospace" }}>₹{d.fee}</div>
                      <div style={{ fontSize: 10, color: "#3d5878" }}>{d.slot_duration_min}min slots</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#3d5878", marginTop: 8 }}>
                    Available: {d.available_days} · {d.start_time}–{d.end_time}
                  </div>
                </div>
              );
            })}
          </div>
          {selectedDoc && (
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Select Date</label>
              <input type="date" style={input} min={today} value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); loadSlots(selectedDoc, e.target.value); }} />
            </div>
          )}
          <button onClick={() => setStep("slot")} disabled={!selectedDoc || !selectedDate || slots.length === 0}
            style={{ ...btn(), width: "100%", padding: "11px", opacity: (!selectedDoc || !selectedDate) ? 0.4 : 1 }}>
            {loading ? "Loading slots…" : "Choose Time Slot →"}
          </button>
        </div>
      )}

      {step === "slot" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ddeeff", margin: "0 0 2px" }}>Select Time Slot</h3>
            <p style={{ fontSize: 12, color: "#7a9ec0", margin: 0 }}>{selectedDoc?.name} · {selectedDate}</p>
          </div>
          {slots.length === 0
            ? <div style={{ textAlign: "center", padding: 24, color: "#3d5878" }}>No slots available for this date.</div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                {slots.map(s => (
                  <div key={s.time} onClick={() => s.available && setSelectedSlot(s.time)} style={{
                    padding: "8px 4px", textAlign: "center", borderRadius: 6, fontSize: 12, fontFamily: "monospace",
                    cursor: s.available ? "pointer" : "not-allowed",
                    border: `1px solid ${selectedSlot === s.time ? "#3b8cf8" : s.available ? "#1e3350" : "#0f1928"}`,
                    background: selectedSlot === s.time ? "rgba(59,140,248,0.12)" : s.available ? "#132038" : "#0a111e",
                    color: selectedSlot === s.time ? "#3b8cf8" : s.available ? "#7a9ec0" : "#2a3a50",
                    transition: "all 0.12s",
                  }}>
                    {s.time}
                  </div>
                ))}
              </div>
          }
          <button onClick={() => setStep("form")} disabled={!selectedSlot}
            style={{ ...btn(), width: "100%", padding: "11px", opacity: !selectedSlot ? 0.4 : 1 }}>
            Continue →
          </button>
        </div>
      )}

      {step === "form" && (
        <div>
          <div style={{ background: "#132038", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#ddeeff" }}>{selectedDoc?.name}</div>
            <div style={{ fontSize: 11, color: "#7a9ec0" }}>{selectedDate} at {selectedSlot} · ₹{selectedDoc?.fee}</div>
          </div>
          <Field label="Patient Name"><input style={input} placeholder="Full name" value={form.patient_name} onChange={e => setForm({ ...form, patient_name: e.target.value })} /></Field>
          <Field label="Phone Number"><input style={input} placeholder="+91 XXXXX XXXXX" value={form.patient_phone} onChange={e => setForm({ ...form, patient_phone: e.target.value })} /></Field>
          <Field label="Age"><input style={input} type="number" placeholder="Patient age" value={form.patient_age} onChange={e => setForm({ ...form, patient_age: e.target.value })} /></Field>
          <Field label="Symptoms / Reason for Visit">
            <textarea style={{ ...input, minHeight: 72, resize: "vertical" as const }} placeholder="Describe symptoms briefly (optional)" value={form.symptoms} onChange={e => setForm({ ...form, symptoms: e.target.value })} />
          </Field>
          <button onClick={submit} disabled={loading || !form.patient_name || !form.patient_phone}
            style={{ ...btn(), width: "100%", padding: "11px", opacity: (!form.patient_name || !form.patient_phone) ? 0.4 : 1 }}>
            {loading ? "Booking…" : "Confirm Appointment"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── AMBULANCE FLOW ────────────────────────────────────────────────────────────
function AmbulanceFlow({ hospitals, onBack }: { hospitals: Hospital[]; onBack: () => void }) {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<any>(null);
  const [form, setForm]         = useState({
    hospital_id: "", patient_name: "", patient_phone: "",
    pickup_address: "", emergency_type: "medical", priority: "high", notes: "",
  });

  async function submit() {
    if (!form.hospital_id || !form.patient_name || !form.patient_phone || !form.pickup_address) return;
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/services/ambulance/request`, {
        ...form, hospital_id: Number(form.hospital_id),
      });
      setResult(r.data);
    } catch (e: any) {
      alert(e.response?.data?.detail ?? "Request failed");
    } finally { setLoading(false); }
  }

  const priorityColor = { critical: "#f04444", high: "#f97316", normal: "#3b8cf8" };

  if (result) {
    return <ConfirmationCard title="Ambulance Dispatched" reference={result.reference} icon="🚑"
      color="#f04444"
      detail={<>An ambulance has been dispatched to your location. Estimated arrival: <strong style={{ color: "#f04444" }}>{result.eta_minutes} minutes</strong>. Keep your phone available.</>}
      onNew={() => setResult(null)} />;
  }

  return (
    <div>
      <button onClick={onBack} style={{ ...btn(false), marginBottom: 24, padding: "6px 12px", fontSize: 12 }}>← Back</button>
      <div style={{ background: "rgba(240,68,68,0.06)", border: "1px solid rgba(240,68,68,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#f04444" }}>
        ⚠ For life-threatening emergencies, also call 108 immediately.
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ddeeff", marginBottom: 4 }}>Request an Ambulance</h3>
      <p style={{ fontSize: 13, color: "#7a9ec0", marginBottom: 20 }}>We'll dispatch the nearest available ambulance to your location.</p>

      <Field label="Nearest Hospital">
        <select style={input} value={form.hospital_id} onChange={e => setForm({ ...form, hospital_id: e.target.value })}>
          <option value="" disabled>Choose nearest hospital</option>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} — {h.location}</option>)}
        </select>
      </Field>
      <Field label="Patient Name"><input style={input} placeholder="Full name" value={form.patient_name} onChange={e => setForm({ ...form, patient_name: e.target.value })} /></Field>
      <Field label="Contact Phone"><input style={input} placeholder="+91 XXXXX XXXXX" value={form.patient_phone} onChange={e => setForm({ ...form, patient_phone: e.target.value })} /></Field>
      <Field label="Pickup Address">
        <textarea style={{ ...input, minHeight: 72, resize: "vertical" as const }} placeholder="Full address with landmark" value={form.pickup_address} onChange={e => setForm({ ...form, pickup_address: e.target.value })} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Emergency Type">
          <select style={input} value={form.emergency_type} onChange={e => setForm({ ...form, emergency_type: e.target.value })}>
            {["medical", "trauma", "cardiac", "maternity", "other"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select style={input} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
            {(["critical", "high", "normal"] as const).map(p => (
              <option key={p} value={p} style={{ color: priorityColor[p] }}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Additional Notes">
        <input style={input} placeholder="Any relevant medical info (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
      </Field>

      <button onClick={submit} disabled={loading || !form.hospital_id || !form.patient_name || !form.patient_phone || !form.pickup_address}
        style={{ ...btn(), width: "100%", padding: "12px", background: "#f04444", boxShadow: "0 2px 12px rgba(240,68,68,0.3)", fontSize: 14, opacity: (!form.hospital_id || !form.patient_name || !form.patient_phone || !form.pickup_address) ? 0.5 : 1 }}>
        {loading ? "Dispatching…" : "🚑 Request Ambulance Now"}
      </button>
    </div>
  );
}

// ── STATUS CHECK ──────────────────────────────────────────────────────────────
function StatusCheck({ onBack }: { onBack: () => void }) {
  const [ref, setRef]       = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError]   = useState("");

  async function check() {
    if (!ref.trim()) return;
    setLoading(true); setError("");
    try {
      const r = await axios.get(`${API}/public/services/booking/${ref.trim().toUpperCase()}`);
      setResult(r.data);
    } catch {
      setError("No booking found with this reference."); setResult(null);
    } finally { setLoading(false); }
  }

  const typeColor: Record<string, string> = { bed: "#10c98a", appointment: "#3b8cf8", ambulance: "#f04444" };
  const typeIcon:  Record<string, string> = { bed: "🛏", appointment: "👨‍⚕️", ambulance: "🚑" };

  return (
    <div>
      <button onClick={onBack} style={{ ...btn(false), marginBottom: 24, padding: "6px 12px", fontSize: 12 }}>← Back</button>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ddeeff", marginBottom: 4 }}>Track Booking Status</h3>
      <p style={{ fontSize: 13, color: "#7a9ec0", marginBottom: 20 }}>Enter your 8-character booking reference.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input style={{ ...input, flex: 1, fontFamily: "monospace", fontSize: 16, letterSpacing: "0.1em", textTransform: "uppercase" }}
          placeholder="e.g. A3F2C9B1" value={ref} onChange={e => setRef(e.target.value.toUpperCase())} maxLength={8}
          onKeyDown={e => e.key === "Enter" && check()} />
        <button onClick={check} disabled={loading || ref.length < 8} style={btn()}>
          {loading ? "…" : "Check"}
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: "#f04444", background: "rgba(240,68,68,0.08)", borderRadius: 8, padding: "10px 14px" }}>{error}</div>}

      {result && (
        <div style={{ background: "#132038", border: `1px solid ${typeColor[result.type] ?? "#1e3350"}30`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 24 }}>{typeIcon[result.type]}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ddeeff" }}>{result.patient_name}</div>
              <div style={{ fontSize: 11, color: "#7a9ec0" }}>{result.type.charAt(0).toUpperCase() + result.type.slice(1)} booking</div>
            </div>
            <div style={{ marginLeft: "auto", background: `${typeColor[result.type]}18`, color: typeColor[result.type], fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 99 }}>
              {result.status}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(result.detail).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                <span style={{ color: "#3d5878", minWidth: 80, textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                <span style={{ color: "#7a9ec0", fontFamily: typeof v === "number" ? "monospace" : "inherit" }}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
const SERVICES = [
  { key: "bed",         icon: "🛏",  title: "Book a Bed",         desc: "Reserve an inpatient bed across ward types — general, ICU, maternity & more.", color: "#10c98a" },
  { key: "appointment", icon: "👨‍⚕️", title: "Doctor Appointment",  desc: "Browse specialists and book a consultation slot that fits your schedule.",     color: "#3b8cf8" },
  { key: "ambulance",   icon: "🚑",  title: "Request Ambulance",  desc: "Dispatch an emergency vehicle to your location. Available 24/7.",               color: "#f04444" },
] as const;

export default function ServicesPage() {
  const hospitals               = useHospitals();
  const [active, setActive]     = useState<ServiceType>(null);
  const [tracking, setTracking] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#0b1220", fontFamily: "var(--font-ui, 'Plus Jakarta Sans', sans-serif)", color: "#ddeeff" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');`}</style>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(11,18,32,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1e3350", padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/public" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(59,140,248,0.12)", border: "1px solid rgba(59,140,248,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><polyline points="0,5 3,5 5,1 7,9 9,3 11,6 12,5 16,5" stroke="#3b8cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#ddeeff" }}>MedVault</span>
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setActive(null); setTracking(true); }} style={{ ...btn(false), fontSize: 11, padding: "6px 12px" }}>Track Booking</button>
          <Link href="/login" style={{ ...btn(), fontSize: 11, padding: "6px 12px", textDecoration: "none" }}>Staff Login</Link>
        </div>
      </nav>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px" }}>

        {/* Landing */}
        {!active && !tracking && (
          <>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(59,140,248,0.1)", border: "1px solid rgba(59,140,248,0.2)", borderRadius: 99, padding: "4px 14px", marginBottom: 16 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10c98a" }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: "#10c98a", letterSpacing: "0.1em" }}>SERVICES AVAILABLE 24/7</span>
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: "#ddeeff", margin: "0 0 10px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                Patient Services Portal
              </h1>
              <p style={{ fontSize: 15, color: "#7a9ec0", margin: 0, lineHeight: 1.6 }}>
                Book beds, schedule appointments, and request emergency services — no login required.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {SERVICES.map(s => (
                <div key={s.key} onClick={() => setActive(s.key)} style={{
                  background: "#0f1a2e", border: "1px solid #1e3350",
                  borderRadius: 14, padding: "22px 24px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 18,
                  transition: "all 0.18s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${s.color}40`; e.currentTarget.style.background = `${s.color}06`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e3350"; e.currentTarget.style.background = "#0f1a2e"; }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: `${s.color}12`, border: `1px solid ${s.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#ddeeff", marginBottom: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: "#7a9ec0", lineHeight: 1.5 }}>{s.desc}</div>
                  </div>
                  <div style={{ color: s.color, fontSize: 18, flexShrink: 0 }}>→</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button onClick={() => setTracking(true)} style={{ ...btn(false), fontSize: 12 }}>
                Already booked? Track your booking →
              </button>
            </div>
          </>
        )}

        {/* Service panel */}
        {(active || tracking) && (
          <div style={{ background: "#0f1a2e", border: "1px solid #1e3350", borderRadius: 16, padding: 28 }}>
            {active === "bed"         && <BedFlow hospitals={hospitals} onBack={() => setActive(null)} />}
            {active === "appointment" && <AppointmentFlow hospitals={hospitals} onBack={() => setActive(null)} />}
            {active === "ambulance"   && <AmbulanceFlow hospitals={hospitals} onBack={() => setActive(null)} />}
            {tracking                 && <StatusCheck onBack={() => setTracking(false)} />}
          </div>
        )}
      </div>
    </div>
  );
}