"""
Spotit — in-memory API.

Everything lives in the module-level lists below. Restart the process and it is
all gone; that is deliberate for a demo build, and it is the reason `models.py`
and `routers/` exist unused (see ARCHITECTURE.md).

Three things this file owns that the frontend cannot:

  1. **Accounts.** One admin (Ishita) that cannot be created through signup, plus
     citizen accounts. Signup only ever mints citizens.
  2. **Upvotes.** A community score is only meaningful if it is shared. Holding
     the tally here means two browsers see the same number.
  3. **Severity.** Classified from the report's own words when it is filed, so
     the admin queue can rank by "how bad" independently of "how popular".

Passwords are stored and compared in plaintext. That is honest about what this
is — a demo with the credentials printed on the login screen — not an oversight
to be papered over with a hash. Nothing here is a substitute for real auth.
"""

from datetime import datetime, timedelta, timezone
from itertools import count
from typing import Any, Dict, List, Optional
import io
import json
import os
import uuid

from dotenv import load_dotenv
from google import genai
from supabase import Client, create_client

from fastapi import Depends, FastAPI, Header, HTTPException, status, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, ImageStat, ImageFilter

load_dotenv()

# ==========================================================================
# Gemini configuration
# ==========================================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not configured")

gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# ==========================================================================
# Supabase Storage configuration
#
# The service/secret key is backend-only. Never expose it to React or commit
# it to GitHub. If these variables are missing, the app still runs and the
# complaint remains in the in-memory MVP, but the image is not persisted.
# ==========================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = (
    os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SECRET_KEY")
)
SUPABASE_STORAGE_BUCKET = os.getenv(
    "SUPABASE_STORAGE_BUCKET",
    "complaint-images",
)

supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print(
            f"Supabase Storage enabled · bucket: {SUPABASE_STORAGE_BUCKET}"
        )
    except Exception as exc:
        print(f"Supabase initialization failed: {exc}")
        supabase = None
else:
    print(
        "Supabase Storage not configured. "
        "Set SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env."
    )

