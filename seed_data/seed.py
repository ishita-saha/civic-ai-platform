import os
import json
import urllib.request
import urllib.error
import random
from datetime import datetime, timedelta

# Load environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Load from backend/.env if present
env_path = os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip() and not line.startswith("#") and "=" in line:
                k, v = line.strip().split("=", 1)
                k = k.strip()
                v = v.strip("\"'")
                if k == "SUPABASE_URL":
                    SUPABASE_URL = v
                elif k in ["SUPABASE_KEY", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] and not SUPABASE_KEY:
                    SUPABASE_KEY = v

clean_url = SUPABASE_URL.rstrip('/')
if clean_url.endswith('/rest/v1'):
    clean_url = clean_url[:-8]

print(f"Connecting to Supabase base URL: {clean_url}")

rest_url = f"{clean_url}/rest/v1/complaints"
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# 1. Try to fetch existing rows to see what status value is currently stored
print("🔍 Step 1: Checking existing records in 'complaints' table...")
get_req = urllib.request.Request(f"{rest_url}?select=status&limit=5", headers=headers, method="GET")
existing_status = None
try:
    with urllib.request.urlopen(get_req) as response:
        rows = json.loads(response.read().decode("utf-8"))
        if rows and len(rows) > 0 and rows[0].get("status"):
            existing_status = rows[0]["status"]
            print(f"  Found existing row with status: '{existing_status}'")
except Exception as e:
    print(f"  Could not read existing rows: {e}")

# 2. Detailed Probe Test with Error Logging
candidate_statuses = [
    "pending", "Pending", "open", "Open", "OPEN",
    "in_progress", "In Progress", "In-Progress", "in-progress", "IN_PROGRESS",
    "resolved", "Resolved", "RESOLVED", "closed", "Closed"
]

valid_open = existing_status
valid_in_prog = None
valid_res = None

