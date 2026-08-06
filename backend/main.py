from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any, Dict

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mock_complaints = [
    {
        "id": 1,
        "title": "Severe Pothole near Central Market",
        "description": "Large pothole causing traffic slowdowns and damage.",
        "category": "Roads",
        "location": "Kolkata Central Market",
        "priority_score": 88,
        "status": "Pending"
    },
    {
        "id": 2,
        "title": "Garbage Accumulation in East Riverside",
        "description": "Overflowing bins not cleared for 3 days.",
        "category": "Sanitation",
        "location": "East Riverside Drive",
        "priority_score": 75,
        "status": "In Progress"
    }
]

@app.get("/")
def read_root():
    return {"message": "Civic AI Platform Backend Running"}

@app.get("/complaints")
def get_complaints():
    return mock_complaints

@app.post("/complaints")
def create_complaint(data: Dict[Any, Any]):
    new_entry = {
        "id": len(mock_complaints) + 1,
        "title": data.get("title", data.get("complaintText", "New Complaint")),
        "description": data.get("description", ""),
        "category": data.get("category", "General"),
        "location": data.location if hasattr(data, 'location') else data.get("location", "Kolkata"),
        "priority_score": 85,
        "status": "Pending"
    }
    # Copy any other fields passed from frontend
    for key, val in data.items():
        if key not in new_entry:
            new_entry[key] = val
            
    mock_complaints.append(new_entry)
    return {"status": "success", "data": new_entry}


# --- ADMIN SECURITY VERIFICATION ---
from fastapi import Header, HTTPException, status

ADMIN_SECRET_KEY = "civicfix-admin-2026"

def verify_admin_token(x_admin_key: str = Header(None)):
    if x_admin_key != ADMIN_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing X-Admin-Key header."
        )
