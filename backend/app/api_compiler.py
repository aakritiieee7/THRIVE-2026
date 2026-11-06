"""Compiler API — validates input, runs the deterministic engine, exports."""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from .solver import CompileInput, GradeRequest, InfeasiblePlan, compile_schedule, to_csv

router = APIRouter()


class GradeIn(BaseModel):
    grade: str = Field(min_length=1, max_length=12)
    topic: str = Field(min_length=1, max_length=200)
    objective: str = Field(min_length=1, max_length=400)
    shared_group: Optional[str] = Field(default=None, max_length=60)


class CompileRequest(BaseModel):
    subject: str = 'Mathematics'
    medium: str = 'English'
    board: str = 'NCERT'
    minutes: int = Field(ge=1, le=600)
    grades: List[GradeIn] = Field(min_length=1, max_length=6)
    materials: str = ''
    transition_buffer: int = Field(default=0, ge=0, le=15)


@router.post('/run')
def run_compile(req: CompileRequest):
    inp = CompileInput(
        subject=req.subject,
        medium=req.medium,
        board=req.board,
        minutes=req.minutes,
        materials=req.materials,
        transition_buffer=req.transition_buffer,
        grades=[GradeRequest(grade=g.grade.strip(), topic=g.topic.strip(),
                             objective=g.objective.strip(),
                             shared_group=g.shared_group) for g in req.grades],
    )
    try:
        return compile_schedule(inp)
    except InfeasiblePlan as e:
        raise HTTPException(status_code=422, detail=e.errors)


@router.post('/export.csv')
def export_csv(req: CompileRequest):
    """Same compile, delivered as a downloadable CSV timetable."""
    inp = CompileInput(
        subject=req.subject,
        medium=req.medium,
        board=req.board,
        minutes=req.minutes,
        materials=req.materials,
        transition_buffer=req.transition_buffer,
        grades=[GradeRequest(grade=g.grade.strip(), topic=g.topic.strip(),
                             objective=g.objective.strip(),
                             shared_group=g.shared_group) for g in req.grades],
    )
    try:
        result = compile_schedule(inp)
    except InfeasiblePlan as e:
        raise HTTPException(status_code=422, detail=e.errors)
    return Response(
        content=to_csv(result),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename="thrive-multigrade-plan.csv"'},
    )
