import json
import os
from typing import Any, Dict

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .api_compiler import router as compiler_router
from .api_auth import router as auth_router
from .auth import get_current_user
from .db import get_db, now
from .models import AssistantMessage, CommunityPost, CommunityReply, LessonPlan, Teacher, TrainingProgress, UpdateBookmark
from .schemas import (AskIn, ChatIn, ChatOut, GuestAskIn, GuestAskOut, GuestPlanOut,
                      GuestTokenOut, GuestUpgradeIn, LessonPlanIn, LessonPlanOut, PostIn,
                      PostOut, ProgressIn, ProgressOut, ReplyIn)
from pydantic import ValidationError
from . import assistant as assistant_engine
from . import guest as guest_layer

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
    try:
        out = GuestAskOut(**result, asks_remaining=guest_layer.guest_asks_remaining(token))
    except ValidationError:
        out = GuestAskOut(reply=result.get('reply', ''), sources=[],
                          mode=result.get('mode', 'local-grounded'),
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
def ask(req: AskIn):
    context = {'state': req.state, 'grades': req.grades, 'subjects': req.subjects}
    context = {k: v for k, v in context.items() if v}
    result = assistant_engine.respond(req.message, context, req.language)
    try:
        return ChatOut(**result)
    except ValidationError:
        return ChatOut(reply=result.get('reply', ''), sources=[], mode=result.get('mode', 'local-grounded'))


@router.post('/assistant/bridge')
def bridge(payload: Dict[str, Any]):
    """Channel-agnostic message bridge.

    Body: {channel: 'whatsapp'|'webchat', from: '<phone or session id>',
           message: str, language?: str, profile?: {...}}
    Returns {reply, sources, mode}. Sessions are keyed by channel + sender,
    so a teacher's WhatsApp thread and web chat stay separate histories.
    No real provider credentials are required — the WhatsApp webhook adapter
    calls this same function once Meta credentials are configured.
    """
    channel = str(payload.get('channel') or 'webchat')[:32]
    sender = str(payload.get('from') or 'anonymous')[:64]
    message = str(payload.get('message') or '').strip()
    if not message:
        raise HTTPException(status_code=422, detail='message is required')
    language = str(payload.get('language') or 'English')
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
_WA_GRAPH = 'https://graph.facebook.com/v19.0'


def _extract_wa_message(payload: Dict[str, Any]) -> Dict[str, str]:
    """Pull {from, text, language} out of a Meta webhook envelope."""
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
        lang = (msg.get('text') or {}).get('body') and payload.get('language') or 'English'
        return {'from': sender, 'text': str(text).strip(), 'language': lang}
    except (KeyError, IndexError, TypeError):
        return {'from': '', 'text': '', 'language': 'English'}


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


@router.get('/assistant/whatsapp/status')
def whatsapp_status() -> Dict[str, Any]:
    """Honest integration status for the UI and tests.

    Never claims live delivery without credentials: `live` is true only when
    both WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are configured.
    """
    configured = bool(_ACCESS_TOKEN and _PHONE_ID)
    return {
        'configured': configured,
        'live': configured,
        'channel': 'whatsapp',
        'webhook_path': '/assistant/whatsapp',
        'verify_token_set': bool(_VERIFY_TOKEN),
        'mode': 'live-send' if configured else 'simulation',
        'note': ('Live Meta Cloud API sends are enabled. Inbound webhook replies are '
                 "generated by THRIVE's assistant and delivered by Meta."
                 if configured else
                 'No WhatsApp credentials configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID). '
                 'The webhook and chatbot run in local simulation: replies are generated '
                 'and returned to the caller, but nothing is sent to a real phone. '
                 'See README to connect a Meta number.'),
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
def whatsapp_webhook(payload: Dict[str, Any]):
    """Inbound WhatsApp message → grounded reply.

    The reply is both returned in the response (useful for tests and for Meta's
    webhook ACK) and pushed outbound when credentials are configured.
    """
    inbound = _extract_wa_message(payload)
    if not inbound['text']:
        # Meta sends status callbacks too — acknowledge without answering.
        return {'status': 'ignored', 'reason': 'no inbound text message'}
    context = payload.get('profile') if isinstance(payload.get('profile'), dict) else {}
    result = assistant_engine.respond(inbound['text'], context, inbound['language'])
    if inbound['from']:
        _send_wa_text(inbound['from'], result['reply'])
    return {
        'channel': 'whatsapp',
        'from': inbound['from'],
        'delivered': bool(_ACCESS_TOKEN),
        **result,
    }
