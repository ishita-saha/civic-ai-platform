from sqlalchemy import Column, String, Text, Float, Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    role = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    rules = Column(Text, nullable=True)

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    description = Column(Text, nullable=False)
    photo_url = Column(Text, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    category = Column(String, nullable=True)
    severity = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    priority_score = Column(Float, nullable=True)
    status = Column(String, server_default="submitted")
    cluster_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    complaint_id = Column(UUID(as_uuid=True), ForeignKey("complaints.id"))
    status = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=text("now()"))

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    message = Column(Text, nullable=False)
    read = Column(Boolean, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

