from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from random import randint

router = APIRouter()

class CompileRequest(BaseModel):
    grades: List[str]
    minutes: int
    slots: int

@router.post('/run')
def run_compile(req: CompileRequest):
    # placeholder solver: create a simple round-robin assignment
    schedule = {}
    for day in ['Mon','Tue','Wed','Thu','Fri']:
        schedule[day] = []
        for s in range(req.slots):
            grade = req.grades[s % len(req.grades)]
            schedule[day].append({
                'slot': s+1,
                'grade': grade,
                'minutes': req.minutes // req.slots,
                'activity': 'Combined activity' if s%2==0 else 'Grade-specific instruction'
            })
    return {'status':'ok','schedule':schedule}
