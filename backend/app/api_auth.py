from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .auth import create_token, get_current_user, hash_password, verify_password
from .db import get_db, now
from .models import (AssistantMessage, CommunityHelpful, CommunityPost,
                     CommunityReply, RemindTask, Teacher, TrainingBookmark,
                     TrainingProgress, UpdateBookmark, WhatsAppLink, WhatsAppPairing)
from .schemas import ProfileUpdate, TeacherCreate, TeacherLogin, TeacherOut, TokenResp

router = APIRouter()


@router.post('/signup', response_model=TokenResp)
def signup(req: TeacherCreate, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    if db.query(Teacher).filter(Teacher.email == email).first():
        raise HTTPException(status_code=409, detail='An account with this email already exists.')
    teacher = Teacher(
        name=req.name.strip(),
        email=email,
        password_hash=hash_password(req.password),
        profile={},
        created_at=now(),
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return TokenResp(token=create_token(teacher.id), teacher_id=teacher.id, name=teacher.name)


@router.post('/login', response_model=TokenResp)
def login(req: TeacherLogin, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.email == req.email.lower().strip()).first()
    if teacher is None or not verify_password(req.password, teacher.password_hash):
        raise HTTPException(status_code=401, detail='Email or password is incorrect.')
    return TokenResp(token=create_token(teacher.id), teacher_id=teacher.id, name=teacher.name)


@router.get('/me', response_model=TeacherOut)
def me(teacher: Teacher = Depends(get_current_user)):
    return TeacherOut(id=teacher.id, name=teacher.name, email=teacher.email, profile=teacher.profile or {})


@router.put('/me', response_model=TeacherOut)
def update_me(
    req: ProfileUpdate,
    teacher: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.name and len(req.name.strip()) >= 2:
        teacher.name = req.name.strip()
    merged = dict(teacher.profile or {})
    merged.update(req.profile or {})
    teacher.profile = merged
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return TeacherOut(id=teacher.id, name=teacher.name, email=teacher.email, profile=teacher.profile or {})


# Account deletion. Every table referenced by a plain foreign key (PRAGMA
# foreign_keys=ON, no ORM cascade) is emptied explicitly first, and a teacher's
# own posts are taken down too — replies on them hang off the post, replies
# they wrote elsewhere hang off them. Lesson plans cascade in the ORM; guest
# plans (teacher_id NULL) are untouched.
@router.delete('/me')
def delete_me(
    teacher: Teacher = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher_id = teacher.id
    # Helpful votes reference both the teacher and posts (on this account and
    # others'), so they go before any post row disappears.
    db.query(CommunityHelpful).filter(CommunityHelpful.teacher_id == teacher_id)\
       .delete(synchronize_session=False)
    db.query(CommunityReply).filter(CommunityReply.teacher_id == teacher_id)\
       .delete(synchronize_session=False)
    db.query(CommunityPost).filter(CommunityPost.teacher_id == teacher_id)\
       .delete(synchronize_session=False)
    for model in (TrainingProgress, TrainingBookmark, UpdateBookmark,
                  AssistantMessage, WhatsAppLink, WhatsAppPairing, RemindTask):
        db.query(model).filter(model.teacher_id == teacher_id)\
           .delete(synchronize_session=False)
    db.delete(teacher)
    db.commit()
    return {'status': 'deleted', 'teacher_id': teacher_id}


