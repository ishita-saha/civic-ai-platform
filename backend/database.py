import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# SQLAlchemy 1.4 still ships the old scheme name; Postgres URLs copied out of
# hosting dashboards almost always use postgres:// and need rewriting.
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

Base = declarative_base()

# Built on first use rather than at import time. This module previously called
# create_engine(DATABASE_URL) at module scope, which raises the moment
# DATABASE_URL is unset — so anything that so much as imported `models` or
# `routers.complaints` died on import, with a stack trace pointing at
# SQLAlchemy instead of at the missing .env. Deferring it means the modules
# import cleanly and you only pay for a connection when you actually ask for one.
_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        if not DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL is not set. Copy it into backend/.env before using "
                "the database layer. The app's current routes (main.py) do not "
                "need it — they serve from an in-memory list."
            )
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    return _engine


def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal


def get_db():
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()
