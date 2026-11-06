import json
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .api_compiler import router as compiler_router
from .api_auth import router as auth_router
from .auth import get_current_user
from .db import get_db, now
from .models import AssistantMessage, CommunityPost, CommunityReply, LessonPlan, Teacher, TrainingProgress, UpdateBookmark
from .schemas import (ChatIn, ChatOut, LessonPlanIn, LessonPlanOut, PostIn, PostOut,
                      ProgressIn, ProgressOut, ReplyIn)
from pydantic import ValidationError
from . import assistant as assistant_engine

router = APIRouter()


class HealthResp(BaseModel):
    status: str


@router.get('/health', response_model=HealthResp)
def health():
    return {"status": "ok"}


router.include_router(compiler_router, prefix='/compiler', tags=['compiler'])
router.include_router(auth_router, prefix='/auth', tags=['auth'])

_CURRICULUM_CANDIDATES = [
    os.path.join(os.path.dirname(__file__), '..', '..', 'curriculum'),
    'curriculum',
]


def _curriculum_dir() -> str:
    for base in _CURRICULUM_CANDIDATES:
        if os.path.isdir(base):
            return base
    raise HTTPException(status_code=500, detail='curriculum directory not found')


@router.get('/curriculum/sample')
def get_sample_curriculum():
    path = os.path.join(_curriculum_dir(), 'ncert_sample.json')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail='sample curriculum not found')
    except Exception as e:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/curriculum/chapters')
def list_chapters(grade: str, subject: str = '', board: str = 'ncert_sample'):
    """Chapters + learning outcomes for one grade (concept-relationship lookup).

    Powers the Curriculum Studio topic picker and the compiler's
    curriculum grounding. `grade` may be '3' or 'Grade 3'.
    """
    grade_norm = grade.replace('Grade', '').replace('grade', '').strip()
    data = get_sample_curriculum()
    for g in data.get('grades', []):
        if str(g.get('grade')) == grade_norm:
            subjects = g.get('subjects', [])
            if subject:
                subjects = [s for s in subjects if s.get('name', '').lower() == subject.lower()
                            or subject.lower() in s.get('name', '').lower()]
            return {'board': data.get('board'), 'grade': grade_norm,
                    'source': data.get('source'), 'subjects': subjects}
    raise HTTPException(status_code=404, detail=f'No curriculum seeded for grade {grade_norm}')


# ---------------------------------------------------------------------------
# Lesson plans (Pillar 1 persistence: save, list, update, delete)
# ---------------------------------------------------------------------------

def _plan_out(p: LessonPlan) -> LessonPlanOut:
    return LessonPlanOut(id=p.id, title=p.title, subject=p.subject, medium=p.medium,
                         board=p.board, minutes=p.minutes, payload=p.payload or {},
                         created_at=p.created_at)


