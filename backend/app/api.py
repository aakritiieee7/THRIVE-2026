import hashlib
import hmac
import json
import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .api_compiler import router as compiler_router
from .api_auth import router as auth_router
from .auth import get_current_user, get_optional_user
from .db import get_db, now
from .models import (AssistantMessage, CommunityHelpful, CommunityPost,
                     CommunityReply, LessonPlan, RemindTask, Teacher,
                     TrainingBookmark, TrainingProgress, UpdateBookmark)
from .schemas import (AskIn, ChatIn, ChatOut, GuestAskIn, GuestAskOut, GuestPlanOut,
                      GuestTokenOut, GuestUpgradeIn, LessonPlanIn, LessonPlanOut,
                      LinkCodeOut, LinkStatusOut, PostIn, PostOut, ProgressIn,
                      ProgressOut, ReminderIn, ReminderOut, ReplyIn)
from pydantic import ValidationError
from . import assistant as assistant_engine
from . import guest as guest_layer
from . import ratelimit as rl
from . import whatsapp_links
from . import whatsapp_actions
from .assistant import detect_language

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
    raise HTTPException(status_code=500, detail='The curriculum library is unavailable right now.')


@router.get('/curriculum/sample')
def get_sample_curriculum():
    path = os.path.join(_curriculum_dir(), 'ncert_sample.json')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail='sample curriculum not found')
    except Exception:  # pragma: no cover - defensive
        # Never surface a raw exception to the client.
        raise HTTPException(status_code=500, detail='The curriculum library could not be read right now.')


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
    raise HTTPException(status_code=404, detail=f'No curriculum loaded for grade {grade_norm}')


# ---------------------------------------------------------------------------
# Lesson plans (Pillar 1 persistence: save, list, update, delete)
# ---------------------------------------------------------------------------

def _plan_out(p: LessonPlan) -> LessonPlanOut:
    return LessonPlanOut(id=p.id, title=p.title, subject=p.subject, medium=p.medium,
                         board=p.board, minutes=p.minutes, payload=p.payload or {},
                         created_at=p.created_at)


def _build_whatsapp_plan(text: str, profile: Dict[str, Any], language: str,
                         db: Session, teacher: Teacher,
                         save: bool = True) -> Optional[Dict[str, Any]]:
    """Run the real compiler over a WhatsApp `plan:` message.

    Returns None when the message is not a plan request at all (caller offers a
    hint). On success, when `save` is True, persists a LessonPlan whose payload
    matches what Curriculum Studio saves, so the plan opens there unchanged, and
    wraps the compiler's reply into the plan_saved copy. Infeasible requests
    return the compiler's honest "cannot fit" reply with nothing saved.
    `preview=True` skips the write entirely.
    """
    from . import whatsapp_actions as wa

    context = {'grades': profile.get('grades', ''), 'subjects': profile.get('subjects', '')}
    req = assistant_engine.extract_plan_request(text, context)
    if req is None:
        return None

    built = assistant_engine.build_plan(req, language)
    if built['compiled'] is None:
        # infeasible — reply with the engine's reasons, save nothing
        reply = built['reply']
        if save:
            reply += ('\n\n(Nothing was saved — the schedule could not be built.)'
                      if not language.lower().startswith('hi')
                      else '\n\n(कुछ सहज नह गय — समय-सारणी बन न सकी।)')
        return {'reply': reply, 'saved_id': None, 'wrote': False}

    compiled = built['compiled']
    inputs = built['inputs']
    title = f"{inputs['subject']}: " + ' & '.join(
        f"Grade {g}" for g in inputs['grades'])
    payload = {
        'title': title,
        'grades': [{'grade': g, 'topic': inputs['topics'].get(g, ''),
                    'objective': f'Practise one {inputs["subject"].lower()} idea suitable for Grade {g}'}
                   for g in inputs['grades']],
        'minutes': inputs['minutes'],
        'subject': inputs['subject'],
        'medium': '',
        'board': '',
        'materials': '',
        'buffer': 0,
        'schedule': compiled['slots'],
        'assessments': compiled['assessments'],
        'sources': compiled.get('sources', []),
        'savedAt': now(),
    }
    plan_id: Optional[int] = None
    if save:
        plan = LessonPlan(teacher_id=teacher.id, title=title[:255],
                          subject=inputs['subject'], medium='', board='',
                          minutes=inputs['minutes'], payload=payload, created_at=now())
        db.add(plan)
        db.commit()
        db.refresh(plan)
        plan_id = plan.id

    reply = wa.copy('plan_saved' if save else 'plan_preview', language,
                    id=plan_id or 0, reply=built['reply'])
    return {'reply': reply, 'saved_id': plan_id, 'wrote': bool(save and plan_id)}


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
# Reminders (Pillar 4 / "done" on WhatsApp): plain helpers so the WhatsApp
# command router and the web profile panel share the exact same writes.
# ---------------------------------------------------------------------------

