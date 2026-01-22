from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# Token
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None

# User
class UserBase(BaseModel):
    username: str = Field(min_length=2, max_length=32, pattern=r"^[\w]+$")
    full_name: Optional[str] = Field(default=None, max_length=100)
    avatar_url: Optional[str] = Field(default=None, max_length=500000)

class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)

class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=2, max_length=32, pattern=r"^[\w]+$")
    full_name: Optional[str] = Field(default=None, max_length=100)
    avatar_url: Optional[str] = Field(default=None, max_length=500000)

class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

class User(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# History Record
class HistoryRecordBase(BaseModel):
    date: str
    start_time: str
    end_time: str
    avg_bpm: float
    signal_quality: str

class HistoryRecordCreate(HistoryRecordBase):
    pass

class HistoryRecord(HistoryRecordBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