if not valid_open:
    print("\n🔍 Step 2: Probing candidate status values...")
    for st in candidate_statuses:
        # Include minimal fields
        test_payload = [{
            "description": "SCHEMA_PROBE",
            "category": "Pothole",
            "latitude": 22.5726,
            "longitude": 88.3639,
            "status": st
        }]
        req = urllib.request.Request(rest_url, data=json.dumps(test_payload).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                print(f"  ✅ SUCCESS for status: '{st}'")
                # Clean up probe row
                if res_data and len(res_data) > 0 and "id" in res_data[0]:
                    del_url = f"{rest_url}?id=eq.{res_data[0]['id']}"
                    del_req = urllib.request.Request(del_url, headers=headers, method="DELETE")
                    try:
                        urllib.request.urlopen(del_req)
                    except Exception:
                        pass
                
                if st in ["pending", "Pending", "open", "Open", "OPEN"]:
                    valid_open = st
                elif st in ["in_progress", "In Progress", "In-Progress", "in-progress", "IN_PROGRESS"]:
                    valid_in_prog = st
                elif st in ["resolved", "Resolved", "RESOLVED", "closed", "Closed"]:
                    valid_res = st
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode('utf-8')
            print(f"  ❌ FAILED '{st}': {err_msg}")

if not valid_open:
    print("\n❌ Could not find a valid status value. Please check the logs above.")
    exit(1)

if not valid_in_prog:
    valid_in_prog = valid_open
if not valid_res:
    valid_res = valid_open

print(f"\n🚀 Proceeding with: Open='{valid_open}', In Progress='{valid_in_prog}', Resolved='{valid_res}'")

HOTSPOT_1_BASE = (22.5726, 88.3639) # Central Market
HOTSPOT_2_BASE = (22.5801, 88.3752) # East Riverside
HOTSPOT_3_BASE = (22.5610, 88.4020) # South Tech Park

descriptions_by_cat = {
    "Pothole": [
        "Large deep pothole causing severe traffic congestion.",
        "Multiple cracks and sharp asphalt edges damaging car tires.",
        "Recent rain enlarged existing road fracture near crossing.",
        "Hazardous pothole right in front of bus stop.",
        "Deep crater on main arterial road disrupting two-wheelers."
    ],
    "Waterlogging": [
        "Water accumulating up to knee level after light rain.",
        "Drainage channel blocked by debris causing stagnant water hazard.",
        "Low-lying road section completely submerged.",
        "Stormwater drain overflowing into pedestrian sidewalk.",
        "Severe waterlogging preventing vehicles from passing."
    ],
    "Waste": [
        "Overflowing municipal dumpsters spreading foul odor.",
        "Uncollected commercial packaging waste blocking alleyway.",
        "Illegal dumping of construction debris along roadway.",
        "Garbage pile accumulating for over 5 days near market area.",
        "Hazardous solid waste scattered near residential entrance."
    ],
    "Streetlight": [
        "Multiple consecutive streetlights dark, creating safety risk at night.",
        "Flickering LED lamp pole with exposed wiring near junction.",
        "Damaged light fixture following high wind storm.",
        "Entire stretch of street without functional public lighting."
    ],
    "Drainage": [
        "Broken drainage grate cover posing fall risk to pedestrians.",
        "Blocked storm sewer emitting strong unpleasant odor.",
        "Collapsed drainage pipe causing surface water backup.",
        "Clogged runoff drain during morning peak hours."
    ]
}

complaints_batch = []
now = datetime.now()

# Hotspot 1 - Pothole Cluster (15)
for i in range(15):
    lat = HOTSPOT_1_BASE[0] + random.uniform(-0.0012, 0.0012)
    lng = HOTSPOT_1_BASE[1] + random.uniform(-0.0012, 0.0012)
    created_at = now - timedelta(days=random.randint(1, 6), hours=random.randint(0, 12))
    complaints_batch.append({
        "description": f"Central Market Cluster #{i+1}: " + random.choice(descriptions_by_cat["Pothole"]),
        "category": "Pothole",
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "status": random.choice([valid_open, valid_open, valid_in_prog]),
        "priority_score": round(random.uniform(75.0, 98.0), 1),
        "created_at": created_at.isoformat(),
        "cluster_explanation": "Severe road degradation cluster with high risk of traffic disruption and vehicle damage."
    })

# Hotspot 2 - Waterlogging Cluster (14)
for i in range(14):
    lat = HOTSPOT_2_BASE[0] + random.uniform(-0.0010, 0.0010)
    lng = HOTSPOT_2_BASE[1] + random.uniform(-0.0010, 0.0010)
    created_at = now - timedelta(days=random.randint(2, 5), hours=random.randint(0, 10))
    complaints_batch.append({
        "description": f"East Riverside Cluster #{i+1}: " + random.choice(descriptions_by_cat["Waterlogging"]),
        "category": "Waterlogging",
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "status": random.choice([valid_open, valid_in_prog]),
        "priority_score": round(random.uniform(80.0, 99.0), 1),
        "created_at": created_at.isoformat(),
        "cluster_explanation": "Critical stormwater drainage blockage causing localized flood hazard."
    })

# Hotspot 3 - Waste Cluster (12)
for i in range(12):
    lat = HOTSPOT_3_BASE[0] + random.uniform(-0.0011, 0.0011)
    lng = HOTSPOT_3_BASE[1] + random.uniform(-0.0011, 0.0011)
    created_at = now - timedelta(days=random.randint(1, 4), hours=random.randint(0, 8))
    complaints_batch.append({
        "description": f"South Tech Park Cluster #{i+1}: " + random.choice(descriptions_by_cat["Waste"]),
        "category": "Waste",
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "status": random.choice([valid_open, valid_in_prog]),
        "priority_score": round(random.uniform(65.0, 88.0), 1),
        "created_at": created_at.isoformat(),
        "cluster_explanation": "Uncollected commercial/residential refuse accumulation requiring immediate sanitation dispatch."
    })

# Scattered Complaints (50)
CATEGORIES = ["Pothole", "Waterlogging", "Waste", "Streetlight", "Drainage"]
wards = ["North District", "Central Market", "East Riverside", "South Tech Park", "West Suburbs"]
statuses = [valid_open, valid_in_prog, valid_res]

for i in range(50):
    cat = random.choice(CATEGORIES)
    ward = random.choice(wards)
    status = random.choice(statuses)
    lat = 22.5400 + random.uniform(0.0000, 0.0800)
    lng = 88.3300 + random.uniform(0.0000, 0.0900)
    created_at = now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
    p_score = round(random.uniform(10.0, 70.0), 1)
    if status == valid_res:
        p_score = round(p_score * 0.3, 1)

    complaints_batch.append({
        "description": f"[{ward}] {cat} issue: " + random.choice(descriptions_by_cat[cat]),
        "category": cat,
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "status": status,
        "priority_score": p_score,
        "created_at": created_at.isoformat(),
        "cluster_explanation": None
    })

print(f"\nInserting {len(complaints_batch)} complaint records into Supabase...")

req = urllib.request.Request(rest_url, data=json.dumps(complaints_batch).encode("utf-8"), headers=headers, method="POST")

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode("utf-8"))
        print("\n🎉 SEED SUCCESSFUL!")
        print(f"Successfully inserted {len(result)} records into Supabase table 'complaints'!")
except urllib.error.HTTPError as e:
    print(f"\n❌ HTTP Error {e.code}: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"\n❌ Failed to insert seed data: {e}")
