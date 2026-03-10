from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    bio: Optional[str] = Field(default=None, max_length=255)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    username: str
    profile_picture_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime


class MessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chat_id: int
    sender_id: int
    text: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_mime: Optional[str] = None
    attachment_size: Optional[int] = None
    created_at: datetime


class ChatPublic(BaseModel):
    id: int
    is_group: bool
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    members: list[UserPublic]
    last_message: Optional[MessagePublic] = None


class SendMessageResponse(BaseModel):
    message: MessagePublic

