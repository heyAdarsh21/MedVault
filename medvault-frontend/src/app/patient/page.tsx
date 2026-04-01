"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

interface Hospital { id: number; name: string; location: string; capacity: number; }
interface Bed       { id: number; ward: string; bed_number: string; bed_type: string; }
interface Doctor    { id: number; name: string; specialty: string; qualification?: string; available_days: string; start_time: string; end_time: string; fee: number; slot_duration_min: number; }
interface Slot      { time: string; available: boolean; }

// ── Shared primitives ─────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--text-primary)",
  fontFamily: "var(--font-ui)", outline: "none", boxSizing: "border-box",
};
const card: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 14,
};
const sectionHead = (title: string) => (
  <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>
    {title}
  </div>
);
const fieldWrap = { marginBottom: 12 };
const labelS: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 };
const fo = (e: any) => { e.target.style.borderColor = "rgba(59,140,248,0.5)"; };
const bl = (e: any) => { e.target.style.borderColor = "var(--border)"; };

function ConfirmCard({ icon, title, ref: reference, color, details, onNew }: any) {
  return (
    <div style={{ textAlign: "center", padding: "32px 24px" }}>
      <div style={{ fontSize: 44, marginBottom: 16 }}>{icon}</div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 99, padding: "4px 14px", marginBottom: 16 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
        <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.1em" }}>CONFIRMED</span>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>{title}</h3>
      <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: "10px 16px", margin: "0 auto 16px", maxWidth: 240 }}>
        <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Booking Reference</div>
        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-mono)", color, letterSpacing: "0.18em" }}>{reference}</div>
      </div>
      {details && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>{details}</div>}
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20 }}>Save this reference to track your booking.</div>
      <button onClick={onNew} style={{ padding: "9px 20px", background: "var(--blue)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
        Make another booking
      </button>
    </div>
  );
}

