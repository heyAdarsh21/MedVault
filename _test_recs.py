import requests

# Test recommendations
r = requests.get('http://127.0.0.1:8000/api/v1/public/recommendations?limit=8', timeout=30)
data = r.json()
print("=== HOSPITAL RECOMMENDATIONS (sorted by score) ===")
for h in data:
    print(f"  {h['name']:40s} score={h['score']:.3f}  beds={h['available_beds']:5d}  wait={h['est_wait_min']:3d}m  {h['status']:15s}")

# Login once
tok_resp = requests.post('http://127.0.0.1:8000/api/v1/auth/login', json={"username":"admin","password":"admin123"}, timeout=10)
tok = tok_resp.json().get('access_token')
if not tok:
    print(f"Login failed: {tok_resp.json()}")
    exit(1)

headers = {"Authorization": f"Bearer {tok}"}

print("\n=== INTELLIGENCE PER HOSPITAL ===")
for h in data:
    try:
        r2 = requests.get(f"http://127.0.0.1:8000/api/v1/intelligence/system-health/{h['hospital_id']}", 
                          headers=headers, timeout=15)
        d = r2.json()
        kpis = d.get('kpis', {})
        print(f"  {h['name']:40s} eff={kpis.get('efficiency',0)*100:.0f}%  strain={kpis.get('strain_index',0):.3f}  risk={kpis.get('risk_level','?'):10s}  throughput={kpis.get('throughput',0):.1f}/hr")
    except Exception as e:
        print(f"  {h['name']:40s} ERROR: {e}")
