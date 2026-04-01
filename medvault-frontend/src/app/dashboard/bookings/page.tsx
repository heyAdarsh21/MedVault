"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { fetchHospitals } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

type Tab = "bed" | "ambulance" | "appointment";

const PRIORITIES = ["critical", "high", "normal"];
const EMERGENCY_TYPES = ["medical", "trauma", "cardiac", "maternity", "other"];

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 16px", borderRadius: 99, fontSize: 13, fontWeight: active ? 600 : 400,
      cursor: "pointer", fontFamily: "var(--font-ui)", transition: "all 0.15s",
      background: active ? "var(--blue)" : "var(--bg-elevated)",
      border: active ? "1px solid rgba(59,140,248,0.3)" : "1px solid var(--border-subtle)",
      color: active ? "#fff" : "var(--text-secondary)",
    }}>{label}</button>
  );
}

function Field({ label, tip, children }: { label: string; tip?: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
        {tip && (
          <span style={{ position: "relative" }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", cursor: "help", border: "1px solid var(--border)", borderRadius: "50%", width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>?</span>
            {show && <span style={{ position: "absolute", bottom: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)", background: "var(--bg-overlay)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 9px", fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap", zIndex: 50, pointerEvents: "none" }}>{tip}</span>}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text-primary)",
  fontFamily: "var(--font-ui)", outline: "none", boxSizing: "border-box",
};

function SuccessCard({ reference, type, onReset }: { reference: string; type: string; onReset: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 32px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--emerald-dim)", border: "1px solid rgba(16,201,138,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, margin: "0 auto 16px" }}>✓</div>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>{type} confirmed</h3>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>Your booking reference number</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--blue)", letterSpacing: "0.1em", padding: "12px 24px", background: "var(--blue-dim)", borderRadius: 8, display: "inline-block", marginBottom: 24 }}>
        {reference}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 24 }}>Save this reference. You can use it to track your booking status.</div>
      <button onClick={onReset} style={{ padding: "9px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13 }}>
        Make another booking
      </button>
    </div>
  );
}

