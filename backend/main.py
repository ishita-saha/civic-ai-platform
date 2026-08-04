from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import re
import json
import logging
import requests
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client
import google.generativeai as genai

app = FastAPI(title="CivicFix AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment setup
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Initialize Supabase
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        logging.error(f"Supabase init error: {e}")

# Initialize Gemini
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as e:
        logging.error(f"Gemini config error: {e}")


class ComplaintCreate(BaseModel):
    description: str
    latitude: Optional[float] = 0.0
    longitude: Optional[float] = 0.0
    photo_url: Optional[str] = None


def classify_complaint_image(image_url: str) -> dict:
    if not GEMINI_API_KEY:
        logging.warning("GEMINI_API_KEY not found. Skipping vision classification.")
        return {"category": "Pothole", "severity": "Medium", "confidence": 0.8}

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        img_response = requests.get(image_url, headers=headers, timeout=10)
        img_response.raise_for_status()
        image_data = img_response.content
        mime_type = img_response.headers.get("Content-Type", "image/jpeg")
        if "text/html" in mime_type or "image" not in mime_type:
            mime_type = "image/jpeg"

        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = """
        You are a civic infrastructure inspector. Analyze this complaint image.
        Classify the image strictly into one of these exact categories:
        ["Pothole", "Waterlogging", "Waste", "Streetlight", "Drainage"]

        Assess the severity as one of: ["Low", "Medium", "High"].
        Provide a confidence score between 0.00 and 1.00.

        Respond ONLY with a valid JSON object matching this structure:
        {"category": "Pothole", "severity": "High", "confidence": 0.95}
        """

        response = model.generate_content([
            prompt,
            {"mime_type": mime_type, "data": image_data}
        ])

        raw_text = response.text.strip()
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group(0))
            return {
                "category": str(result.get("category", "Pothole")),
                "severity": str(result.get("severity", "Medium")),
                "confidence": float(result.get("confidence", 0.85))
            }
        return {"category": "Pothole", "severity": "Medium", "confidence": 0.8}

    except Exception as e:
        logging.error(f"Error in vision classification: {e}")
        return {"category": "Pothole", "severity": "Medium", "confidence": 0.8}


# --- MODULE 2: DETERMINISTIC PRIORITY ENGINE ---

def get_complaint_density(lat: float, lng: float) -> int:
    """Calculates density: count of complaints within ~200m in the last 30 days."""
    if not supabase or lat == 0.0 or lng == 0.0:
        return 0

    try:
        # Roughly 200m bounding box in degrees (~0.002 degrees latitude/longitude)
        delta = 0.002
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

        res = supabase.table("complaints") \
            .select("id") \
            .gte("latitude", lat - delta) \
            .lte("latitude", lat + delta) \
            .gte("longitude", lng - delta) \
            .lte("longitude", lng + delta) \
            .gte("created_at", thirty_days_ago) \
            .execute()

        return len(res.data) if res.data else 0
    except Exception as e:
        logging.error(f"Error calculating complaint density: {e}")
        return 0


def determine_road_importance(description: str) -> int:
    """Simple keyword lookup: Main roads/Highways = 3, Residential/Local = 1."""
    text = description.lower()
    main_road_keywords = ["highway", "main road", "expressway", "avenue", "boulevard", "junction", "market", "station", "school", "hospital"]
    if any(keyword in text for keyword in main_road_keywords):
        return 3
    return 1


def calculate_priority(severity: str, complaint_density: int, age_days: float, road_importance: int) -> float:
    """
    Transparent Priority Formula for Civic Infrastructure:
    Priority = (Severity Score * 3) + (Density * 2) + (Age in Days * 0.5) + (Road Importance * 2)
    """
    severity_map = {"Low": 1, "Medium": 2, "High": 3}
    severity_score = severity_map.get(severity, 2)
    
    priority_score = (severity_score * 3) + (complaint_density * 2) + (age_days * 0.5) + (road_importance * 2)
    return round(priority_score, 2)


@app.get("/")
def read_root():
    return {"message": "CivicFix AI Backend is running!"}


@app.get("/complaints")
def get_complaints():
    if not supabase:
        return []
    try:
        response = supabase.table("complaints").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/complaints")
@app.post("/complaints/")
def create_complaint(complaint: ComplaintCreate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized.")

    try:
        lat = complaint.latitude if complaint.latitude is not None else 0.0
        lng = complaint.longitude if complaint.longitude is not None else 0.0

        # Initial payload insertion
        payload = {
            "description": complaint.description,
            "latitude": lat,
            "longitude": lng,
            "status": "submitted"
        }

        if complaint.photo_url:
            payload["photo_url"] = complaint.photo_url

        insert_res = supabase.table("complaints").insert(payload).execute()
        created_record = insert_res.data[0]
        complaint_id = created_record["id"]

        # 1. Vision Classification (Category & Severity)
        category, severity, confidence = "Pothole", "Medium", 0.8
        if complaint.photo_url:
            ai_data = classify_complaint_image(complaint.photo_url)
            category = ai_data.get("category", "Pothole")
            severity = ai_data.get("severity", "Medium")
            confidence = ai_data.get("confidence", 0.8)

        # 2. Priority Calculation
        density = get_complaint_density(lat, lng)
        road_importance = determine_road_importance(complaint.description)
        age_days = 0.0  # Freshly submitted
        
        priority_score = calculate_priority(severity, density, age_days, road_importance)

        # 3. Update row in Supabase with Category, Severity, Confidence, and Priority Score
        update_payload = {
            "category": category,
            "severity": severity,
            "confidence": confidence,
            "priority_score": priority_score
        }

        supabase.table("complaints").update(update_payload).eq("id", complaint_id).execute()
        created_record.update(update_payload)

        return created_record

    except Exception as e:
        logging.error(f"Insert error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