app = FastAPI(title="Spotit API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# The admin proves itself with this header. It is handed out once, in the login
# response for the admin account, so it never sits in the JS bundle the way a
# hardcoded frontend password would. Still a shared secret — see ARCHITECTURE.md.
ADMIN_SECRET_KEY = "spotit-admin-2026"


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def hours_ago(h: float) -> str:
    return iso(now() - timedelta(hours=h))


# ==========================================================================
# Severity classification
#
# A keyword pass over the report's own text. This is not the vision model the
# README talks about; it is a stand-in that is at least explainable — you can
# read a report and predict what it will score, which a black box would not give
# you. `backend/ai/priority.py` is where a real model would replace it.
# ==========================================================================

CRITICAL_WORDS = (
    "collapse", "collapsed", "live wire", "livewire", "electrocut", "gas leak",
    "sewage overflow", "fire", "sinkhole", "accident", "injury", "injured",
    "flood", "flooding", "contaminat", "exposed wire", "open manhole",
    "manhole open", "landslide", "burst pipe", "transformer", "danger",
    "emergency", "child", "hospital", "school gate",
)

HIGH_WORDS = (
    "pothole", "overflow", "garbage", "blocked drain", "no water", "waterlog",
    "water logging", "streetlight", "street light", "dark", "leak", "broken",
    "damaged", "stray dog", "sewage", "drain", "unsafe", "deep", "traffic",
    "water supply", "pressure", "outage", "blocked",
)

MODERATE_WORDS = (
    "crack", "faded", "stagnant", "delay", "noise", "encroach", "uneven",
    "litter", "bin", "signage", "sign board", "weeds", "paint",
)

SEVERITY_BASE = {"critical": 78, "high": 60, "moderate": 42, "low": 26}

# Popularity moves a case up the queue but never outranks severity on its own:
# capped at 22 points, which is one band's worth. Ten neighbours annoyed about
# a faded sign should not outrank a live wire nobody has upvoted yet.
UPVOTE_POINTS = 2.5
UPVOTE_CAP = 22

DEPARTMENTS = {
    "Roads": "Public Works Department (PWD)",
    "Sanitation": "Solid Waste Management Dept.",
    "Lighting": "Electrical & Street Lighting Dept.",
    "Water": "Water Supply Department",
    "Drainage": "Drainage & Sewerage Dept.",
    "Electricity": "Electricity Department",
}


def classify_severity(*parts: Optional[str]) -> str:
    blob = " ".join(p for p in parts if p).lower()
    if any(w in blob for w in CRITICAL_WORDS):
        return "critical"
    if any(w in blob for w in HIGH_WORDS):
        return "high"
    if any(w in blob for w in MODERATE_WORDS):
        return "moderate"
    return "low"

    
    
    
    
def analyze_image_severity(image_bytes: bytes) -> Dict[str, Any]:
    """
    Lightweight image-assisted severity analysis.

    This does not replace the existing text-based severity classifier.
    It extracts visual risk signals from the uploaded image and gives
    the triage engine an additional, conservative signal.
    """

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Resize so analysis stays fast even for large phone photos.
        image.thumbnail((256, 256))

        # Basic brightness and contrast.
        grayscale = image.convert("L")
        stats = ImageStat.Stat(grayscale)

        brightness = stats.mean[0]
        contrast = stats.stddev[0]

        # Edge density gives us a simple measure of visible structure/
        # damage-like boundaries without requiring a large ML model.
        edges = grayscale.filter(ImageFilter.FIND_EDGES)
        edge_stats = ImageStat.Stat(edges)
        edge_strength = edge_stats.mean[0]

        signals = []

        if brightness < 45:
            signals.append("very_dark_image")

        if contrast > 70:
            signals.append("high_contrast")

        if edge_strength > 35:
            signals.append("strong_visual_edges")

        # Conservative visual score.
        visual_score = 0

        if brightness < 45:
            visual_score += 5

        if contrast > 70:
            visual_score += 5

        if edge_strength > 35:
            visual_score += 5

        visual_score = min(visual_score, 15)

        if visual_score >= 10:
            image_severity = "high"
        elif visual_score >= 5:
            image_severity = "moderate"
        else:
            image_severity = "low"

        return {
            "available": True,
            "severity": image_severity,
            "visual_score": visual_score,
            "signals": signals,
            "brightness": round(brightness, 2),
            "contrast": round(contrast, 2),
            "edge_strength": round(edge_strength, 2),
        }

    except Exception as exc:
        return {
            "available": False,
            "severity": "low",
            "visual_score": 0,
            "signals": [],
            "error": str(exc),
        }


def priority_of(record: Dict[str, Any]) -> float:
    base = SEVERITY_BASE.get(record.get("severity", "low"), SEVERITY_BASE["low"])
    boost = min(len(record.get("voters", [])) * UPVOTE_POINTS, UPVOTE_CAP)
    return round(min(base + boost, 100), 1)


def rescore(record: Dict[str, Any]) -> Dict[str, Any]:
    """Recompute the derived columns after anything mutates a record."""
    record["upvotes"] = len(record.get("voters", []))
    record["priority_score"] = priority_of(record)
    return record


# ==========================================================================
# Accounts
# ==========================================================================

USERS: List[Dict[str, Any]] = [
    {
        "id": "admin-ishita",
        "name": "Ishita",
        "email": "ishita@spotit.gov.in",
        "password": "admin123",
        "role": "admin",
        "title": "Municipal Commissioner",
        "emp_id": "ADM-KMC-0001",
        "created_at": hours_ago(24 * 90),
    },
    {
        "id": "u1",
        "name": "Aritra Ganguly",
        "email": "aritra@demo.in",
        "password": "civic123",
        "role": "citizen",
        "title": "Resident, Ward 62",
        "created_at": hours_ago(24 * 40),
    },
    {
        "id": "u2",
        "name": "Priya Roy",
        "email": "priya@demo.in",
        "password": "civic123",
        "role": "citizen",
        "title": "Resident, Ward 58",
        "created_at": hours_ago(24 * 33),
    },
    {
        "id": "u3",
        "name": "Farhan Alam",
        "email": "farhan@demo.in",
        "password": "civic123",
        "role": "citizen",
        "title": "Shopkeeper, Central Market",
        "created_at": hours_ago(24 * 21),
    },
    {
        "id": "u4",
        "name": "Meera Nair",
        "email": "meera@demo.in",
        "password": "civic123",
        "role": "citizen",
        "title": "Resident, Park Avenue",
        "created_at": hours_ago(24 * 12),
    },
    {
        "id": "u5",
        "name": "Debjit Sarkar",
        "email": "debjit@demo.in",
        "password": "civic123",
        "role": "citizen",
        "title": "Resident, East Riverside",
        "created_at": hours_ago(24 * 5),
    },
]

_user_ids = count(6)


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """Everything about a user except the one field that must never leave."""
    out = {k: v for k, v in user.items() if k != "password"}
    if user["role"] == "admin":
        out["admin_key"] = ADMIN_SECRET_KEY
    return out


def find_user(email: str) -> Optional[Dict[str, Any]]:
    target = (email or "").strip().lower()
    return next((u for u in USERS if u["email"].lower() == target), None)


def user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    return next((u for u in USERS if u["id"] == user_id), None)


def require_admin(x_admin_key: str = Header(None)):
    if x_admin_key != ADMIN_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Only the admin account can do that.",
        )


