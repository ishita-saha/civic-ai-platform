from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import json
import logging
import requests
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
    genai.configure(api_key=GEMINI_API_KEY)


class ComplaintCreate(BaseModel):
    description: str
    latitude: Optional[float] = 0.0
    longitude: Optional[float] = 0.0
    photo_url: Optional[str] = None


def classify_complaint_image(image_url: str) -> dict:
    """
    Downloads an image from URL and sends it to Gemini 1.5 Flash for civic issue classification.
    Returns JSON with category, severity, and confidence score.
    """
    if not GEMINI_API_KEY:
        logging.warning("GEMINI_API_KEY not found. Skipping vision classification.")
        return {"category": None, "severity": None, "confidence": 0.0}

    try:
        # Download image bytes
        img_response = requests.get(image_url, timeout=10)
        img_response.raise_for_status()
        image_data = img_response.content
        mime_type = img_response.headers.get("Content-Type", "image/jpeg")

        # Initialize model
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = """
        Analyze this civic issue complaint photo.
        Classify the image strictly into one of these exact categories:
        ['Pothole', 'Waterlogging', 'Waste', 'Streetlight', 'Drainage']

        Assess the severity as one of: ['Low', 'Medium', 'High'].
        Provide a confidence score between 0.00 and 1.00.

        Respond ONLY with a valid JSON object matching this schema:
        {
            "category": "Pothole | Waterlogging | Waste | Streetlight | Drainage",
            "severity": "Low | Medium | High",
            "confidence": 0.95
        }
        Do not include markdown formatting, backticks, or extra text.
        """

        # API Call
        response = model.generate_content([
            prompt,
            {"mime_type": mime_type, "data": image_data}
        ])

        # Clean JSON response
        clean_text = response.text.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(clean_text)
        return result

    except Exception as e:
        logging.error(f"Error in vision classification: {e}")
        return {"category": None, "severity": None, "confidence": 0.0}


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
        raise HTTPException(
            status_code=500, 
            detail="Supabase client not initialized."
        )

    try:
        lat = complaint.latitude if complaint.latitude is not None else 0.0
        lng = complaint.longitude if complaint.longitude is not None else 0.0

        payload = {
            "description": complaint.description,
            "latitude": lat,
            "longitude": lng,
            "status": "submitted"
        }

        if complaint.photo_url:
            payload["photo_url"] = complaint.photo_url

        # 1. Insert original complaint record
        insert_res = supabase.table("complaints").insert(payload).execute()
        created_record = insert_res.data[0]
        complaint_id = created_record["id"]

        # 2. Trigger Vision AI classification if a photo is attached
        if complaint.photo_url:
            ai_data = classify_complaint_image(complaint.photo_url)

            # 3. Update the row with AI results
            update_payload = {
                "category": ai_data.get("category"),
                "severity": ai_data.get("severity"),
                "confidence": ai_data.get("confidence")
            }
            supabase.table("complaints").update(update_payload).eq("id", complaint_id).execute()
            
            created_record.update(update_payload)

        return created_record

    except Exception as e:
        logging.error(f"Insert error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
