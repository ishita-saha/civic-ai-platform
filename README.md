# CivicFix AI — Civic Issue Reporting & AI Routing Platform

An AI-powered civic issue management platform built with React, FastAPI, Supabase, and AI Vision/RAG models.

## 🚀 Features
- **Citizen Portal**: Report potholes, garbage, streetlights with location tagging and photo uploads.
- **AI Classification**: Automatic image vision model for issue detection and severity scoring.
- **RAG Routing**: Semantic matching of complaints to official municipal department SLA rules.
- **Admin Dashboard**: Real-time analytics, filtering, and automated ticket dispatch.

## 📁 Project Structure
- **backend/**: FastAPI server, AI modules (Vision/RAG), Supabase integration
- **frontend/**: React + Vite application deployed on Vercel

## 🛠️ Local Setup

### Backend (FastAPI)
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

### Frontend (React + Vite)
cd frontend
npm install
npm run dev
