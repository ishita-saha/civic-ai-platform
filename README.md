# CivicFix AI — Civic Issue Reporting & AI Routing Platform

An AI-powered civic issue management platform built with React, FastAPI, Supabase, and AI Vision/RAG models.

## 🚀 Key Technical Differentiators

| Core Aspect | Standard Civic Tools | CivicFix AI Platform |
| :--- | :--- | :--- |
| **Location Verification** | Manual drop-downs or unverified user text | Strict Browser Geolocation Enforcement with GPS coordinate verification |
| **Duplicate Management** | None (leads to ticket spam) | Spatial Clustering (DBSCAN) to aggregate reports in close geographic proximity |
| **Issue Classification & Routing** | Manual human triaging & static form dispatch | AI Vision Classification & RAG-based semantic matching to municipal SLA rules |
| **Post-Resolution Integrity** | Unverified status toggle | Proof-of-Work Photo Upload with AI/GPS cross-verification |
| **Accountability & Auditing** | Generic resolved state | Inspector Work Reviewer Designation, Employee Audit ID, and Reviewer Metadata |

## 💡 Why Our Solution is Better

- **Zero Duplicate Noise**: Built-in spatial clustering (DBSCAN) prevents identical complaints from clogging municipal queues.
- **Tamper-Proof Resolution**: Field officers cannot arbitrarily close tickets without cross-verified proof-of-work photos and location metadata.
- **Automated Routing**: RAG-driven department matching replaces slow manual triaging with precise SLA rule routing.
- **End-to-End Audit Trail**: Employee IDs and inspector metadata are stored for every resolution step, ensuring complete municipal accountability.

## 🛠️ Tech Stack & Architecture

- **Frontend**: React.js, Vite, Tailwind CSS, Lucide Icons
- **Backend**: FastAPI (Python), Supabase (PostgreSQL / Storage / Auth)
- **AI & Analytics**: AI Vision Models (Issue Detection & Severity Scoring), RAG (Retrieval-Augmented Generation for SLA rules), DBSCAN (Spatial Clustering)

## 📁 Project Structure

- **`backend/`**: FastAPI server, AI modules (Vision/RAG), DBSCAN clustering, Supabase integration
- **`frontend/`**: React + Vite application featuring Admin Analytics and Citizen Reporting

## 🛠️ Local Setup

### Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