@router.post('/plans', response_model=LessonPlanOut)
def create_plan(
    req: LessonPlanIn,
    teacher: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = LessonPlan(teacher_id=teacher.id, title=req.title, subject=req.subject,
                      medium=req.medium, board=req.board, minutes=req.minutes,
                      payload=req.payload, created_at=now())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _plan_out(plan)


@router.get('/plans', response_model=list[LessonPlanOut])
def list_plans(teacher: Teacher = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(LessonPlan).filter(LessonPlan.teacher_id == teacher.id)\
             .order_by(LessonPlan.id.desc()).all()
    return [_plan_out(p) for p in rows]


@router.put('/plans/{plan_id}', response_model=LessonPlanOut)
def update_plan(
    plan_id: int,
    req: LessonPlanIn,
    teacher: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.get(LessonPlan, plan_id)
    if plan is None or plan.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail='Lesson plan not found')
    plan.title, plan.subject, plan.medium = req.title, req.subject, req.medium
    plan.board, plan.minutes, plan.payload = req.board, req.minutes, req.payload
    db.commit()
    db.refresh(plan)
    return _plan_out(plan)


@router.delete('/plans/{plan_id}')
def delete_plan(plan_id: int, teacher: Teacher = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.get(LessonPlan, plan_id)
    if plan is None or plan.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail='Lesson plan not found')
    db.delete(plan)
    db.commit()
    return {'status': 'deleted', 'id': plan_id}


# ---------------------------------------------------------------------------
# Training progress (Pillar 3)
# ---------------------------------------------------------------------------

@router.get('/training/progress', response_model=list[ProgressOut])
def get_progress(teacher: Teacher = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(TrainingProgress).filter(TrainingProgress.teacher_id == teacher.id).all()
    return [ProgressOut(course_id=r.course_id, lessons_done=r.lessons_done, updated_at=r.updated_at)
            for r in rows]


@router.put('/training/progress', response_model=ProgressOut)
def set_progress(
    req: ProgressIn,
    teacher: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(TrainingProgress).filter(
        TrainingProgress.teacher_id == teacher.id,
        TrainingProgress.course_id == req.course_id,
    ).first()
    if row is None:
        row = TrainingProgress(teacher_id=teacher.id, course_id=req.course_id,
                               lessons_done=req.lessons_done, updated_at=now())
        db.add(row)
    else:
        row.lessons_done = req.lessons_done
        row.updated_at = now()
    db.commit()
    db.refresh(row)
    return ProgressOut(course_id=row.course_id, lessons_done=row.lessons_done, updated_at=row.updated_at)


# ---------------------------------------------------------------------------
# Updates bookmarks (Pillar 4)
# ---------------------------------------------------------------------------

@router.get('/updates/bookmarks')
def list_bookmarks(teacher: Teacher = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(UpdateBookmark).filter(UpdateBookmark.teacher_id == teacher.id).all()
    return {'item_ids': [r.item_id for r in rows]}


@router.put('/updates/bookmarks/{item_id}')
def add_bookmark(item_id: str, teacher: Teacher = Depends(get_current_user), db: Session = Depends(get_db)):
    exists = db.query(UpdateBookmark).filter(
        UpdateBookmark.teacher_id == teacher.id, UpdateBookmark.item_id == item_id).first()
    if exists is None:
        db.add(UpdateBookmark(teacher_id=teacher.id, item_id=item_id, created_at=now()))
        db.commit()
    return {'item_ids': [r.item_id for r in db.query(UpdateBookmark)
                         .filter(UpdateBookmark.teacher_id == teacher.id).all()]}


@router.delete('/updates/bookmarks/{item_id}')
def remove_bookmark(item_id: str, teacher: Teacher = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(UpdateBookmark).filter(
        UpdateBookmark.teacher_id == teacher.id, UpdateBookmark.item_id == item_id).first()
    if row is not None:
        db.delete(row)
        db.commit()
    return {'item_ids': [r.item_id for r in db.query(UpdateBookmark)
                         .filter(UpdateBookmark.teacher_id == teacher.id).all()]}


# ---------------------------------------------------------------------------
# Community (Pillar 5): posts, replies, likes handled client-side per-post,
# reports feed a moderation counter.
# ---------------------------------------------------------------------------

def _post_out(p: CommunityPost) -> PostOut:
    return PostOut(
        id=p.id, topic=p.topic, title=p.title, body=p.body, reports=p.reports,
        author=p.teacher.name if p.teacher else 'Teacher',
        location=(p.teacher.profile or {}).get('state', '') if p.teacher else '',
        created_at=p.created_at,
        replies=[{'id': r.id, 'name': r.author.name if r.author else 'Teacher', 'body': r.body}
                 for r in p.replies],
    )


@router.get('/community/posts', response_model=list[PostOut])
def list_posts(db: Session = Depends(get_db)):
    rows = db.query(CommunityPost).filter(CommunityPost.reports < 2)\
             .order_by(CommunityPost.id.desc()).all()
    return [_post_out(p) for p in rows]


@router.post('/community/posts', response_model=PostOut)
def create_post(
    req: PostIn,
    teacher: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = CommunityPost(teacher_id=teacher.id, topic=req.topic, title=req.title,
                         body=req.body, reports=0, created_at=now())
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_out(post)


@router.post('/community/posts/{post_id}/replies', response_model=PostOut)
def create_reply(
    post_id: int,
    req: ReplyIn,
    teacher: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.get(CommunityPost, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail='Post not found')
    db.add(CommunityReply(post_id=post_id, teacher_id=teacher.id, body=req.body, created_at=now()))
    db.commit()
    db.refresh(post)
    return _post_out(post)


@router.post('/community/posts/{post_id}/report')
def report_post(post_id: int, teacher: Teacher = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.get(CommunityPost, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail='Post not found')
    post.reports = (post.reports or 0) + 1
    db.commit()
    return {'status': 'reported', 'reports': post.reports}


# ---------------------------------------------------------------------------
# Assistant (Pillar 2): persisted conversation + retrieval-grounded reply
# ---------------------------------------------------------------------------

@router.get('/assistant/messages')
def list_messages(teacher: Teacher = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(AssistantMessage).filter(AssistantMessage.teacher_id == teacher.id)\
             .order_by(AssistantMessage.id.asc()).all()
    return [{'id': m.id, 'role': m.role, 'text': m.text, 'sources': m.sources or []} for m in rows]


@router.post('/assistant/chat', response_model=ChatOut)
def chat(
    req: ChatIn,
    teacher: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = teacher.profile or {}
    result = assistant_engine.respond(req.message, profile, req.language)
    db.add(AssistantMessage(teacher_id=teacher.id, role='teacher', text=req.message,
                            sources=[], created_at=now()))
    db.add(AssistantMessage(teacher_id=teacher.id, role='assistant', text=result['reply'],
                            sources=result['sources'], created_at=now()))
    db.commit()
    try:
        return ChatOut(**result)
    except ValidationError:
        return ChatOut(reply=result.get('reply', ''), sources=[], mode=result.get('mode', 'local-grounded'))


@router.delete('/assistant/messages')
def clear_messages(teacher: Teacher = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(AssistantMessage).filter(AssistantMessage.teacher_id == teacher.id).delete()
    db.commit()
    return {'status': 'cleared'}