def save_reminder(text: str, remind_at: str, teacher: Teacher,
                  db: Session) -> RemindTask:
    """Persist a reminder (called by the web and the WhatsApp `remind:` command)."""
    task = RemindTask(teacher_id=teacher.id, text=text[:200],
                      remind_at=remind_at[:32], done=0, created_at=now())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _reminder_out(t: RemindTask) -> ReminderOut:
    return ReminderOut(id=t.id, text=t.text, remind_at=t.remind_at,
                       done=bool(t.done), created_at=t.created_at)


def toggle_reminder(task_id: int, teacher: Teacher, db: Session) -> Optional[RemindTask]:
    """Mark a reminder done (idempotent). 404 + ownership, same as delete_plan."""
    task = db.get(RemindTask, task_id)
    if task is None or task.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail='Reminder not found')
    if not task.done:
        task.done = 1
        db.commit()
        db.refresh(task)
    return task


@router.get('/reminders', response_model=list[ReminderOut])
def list_reminders(teacher: Teacher = Depends(get_current_user), db: Session = Depends(get_db)):
    """Pending reminders first, then recently done ones (newest first)."""
    rows = db.query(RemindTask).filter(RemindTask.teacher_id == teacher.id)\
             .order_by(RemindTask.done.asc(), RemindTask.id.desc()).all()
    return [_reminder_out(t) for t in rows]


