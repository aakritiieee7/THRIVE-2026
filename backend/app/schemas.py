from pydantic import BaseModel, EmailStr, Field
from typing import List, Dict, Any, Optional


class TeacherCreate(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class TeacherLogin(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    profile: Dict[str, Any] = {}


class TokenResp(BaseModel):
    token: str
    teacher_id: int
    name: str


class TeacherOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    profile: Dict[str, Any]


class LessonPlanIn(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    subject: str = ''
    medium: str = ''
    board: str = ''
    minutes: int = Field(default=45, ge=1, le=600)
    payload: Dict[str, Any] = {}


class LessonPlanOut(LessonPlanIn):
    id: int
    created_at: str


class ProgressIn(BaseModel):
    course_id: str
    lessons_done: int = Field(ge=0, le=1000)


class ProgressOut(ProgressIn):
    updated_at: str


class PostIn(BaseModel):
    topic: str = Field(default='Multi-grade', max_length=60)
    title: str = Field(min_length=5, max_length=160)
    body: str = Field(min_length=12, max_length=4000)


class ReplyIn(BaseModel):
    body: str = Field(min_length=2, max_length=2000)


class PostOut(BaseModel):
    id: int
    topic: str
    title: str
    body: str
    reports: int
    author: str
    location: str = ''
    created_at: str
    replies: List[Dict[str, Any]] = []


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    language: str = 'English'


class ChatOut(BaseModel):
    reply: str
    sources: List[Dict[str, Any]] = []
    mode: str = 'grounded'