# ==========================================================================
# Community posts
#
# Same records the staff dashboard calls complaints. A post and a complaint are
# the same thing seen from two ends — keeping them one list is why an upvote on
# the community feed moves the case in the admin queue.
# ==========================================================================

_complaint_ids = count(1)


def make_post(
    *,
    author: Dict[str, Any],
    title: str,
    description: str,
    category: str,
    location: str,
    geotag: Optional[Dict[str, float]] = None,
    voters: Optional[List[str]] = None,
    filed_hours_ago: float = 1,
    status_value: str = "Pending",
    verified_by: Optional[str] = None,
    **extra: Any,
) -> Dict[str, Any]:
    record: Dict[str, Any] = {
        "id": next(_complaint_ids),
        "title": title,
        "description": description,
        "category": category,
        "location": location,
        "geotag": geotag,
        "latitude": geotag["lat"] if geotag else None,
        "longitude": geotag["lng"] if geotag else None,
        "author": {"id": author["id"], "name": author["name"], "title": author.get("title")},
        # The dashboard reads `complainant` for the "who do we call back" column.
        # A community post has the same answer under a different name.
        "complainant": {"fullName": author["name"], "email": author["email"], "phone": None},
        "severity": classify_severity(title, description, category),
        "department": DEPARTMENTS.get(category, "Municipal Services"),
        "voters": list(voters or []),
        "status": status_value,
        "verified": verified_by is not None,
        "verified_by": verified_by,
        "verified_at": hours_ago(filed_hours_ago / 2) if verified_by else None,
        "timestamp": hours_ago(filed_hours_ago),
        "created_at": hours_ago(filed_hours_ago),
        "history": [{"status": "Pending", "note": "Filed from the community feed.",
                     "at": hours_ago(filed_hours_ago)}],
        "image_url": None,
        "image_storage_path": None,
    }
    record.update(extra)
    return rescore(record)


