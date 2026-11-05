from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from .db import SessionLocal
from .models import Teacher

router = APIRouter()

class SignupReq(BaseModel):
    name: str
    email: str

@router.post('/signup')
def signup(req: SignupReq):
    db = SessionLocal()
    t = Teacher(name=req.name, email=req.email)
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"status":"ok","teacher_id":t.id}

@router.get('/me')
def me():
    # stub
    return {"id":1,"name":"Demo Teacher","email":"demo@thrive.local"}
