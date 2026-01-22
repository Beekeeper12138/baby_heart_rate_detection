from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    records = relationship("HistoryRecord", back_populates="user")

class HistoryRecord(Base):
    __tablename__ = "history_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(String) # YYYY-MM-DD
    start_time = Column(String) # HH:MM
    end_time = Column(String) # HH:MM
    avg_bpm = Column(Float)
    signal_quality = Column(String) # Excellent, Good, Fair, Poor
    raw_data_path = Column(String, nullable=True) # Path to saved raw data if any
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="records")
