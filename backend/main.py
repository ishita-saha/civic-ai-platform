from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
import re
import json
import logging
import requests
import numpy as np
from sklearn.cluster import DBSCAN
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


def call_gemini_safe(contents, default_fallback=""):
    if not GEMINI_API_KEY:
        return default_fallback

    candidate_models = ["gemini-1.5-flash-latest", "gemini-2.0-flash", "gemini-1.5-flash"]
    for model_name in candidate_models:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(contents)
            return response.text.strip()
        except Exception as e:
            logging.warning(f"Failed with {model_name}: {e}")
            continue

    return default_fallback


class ComplaintCreate(BaseModel):
    description: str
    latitude: Optional[float] = 0.0
    longitude: Optional[float] = 0.0
    photo_url: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str


class AssignWorker(BaseModel):
    assigned_to: str


class CitizenQuestion(BaseModel):
    question: str


# --- MODULE 1: VISION CLASSIFICATION ---
def classify_complaint_image(image_url: str) -> dict:
    if not GEMINI_API_KEY:
        return {"category": "Pothole", "severity": "Medium", "confidence": 0.8}

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        img_response = requests.get(image_url, headers=headers, timeout=10)
        img_response.raise_for_status()
        image_data = img_response.content
        mime_type = img_response.headers.get("Content-Type", "image/jpeg")
        if "text/html" in mime_type or "image" not in mime_type:
            mime_type = "image/jpeg"

        prompt = """
        You are a civic infrastructure inspector. Analyze this complaint image.
        Classify the image strictly into one of these exact categories:
        ["Pothole", "Waterlogging", "Waste", "Streetlight", "Drainage"]

        Assess the severity as one of: ["Low", "Medium", "High"].
        Provide a confidence score between 0.00 and 1.00.

        Respond ONLY with a valid JSON object:
        {"category": "Pothole", "severity": "High", "confidence": 0.95}
        """

        raw_text = call_gemini_safe([prompt, {"mime_type": mime_type, "data": image_data}])
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
    if not supabase or lat == 0.0 or lng == 0.0:
        return 0
    try:
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
        logging.error(f"Error calculating density: {e}")
        return 0


def determine_road_importance(description: str) -> int:
    text = description.lower()
    main_road_keywords = ["highway", "main road", "expressway", "avenue", "boulevard", "junction", "market", "station", "school", "hospital"]
    return 3 if any(kw in text for kw in main_road_keywords) else 1


def calculate_priority(severity: str, complaint_density: int, age_days: float, road_importance: int) -> float:
    severity_map = {"Low": 1, "Medium": 2, "High": 3}
    severity_score = severity_map.get(severity, 2)
    priority_score = (severity_score * 3) + (complaint_density * 2) + (age_days * 0.5) + (road_importance * 2)
    return round(priority_score, 2)


# --- MODULE 3: EXPLAINABLE AI ---
def generate_explanation(complaint_data: dict) -> str:
    fallback = (
        f"• Classified with {complaint_data.get('severity', 'Medium')} severity rating.\n"
        f"• Local complaint density count is {complaint_data.get('density', 0)} in 30 days.\n"
        f"• Evaluated road importance weight: {complaint_data.get('road_importance', 1)}."
    )
    prompt = f"""
    Explain why this civic complaint received its priority score of {complaint_data.get('priority_score')}.

    Input Parameters:
    - Severity: {complaint_data.get('severity')}
    - Category: {complaint_data.get('category')}
    - Complaint Density: {complaint_data.get('density')}
    - Road Importance: {complaint_data.get('road_importance')}
    - Description: "{complaint_data.get('description')}"

    Provide EXAGGERATEDLY CLEAR, 3 bullet points explaining why this complaint received its calculated priority score.
    Start each line with a bullet point symbol (•). Do not add any headings or extra text.
    """
    res = call_gemini_safe(prompt, fallback)
    return res if res else fallback


# --- MODULE 4 & 5: CLUSTERING & ROOT CAUSE ANALYSIS ---
def generate_root_cause(cluster_summary: dict) -> str:
    fallback = f"Likely infrastructure deterioration causing recurring {cluster_summary.get('category', 'civic')} complaints."
    prompt = f"""
    Analyze this civic complaint cluster:
    - Complaint Count: {cluster_summary.get('count')}
    - Primary Category: {cluster_summary.get('category')}
    - Sample Descriptions: {cluster_summary.get('descriptions')}

    Write exactly ONE concise, professional sentence explaining the probable root cause of this localized hotspot.
    Example: "Likely blocked subsurface drainage due to recent heavy rainfall and accumulated debris."
    """
    res = call_gemini_safe(prompt, fallback)
    return res if res else fallback


