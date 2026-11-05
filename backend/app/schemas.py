from pydantic import BaseModel
from typing import List, Dict, Any

class TeacherCreate(BaseModel):
    name: str
    email: str

class TeacherOut(BaseModel):
    id: int
    name: str
    email: str
    profile: Dict[str,Any]