def _seed() -> List[Dict[str, Any]]:
    by_email = {u["email"]: u for u in USERS}
    a, p, f, m, d = (
        by_email["aritra@demo.in"],
        by_email["priya@demo.in"],
        by_email["farhan@demo.in"],
        by_email["meera@demo.in"],
        by_email["debjit@demo.in"],
    )
    return [
        make_post(
            author=f,
            title="Open manhole outside Central Market gate",
            description=(
                "The cover has been missing for four days. It is right where the "
                "school queue forms in the morning and a child nearly went in on Tuesday."
            ),
            category="Drainage",
            location="Central Market, Gate 2",
            geotag={"lat": 22.5697, "lng": 88.3698},
            voters=["u1", "u2", "u4", "u5"],
            filed_hours_ago=76,
        ),
        make_post(
            author=a,
            title="Severe pothole slowing traffic near Central Market",
            description=(
                "Deep pothole across the inside lane. Two-wheelers swerve into the "
                "opposite lane to avoid it and there have been three near misses this week."
            ),
            category="Roads",
            location="Kolkata Central Market",
            geotag={"lat": 22.5701, "lng": 88.3671},
            voters=["u2", "u3", "u5"],
            filed_hours_ago=52,
        ),
        make_post(
            author=d,
            title="Garbage not cleared in East Riverside for three days",
            description=(
                "Both bins overflowing onto the footpath. Stray dogs are pulling it "
                "into the road and the smell reaches the flats above."
            ),
            category="Sanitation",
            location="East Riverside Drive",
            geotag={"lat": 22.5748, "lng": 88.3612},
            voters=["u1", "u4"],
            filed_hours_ago=40,
            status_value="In Progress",
            verified_by="Ishita",
            officer_assigned="Sub-Eng. S. Mukherjee",
        ),
        make_post(
            author=m,
            title="Street light out on Park Avenue since last week",
            description=(
                "Whole stretch between the pharmacy and the bus stop is dark after 7pm. "
                "Women walking back from the late shift are taking the long way round."
            ),
            category="Lighting",
            location="Park Avenue, Zone 4",
            geotag={"lat": 22.5726, "lng": 88.3639},
            voters=["u1", "u2", "u3", "u5"],
            filed_hours_ago=30,
        ),
        make_post(
            author=p,
            title="Water supply pressure very low in Ward 58",
            description=(
                "Taps run for about ten minutes in the morning and then nothing. "
                "It has been like this since the mains work finished."
            ),
            category="Water",
            location="Ward 58, Block C",
            geotag={"lat": 22.5663, "lng": 88.3585},
            voters=["u3"],
            filed_hours_ago=18,
        ),
        make_post(
            author=p,
            title="Faded zebra crossing outside the primary school",
            description="The paint has worn away almost completely. Drivers do not slow down for it any more.",
            category="Other",
            location="School Road, Ward 58",
            geotag={"lat": 22.5671, "lng": 88.3594},
            voters=["u4"],
            filed_hours_ago=9,
        ),
    ]


COMPLAINTS: List[Dict[str, Any]] = _seed()


def find_complaint(complaint_id: int) -> Dict[str, Any]:
    match = next((c for c in COMPLAINTS if c["id"] == complaint_id), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"No case matches reference #{complaint_id}.")
    return match


# ==========================================================================
# ==========================================================================
# Supabase image storage
# ==========================================================================

def upload_complaint_image(
    image_bytes: bytes,
    content_type: str,
    complaint_id: int,
) -> Dict[str, Any]:
    """
    Store a complaint evidence image in Supabase Storage and return its URL.

    The bucket must already exist. For this hackathon MVP, the bucket should
    be public so the frontend can display the returned URL directly.
    """

    if supabase is None:
        return {
            "stored": False,
            "url": None,
            "path": None,
            "error": "Supabase Storage is not configured.",
        }

    extension_by_type = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }
    extension = extension_by_type.get(content_type.lower(), "jpg")

    storage_path = (
        f"complaints/{complaint_id}/"
        f"{uuid.uuid4().hex}.{extension}"
    )

    try:
        supabase.storage.from_(SUPABASE_STORAGE_BUCKET).upload(
            path=storage_path,
            file=image_bytes,
            file_options={
                "content-type": content_type,
                "cache-control": "3600",
                "upsert": "false",
            },
        )

        public_url = supabase.storage.from_(
            SUPABASE_STORAGE_BUCKET
        ).get_public_url(storage_path)

        return {
            "stored": True,
            "url": public_url,
            "path": storage_path,
            "error": None,
        }

    except Exception as exc:
        print(f"Supabase image upload failed: {exc}")
        return {
            "stored": False,
            "url": None,
            "path": storage_path,
            "error": str(exc),
        }


# Request bodies
# ==========================================================================


class Credentials(BaseModel):
    email: str
    password: str


class SignupBody(BaseModel):
    name: str
    email: str
    password: str


class VoteBody(BaseModel):
    user_id: str


class StatusBody(BaseModel):
    status: str
    note: Optional[str] = None


class VerifyBody(BaseModel):
    note: Optional[str] = None
    verified_by: Optional[str] = None


class ElectricityUrgencyResult(BaseModel):
    is_electricity_issue: bool
    is_urgent: bool
    issue_type: str
    reason: str
    confidence: float


# ==========================================================================
# Routes
# ==========================================================================