def cluster_complaints(complaints: List[dict]):
    if not complaints or len(complaints) == 0:
        return []

    coords, valid_complaints = [], []
    for c in complaints:
        lat, lng = c.get("latitude", 0.0), c.get("longitude", 0.0)
        if lat != 0.0 and lng != 0.0:
            coords.append([lat, lng])
            valid_complaints.append(c)

    if len(coords) == 0:
        return complaints

    db = DBSCAN(eps=0.002, min_samples=3).fit(np.array(coords))
    labels = db.labels_

    clusters_dict = {}

    for i, comp in enumerate(valid_complaints):
        cluster_id = int(labels[i]) if labels[i] != -1 else None
        comp["cluster_id"] = cluster_id

        if cluster_id is not None:
            if cluster_id not in clusters_dict:
                clusters_dict[cluster_id] = []
            clusters_dict[cluster_id].append(comp)

        try:
            supabase.table("complaints").update({"cluster_id": cluster_id}).eq("id", comp["id"]).execute()
        except Exception as e:
            logging.error(f"Failed to update cluster_id: {e}")

    for cid, items in clusters_dict.items():
        if len(items) >= 3:
            categories = [item.get("category", "Pothole") for item in items if item.get("category")]
            main_category = max(set(categories), key=categories.count) if categories else "Pothole"
            sample_desc = " | ".join([item.get("description", "") for item in items[:3]])

            summary = {"count": len(items), "category": main_category, "descriptions": sample_desc}
            root_cause = generate_root_cause(summary)

            for item in items:
                item["cluster_explanation"] = root_cause
                try:
                    supabase.table("complaints").update({"cluster_explanation": root_cause}).eq("id", item["id"]).execute()
                except Exception as e:
                    logging.error(f"Failed updating cluster_explanation: {e}")

    return complaints


# --- MODULE 6: RAG CITIZEN Q&A ---
def get_embedding(text: str) -> List[float]:
    try:
        res = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_query"
        )
        return res["embedding"]
    except Exception as e:
        logging.error(f"Embedding error: {e}")
        return []


@app.get("/")
def read_root():
    return {"message": "CivicFix AI Backend is running!"}


# --- STEP 3.1 & 3.2: ADMIN WORKFLOW & ON-THE-FLY SLA ESCALATION ---
@app.get("/complaints")
def get_complaints(
    category: Optional[str] = None,
    department_id: Optional[str] = None,
    priority_min: Optional[float] = Query(None),
    status: Optional[str] = None,
    location_search: Optional[str] = None
):
    if not supabase:
        return []
    try:
        query = supabase.table("complaints").select("*")

        if category:
            query = query.eq("category", category)
        if department_id:
            query = query.eq("department_id", department_id)
        if priority_min is not None:
            query = query.gte("priority_score", priority_min)
        if status:
            query = query.eq("status", status)
        if location_search:
            query = query.ilike("description", f"%{location_search}%")

        response = query.execute()
        records = response.data or []

        now = datetime.now(timezone.utc)
        for item in records:
            item_status = item.get("status", "submitted")
            last_updated_str = item.get("status_updated_at") or item.get("created_at")
            
            is_escalated = False
            effective_priority = float(item.get("priority_score") or 0.0)

            if item_status not in ["resolved", "closed"] and last_updated_str:
                try:
                    last_updated = datetime.fromisoformat(last_updated_str.replace("Z", "+00:00"))
                    time_diff = now - last_updated
                    if time_diff.total_seconds() > 86400:  # 24 Hours
                        is_escalated = True
                        effective_priority += 10.0
                except Exception as e:
                    logging.error(f"Date parsing error for SLA: {e}")

            item["is_escalated"] = is_escalated
            item["effective_priority_score"] = round(effective_priority, 2)

        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/complaints/{complaint_id}/status")
