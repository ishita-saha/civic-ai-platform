from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

class ComplaintCreate(BaseModel):
    description: str
    latitude: float
    longitude: float
    photo_url: Optional[str] = None
    user_id: Optional[UUID] = None

class ComplaintStatusUpdate(BaseModel):
    status: str
    note: Optional[str] = None

class ComplaintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: Optional[UUID]
    description: str
    photo_url: Optional[str]
    latitude: float
    longitude: float
    category: Optional[str]
    severity: Optional[str]
    confidence: Optional[float]
    department_id: Optional[UUID]
    priority_score: Optional[float]
    status: str
    cluster_id: Optional[str]
    created_at: datetime