@router.post('/reminders', response_model=ReminderOut)
def create_reminder(req: ReminderIn, teacher: Teacher = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    return _reminder_out(save_reminder(req.text, req.remind_at, teacher, db))


@router.put('/reminders/{task_id}/done', response_model=ReminderOut)
def mark_reminder_done(task_id: int, teacher: Teacher = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    return _reminder_out(toggle_reminder(task_id, teacher, db))


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


def set_progress_direct(course_id: str, lessons_done: int, teacher: Teacher,
                        db: Session) -> ProgressOut:
    """The same upsert set_progress performs, callable from the WhatsApp
    command router (the course id is already validated against COURSES)."""
    row = db.query(TrainingProgress).filter(
        TrainingProgress.teacher_id == teacher.id,
        TrainingProgress.course_id == course_id,
    ).first()
    if row is None:
        row = TrainingProgress(teacher_id=teacher.id, course_id=course_id,
                               lessons_done=lessons_done, updated_at=now())
        db.add(row)
    else:
        row.lessons_done = lessons_done
        row.updated_at = now()
    db.commit()
    db.refresh(row)
    return ProgressOut(course_id=row.course_id, lessons_done=row.lessons_done,
                       updated_at=row.updated_at)


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
# Training bookmarks — same ledger as updates: courses saved for later.
# ---------------------------------------------------------------------------

@router.get('/training/bookmarks')
def list_training_bookmarks(teacher: Teacher = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(TrainingBookmark).filter(TrainingBookmark.teacher_id == teacher.id).all()
    return {'item_ids': [r.item_id for r in rows]}


@router.put('/training/bookmarks/{item_id}')
def add_training_bookmark(item_id: str, teacher: Teacher = Depends(get_current_user),
                          db: Session = Depends(get_db)):
    exists = db.query(TrainingBookmark).filter(
        TrainingBookmark.teacher_id == teacher.id, TrainingBookmark.item_id == item_id).first()
    if exists is None:
        db.add(TrainingBookmark(teacher_id=teacher.id, item_id=item_id, created_at=now()))
        db.commit()
    return {'item_ids': [r.item_id for r in db.query(TrainingBookmark)
                         .filter(TrainingBookmark.teacher_id == teacher.id).all()]}


@router.delete('/training/bookmarks/{item_id}')
def remove_training_bookmark(item_id: str, teacher: Teacher = Depends(get_current_user),
                             db: Session = Depends(get_db)):
    row = db.query(TrainingBookmark).filter(
        TrainingBookmark.teacher_id == teacher.id, TrainingBookmark.item_id == item_id).first()
    if row is not None:
        db.delete(row)
        db.commit()
    return {'item_ids': [r.item_id for r in db.query(TrainingBookmark)
                         .filter(TrainingBookmark.teacher_id == teacher.id).all()]}


# ---------------------------------------------------------------------------
# Community (Pillar 5): posts, replies, server-stored helpful votes, reports.
# author_id lets the client tell teachers which posts are theirs to edit;
# helpful votes live in community_helpful so a count survives across devices.
# ---------------------------------------------------------------------------

def _post_out(p: CommunityPost, my_helpful: bool = False) -> PostOut:
    return PostOut(
        id=p.id, topic=p.topic, title=p.title, body=p.body, reports=p.reports,
        author=p.teacher.name if p.teacher else 'Teacher',
        author_id=p.teacher_id,
        helpful=p.helpful or 0,
        my_helpful=my_helpful,
        location=(p.teacher.profile or {}).get('state', '') if p.teacher else '',
        created_at=p.created_at,
        replies=[{'id': r.id, 'name': r.author.name if r.author else 'Teacher',
                  'teacher_id': r.teacher_id, 'body': r.body}
                 for r in p.replies],
    )


def _owned_post(post_id: int, teacher: Teacher, db: Session) -> CommunityPost:
    """Fetch a post the signed-in teacher wrote, else 404 (never 403 — an
    author check should not confirm a stranger's post id)."""
    post = db.get(CommunityPost, post_id)
    if post is None or post.teacher_id != teacher.id:
        raise HTTPException(status_code=404, detail='Post not found')
    return post


@router.get('/community/posts', response_model=list[PostOut])
def list_posts(
    teacher: Optional[Teacher] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    rows = db.query(CommunityPost).filter(CommunityPost.reports < 2)\
             .order_by(CommunityPost.id.desc()).all()
    marked: set = set()
    if teacher is not None:
        marked = {r.post_id for r in db.query(CommunityHelpful)
                  .filter(CommunityHelpful.teacher_id == teacher.id).all()}
    # my_helpful must be set while constructing the model — PostOut is
    # immutable-ish for extra attributes once validated.
    return [_post_out(p, my_helpful=p.id in marked) for p in rows]


@router.post('/community/posts', response_model=PostOut)
def create_post(
    req: PostIn,
    teacher: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = CommunityPost(teacher_id=teacher.id, topic=req.topic, title=req.title,
                         body=req.body, reports=0, helpful=0, created_at=now())
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_out(post)


@router.put('/community/posts/{post_id}', response_model=PostOut)
def update_post(
    post_id: int,
    req: PostIn,
    teacher: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _owned_post(post_id, teacher, db)
    post.topic, post.title, post.body = req.topic, req.title, req.body
    db.commit()
    db.refresh(post)
    return _post_out(post)


@router.delete('/community/posts/{post_id}')
def delete_post(
    post_id: int,
    teacher: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _owned_post(post_id, teacher, db)
    # Reply rows hang off the post: clear them first (their FK is plain).
    db.query(CommunityReply).filter(CommunityReply.post_id == post.id)\
       .delete(synchronize_session=False)
    db.query(CommunityHelpful).filter(CommunityHelpful.post_id == post.id)\
       .delete(synchronize_session=False)
    db.delete(post)
    db.commit()
    return {'status': 'deleted', 'id': post_id}


@router.post('/community/posts/{post_id}/helpful')
def toggle_helpful(
    post_id: int,
    teacher: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle this teacher's helpful mark — one vote per teacher per post."""
    post = db.get(CommunityPost, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail='Post not found')
    existing = db.query(CommunityHelpful).filter(
        CommunityHelpful.teacher_id == teacher.id,
        CommunityHelpful.post_id == post.id).first()
    if existing is not None:
        db.delete(existing)
        post.helpful = max(0, (post.helpful or 0) - 1)
        marked = False
    else:
        db.add(CommunityHelpful(teacher_id=teacher.id, post_id=post.id,
                                created_at=now()))
        post.helpful = (post.helpful or 0) + 1
        marked = True
    db.commit()
    return {'helpful': post.helpful or 0, 'my_helpful': marked}



def save_post(title: str, body: str, teacher: Teacher,
              db: Session) -> Dict[str, Any]:
    """Publish a community post from the WhatsApp `post:` command.

    Applies the exact PostIn rules (title 5–160, body 12–4000) and reports the
    specific failure with a 422 whose detail names the field, so the command
    router can ask the teacher to add a title or a fuller body.
    """
    title = (title or '').strip()
    body = (body or '').strip()
    if len(title) < 5:
        raise HTTPException(status_code=422, detail='title too short')
    if len(title) > 160:
        raise HTTPException(status_code=422, detail='title too long')
    if len(body) < 12:
        raise HTTPException(status_code=422, detail='body too short')
    if len(body) > 4000:
        raise HTTPException(status_code=422, detail='body too long')
    post = CommunityPost(teacher_id=teacher.id, topic='Multi-grade', title=title,
                         body=body, reports=0, helpful=0, created_at=now())
    db.add(post)
    db.commit()
    db.refresh(post)
    return {'id': post.id, 'title': post.title}


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
    return _chat_out(result)


def _chat_out(result: Dict[str, Any]) -> ChatOut:
    """Map an engine result onto ChatOut.

    The engine may return extra keys (compiled/inputs) when the reply is a
    real schedule; those are folded into `plan` so the UI can offer
    "open in Curriculum Studio". Everything else falls back to a valid,
    honest ChatOut — never fabricated content.
    """
    plan = result.get('compiled') or None
    if plan and isinstance(plan, dict):
        inputs = result.get('inputs') if isinstance(result.get('inputs'), dict) else {}
        plan = {**plan, 'inputs': inputs}
    try:
        return ChatOut(**{**result, 'plan': plan})
    except ValidationError:
        return ChatOut(reply=result.get('reply', ''), sources=[],
                       mode=result.get('mode', 'local-grounded'), plan=plan)


@router.delete('/assistant/messages')
def clear_messages(teacher: Teacher = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(AssistantMessage).filter(AssistantMessage.teacher_id == teacher.id).delete()
    db.commit()
    return {'status': 'cleared'}


# ---------------------------------------------------------------------------
# Guest access (no account): short-lived anonymous tokens, rate-limited asks,
# and draft plans that can later be adopted into a teacher account.
# Limits are env-configurable — see app/guest.py and README (GUEST_* vars).
# ---------------------------------------------------------------------------

@router.post('/guest/session', response_model=GuestTokenOut)
def guest_session(request: Request, response: Response):
    """Start (or continue) an anonymous session. Sets a rate-limit cookie for
    browsers; the body token is authoritative for API clients."""
    token = guest_layer.mint_token(request.client.host if request.client else 'unknown')
    response.set_cookie('thrive_guest', token, max_age=int(guest_layer.GUEST_TTL_HOURS * 3600),
                        httponly=True, samesite='lax')
    return GuestTokenOut(guest_token=token, expires_hours=guest_layer.GUEST_TTL_HOURS,
                         ask_limit_per_hour=guest_layer.GUEST_ASK_PER_HOUR,
                         plan_limit=guest_layer.GUEST_PLAN_LIMIT)


@router.post('/guest/ask', response_model=GuestAskOut)
def guest_ask(req: GuestAskIn, request: Request):
    """Assistant for signed-out visitors, bounded per guest token.

    Server-side quota — the frontend counter is only a courtesy mirror.
    Never touches another teacher's data: context is what this guest sent.
    """
    token = req_token(request.headers.get('x-guest-token', ''),
                      request.cookies.get('thrive_guest', ''))
    guest_layer.check_token(token)
    if guest_layer.count_asks(token) >= guest_layer.GUEST_ASK_PER_HOUR:
        raise HTTPException(status_code=429,
                            detail='Your free guest questions for this hour are used up. '
                                   'Create a free account to continue, or try again in an hour — '
                                   'your drafts stay safe either way.')
    guest_layer.record_ask(token)
    ctx = req.context if isinstance(req.context, dict) else {}
    result = assistant_engine.respond(req.message, ctx, req.language)
    plan = result.get('compiled') or None
    if plan and isinstance(plan, dict):
        inputs = result.get('inputs') if isinstance(result.get('inputs'), dict) else {}
        plan = {**plan, 'inputs': inputs}
    try:
        out = GuestAskOut(**{**result, 'plan': plan},
                          asks_remaining=guest_layer.guest_asks_remaining(token))
    except ValidationError:
        out = GuestAskOut(reply=result.get('reply', ''), sources=[],
                          mode=result.get('mode', 'local-grounded'), plan=plan,
                          asks_remaining=guest_layer.guest_asks_remaining(token))
    return out


@router.get('/guest/plans', response_model=list[GuestPlanOut])
def guest_plans(x_guest_token: str = Header(default='', alias='x-guest-token'),
                db: Session = Depends(get_db)):
    token = req_token(x_guest_token, '')
    guest_layer.check_token(token)
    return [GuestPlanOut(**p) for p in guest_layer.list_guest_plans(token, db)]


@router.post('/guest/plans', response_model=GuestPlanOut)
def guest_plan_create(req: LessonPlanIn, request: Request,
                      x_guest_token: str = Header(default='', alias='x-guest-token'),
                      db: Session = Depends(get_db)):
    token = req_token(x_guest_token, request.cookies.get('thrive_guest', ''))
    guest_layer.check_token(token)
    plan = guest_layer.create_guest_plan(req, token, db)
    return guest_layer.plan_out(plan)


@router.delete('/guest/plans/{plan_id}')
def guest_plan_delete(plan_id: int, x_guest_token: str = Header(default='', alias='x-guest-token'),
                      db: Session = Depends(get_db)):
    token = req_token(x_guest_token, '')
    guest_layer.check_token(token)
    guest_layer.delete_guest_plan(token, plan_id, db)
    return {'status': 'deleted', 'id': plan_id}


@router.post('/guest/upgrade')
def guest_upgrade(req: GuestUpgradeIn,
                  teacher: Teacher = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """After registration: move this guest's drafts into the account and retire
    the guest token. Returns how many plans were adopted."""
    adopted = guest_layer.adopt_guest_plans(req.guest_token, teacher.id, db)
    return {'status': 'ok', 'adopted': adopted}


def req_token(header: str, cookie: str) -> str:
    return (header or cookie or '').strip()


# ---------------------------------------------------------------------------
# Voice + chat bridge: one assistant endpoint that needs no account session.
# The web voice button posts here, and the WhatsApp/chat bridge reuses it, so
# every channel answers from the same grounded engine.
# ---------------------------------------------------------------------------

@router.post('/assistant/ask', response_model=ChatOut)
def ask(req: AskIn, request: Request):
    ip = request.client.host if request.client else 'unknown'
    rl.allow('ask:' + ip, rl.ASK_PER_HOUR, 'assistant asks')
    context = {'state': req.state, 'grades': req.grades, 'subjects': req.subjects}
    context = {k: v for k, v in context.items() if v}
    result = assistant_engine.respond(req.message, context, req.language)
    return _chat_out(result)


@router.post('/assistant/bridge')
def bridge(payload: Dict[str, Any], request: Request):
    """Channel-agnostic message bridge.

    Body: {channel: 'whatsapp'|'webchat', from: '<phone or session id>',
           message: str, language?: str, profile?: {...}}
    Returns {reply, sources, mode}. Sessions are keyed by channel + sender,
    so a teacher's WhatsApp thread and web chat stay separate histories.
    No real provider credentials are required — the WhatsApp webhook adapter
    calls this same function once Meta credentials are configured.
    """
    ip = request.client.host if request.client else 'unknown'
    rl.allow('bridge:' + ip, rl.ASK_PER_HOUR, 'assistant asks')
    channel = str(payload.get('channel') or 'webchat')[:32]
    sender = str(payload.get('from') or 'anonymous')[:64]
    message = str(payload.get('message') or '').strip()
    if not message:
        raise HTTPException(status_code=422, detail='message is required')
    language = str(payload.get('language') or '').strip() or detect_language(message)
    context = payload.get('profile') if isinstance(payload.get('profile'), dict) else {}
    result = assistant_engine.respond(message, context, language)
    return {'channel': channel, 'from': sender, **result}


# ---------------------------------------------------------------------------
# WhatsApp webhook adapter (Meta Cloud API).
#
# GET  /assistant/whatsapp?hub.mode=…&hub.verify_token=…&hub.challenge=…
#      — Meta's subscription handshake; answers the challenge only when the
#        verify token matches WHATSAPP_VERIFY_TOKEN.
# POST /assistant/whatsapp
#      — Meta delivers inbound messages as JSON; we extract the text, run it
#        through the same bridge the web chat uses, and return a reply
#        structure Meta can deliver back to the teacher.
#
# Works today in "echo mode" (no credentials): a POST with a plain payload is
# answered so the flow can be tested end to end. With WHATSAPP_TOKEN set the
# outbound send is attempted for real.
# ---------------------------------------------------------------------------
import urllib.parse
import urllib.request

_VERIFY_TOKEN = os.environ.get('WHATSAPP_VERIFY_TOKEN', 'thrive-verify').strip()
_ACCESS_TOKEN = os.environ.get('WHATSAPP_TOKEN', '').strip()
_PHONE_ID = os.environ.get('WHATSAPP_PHONE_ID', '').strip()
_APP_SECRET = os.environ.get('WHATSAPP_APP_SECRET', '').strip()
_DISPLAY_NUMBER = os.environ.get('WHATSAPP_DISPLAY_NUMBER', '').strip()
_WA_GRAPH = 'https://graph.facebook.com/v19.0'
# Link codes are a credential-adjacent write; cap attempts per number per hour.
LINK_PER_HOUR = 5


def _check_wa_signature(raw: bytes, signature_header: str) -> bool:
    """Verify Meta's X-Hub-Signature-256 when an app secret is configured.

    ``signature_header`` is ``sha256=<hexdigest>``. Uses constant-time compare.
    Returns True when no secret is set (unsigned dev/simulation/tests) or the
    signature matches.
    """
    if not _APP_SECRET:
        return True
    if not signature_header or not signature_header.startswith('sha256='):
        return False
    expected = hmac.new(_APP_SECRET.encode('utf-8'), raw, hashlib.sha256).hexdigest()
    given = signature_header.split('sha256=', 1)[1].strip()
    return hmac.compare_digest(expected, given)


def _extract_wa_status(payload: Dict[str, Any]) -> Dict[str, str]:
    """Pull the first delivery status callback out of a Meta webhook envelope.

    Meta posts delivery receipts as a ``statuses`` array rather than ``messages``.
    Returns {message_id, to, status, error} — status is one of sent, delivered,
    read, failed (or a raw code) — and an empty dict when there is none.
    """
    try:
        entry = payload['entry'][0]
        change = entry['changes'][0]['value']
        st = change['statuses'][0]
        status = str(st.get('status') or '')
        err = (st.get('errors') or [{}])[0]
        return {'message_id': str(st.get('id') or ''), 'to': str(st.get('to') or ''),
                'status': status, 'error': str(err.get('message') or '')}
    except (KeyError, IndexError, TypeError):
        return {}


def _extract_wa_message(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Pull {from, text, language, display_name} out of a Meta webhook envelope.

    Language is honoured when the caller states it (e.g. a test harness or a
    client that pins it); otherwise we infer it from the message text itself —
    Devanagari means Hindi — so a teacher simply typing in their own language
    gets a reply in that language.
    """
    try:
        entry = payload['entry'][0]
        change = entry['changes'][0]['value']
        msg = change['messages'][0]
        sender = msg.get('from', '')
        # text body, or button reply, or interactive list reply
        text = (msg.get('text') or {}).get('body') \
            or (msg.get('button') or {}).get('text') \
            or (msg.get('interactive') or {}).get('button_reply', {}).get('title') \
            or (msg.get('interactive') or {}).get('list_reply', {}).get('title') \
            or ''
        text = str(text).strip()
        explicit = str(payload.get('language') or '').strip()
        lang = explicit if explicit else detect_language(text)
        display_name = str((msg.get('profile') or {}).get('name') or '').strip()
        return {'from': sender, 'text': text, 'language': lang, 'display_name': display_name}
    except (KeyError, IndexError, TypeError):
        return {'from': '', 'text': '', 'language': 'English', 'display_name': ''}


def _send_wa_text(to: str, body: str) -> bool:
    """Best-effort outbound send via Meta Cloud API. Silent no-op without creds."""
    if not (_ACCESS_TOKEN and _PHONE_ID and to):
        return False
    data = json.dumps({'messaging_product': 'whatsapp', 'to': to,
                       'type': 'text', 'text': {'body': body[:4096]}}).encode('utf-8')
    req = urllib.request.Request(
        f'{_WA_GRAPH}/{_PHONE_ID}/messages',
        data=data,
        headers={'Content-Type': 'application/json',
                 'Authorization': f'Bearer {_ACCESS_TOKEN}'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return 200 <= resp.status < 300
    except Exception:
        return False


# ---------------------------------------------------------------------------
# WhatsApp account linking — a signed-in teacher mints a one-time code on the
# web and texts it to the bot; the webhook redeems it. Unlink is web-only.
# ---------------------------------------------------------------------------

@router.post('/assistant/whatsapp/link-code', response_model=LinkCodeOut)
def whatsapp_link_code(teacher: Teacher = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """Mint a fresh one-time link code (older unused codes for this teacher are
    dropped). The plain code is returned once; only its hash is stored."""
    issued = whatsapp_links.issue_code(teacher, db)
    return LinkCodeOut(code=issued['code'], expires_in=issued['expires_in'],
                       wa_number=_DISPLAY_NUMBER)


@router.get('/assistant/whatsapp/link', response_model=LinkStatusOut)
def whatsapp_link_status(teacher: Teacher = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    """Whether this account is bound to a WhatsApp number (masked, never full)."""
    link = whatsapp_links.get_link(teacher.id, db)
    if link is None:
        return LinkStatusOut(linked=False)
    return LinkStatusOut(linked=True, phone_masked=whatsapp_links.phone_masked(link.phone),
                         linked_at=link.linked_at)


@router.delete('/assistant/whatsapp/link')
def whatsapp_unlink(teacher: Teacher = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """Unbind this account's number. Deliberately web-only — a stolen or shared
    phone must not be able to detach the real teacher's account."""
    removed = whatsapp_links.remove_link(teacher.id, db)
    return {'status': 'unlinked' if removed else 'not-linked'}


@router.get('/assistant/whatsapp/status')
def whatsapp_status(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Honest integration status for the UI and tests.

    Never claims live delivery without credentials: `live` is true only when
    both WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are configured. `signing` reports
    whether webhook bodies are HMAC-verified (required before go-live).
    """
    configured = bool(_ACCESS_TOKEN and _PHONE_ID)
    signing = bool(_APP_SECRET)
    linked_senders = db.query(whatsapp_links.WhatsAppLink).count()
    note = ('Live Meta Cloud API sends are enabled. Inbound webhook replies are '
            "generated by THRIVE's assistant and delivered by Meta."
            if configured else
            'WhatsApp is not connected yet — a WhatsApp Business number and its '
            'credentials (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID) still need to be added. '
            'Until then, replies are generated by THRIVE’s assistant but nothing is '
            'sent to a real phone. Your administrator can connect a number to go live.')
    if not signing:
        note += (' Webhook signature checking is OFF — set WHATSAPP_APP_SECRET '
                 'before going live.')
    return {
        'configured': configured,
        'live': configured,
        'channel': 'whatsapp',
        'webhook_path': '/assistant/whatsapp',
        'verify_token_set': bool(_VERIFY_TOKEN),
        'signing': signing,
        'linked_senders': linked_senders,
        'mode': 'live-send' if configured else 'simulation',
        'note': note,
    }


@router.get('/assistant/whatsapp')
def whatsapp_verify(
    # Meta sends dotted query keys (hub.mode, …); alias them explicitly —
    # FastAPI would otherwise map them to hub_mode only after dot-to-underscore
    # conversion, which is fragile across versions.
    hub_mode: str = Query('', alias='hub.mode'),
    hub_verify_token: str = Query('', alias='hub.verify_token'),
    hub_challenge: str = Query('', alias='hub.challenge'),
):
    """Meta subscription verification handshake."""
    if hub_mode == 'subscribe' and hub_verify_token == _VERIFY_TOKEN:
        return Response(content=hub_challenge, media_type='text/plain')
    raise HTTPException(status_code=403, detail='verification token mismatch')


@router.post('/assistant/whatsapp')
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    """Inbound WhatsApp message → grounded reply / account action; receipts → ack.

    Meta posts two shapes here. An inbound teacher message (``messages``) is
    routed through ``whatsapp_actions.handle`` — free text to the grounded
    assistant, and (for a number bound to an account) plan/post/progress/
    remind commands that write to that account. The reply is returned in the
    response (for tests and Meta's webhook ACK) and pushed outbound when
    credentials are configured. A delivery receipt (``statuses``) is
    acknowledged with what it reports, never answered.

    When ``WHATSAPP_APP_SECRET`` is set, the body must carry a valid
    ``X-Hub-Signature-256`` or the call is refused (403).
    """
    raw = await request.body()
    if not _check_wa_signature(raw, request.headers.get('x-hub-signature-256', '')):
        raise HTTPException(status_code=403, detail='invalid webhook signature')
    try:
        payload = json.loads(raw.decode('utf-8') or '{}')
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail='invalid JSON body')

    status = _extract_wa_status(payload)
    if status:
        return {'channel': 'whatsapp', 'kind': 'status', 'acknowledged': True, **status}

    inbound = _extract_wa_message(payload)
    if not inbound['text']:
        # Some other change type (user profile, etc.) — acknowledge silently.
        return {'status': 'ignored', 'reason': 'no inbound text message'}

    # Rate limit. A 429 must reach the teacher as a *sent* bilingual message
    # (Meta's ACK can't carry a body), so we convert the exception here.
    if inbound['from']:
        try:
            rl.allow('wa:' + inbound['from'], rl.WHATSAPP_PER_HOUR, 'WhatsApp messages')
        except HTTPException as e:
            en, hi = str(e.detail), whatsapp_actions.RATE_HI
            body = en + '\n\n' + hi
            _send_wa_text(inbound['from'], body)
            return {'channel': 'whatsapp', 'kind': 'message', 'from': inbound['from'],
                    'throttled': True, 'delivered': bool(_ACCESS_TOKEN), 'reply': body,
                    'sources': [], 'mode': 'rate-limit'}

    # Resolve the account bound to this phone, if any (unlinked → guest, no writes).
    teacher = whatsapp_links.resolve_teacher(inbound['from'], db)
    result = whatsapp_actions.handle(inbound['text'], teacher, inbound['language'], db,
                                     phone=inbound['from'])
    if inbound['from']:
        _send_wa_text(inbound['from'], result['reply'])
    return {
        'channel': 'whatsapp',
        'kind': 'message',
        'from': inbound['from'],
        'linked': result['linked'],
        'action': result['action'],
        'saved_id': result['saved_id'],
        'delivered': bool(_ACCESS_TOKEN),
        'reply': result['reply'],
        'sources': result['sources'],
        'mode': result['mode'],
    }