def update_complaint_status(complaint_id: str, payload: StatusUpdate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized.")

    valid_statuses = ["submitted", "acknowledged", "in_progress", "resolved", "closed"]
    new_status = payload.status.lower()

    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    try:
        current_res = supabase.table("complaints").select("status, user_id, category").eq("id", complaint_id).execute()
        if not current_res.data:
            raise HTTPException(status_code=404, detail="Complaint not found.")

        complaint_record = current_res.data[0]
        old_status = complaint_record.get("status", "submitted")
        user_id = complaint_record.get("user_id")
        category = complaint_record.get("category", "Complaint")
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Update status & timestamp
        update_res = supabase.table("complaints").update({
            "status": new_status,
            "status_updated_at": now_iso
        }).eq("id", complaint_id).execute()

        # 2. Append to status_history log
        try:
            supabase.table("status_history").insert({
                "complaint_id": complaint_id,
                "old_status": old_status,
                "new_status": new_status,
                "changed_at": now_iso
            }).execute()
        except Exception as e:
            logging.error(f"Failed logging status history: {e}")

        # 3. Create In-App Notification (STEP 3.3)
        try:
            readable_status = new_status.replace("_", " ").title()
            notification_message = f"Your {category} complaint status was updated to '{readable_status}'."
            
            notif_payload = {
                "complaint_id": complaint_id,
                "message": notification_message,
                "is_read": False,
                "created_at": now_iso
            }
            if user_id:
                notif_payload["user_id"] = user_id

            notif_res = supabase.table("notifications").insert(notif_payload).execute()
            print("NOTIFICATION CREATED:", notif_res.data)
        except Exception as e:
            print("NOTIFICATION FAILED:", str(e))
            logging.error(f"Failed generating in-app notification: {e}")

        return update_res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/complaints/{complaint_id}/assign")
def assign_field_worker(complaint_id: str, payload: AssignWorker):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized.")

    try:
        update_res = supabase.table("complaints").update({
            "assigned_to": payload.assigned_to
        }).eq("id", complaint_id).execute()

        if not update_res.data:
            raise HTTPException(status_code=404, detail="Complaint not found.")

        return update_res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- STEP 3.3: IN-APP NOTIFICATIONS API ---
@app.get("/notifications")
def get_notifications(user_id: Optional[str] = None):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized.")
    try:
        query = supabase.table("notifications").select("*").order("created_at", desc=True)
        if user_id:
            query = query.eq("user_id", user_id)
        res = query.execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized.")
    try:
        res = supabase.table("notifications").update({"is_read": True}).eq("id", notification_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Notification not found.")
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/clusters")
def get_clusters():
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized.")
    try:
        res = supabase.table("complaints").select("*").execute()
        clustered = cluster_complaints(res.data)
        return {"status": "success", "total_complaints": len(clustered), "complaints": clustered}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/kb/seed-embeddings")
def seed_embeddings():
    if not supabase or not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Supabase or Gemini key missing.")

    try:
        res = supabase.table("kb_chunks").select("id, content").execute()
        chunks = res.data or []
        updated_count = 0

        for chunk in chunks:
            vector = get_embedding(chunk["content"])
            if vector:
                supabase.table("kb_chunks").update({"embedding": vector}).eq("id", chunk["id"]).execute()
                updated_count += 1

        return {"status": "success", "updated_chunks": updated_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ask")
def ask_citizen_qna(query: CitizenQuestion):
    if not supabase or not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Supabase or Gemini key missing.")

    try:
        question = query.question
        question_vector = get_embedding(question)

        context_text = ""

        if question_vector:
            try:
                rpc_res = supabase.rpc("match_kb_chunks", {
                    "query_embedding": question_vector,
                    "match_threshold": 0.3,
                    "match_count": 3
                }).execute()
                matched_chunks = rpc_res.data
                context_text = "\n\n".join([f"[{c.get('title', 'SOP')}]: {c.get('content')}" for c in matched_chunks])
            except Exception:
                fallback_res = supabase.table("kb_chunks").select("title, content").limit(3).execute()
                context_text = "\n\n".join([f"[{c.get('title', 'SOP')}]: {c.get('content')}" for c in fallback_res.data])

        prompt = f"""
        You are a helpful civic AI customer service assistant.
        Answer the citizen's question using ONLY the retrieved municipal SOP facts below.

        Retrieved Municipal Guidance:
        {context_text}

        Citizen Question: "{question}"

        Instructions:
        - Keep answer direct, helpful, and concise (under 3 sentences).
        - If the exact answer isn't in the context, give a polite general response based on standard civic department protocols.
        """

        fallback_ans = "Potholes on emergency main roads are targeted for repair within 24 to 48 hours according to Public Works Department guidelines."
        answer = call_gemini_safe(prompt, fallback_ans)

        return {
            "question": question,
            "answer": answer,
            "sources_used": bool(context_text)
        }

    except Exception as e:
        logging.error(f"Error in /ask endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/complaints")
@app.post("/complaints/")
def create_complaint(complaint: ComplaintCreate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized.")

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

        insert_res = supabase.table("complaints").insert(payload).execute()
        created_record = insert_res.data[0]
        complaint_id = created_record["id"]

        category, severity, confidence = "Pothole", "Medium", 0.8
        if complaint.photo_url:
            ai_data = classify_complaint_image(complaint.photo_url)
            category = ai_data.get("category", "Pothole")
            severity = ai_data.get("severity", "Medium")
            confidence = ai_data.get("confidence", 0.8)

        density = get_complaint_density(lat, lng)
        road_importance = determine_road_importance(complaint.description)
        age_days = 0.0
        priority_score = calculate_priority(severity, density, age_days, road_importance)

        comp_context = {
            "description": complaint.description,
            "category": category,
            "severity": severity,
            "density": density,
            "road_importance": road_importance,
            "priority_score": priority_score
        }
        explanation = generate_explanation(comp_context)

        update_payload = {
            "category": category,
            "severity": severity,
            "confidence": confidence,
            "priority_score": priority_score,
            "ai_explanation": explanation
        }

        supabase.table("complaints").update(update_payload).eq("id", complaint_id).execute()
        created_record.update(update_payload)

        return created_record

    except Exception as e:
        logging.error(f"Insert error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
