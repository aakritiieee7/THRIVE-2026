from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .auth import create_token, get_current_user, hash_password, verify_password
from .db import get_db, now
from .models import Teacher
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