// ─── Bed Booking ─────────────────────────────────────────────────────────────
function BedBooking({ hospitals }: { hospitals: any[] }) {
  const queryClient = useQueryClient();
  const [hospitalId, setHospitalId] = useState("");
  const [bedType, setBedType] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState("");

  // Fetch available beds from the backend
  const { data: beds = [] } = useQuery({
    queryKey: ["beds", hospitalId],
    queryFn: () => axios.get(`${API}/public/services/beds?hospital_id=${hospitalId}`).then(r => r.data),
    enabled: !!hospitalId,
  });

  // Get unique bed types from available beds
  const bedTypes = [...new Set((beds as any[]).map((b: any) => b.bed_type))];
  // Get available beds of selected type
  const filteredBeds = bedType
    ? (beds as any[]).filter((b: any) => b.bed_type === bedType)
    : beds as any[];

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      // Pick the first available bed of the selected type
      const selectedBed = filteredBeds[0];
      if (!selectedBed) {
        setError("No beds of this type are available. Please select a different type.");
        setLoading(false);
        return;
      }

      const res = await axios.post(`${API}/public/services/beds/book`, {
        bed_id: selectedBed.id,
        hospital_id: Number(hospitalId),
        patient_name: name,
        patient_phone: phone,
        patient_age: age ? Number(age) : null,
        reason: reason || null,
      });
      setRef(res.data.reference ?? "BK-" + Math.random().toString(36).slice(2, 10).toUpperCase());
      // Invalidate beds query so availability updates
      queryClient.invalidateQueries({ queryKey: ["beds", hospitalId] });
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Booking failed. Please try again.");
    } finally { setLoading(false); }
  }

  if (ref) return <SuccessCard reference={ref} type="Bed booking" onReset={() => { setRef(""); setName(""); setPhone(""); }} />;

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Availability summary */}
      {hospitalId && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", gridColumn: "1/-1", marginBottom: 4 }}>Live availability</div>
          {["general", "icu", "emergency", "maternity", "paediatric"].map(type => {
            const count = (beds as any[]).filter((b: any) => b.bed_type === type).length;
            return (
              <div key={type} style={{ fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>{type}: </span>
                <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", color: count > 0 ? "var(--emerald)" : "var(--red)" }}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Hospital" tip="Select the hospital you want to book a bed at">
          <select value={hospitalId} onChange={e => { setHospitalId(e.target.value); setBedType(""); }} required style={inp}>
            <option value="">Select hospital…</option>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </Field>
        <Field label="Bed type" tip="Type of ward — ICU beds are for critical patients">
          <select value={bedType} onChange={e => setBedType(e.target.value)} required style={inp} disabled={!hospitalId}>
            <option value="">Select type…</option>
            {(bedTypes.length ? bedTypes : ["general", "icu", "emergency", "maternity", "paediatric"]).map(t => (
              <option key={t as string} value={t as string}>{(t as string).replace(/_/g, " ")}</option>
            ))}
          </select>
        </Field>
        <Field label="Patient full name">
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Full legal name" style={inp} />
        </Field>
        <Field label="Phone number">
          <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+91..." style={inp} />
        </Field>
        <Field label="Patient age">
          <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Optional" style={inp} />
        </Field>
        <Field label="Reason for admission">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Scheduled surgery, observation" style={inp} />
        </Field>
      </div>
      {error && <div style={{ background: "var(--red-dim)", border: "1px solid rgba(240,68,68,0.2)", borderRadius: 7, padding: "9px 12px", fontSize: 12, color: "var(--red)" }}>⚠ {error}</div>}
      <button type="submit" disabled={loading || (!!hospitalId && filteredBeds.length === 0)} style={{ padding: "11px", background: "var(--blue)", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui)", opacity: loading ? 0.7 : 1 }}>
        {loading ? "Booking…" : filteredBeds.length === 0 && hospitalId && bedType ? "No beds available" : "Confirm bed booking"}
      </button>
    </form>
  );
}

// ─── Ambulance Booking ───────────────────────────────────────────────────────
function AmbulanceBooking({ hospitals }: { hospitals: any[] }) {
  const [hospitalId, setHospitalId] = useState("");
  const [emergencyType, setEmergencyType] = useState("medical");
  const [priority, setPriority] = useState("high");
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await axios.post(`${API}/public/services/ambulance/request`, {
        hospital_id: Number(hospitalId),
        emergency_type: emergencyType,
        priority,
        pickup_address: address,
        patient_name: name,
        patient_phone: phone,
        notes: notes || null,
      });
      setRef(res.data.reference ?? "AMB-" + Math.random().toString(36).slice(2, 10).toUpperCase());
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Request failed.");
    } finally { setLoading(false); }
  }

  if (ref) return <SuccessCard reference={ref} type="Ambulance request" onReset={() => { setRef(""); setAddress(""); }} />;

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "var(--red-dim)", border: "1px solid rgba(240,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--red)" }}>
        🚨 For life-threatening emergencies, call <strong>112</strong> immediately. This form is for pre-scheduled or non-urgent ambulance requests.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Nearest hospital">
          <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} required style={inp}>
            <option value="">Select hospital…</option>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </Field>
        <Field label="Emergency type" tip="Type of medical emergency">
          <select value={emergencyType} onChange={e => setEmergencyType(e.target.value)} style={inp}>
            {EMERGENCY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Priority" tip="Critical requests are dispatched first">
          <select value={priority} onChange={e => setPriority(e.target.value)} style={inp}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Pickup address">
          <input value={address} onChange={e => setAddress(e.target.value)} required placeholder="Full address for ambulance pickup" style={inp} />
        </Field>
        <Field label="Contact name">
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Patient or caller name" style={inp} />
        </Field>
        <Field label="Contact phone">
          <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+91..." style={inp} />
        </Field>
      </div>
      <Field label="Additional notes">
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any relevant medical information" style={inp} />
      </Field>
      {error && <div style={{ background: "var(--red-dim)", border: "1px solid rgba(240,68,68,0.2)", borderRadius: 7, padding: "9px 12px", fontSize: 12, color: "var(--red)" }}>⚠ {error}</div>}
      <button type="submit" disabled={loading} style={{ padding: "11px", background: priority === "critical" ? "var(--red)" : "var(--blue)", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui)", opacity: loading ? 0.7 : 1 }}>
        {loading ? "Requesting…" : "Request ambulance"}
      </button>
    </form>
  );
}

// ─── Appointment Booking ─────────────────────────────────────────────────────
function AppointmentBooking({ hospitals }: { hospitals: any[] }) {
  const [hospitalId, setHospitalId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState("");

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors", hospitalId],
    queryFn: () => axios.get(`${API}/public/services/doctors?hospital_id=${hospitalId}`).then(r => r.data),
    enabled: !!hospitalId,
  });
  const { data: slots = [] } = useQuery({
    queryKey: ["slots", doctorId, dateStr],
    queryFn: () => axios.get(`${API}/public/services/doctors/${doctorId}/slots?date=${dateStr}`).then(r => r.data),
    enabled: !!doctorId && !!dateStr,
  });

  // Only show available slots
  const availableSlots = (slots as any[]).filter((s: any) => s.available);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await axios.post(`${API}/public/services/appointments/book`, {
        doctor_id: Number(doctorId),
        hospital_id: Number(hospitalId),
        patient_name: name,
        patient_phone: phone,
        patient_age: age ? Number(age) : null,
        symptoms: symptoms || null,
        appointment_date: dateStr,
        appointment_time: selectedTime,
      });
      setRef(res.data.reference ?? "APT-" + Math.random().toString(36).slice(2, 10).toUpperCase());
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Booking failed.");
    } finally { setLoading(false); }
  }

  if (ref) return <SuccessCard reference={ref} type="Appointment" onReset={() => { setRef(""); setName(""); setSelectedTime(""); }} />;

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Hospital">
          <select value={hospitalId} onChange={e => { setHospitalId(e.target.value); setDoctorId(""); setSelectedTime(""); }} required style={inp}>
            <option value="">Select hospital…</option>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </Field>
        <Field label="Doctor / Specialist" tip="Select a doctor at the chosen hospital">
          <select value={doctorId} onChange={e => { setDoctorId(e.target.value); setSelectedTime(""); }} required style={inp} disabled={!hospitalId}>
            <option value="">Select doctor…</option>
            {(doctors as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}
          </select>
        </Field>
        <Field label="Appointment date" tip="Select a date to see available slots">
          <input type="date" value={dateStr} onChange={e => { setDateStr(e.target.value); setSelectedTime(""); }} required style={inp}
            min={new Date().toISOString().split("T")[0]}
            disabled={!doctorId} />
        </Field>
        <Field label="Available time slot" tip="Times shown are available appointment slots">
          <select value={selectedTime} onChange={e => setSelectedTime(e.target.value)} required style={inp} disabled={!dateStr || availableSlots.length === 0}>
            <option value="">{!dateStr ? "Select date first…" : availableSlots.length === 0 ? "No slots available" : "Select time…"}</option>
            {availableSlots.map((s: any, i: number) => (
              <option key={i} value={s.time}>{s.time}</option>
            ))}
          </select>
        </Field>
        <Field label="Patient name">
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Full name" style={inp} />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+91..." style={inp} />
        </Field>
        <Field label="Age">
          <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Optional" style={inp} />
        </Field>
        <Field label="Symptoms / Reason" tip="Brief description helps the doctor prepare">
          <input value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="e.g. follow-up, chest pain" style={inp} />
        </Field>
      </div>
      {error && <div style={{ background: "var(--red-dim)", border: "1px solid rgba(240,68,68,0.2)", borderRadius: 7, padding: "9px 12px", fontSize: 12, color: "var(--red)" }}>⚠ {error}</div>}
      <button type="submit" disabled={loading} style={{ padding: "11px", background: "var(--blue)", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui)", opacity: loading ? 0.7 : 1 }}>
        {loading ? "Booking…" : "Confirm appointment"}
      </button>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BookingsPage() {
  const [tab, setTab] = useState<Tab>("bed");
  const { data: hospitals = [] } = useQuery({ queryKey: ["hospitals"], queryFn: fetchHospitals });

  return (
    <div style={{ fontFamily: "var(--font-ui)", color: "var(--text-primary)" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Bookings</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>Hospital Services</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Book beds, ambulances, and doctor appointments at any hospital in the network.</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <Chip label="🛏 Bed booking"      active={tab === "bed"}         onClick={() => setTab("bed")} />
        <Chip label="🚑 Ambulance"        active={tab === "ambulance"}   onClick={() => setTab("ambulance")} />
        <Chip label="📅 Appointment"      active={tab === "appointment"} onClick={() => setTab("appointment")} />
      </div>

      {/* Booking form */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "24px 28px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
          {tab === "bed" ? "Bed reservation" : tab === "ambulance" ? "Ambulance request" : "Doctor appointment"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
          {tab === "bed" ? "Reserve a bed at your chosen hospital. You'll receive a reference number to present on arrival." :
           tab === "ambulance" ? "Schedule ambulance pickup. For emergencies, call 112 directly." :
           "Book a consultation with a specialist. Select a date to see available time slots."}
        </div>
        {tab === "bed"         && <BedBooking hospitals={hospitals} />}
        {tab === "ambulance"   && <AmbulanceBooking hospitals={hospitals} />}
        {tab === "appointment" && <AppointmentBooking hospitals={hospitals} />}
      </div>

      {/* Status tracker */}
      <div style={{ marginTop: 16, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "16px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Track existing booking</div>
        <BookingTracker />
      </div>
    </div>
  );
}

function BookingTracker() {
  const [ref, setRef] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function lookup(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await axios.get(`${API}/public/services/booking/${ref.trim()}`);
      setResult(res.data);
    } catch { setError("Reference not found."); setResult(null); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <form onSubmit={lookup} style={{ display: "flex", gap: 10 }}>
        <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Enter booking reference (e.g. BK-A3F2B1)" style={{ ...inp, flex: 1 }} />
        <button type="submit" disabled={loading} style={{ padding: "9px 18px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13 }}>
          {loading ? "…" : "Look up"}
        </button>
      </form>
      {error && <div style={{ marginTop: 8, fontSize: 12, color: "var(--red)" }}>⚠ {error}</div>}
      {result && (
        <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: 8, fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Booking found</div>
          <div style={{ color: "var(--text-secondary)" }}>Type: <strong>{result.type}</strong> · Status: <strong style={{ color: "var(--emerald)" }}>{result.status}</strong></div>
          <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>Patient: {result.patient_name}</div>
        </div>
      )}
    </div>
  );
}