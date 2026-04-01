"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

type Step = 1 | 2 | 3;

const BLOOD_GROUPS = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];
const GENDERS      = ["Male","Female","Other","Prefer not to say"];

const inp: React.CSSProperties = {
  width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "var(--text-primary)",
  fontFamily: "var(--font-ui)", outline: "none", transition: "border-color 0.15s", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 };

function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return <div style={{ flex: half ? "1 1 calc(50% - 6px)" : "1 1 100%" }}><label style={labelStyle}>{label}</label>{children}</div>;
}

function focus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) { e.target.style.borderColor = "rgba(59,140,248,0.5)"; }
function blur(e:  React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) { e.target.style.borderColor = "var(--border)"; }

export default function SignupPage() {
  const router   = useRouter();
  const setToken = useAuthStore(s => s.setToken);
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const [form, setForm] = useState({
    // Step 1 — Account
    username: "", password: "", confirmPassword: "",
    // Step 2 — Personal
    full_name: "", date_of_birth: "", gender: "", blood_group: "", phone: "", email: "", address: "",
    // Step 3 — Emergency contact
    emergency_name: "", emergency_phone: "", emergency_relation: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function validateStep(s: Step) {
    if (s === 1) {
      if (!form.username || form.username.length < 3) return "Username must be at least 3 characters";
      if (!form.password || form.password.length < 6)  return "Password must be at least 6 characters";
      if (form.password !== form.confirmPassword)       return "Passwords do not match";
    }
    if (s === 2) {
      if (!form.full_name) return "Full name is required";
      if (!form.phone)     return "Phone number is required";
      if (!form.gender)    return "Please select gender";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError("");
    setStep(s => (s + 1) as Step);
  }

  async function submit() {
    setLoading(true); setError("");
    try {
      const res = await axios.post(`${API}/public/patient/register`, {
        username:           form.username,
        password:           form.password,
        full_name:          form.full_name,
        date_of_birth:      form.date_of_birth || null,
        gender:             form.gender,
        blood_group:        form.blood_group || null,
        phone:              form.phone,
        email:              form.email || null,
        address:            form.address || null,
        emergency_name:     form.emergency_name || null,
        emergency_phone:    form.emergency_phone || null,
        emergency_relation: form.emergency_relation || null,
      });
      setToken(res.data.access_token);
      router.push("/patient");
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Registration failed. Please try again.");
    } finally { setLoading(false); }
  }

  const STEPS = ["Account", "Personal Details", "Emergency Contact"];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", fontFamily: "var(--font-ui)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>

      <div style={{ position: "absolute", top: 20, left: 24 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--text-muted)", fontSize: 13 }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
          <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><polyline points="0,5 3,5 5,1 7,9 9,3 11,6 12,5 16,5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          MedVault
        </Link>
      </div>

      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Create patient account</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Register to access all healthcare services</p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  background: step > i + 1 ? "var(--emerald)" : step === i + 1 ? "var(--blue)" : "var(--bg-elevated)",
                  color: step >= i + 1 ? "#fff" : "var(--text-muted)",
                  border: step === i + 1 ? "2px solid rgba(59,140,248,0.4)" : "1px solid var(--border)",
                  transition: "all 0.3s",
                }}>
                  {step > i + 1 ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 11, fontWeight: step === i + 1 ? 600 : 400, color: step === i + 1 ? "var(--text-primary)" : "var(--text-muted)", whiteSpace: "nowrap" }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: step > i + 1 ? "var(--emerald)" : "var(--border-subtle)", margin: "0 10px", transition: "background 0.3s" }} />}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "28px" }}>

          {error && (
            <div style={{ background: "var(--red-dim)", border: "1px solid rgba(240,68,68,0.2)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "var(--red)", marginBottom: 16, display: "flex", gap: 7 }}>
              <span>⚠</span>{error}
            </div>
          )}

          {/* Step 1 — Account */}
          {step === 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Field label="Username">
                <input style={inp} placeholder="Choose a username" value={form.username} onChange={set("username")} onFocus={focus} onBlur={blur} />
              </Field>
              <Field label="Password" half>
                <input style={inp} type="password" placeholder="Min. 6 characters" value={form.password} onChange={set("password")} onFocus={focus} onBlur={blur} />
              </Field>
              <Field label="Confirm Password" half>
                <input style={inp} type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={set("confirmPassword")} onFocus={focus} onBlur={blur} />
              </Field>
            </div>
          )}

          {/* Step 2 — Personal */}
          {step === 2 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Field label="Full Name">
                <input style={inp} placeholder="As per medical records" value={form.full_name} onChange={set("full_name")} onFocus={focus} onBlur={blur} />
              </Field>
              <Field label="Phone Number" half>
                <input style={inp} placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={set("phone")} onFocus={focus} onBlur={blur} />
              </Field>
              <Field label="Email" half>
                <input style={inp} type="email" placeholder="Optional" value={form.email} onChange={set("email")} onFocus={focus} onBlur={blur} />
              </Field>
              <Field label="Date of Birth" half>
                <input style={inp} type="date" value={form.date_of_birth} onChange={set("date_of_birth")} onFocus={focus} onBlur={blur} />
              </Field>
              <Field label="Gender" half>
                <select style={inp} value={form.gender} onChange={set("gender")} onFocus={focus} onBlur={blur}>
                  <option value="">Select gender</option>
                  {GENDERS.map(g => <option key={g} value={g.toLowerCase()}>{g}</option>)}
                </select>
              </Field>
              <Field label="Blood Group" half>
                <select style={inp} value={form.blood_group} onChange={set("blood_group")} onFocus={focus} onBlur={blur}>
                  <option value="">Select (optional)</option>
                  {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Address">
                <textarea style={{ ...inp, minHeight: 60, resize: "vertical" } as React.CSSProperties} placeholder="Home address (optional)" value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))} onFocus={focus} onBlur={blur} />
              </Field>
            </div>
          )}

          {/* Step 3 — Emergency */}
          {step === 3 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ width: "100%", background: "var(--amber-dim)", border: "1px solid rgba(244,167,38,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--amber)" }}>
                ⚡ Emergency contact details help us reach your family in case of a medical emergency.
              </div>
              <Field label="Contact Name">
                <input style={inp} placeholder="Emergency contact full name" value={form.emergency_name} onChange={set("emergency_name")} onFocus={focus} onBlur={blur} />
              </Field>
              <Field label="Contact Phone" half>
                <input style={inp} placeholder="+91 XXXXX XXXXX" value={form.emergency_phone} onChange={set("emergency_phone")} onFocus={focus} onBlur={blur} />
              </Field>
              <Field label="Relationship" half>
                <input style={inp} placeholder="e.g. Spouse, Parent" value={form.emergency_relation} onChange={set("emergency_relation")} onFocus={focus} onBlur={blur} />
              </Field>
              <p style={{ width: "100%", fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                All fields on this step are optional but strongly recommended.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, gap: 10 }}>
            {step > 1
              ? <button onClick={() => { setError(""); setStep(s => (s - 1) as Step); }} style={{ padding: "10px 20px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                  ← Back
                </button>
              : <div />
            }
            {step < 3
              ? <button onClick={next} style={{ padding: "10px 24px", background: "var(--blue)", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui)", boxShadow: "0 2px 10px rgba(59,140,248,0.3)" }}>
                  Continue →
                </button>
              : <button onClick={submit} disabled={loading} style={{ padding: "10px 28px", background: "var(--emerald)", border: "none", borderRadius: 8, color: "#0b1220", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "var(--font-ui)", opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Creating account…" : "✓  Complete Registration"}
                </button>
            }
          </div>
        </div>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--blue)", textDecoration: "none", fontWeight: 500 }}>Sign in →</Link>
        </div>
      </div>
    </div>
  );
}