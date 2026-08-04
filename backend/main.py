from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from supabase import create_client, Client

app = FastAPI(title="CivicFix AI API")

# Enable CORS for all frontend domains
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
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

class ComplaintCreate(BaseModel):
    description: str
    latitude: float = None
    longitude: float = None
    photo_url: str = None

@app.get("/")
def read_root():
    return {"message": "CivicFix AI Backend is running!"}

@app.get("/complaints")
def get_complaints():
    if not supabase:
        return []
    response = supabase.table("complaints").select("*").execute()
    return response.data

@app.post("/complaints")
@app.post("/complaints/")
def create_complaint(complaint: ComplaintCreate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection not configured")
    
    data = complaint.dict()
    response = supabase.table("complaints").insert(data).execute()
    return response.data
