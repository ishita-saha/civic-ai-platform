from fastapi import FastAPI, HTTPException
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


def get_model():
    """Helper to return available Gemini Flash model safely."""
    try:
        return genai.GenerativeModel("gemini-1.5-flash")
    except Exception:
        return genai.GenerativeModel("gemini-1.5-flash-latest")


class ComplaintCreate(BaseModel):
    description: str
    latitude: Optional[float] = 0.0
    longitude: Optional[float] = 0.0
    photo_url: Optional[str] = None


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

        model = get_model()
        prompt = """
        You are a civic infrastructure inspector. Analyze this complaint image.
        Classify the image strictly into one of these exact categories:
        ["Pothole", "Waterlogging", "Waste", "Streetlight", "Drainage"]

        Assess the severity as one of: ["Low", "Medium", "High"].
        Provide a confidence score between 0.00 and 1.00.

        Respond ONLY with a valid JSON object:
        {"category": "Pothole", "severity": "High", "confidence": 0.95}
        """

        response = model.generate_content([prompt, {"mime_type": mime_type, "data": image_data}])
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
    if not GEMINI_API_KEY:
        return f"• Classified as {complaint_data.get('severity', 'Medium')} severity.\n• Nearby count: {complaint_data.get('density', 0)}.\n• Priority score evaluated."

    try:
        model = get_model()
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
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logging.error(f"Error in explanation generation: {e}")
        return f"• Classified as {complaint_data.get('severity')} severity.\n• Priority score assigned."


# --- MODULE 4 & 5: CLUSTERING & ROOT CAUSE ANALYSIS ---
def generate_root_cause(cluster_summary: dict) -> str:
    if not GEMINI_API_KEY:
        return f"Likely infrastructure degradation in the area resulting in repeated {cluster_summary.get('category', 'civic')} issues."

    try:
        model = get_model()
        prompt = f"""
        Analyze this civic complaint cluster:
        - Complaint Count: {cluster_summary.get('count')}
        - Primary Category: {cluster_summary.get('category')}
        - Sample Descriptions: {cluster_summary.get('descriptions')}

        Write exactly ONE concise, professional sentence explaining the probable root cause of this localized hotspot.
        Example: "Likely blocked subsurface drainage due to recent heavy rainfall and accumulated debris."
        """
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logging.error(f"Error generating root cause: {e}")
        return f"Likely localized infrastructure deterioration causing recurring {cluster_summary.get('category')} complaints."


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


@app.get("/complaints")
def get_complaints():
    if not supabase:
        return []
    try:
        response = supabase.table("complaints").select("*").execute()
        return response.data
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

        model = get_model()
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

        response = model.generate_content(prompt)
        return {
            "question": question,
            "answer": response.text.strip(),
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