@app.get("/")
def read_root():
    return {"message": "Civic AI Platform Backend Running", "users": len(USERS), "posts": len(COMPLAINTS)}


@app.post("/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(body: SignupBody):
    """
    Citizens only. There is exactly one admin and it is seeded above — no role
    field is read from this body, so no request can promote itself.
    """
    name = body.name.strip()
    email = body.email.strip().lower()

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Please enter your name.")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="That email address doesn't look right.")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Pick a password of at least 6 characters.")
    if find_user(email):
        raise HTTPException(status_code=409, detail="An account already uses that email. Try signing in.")

    user = {
        "id": f"u{next(_user_ids)}",
        "name": name,
        "email": email,
        "password": body.password,
        "role": "citizen",
        "title": "Resident",
        "created_at": iso(now()),
    }
    USERS.append(user)
    return public_user(user)


@app.post("/auth/login")
def login(body: Credentials):
    user = find_user(body.email)
    if not user or user["password"] != body.password:
        raise HTTPException(status_code=401, detail="That email and password combination is not recognised.")
    return public_user(user)


@app.get("/auth/demo-accounts")
def demo_accounts():
    """
    Powers the one-click sign-in buttons. Safe to expose *because* this is a demo
    with plaintext credentials by design; delete this route the moment it isn't.
    """
    return [
        {"name": u["name"], "email": u["email"], "password": u["password"],
         "role": u["role"], "title": u.get("title")}
        for u in USERS
        if u["id"] in {"admin-ishita", "u1", "u2", "u3"}
    ]


@app.get("/users")
def list_users():
    return [public_user(u) for u in USERS]


@app.get("/complaints")
def get_complaints():
    return COMPLAINTS


@app.get("/complaints/{complaint_id}")
def get_complaint(complaint_id: int):
    return find_complaint(complaint_id)


def analyze_electricity_urgency(title: str, description: str) -> Dict[str, Any]:
    """
    Use Gemini to determine whether an Electricity complaint needs
    immediate attention. This is semantic classification, not keyword matching.
    """
    prompt = f"""
You are an electricity complaint triage assistant for a civic issue reporting platform.

Analyze the complaint and determine whether it represents an urgent
electricity-related public safety hazard or significant service disruption.

Urgent examples include:
- fallen or live electrical wires
- sparking or exploding transformers
- fallen electrical poles
- dangerous damaged electrical boxes
- significant/local power outages

Use the meaning and context of the complaint, not exact keyword matching.
Do not invent facts.

Complaint title:
{title}

Complaint description:
{description}
"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": ElectricityUrgencyResult,
            },
        )

        result = ElectricityUrgencyResult.model_validate_json(response.text)
        result_data = result.model_dump()

        # Keep the model responsible for the classification while applying
        # a conservative confidence gate before triggering the emergency flow.
        result_data["is_urgent"] = bool(
            result.is_electricity_issue
            and result.is_urgent
            and result.confidence >= 0.70
        )

        return result_data

    except Exception as exc:
        print(f"Gemini electricity analysis failed: {exc}")
        return {
            "is_electricity_issue": True,
            "is_urgent": False,
            "issue_type": "analysis_unavailable",
            "reason": "Electricity urgency analysis was unavailable. Normal complaint processing will continue.",
            "confidence": 0.0,
            "error": str(exc),
        }


ELECTRICITY_EMERGENCY_CONTACT = {
    "name": "Rajesh Kumar",
    "designation": "Electrical Maintenance Engineer",
    "zone": "Zone 3",
    "phone": "1800-000-0000",
    "demo_contact": True,
}


@app.post("/complaints", status_code=status.HTTP_201_CREATED)
def create_complaint(data: Dict[Any, Any]):
    """
    Untyped on purpose: the citizen report form posts fields this file has never
    heard of (`geotag`, `image_name`, `complainant`) and they have to survive the
    round trip. Known keys are normalised, the rest are copied verbatim.
    """
    author_id = data.get("author_id")
    author = user_by_id(author_id) if author_id else None

    title = (data.get("title") or data.get("complaintText") or "New report").strip()
    description = (data.get("description") or "").strip()
    category = data.get("category") or "Other"
    geotag = data.get("geotag")

    electricity_analysis = None
    electricity_emergency = None

    if category == "Electricity":
        electricity_analysis = analyze_electricity_urgency(title, description)

        if electricity_analysis.get("is_urgent"):
            electricity_emergency = {
                "urgent": True,
                "contact": ELECTRICITY_EMERGENCY_CONTACT,
                "issue_type": electricity_analysis.get("issue_type"),
                "reason": electricity_analysis.get("reason"),
                "confidence": electricity_analysis.get("confidence"),
            }

    record: Dict[str, Any] = {
        "id": next(_complaint_ids),
        "title": title,
        "description": description,
        "category": category,
        "location": data.get("location") or "Kolkata",
        "geotag": geotag,
        "latitude": (geotag or {}).get("lat", data.get("latitude")),
        "longitude": (geotag or {}).get("lng", data.get("longitude")),
        "author": (
            {"id": author["id"], "name": author["name"], "title": author.get("title")}
            if author
            else data.get("author")
        ),
        "complainant": data.get("complainant")
        or ({"fullName": author["name"], "email": author["email"], "phone": None} if author else None),
        "severity": classify_severity(title, description, category),
        "department": DEPARTMENTS.get(category, "Municipal Services"),
        "voters": [],
        "status": "Pending",
        "verified": False,
        "verified_by": None,
        "verified_at": None,
        "timestamp": data.get("timestamp") or iso(now()),
        "created_at": iso(now()),
        "history": [{"status": "Pending", "note": "Report filed.", "at": iso(now())}],
        "image_url": data.get("image_url"),
        "image_storage_path": data.get("image_storage_path"),
    }

    if electricity_analysis is not None:
        record["electricity_analysis"] = electricity_analysis

    if electricity_emergency is not None:
        record["electricity_emergency"] = electricity_emergency

    for key, value in data.items():
        if key not in record and key != "author_id":
            record[key] = value

    rescore(record)
    COMPLAINTS.append(record)
    return {"status": "success", "data": record}
    
@app.post("/complaints/with-image", status_code=status.HTTP_201_CREATED)
async def create_complaint_with_image(
    payload: str = Form(...),
    image: UploadFile = File(...),
):
    """
    Create a civic complaint together with its uploaded photo.

    The existing /complaints endpoint remains untouched.
    This endpoint adds image-assisted severity for the new reporting flow.
    """

    # Validate that the uploaded file is actually an image.
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file.",
        )

    # Keep the upload small enough for a live demo.
    image_bytes = await image.read()

    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Image must be smaller than 10 MB.",
        )

    # Convert the JSON string from the frontend back into a dictionary.
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Invalid complaint data.",
        )

    # Analyze the actual uploaded image.
    image_analysis = analyze_image_severity(image_bytes)

    # Keep the existing text-based classifier as the primary signal.
    text_severity = classify_severity(
        data.get("title"),
        data.get("description"),
        data.get("category"),
    )

    severity_order = {
        "low": 0,
        "moderate": 1,
        "high": 2,
        "critical": 3,
    }

    # Conservative image-assisted adjustment:
    # the image can increase severity, but only by ONE level.
    final_severity = text_severity

    if image_analysis.get("available"):
        image_severity = image_analysis.get("severity", "low")

        text_rank = severity_order.get(text_severity, 0)
        image_rank = severity_order.get(image_severity, 0)

        if image_rank > text_rank:
            final_rank = min(text_rank + 1, 3)

            for severity, rank in severity_order.items():
                if rank == final_rank:
                    final_severity = severity
                    break

    # Show the image-assisted triage decision in the backend terminal.
    print("\n========== IMAGE-ASSISTED TRIAGE ==========")
    print(f"Image: {image.filename}")
    print(f"Text severity: {text_severity}")
    print(f"Image severity: {image_analysis.get('severity')}")
    print(f"Visual score: {image_analysis.get('visual_score')}")
    print(f"Signals: {image_analysis.get('signals')}")
    print(f"FINAL SEVERITY: {final_severity}")
    print("===========================================\n")

    # Add image information to the complaint payload.
    data["image_name"] = image.filename
    data["image_analysis"] = image_analysis
    data["text_severity"] = text_severity
    data["severity"] = final_severity

    # Reuse the existing complaint creation logic.
    result = create_complaint(data)

    # create_complaint recalculates severity from text, so restore our
    # final image-assisted severity afterwards.
    record = result["data"]
    record["text_severity"] = text_severity
    record["image_analysis"] = image_analysis
    record["severity"] = final_severity

    # ------------------------------------------------------------------
    # Permanent evidence storage
    # ------------------------------------------------------------------
    storage_result = upload_complaint_image(
        image_bytes=image_bytes,
        content_type=image.content_type,
        complaint_id=record["id"],
    )

    record["image_url"] = storage_result["url"]
    record["image_storage_path"] = storage_result["path"]
    record["image_storage_status"] = (
        "stored" if storage_result["stored"] else "not_stored"
    )

    if storage_result["error"]:
        record["image_storage_error"] = storage_result["error"]
    else:
        record.pop("image_storage_error", None)

    # Recalculate the priority score using the final severity.
    rescore(record)

    if record.get("electricity_analysis"):
        print("\n========== GEMINI ELECTRICITY TRIAGE ==========")
        print(f"Issue type: {record['electricity_analysis'].get('issue_type')}")
        print(f"Urgent: {record['electricity_analysis'].get('is_urgent')}")
        print(f"Confidence: {record['electricity_analysis'].get('confidence')}")
        print(f"Reason: {record['electricity_analysis'].get('reason')}")
        print("===============================================\n")

    return {
        "status": "success",
        "data": record,
        "image": {
            "stored": storage_result["stored"],
            "url": storage_result["url"],
            "path": storage_result["path"],
        },
    }

@app.post("/complaints/{complaint_id}/upvote")
def upvote(complaint_id: int, body: VoteBody):
    """
    Toggles. One vote per account, tracked by id rather than a bare counter so
    the same person cannot inflate a case by clicking twice — and so the button
    can show whether *you* already voted.
    """
    record = find_complaint(complaint_id)

    if not user_by_id(body.user_id):
        raise HTTPException(status_code=401, detail="Sign in before upvoting.")

    author_id = (record.get("author") or {}).get("id")
    if author_id and author_id == body.user_id:
        raise HTTPException(status_code=400, detail="You can't upvote your own report.")

    voters: List[str] = record.setdefault("voters", [])
    if body.user_id in voters:
        voters.remove(body.user_id)
    else:
        voters.append(body.user_id)

    return rescore(record)


@app.post("/complaints/{complaint_id}/verify", dependencies=[Depends(require_admin)])
def verify(complaint_id: int, body: VerifyBody):
    """
    The gate before any work is dispatched. Nothing moves to "In Progress" until
    a named person has said the report is real — see `update_status`.
    """
    record = find_complaint(complaint_id)
    record["verified"] = True
    record["verified_by"] = body.verified_by or "Ishita"
    record["verified_at"] = iso(now())
    record.setdefault("history", []).append(
        {
            "status": record.get("status", "Pending"),
            "note": body.note or f"Verified by {record['verified_by']}.",
            "at": iso(now()),
        }
    )
    return rescore(record)


@app.patch("/complaints/{complaint_id}/status", dependencies=[Depends(require_admin)])
def update_status(complaint_id: int, body: StatusBody):
    record = find_complaint(complaint_id)
    target = body.status.strip()

    moving_to_work = target.lower() in {"in progress", "resolved"}
    if moving_to_work and not record.get("verified"):
        raise HTTPException(
            status_code=409,
            detail="Verify this report before dispatching a crew to it.",
        )

    record["status"] = target
    if target.lower() == "resolved":
        record["resolved_at"] = iso(now())
    record.setdefault("history", []).append(
        {"status": target, "note": body.note, "at": iso(now())}
    )
    return rescore(record)


# ==========================================================================
# Starting it
#
# `python main.py` works as well as `uvicorn main:app --reload`. Without this
# block the first form runs the whole file, starts no server, exits 0 and
# prints nothing — which looks exactly like a backend that "isn't working".
# ==========================================================================

if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    print(f"Spotit API on http://127.0.0.1:{port}  ·  docs at /docs  ·  Ctrl-C to stop")
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
