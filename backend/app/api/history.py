from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from .deps import get_db, get_current_user

router = APIRouter()

@router.get("/", response_model=List[schemas.HistoryRecord])
def read_history(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    records = db.query(models.HistoryRecord).filter(
        models.HistoryRecord.user_id == current_user.id
    ).offset(skip).limit(limit).all()
    return records

@router.post("/", response_model=schemas.HistoryRecord)
def create_history_record(
    record: schemas.HistoryRecordCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_record = models.HistoryRecord(**record.model_dump(), user_id=current_user.id)
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record
