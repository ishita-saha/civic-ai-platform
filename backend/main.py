from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import logging
from supabase import create_client, Client

app = FastAPI(title="CivicFix AI API")

# Enable global CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        logging.error(f"Supabase init error: {e}")

class ComplaintCreate(BaseModel):
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photo_url: Optional[str] = None

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
            detail="Supabase client not initialized. Verify environment variables."
        )
    
    try:
        payload = {
            "description": complaint.description,
            "latitude": complaint.latitude,
            "longitude": complaint.longitude,
            "photo_url": complaint.photo_url
        }
        clean_payload = {k: v for k, v in payload.items() if v is not None}
        
        response = supabase.table("complaints").insert(clean_payload).execute()
        return response.data
    except Exception as e:
        logging.error(f"Insert error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
