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
    author_id: int = 0          # who wrote it (0 for legacy/seed rows)
    helpful: int = 0            # server-stored helpful votes
    my_helpful: bool = False    # has *this* signed-in teacher marked it
    location: str = ''
    created_at: str
    replies: List[Dict[str, Any]] = []


class GuestTokenOut(BaseModel):
    """Anonymous session token — short-lived, no account attached."""
    guest_token: str
    expires_hours: float
    ask_limit_per_hour: int
    plan_limit: int


class GuestAskIn(BaseModel):
    """Unauthenticated assistant ask under the guest rate limit."""
    message: str = Field(min_length=1, max_length=4000)
    language: str = 'English'
    # Optional context the guest typed in Guided setup — never other people's data.
    context: Dict[str, Any] = {}




class GuestUpgradeIn(BaseModel):
    """After registration: adopt guest drafts into the new account."""
    guest_token: str = Field(min_length=8, max_length=80)


class GuestPlanOut(BaseModel):
    id: int
    title: str
    subject: str = ''
    medium: str = ''
    board: str = ''
    minutes: int = 45
    payload: Dict[str, Any] = {}
    created_at: str


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    language: str = 'English'
    voice: bool = False  # true when the message was dictated, not typed


class AskIn(BaseModel):
    """Unauthenticated ask — powers voice demos and the chat/WhatsApp bridge."""
    message: str = Field(min_length=1, max_length=4000)
    language: str = 'English'
    state: str = ''
    grades: str = ''
    subjects: str = ''


class ChatOut(BaseModel):
    reply: str
    sources: List[Dict[str, Any]] = []
    mode: str = 'grounded'
    transcript: str = ''  # what the assistant heard (voice input only)
    # When the reply IS a compiled lesson plan, carry the real schedule so the
    # frontend can open it in Curriculum Studio (convert-to-lesson-plan).
    # None for ordinary answers — never fabricated.
    plan: Optional[Dict[str, Any]] = None

class GuestAskOut(ChatOut):
    """Guest ask reply — includes the remaining anonymous quota."""
    asks_remaining: int = 0


class LinkCodeOut(BaseModel):
    """One-time code a signed-in teacher shows on the web, then texts to the
    bot from their own WhatsApp number. Returned once, stored only as a hash."""
    code: str
    expires_in: int
    wa_number: str = ''   # the bot's number, when WHATSAPP_DISPLAY_NUMBER is set


class LinkStatusOut(BaseModel):
    """Whether this account is bound to a WhatsApp number (masked)."""
    linked: bool
    phone_masked: str = ''
    linked_at: str = ''


class ReminderIn(BaseModel):
    """A reminder added from the web (same rules as the WhatsApp `remind:`)."""
    text: str = Field(min_length=2, max_length=200)
    remind_at: str = Field(default='today', min_length=1, max_length=32)


class ReminderOut(BaseModel):
    id: int
    text: str
    remind_at: str
    done: bool
    created_at: str