// ── Bed Flow ──────────────────────────────────────────────────────────────────
function BedFlow({ hospitals }: { hospitals: Hospital[] }) {
  const [hid, setHid]           = useState<number | null>(null);
  const [beds, setBeds]         = useState<Bed[]>([]);
  const [selected, setSelected] = useState<Bed | null>(null);
  const [step, setStep]         = useState<"setup"|"pick"|"form"|"done">("setup");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<any>(null);
  const [form, setForm]         = useState({ patient_name: "", patient_phone: "", patient_age: "", reason: "" });
  const TYPE_COLORS: Record<string,string> = { general: "#3b8cf8", icu: "#f04444", emergency: "#f97316", maternity: "#a78bfa", paediatric: "#10c98a" };

  async function loadBeds(id: number) {
    setLoading(true);
    const r = await axios.get(`${API}/public/services/beds`, { params: { hospital_id: id } }).catch(() => ({ data: [] }));
    setBeds(r.data); setLoading(false); setStep("pick");
  }
  async function confirm() {
    if (!selected || !hid) return;
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/services/beds/book`, { bed_id: selected.id, hospital_id: hid, ...form, patient_age: form.patient_age ? Number(form.patient_age) : null });
      setResult(r.data); setStep("done");
    } catch (e: any) { alert(e.response?.data?.detail ?? "Failed"); }
    finally { setLoading(false); }
  }

  if (step === "done") return <ConfirmCard icon="🛏" title="Bed Reserved" ref={result?.reference} color="#10c98a"
    details="Proceed to hospital reception and present your reference code upon arrival."
    onNew={() => { setStep("setup"); setResult(null); setBeds([]); setSelected(null); setForm({ patient_name:"",patient_phone:"",patient_age:"",reason:"" }); }} />;

  return (
    <div>
      {step === "setup" && <>
        <div style={fieldWrap}><label style={labelS}>Hospital</label>
          <select style={inp} onChange={e => setHid(e.target.value ? Number(e.target.value) : null)} defaultValue="" onFocus={fo} onBlur={bl}>
            <option value="" disabled>Choose hospital</option>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} — {h.location}</option>)}
          </select></div>
        <button onClick={() => hid && loadBeds(hid)} disabled={!hid || loading}
          style={{ width:"100%", padding:"11px", background:"var(--blue)", border:"none", borderRadius:8, color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-ui)", opacity: !hid ? 0.5 : 1 }}>
          {loading ? "Searching…" : "Find Available Beds →"}
        </button>
      </>}

      {step === "pick" && <>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>Available Beds</div>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{beds.length} beds available</div>
          </div>
          <button onClick={() => setStep("setup")} style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:6, padding:"5px 10px", fontSize:11, color:"var(--text-muted)", cursor:"pointer", fontFamily:"var(--font-ui)" }}>← Back</button>
        </div>
        {beds.length === 0
          ? <div style={{ textAlign:"center", padding:32, color:"var(--text-muted)", fontSize:13 }}>No beds currently available.</div>
          : <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14, maxHeight:280, overflowY:"auto" }}>
              {beds.map(b => {
                const c = TYPE_COLORS[b.bed_type] ?? "var(--blue)";
                const active = selected?.id === b.id;
                return (
                  <div key={b.id} onClick={() => setSelected(b)} style={{ padding:"12px", borderRadius:8, cursor:"pointer", border:`1px solid ${active ? c : "var(--border-subtle)"}`, background: active ? `${c}10` : "var(--bg-elevated)", transition:"all 0.12s" }}>
                    <div style={{ fontSize:13, fontWeight:700, fontFamily:"var(--font-mono)", color: active ? c : "var(--text-primary)" }}>{b.bed_number}</div>
                    <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{b.ward}</div>
                    <div style={{ marginTop:6, display:"inline-block", background:`${c}18`, color:c, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", padding:"2px 7px", borderRadius:99 }}>{b.bed_type}</div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setStep("form")} disabled={!selected}
              style={{ width:"100%", padding:"10px", background:"var(--blue)", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-ui)", opacity: !selected ? 0.4 : 1 }}>
              Continue with {selected?.bed_number ?? "selected bed"} →
            </button>
          </>
        }
      </>}

      {step === "form" && selected && <>
        <div style={{ background:"var(--bg-elevated)", borderRadius:8, padding:"10px 14px", marginBottom:16, display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontSize:20 }}>🛏</span>
          <div><div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>Bed {selected.bed_number} — {selected.ward}</div>
          <div style={{ fontSize:11, color:"var(--text-muted)" }}>{selected.bed_type}</div></div>
          <button onClick={() => setStep("pick")} style={{ marginLeft:"auto", background:"transparent", border:"1px solid var(--border)", borderRadius:6, padding:"4px 10px", fontSize:11, color:"var(--text-muted)", cursor:"pointer", fontFamily:"var(--font-ui)" }}>Change</button>
        </div>
        {[{l:"Patient Name",k:"patient_name",p:"Full name"},{l:"Phone",k:"patient_phone",p:"+91 XXXXX"},{l:"Age",k:"patient_age",p:"Optional",t:"number"}].map(f => (
          <div key={f.k} style={fieldWrap}><label style={labelS}>{f.l}</label>
            <input style={inp} type={f.t ?? "text"} placeholder={f.p} value={(form as any)[f.k]} onChange={e => setForm(x => ({...x,[f.k]:e.target.value}))} onFocus={fo} onBlur={bl}/></div>
        ))}
        <div style={fieldWrap}><label style={labelS}>Reason (Optional)</label>
          <textarea style={{...inp, minHeight:60, resize:"vertical" as const}} placeholder="Brief reason for admission" value={form.reason} onChange={e => setForm(x => ({...x,reason:e.target.value}))} onFocus={fo} onBlur={bl}/></div>
        <button onClick={confirm} disabled={loading || !form.patient_name || !form.patient_phone}
          style={{ width:"100%", padding:"11px", background:"var(--blue)", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-ui)", opacity:(!form.patient_name||!form.patient_phone)?0.4:1 }}>
          {loading ? "Confirming…" : "Confirm Booking"}
        </button>
      </>}
    </div>
  );
}

// ── Appointment Flow ──────────────────────────────────────────────────────────
function AppointmentFlow({ hospitals }: { hospitals: Hospital[] }) {
  const [hid, setHid]           = useState<number | null>(null);
  const [doctors, setDoctors]   = useState<Doctor[]>([]);
  const [doc, setDoc]           = useState<Doctor | null>(null);
  const [slots, setSlots]       = useState<Slot[]>([]);
  const [date, setDate]         = useState("");
  const [slot, setSlot]         = useState<string|null>(null);
  const [step, setStep]         = useState<"setup"|"doctor"|"slot"|"form"|"done">("setup");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<any>(null);
  const [form, setForm]         = useState({ patient_name:"", patient_phone:"", patient_age:"", symptoms:"" });
  const today = new Date().toISOString().split("T")[0];

  async function loadDoctors(id: number) { setLoading(true); const r = await axios.get(`${API}/public/services/doctors`, { params: { hospital_id: id } }).catch(() => ({data:[]})); setDoctors(r.data); setLoading(false); setStep("doctor"); }
  async function loadSlots(d: Doctor, dt: string) { if (!dt) return; setLoading(true); const r = await axios.get(`${API}/public/services/doctors/${d.id}/slots`, { params: { date: dt } }).catch(() => ({data:[]})); setSlots(r.data); setLoading(false); }
  async function confirm() {
    if (!doc||!hid||!slot||!date) return; setLoading(true);
    try {
      const r = await axios.post(`${API}/public/services/appointments/book`, { doctor_id:doc.id, hospital_id:hid, ...form, patient_age: form.patient_age ? Number(form.patient_age) : null, appointment_date:date, appointment_time:slot });
      setResult(r.data); setStep("done");
    } catch(e:any) { alert(e.response?.data?.detail ?? "Failed"); }
    finally { setLoading(false); }
  }

  const reset = () => { setStep("setup"); setResult(null); setDoc(null); setSlots([]); setSlot(null); setDate(""); setForm({patient_name:"",patient_phone:"",patient_age:"",symptoms:""}); };

  if (step === "done") return <ConfirmCard icon="👨‍⚕️" title="Appointment Confirmed" ref={result?.reference} color="var(--blue)"
    details={<>With <strong style={{color:"var(--text-primary)"}}>{doc?.name}</strong> on <strong style={{color:"var(--text-primary)"}}>{date}</strong> at <strong style={{color:"var(--blue)"}}>{slot}</strong></>}
    onNew={reset} />;

  return (
    <div>
      {step === "setup" && <>
        <div style={fieldWrap}><label style={labelS}>Hospital</label>
          <select style={inp} onChange={e => setHid(e.target.value ? Number(e.target.value) : null)} defaultValue="" onFocus={fo} onBlur={bl}>
            <option value="" disabled>Choose hospital</option>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} — {h.location}</option>)}
          </select></div>
        <button onClick={() => hid && loadDoctors(hid)} disabled={!hid||loading}
          style={{ width:"100%", padding:"11px", background:"var(--blue)", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-ui)", opacity:!hid?0.4:1 }}>
          {loading ? "Loading…" : "Browse Doctors →"}
        </button>
      </>}

      {step === "doctor" && <>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>{doctors.length} Doctors Available</div>
          <button onClick={() => setStep("setup")} style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:6, padding:"4px 10px", fontSize:11, color:"var(--text-muted)", cursor:"pointer", fontFamily:"var(--font-ui)" }}>← Back</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:300, overflowY:"auto", marginBottom:12 }}>
          {doctors.map(d => {
            const active = doc?.id === d.id;
            return (
              <div key={d.id} onClick={() => { setDoc(d); if(date) loadSlots(d, date); }} style={{ padding:"12px 14px", borderRadius:10, cursor:"pointer", border:`1px solid ${active?"rgba(59,140,248,0.4)":"var(--border-subtle)"}`, background: active?"var(--blue-dim)":"var(--bg-elevated)", transition:"all 0.15s" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color: active?"var(--blue)":"var(--text-primary)" }}>{d.name}</div>
                    <div style={{ fontSize:11, color:"var(--text-secondary)", marginTop:2 }}>{d.specialty}</div>
                    {d.qualification && <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:1 }}>{d.qualification}</div>}
                    <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:4 }}>Available: {d.available_days}</div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:"var(--emerald)", fontFamily:"var(--font-mono)" }}>₹{d.fee}</div>
                    <div style={{ fontSize:10, color:"var(--text-muted)" }}>{d.slot_duration_min}min</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {doc && <div style={fieldWrap}><label style={labelS}>Select Date</label>
          <input style={inp} type="date" min={today} value={date} onFocus={fo} onBlur={bl}
            onChange={e => { setDate(e.target.value); loadSlots(doc, e.target.value); }} /></div>}
        <button onClick={() => setStep("slot")} disabled={!doc||!date||loading}
          style={{ width:"100%", padding:"10px", background:"var(--blue)", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-ui)", opacity:(!doc||!date)?0.4:1 }}>
          {loading ? "Loading slots…" : "Choose Slot →"}
        </button>
      </>}

      {step === "slot" && <>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>{doc?.name}</div>
            <div style={{ fontSize:11, color:"var(--text-muted)" }}>{date}</div>
          </div>
          <button onClick={() => setStep("doctor")} style={{ background:"transparent", border:"1px solid var(--border)", borderRadius:6, padding:"4px 10px", fontSize:11, color:"var(--text-muted)", cursor:"pointer", fontFamily:"var(--font-ui)" }}>← Back</button>
        </div>
        {slots.length === 0
          ? <div style={{ textAlign:"center", padding:24, color:"var(--text-muted)", fontSize:13 }}>No slots available this day.</div>
          : <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:14 }}>
              {slots.map(s => (
                <div key={s.time} onClick={() => s.available && setSlot(s.time)} style={{ padding:"8px 4px", textAlign:"center", borderRadius:6, fontSize:12, fontFamily:"var(--font-mono)", cursor: s.available?"pointer":"not-allowed", border:`1px solid ${slot===s.time?"var(--blue)":s.available?"var(--border-subtle)":"transparent"}`, background: slot===s.time?"var(--blue-dim)":s.available?"var(--bg-elevated)":"var(--bg-surface)", color: slot===s.time?"var(--blue)":s.available?"var(--text-secondary)":"var(--text-muted)", transition:"all 0.12s" }}>
                  {s.time}
                </div>
              ))}
            </div>
        }
        <button onClick={() => setStep("form")} disabled={!slot}
          style={{ width:"100%", padding:"10px", background:"var(--blue)", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-ui)", opacity:!slot?0.4:1 }}>
          Continue →
        </button>
      </>}

      {step === "form" && <>
        <div style={{ background:"var(--bg-elevated)", borderRadius:8, padding:"10px 14px", marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>{doc?.name}</div>
          <div style={{ fontSize:11, color:"var(--text-muted)" }}>{date} at {slot} · ₹{doc?.fee}</div>
        </div>
        {[{l:"Patient Name",k:"patient_name",p:"Full name"},{l:"Phone",k:"patient_phone",p:"+91 XXXXX"},{l:"Age",k:"patient_age",p:"Optional",t:"number"}].map(f => (
          <div key={f.k} style={fieldWrap}><label style={labelS}>{f.l}</label>
            <input style={inp} type={f.t??"text"} placeholder={f.p} value={(form as any)[f.k]} onChange={e => setForm(x => ({...x,[f.k]:e.target.value}))} onFocus={fo} onBlur={bl}/></div>
        ))}
        <div style={fieldWrap}><label style={labelS}>Symptoms</label>
          <textarea style={{...inp, minHeight:60, resize:"vertical" as const}} placeholder="Briefly describe your symptoms (optional)" value={form.symptoms} onChange={e => setForm(x=>({...x,symptoms:e.target.value}))} onFocus={fo} onBlur={bl}/></div>
        <button onClick={confirm} disabled={loading||!form.patient_name||!form.patient_phone}
          style={{ width:"100%", padding:"11px", background:"var(--blue)", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-ui)", opacity:(!form.patient_name||!form.patient_phone)?0.4:1 }}>
          {loading?"Booking…":"Confirm Appointment"}
        </button>
      </>}
    </div>
  );
}

// ── Ambulance Flow ────────────────────────────────────────────────────────────
function AmbulanceFlow({ hospitals }: { hospitals: Hospital[] }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<any>(null);
  const [form, setForm] = useState({ hospital_id:"", patient_name:"", patient_phone:"", pickup_address:"", emergency_type:"medical", priority:"high", notes:"" });
  const set = (k: string) => (e: any) => setForm(f => ({...f,[k]:e.target.value}));

  async function submit() {
    if (!form.hospital_id||!form.patient_name||!form.patient_phone||!form.pickup_address) return;
    setLoading(true);
    try { const r = await axios.post(`${API}/public/services/ambulance/request`, {...form, hospital_id: Number(form.hospital_id)}); setResult(r.data); }
    catch(e:any) { alert(e.response?.data?.detail ?? "Failed"); }
    finally { setLoading(false); }
  }

  if (result) return <ConfirmCard icon="🚑" title="Ambulance Dispatched" ref={result.reference} color="var(--red)"
    details={<>ETA: <strong style={{color:"var(--red)"}}>{result.eta_minutes} minutes</strong>. Keep your phone on and be ready at the pickup address.</>}
    onNew={() => setResult(null)} />;

  return (
    <div>
      <div style={{ background:"var(--red-dim)", border:"1px solid rgba(240,68,68,0.2)", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:12, color:"var(--red)" }}>
        ⚠ For life-threatening emergencies, also dial <strong>108</strong> immediately.
      </div>
      {[{l:"Nearest Hospital",k:"hospital_id",as:"select"},{l:"Patient Name",k:"patient_name",p:"Full name"},{l:"Contact Phone",k:"patient_phone",p:"+91 XXXXX XXXXX"}].map(f => (
        <div key={f.k} style={fieldWrap}><label style={labelS}>{f.l}</label>
          {f.as === "select"
            ? <select style={inp} value={form.hospital_id} onChange={set("hospital_id")} onFocus={fo} onBlur={bl}>
                <option value="" disabled>Choose nearest hospital</option>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} — {h.location}</option>)}
              </select>
            : <input style={inp} placeholder={f.p} value={(form as any)[f.k]} onChange={set(f.k)} onFocus={fo} onBlur={bl}/>}
        </div>
      ))}
      <div style={fieldWrap}><label style={labelS}>Pickup Address</label>
        <textarea style={{...inp, minHeight:72, resize:"vertical" as const}} placeholder="Full address with landmark" value={form.pickup_address} onChange={set("pickup_address")} onFocus={fo} onBlur={bl}/></div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div style={fieldWrap}><label style={labelS}>Emergency Type</label>
          <select style={inp} value={form.emergency_type} onChange={set("emergency_type")} onFocus={fo} onBlur={bl}>
            {["medical","trauma","cardiac","maternity","other"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </select></div>
        <div style={fieldWrap}><label style={labelS}>Priority</label>
          <select style={inp} value={form.priority} onChange={set("priority")} onFocus={fo} onBlur={bl}>
            {[["critical","Critical — Life threatening"],["high","High — Urgent"],["normal","Normal — Non-urgent"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
      </div>
      <div style={fieldWrap}><label style={labelS}>Additional Notes</label>
        <input style={inp} placeholder="Medical conditions, medications (optional)" value={form.notes} onChange={set("notes")} onFocus={fo} onBlur={bl}/></div>
      <button onClick={submit} disabled={loading||!form.hospital_id||!form.patient_name||!form.patient_phone||!form.pickup_address}
        style={{ width:"100%", padding:"12px", background:"var(--red)", border:"none", borderRadius:8, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"var(--font-ui)", boxShadow:"0 2px 12px rgba(240,68,68,0.3)", opacity:(!form.hospital_id||!form.patient_name||!form.patient_phone||!form.pickup_address)?0.5:1 }}>
        {loading ? "Dispatching…" : "🚑  Request Ambulance Now"}
      </button>
    </div>
  );
}

// ── Status Tracker ────────────────────────────────────────────────────────────
function StatusTracker() {
  const [ref, setRef]       = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError]   = useState("");
  const TYPE_ICON: Record<string,string> = { bed:"🛏", appointment:"👨‍⚕️", ambulance:"🚑" };
  const TYPE_COLOR: Record<string,string> = { bed:"var(--emerald)", appointment:"var(--blue)", ambulance:"var(--red)" };

  async function check() {
    if (ref.length < 8) return; setLoading(true); setError("");
    try { const r = await axios.get(`${API}/public/services/booking/${ref.trim().toUpperCase()}`); setResult(r.data); }
    catch { setError("No booking found with this reference."); setResult(null); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        <input style={{...inp, flex:1, fontFamily:"var(--font-mono)", fontSize:16, letterSpacing:"0.12em", textTransform:"uppercase"}}
          placeholder="e.g. A3F2C9B1" value={ref} onChange={e => setRef(e.target.value.toUpperCase())} maxLength={8}
          onKeyDown={e => e.key==="Enter" && check()} onFocus={fo} onBlur={bl}/>
        <button onClick={check} disabled={loading||ref.length<8}
          style={{ padding:"10px 18px", background:"var(--blue)", border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"var(--font-ui)", opacity:ref.length<8?0.4:1 }}>
          {loading?"…":"Check"}
        </button>
      </div>
      {error && <div style={{ fontSize:12, color:"var(--red)", background:"var(--red-dim)", borderRadius:8, padding:"9px 12px" }}>{error}</div>}
      {result && (
        <div style={{ background:"var(--bg-elevated)", border:`1px solid ${TYPE_COLOR[result.type] ?? "var(--border)"}20`, borderRadius:12, padding:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
            <span style={{ fontSize:24 }}>{TYPE_ICON[result.type]}</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>{result.patient_name}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{result.type} booking</div>
            </div>
            <div style={{ marginLeft:"auto", background:`${TYPE_COLOR[result.type]}18`, color:TYPE_COLOR[result.type], fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", padding:"4px 10px", borderRadius:99 }}>
              {result.status}
            </div>
          </div>
          {Object.entries(result.detail).filter(([,v])=>v).map(([k,v]) => (
            <div key={k} style={{ display:"flex", gap:10, fontSize:12, marginBottom:6 }}>
              <span style={{ color:"var(--text-muted)", minWidth:90, textTransform:"capitalize" }}>{k.replace(/_/g," ")}</span>
              <span style={{ color:"var(--text-secondary)" }}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Patient Portal ───────────────────────────────────────────────────────
type Service = "bed"|"appointment"|"ambulance"|"status"|null;

const SERVICES = [
  { key:"bed",         icon:"🛏",  title:"Book a Bed",          desc:"ICU, general, maternity & more",  color:"var(--blue)"    },
  { key:"appointment", icon:"🩺",  title:"Doctor Appointment",  desc:"Browse specialists & book slots",  color:"var(--emerald)" },
  { key:"ambulance",   icon:"🚑",  title:"Emergency Ambulance", desc:"Dispatch to your location 24/7",   color:"var(--red)"     },
  { key:"status",      icon:"🔍",  title:"Track Booking",       desc:"Check status with your reference", color:"var(--amber)"   },
] as const;

export default function PatientPortal() {
  const router    = useRouter();
  const { logout, hydrated, token } = useAuthStore();
  const [active, setActive]     = useState<Service>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  useEffect(() => {
    axios.get(`${API}/public/hospitals`).then(r => setHospitals(r.data)).catch(() => {});
  }, []);

  function handleLogout() { logout(); router.push("/"); }

  const SERVICE_LABEL: Record<string, string> = { bed:"Book a Bed", appointment:"Doctor Appointment", ambulance:"Emergency Ambulance", status:"Track Booking" };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg-base)", fontFamily:"var(--font-ui)", color:"var(--text-primary)" }}>

      {/* Nav */}
      <nav style={{ position:"sticky", top:0, zIndex:50, background:"rgba(11,18,32,0.97)", backdropFilter:"blur(12px)", borderBottom:"1px solid var(--border-subtle)", padding:"0 32px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:"var(--blue-dim)", border:"1px solid rgba(59,140,248,0.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><polyline points="0,5 3,5 5,1 7,9 9,3 11,6 12,5 16,5" stroke="#3b8cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize:14, fontWeight:700 }}>MedVault</span>
          <span style={{ fontSize:11, color:"var(--text-muted)", marginLeft:4 }}>/ Patient Portal</span>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <Link href="/public" style={{ fontSize:12, color:"var(--text-muted)", textDecoration:"none", padding:"5px 10px", borderRadius:6, transition:"color 0.15s" }}
            onMouseEnter={e=>(e.currentTarget.style.color="var(--text-primary)")} onMouseLeave={e=>(e.currentTarget.style.color="var(--text-muted)")}>
            Hospital Status
          </Link>
          <button onClick={handleLogout} style={{ fontSize:12, color:"var(--text-muted)", background:"transparent", border:"1px solid var(--border-subtle)", borderRadius:6, padding:"5px 10px", cursor:"pointer", fontFamily:"var(--font-ui)", transition:"all 0.15s" }}
            onMouseEnter={e=>{e.currentTarget.style.color="var(--red)";e.currentTarget.style.borderColor="rgba(240,68,68,0.3)";}} onMouseLeave={e=>{e.currentTarget.style.color="var(--text-muted)";e.currentTarget.style.borderColor="var(--border-subtle)";}}>
            Sign out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth:1000, margin:"0 auto", padding:"36px 24px" }}>

        {/* Page title */}
        <div className="stagger-1" style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, fontWeight:600, color:"var(--blue)", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6 }}>Patient Portal</div>
          <h1 style={{ fontSize:22, fontWeight:700, margin:"0 0 4px", letterSpacing:"-0.01em" }}>Healthcare Services</h1>
          <p style={{ fontSize:13, color:"var(--text-secondary)", margin:0 }}>Book beds, schedule appointments, request emergency services — no waiting.</p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:active ? "320px 1fr" : "1fr", gap:20, alignItems:"start" }}>

          {/* Service selector */}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {SERVICES.map((s, i) => {
              const isActive = active === s.key;
              return (
                <div key={s.key} className={`stagger-${i+2}`} onClick={() => setActive(s.key)} style={{ ...card, padding:"16px 18px", cursor:"pointer", borderColor: isActive ? `${s.color}35` : "var(--border-subtle)", background: isActive ? `color-mix(in srgb, ${s.color} 5%, var(--bg-surface))` : "var(--bg-surface)", transition:"all 0.15s", display:"flex", alignItems:"center", gap:14 }}
                  onMouseEnter={e => { if(!isActive) { e.currentTarget.style.borderColor=`${s.color}25`; e.currentTarget.style.background="var(--bg-elevated)"; }}}
                  onMouseLeave={e => { if(!isActive) { e.currentTarget.style.borderColor="var(--border-subtle)"; e.currentTarget.style.background="var(--bg-surface)"; }}}>
                  <div style={{ width:40, height:40, borderRadius:10, background:`color-mix(in srgb, ${s.color} 12%, transparent)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                    {s.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color: isActive ? s.color : "var(--text-primary)" }}>{s.title}</div>
                    <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{s.desc}</div>
                  </div>
                  <div style={{ color: isActive ? s.color : "var(--text-muted)", fontSize:14, flexShrink:0, transition:"transform 0.15s", transform: isActive ? "translateX(2px)" : "none" }}>→</div>
                </div>
              );
            })}
          </div>

          {/* Active service panel */}
          {active && (
            <div className="stagger-2" style={{ ...card, overflow:"hidden" }}>
              {sectionHead(SERVICE_LABEL[active])}
              <div style={{ padding:20 }}>
                {active === "bed"         && <BedFlow hospitals={hospitals} />}
                {active === "appointment" && <AppointmentFlow hospitals={hospitals} />}
                {active === "ambulance"   && <AmbulanceFlow hospitals={hospitals} />}
                {active === "status"      && <StatusTracker />}
              </div>
            </div>
          )}

          {/* Empty state when nothing selected */}
          {!active && (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}