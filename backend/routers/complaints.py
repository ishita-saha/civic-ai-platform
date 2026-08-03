from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from database import get_db
import models
import schemas

router = APIRouter(
    prefix="/complaints",
    tags=["Complaints"]
)

@router.post("/", response_model=schemas.ComplaintResponse, status_code=status.HTTP_201_CREATED)
def create_complaint(complaint_in: schemas.ComplaintCreate, db: Session = Depends(get_db)):
    db_complaint = models.Complaint(**complaint_in.model_dump())
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    return db_complaint

@router.get("/", response_model=List[schemas.ComplaintResponse])
def get_complaints(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(models.Complaint).offset(skip).limit(limit).all()

@router.get("/{complaint_id}", response_model=schemas.ComplaintResponse)
def get_complaint(complaint_id: UUID, db: Session = Depends(get_db)):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint

@router.patch("/{complaint_id}/status", response_model=schemas.ComplaintResponse)
def update_complaint_status(complaint_id: UUID, status_update: schemas.ComplaintStatusUpdate, db: Session = Depends(get_db)):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    complaint.status = status_update.status
    
    history = models.StatusHistory(
        complaint_id=complaint.id,
        status=status_update.status,
        note=status_update.note
    )
    db.add(history)
    db.commit()
    db.refresh(complaint)
    return complaint

