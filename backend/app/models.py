from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from .db import Base


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
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    subject = Column(String(120), default='')
    medium = Column(String(60), default='')
    board = Column(String(120), default='')
    minutes = Column(Integer, default=45)
    payload = Column(JSON, default=dict)   # {grades:[...], schedule:[...], sources:[...]}
    created_at = Column(String(32), nullable=False)

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


class CommunityPost(Base):
    __tablename__ = 'community_posts'

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False, index=True)
    topic = Column(String(60), default='Multi-grade')
    title = Column(String(160), nullable=False)
    body = Column(Text, nullable=False)
    reports = Column(Integer, default=0)
    created_at = Column(String(32), nullable=False)

    teacher = relationship('Teacher', back_populates='posts')
    replies = relationship('CommunityReply', back_populates='post', cascade='all, delete-orphan')


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
