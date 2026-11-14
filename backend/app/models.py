from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from .db import Base, _add_missing_columns


class Teacher(Base):
    __tablename__ = 'teachers'

    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    profile = Column(JSON, default=dict)
    created_at = Column(String(32), nullable=False)

    lesson_plans = relationship('LessonPlan', back_populates='teacher', cascade='all, delete-orphan')
    posts = relationship('CommunityPost', back_populates='teacher', cascade='all, delete-orphan')


class LessonPlan(Base):
    __tablename__ = 'lesson_plans'

    id = Column(Integer, primary_key=True)
    # NULL for guest drafts (no account yet); set on adoption into an account.
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    subject = Column(String(120), default='')
    medium = Column(String(60), default='')
    board = Column(String(120), default='')
    minutes = Column(Integer, default=45)
    payload = Column(JSON, default=dict)   # {grades:[...], schedule:[...], sources:[...]}
    created_at = Column(String(32), nullable=False)
    # NULL for account-owned plans; set only for guest (anonymous) drafts so
    # they can later be adopted into an account. No Alembic in this project —
    # db.init_db() adds this column to pre-existing SQLite files in place.
    guest_token = Column(String(80), nullable=True, index=True)

    teacher = relationship('Teacher', back_populates='lesson_plans')


class TrainingProgress(Base):
    __tablename__ = 'training_progress'
    __table_args__ = (UniqueConstraint('teacher_id', 'course_id', name='uq_progress_course'),)

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False, index=True)
    course_id = Column(String(64), nullable=False)
    lessons_done = Column(Integer, default=0)
    updated_at = Column(String(32), nullable=False)


class UpdateBookmark(Base):
    __tablename__ = 'update_bookmarks'
    __table_args__ = (UniqueConstraint('teacher_id', 'item_id', name='uq_bookmark_item'),)

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False, index=True)
    item_id = Column(String(64), nullable=False)
    created_at = Column(String(32), nullable=False)


class TrainingBookmark(Base):
    """A saved course in the Training centre — same ledger shape as updates."""
    __tablename__ = 'training_bookmarks'
    __table_args__ = (UniqueConstraint('teacher_id', 'item_id', name='uq_training_bookmark_item'),)

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False, index=True)
    item_id = Column(String(64), nullable=False)
    created_at = Column(String(32), nullable=False)


class CommunityPost(Base):
    __tablename__ = 'community_posts'

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False, index=True)
    topic = Column(String(60), default='Multi-grade')
    title = Column(String(160), nullable=False)
    body = Column(Text, nullable=False)
    reports = Column(Integer, default=0)
    # Helpful votes are stored server-side (count on the post, per-teacher
    # marks in community_helpful) so they are real data, not device-local.
    helpful = Column(Integer, default=0)
    created_at = Column(String(32), nullable=False)

    teacher = relationship('Teacher', back_populates='posts')
    replies = relationship('CommunityReply', back_populates='post', cascade='all, delete-orphan')


class CommunityHelpful(Base):
    """One teacher's "helpful" mark on one post — the server's vote ledger."""
    __tablename__ = 'community_helpful'
    __table_args__ = (UniqueConstraint('teacher_id', 'post_id', name='uq_helpful_teacher_post'),)

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False, index=True)
    post_id = Column(Integer, ForeignKey('community_posts.id'), nullable=False, index=True)
    created_at = Column(String(32), nullable=False)


class CommunityReply(Base):
    __tablename__ = 'community_replies'

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey('community_posts.id'), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(String(32), nullable=False)

    post = relationship('CommunityPost', back_populates='replies')
    author = relationship('Teacher')


class AssistantMessage(Base):
    __tablename__ = 'assistant_messages'

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False, index=True)
    role = Column(String(20), nullable=False)          # 'teacher' | 'assistant'
    text = Column(Text, nullable=False)
    sources = Column(JSON, default=list)
    created_at = Column(String(32), nullable=False)


class WhatsAppLink(Base):
    """A WhatsApp sender (phone) bound to a THRIVE teacher account.

    Binding is created only by redeeming a one-time pairing code that a
    signed-in teacher obtained from the web — never by claiming a phone
    number directly. One number per account and one account per number.
    """
    __tablename__ = 'whatsapp_links'
    __table_args__ = (UniqueConstraint('teacher_id', name='uq_wa_link_teacher'),)

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False,
                        unique=True, index=True)
    phone = Column(String(32), nullable=False, unique=True, index=True)
    linked_at = Column(String(32), nullable=False)

    teacher = relationship('Teacher')


class WhatsAppPairing(Base):
    """One-time link code issued from the web (SHA-256 hash only, short TTL)."""
    __tablename__ = 'whatsapp_pairings'

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False, index=True)
    code_hash = Column(String(64), nullable=False, index=True)
    expires_at = Column(String(32), nullable=False)
    used_at = Column(String(32), nullable=True)
    created_at = Column(String(32), nullable=False)


class WhatsAppTurn(Base):
    """One inbound WhatsApp message and the reply THRIVE sent back.

    Kept only so the /demo page can show the last few exchanges live during a
    presentation. Deliberately minimal:
      • the phone is stored masked (last 4 digits) — a full number is personal
        data and there is no reason to keep it here;
      • message bodies are the teacher's own curriculum questions, and the
        assistant is instructed never to record student details, so no child's
        personal data enters this table.
    Rows are trimmed to a small window by the writer.
    """
    __tablename__ = 'whatsapp_turns'

    id = Column(Integer, primary_key=True)
    phone_masked = Column(String(16), nullable=False, index=True)
    inbound = Column(Text, nullable=False)
    reply = Column(Text, nullable=False)
    action = Column(String(32), nullable=False, default='')
    language = Column(String(16), nullable=False, default='English')
    created_at = Column(String(32), nullable=False, index=True)


class RemindTask(Base):
    """A reminder set over WhatsApp (or web) and owned by a teacher account."""
    __tablename__ = 'remind_tasks'

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False, index=True)
    text = Column(String(200), nullable=False)
    remind_at = Column(String(32), nullable=False)
    done = Column(Integer, default=0)   # SQLite-friendly boolean
    created_at = Column(String(32), nullable=False)

    teacher = relationship('Teacher')
