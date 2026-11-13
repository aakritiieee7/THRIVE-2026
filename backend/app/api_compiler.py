"""Compiler API — validates input, runs the deterministic engine, exports."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from .solver import (CompileInput, GradeRequest, InfeasiblePlan, Slot, _feasible,
                     compile_schedule, to_csv)

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


class RegenerateRequest(CompileRequest):
    """Section-level regeneration: the current form inputs plus the timeline
    the teacher has been editing (so manual duration/activity edits survive)
    and the index of the one teacher-turn section to rebuild."""
    slot_index: int = Field(ge=0, le=200)
    slots: List[Dict[str, Any]] = Field(min_length=1, max_length=200)


def _input_from(req: CompileRequest) -> CompileInput:
    return CompileInput(
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


@router.post('/run')
def run_compile(req: CompileRequest):
    try:
        return compile_schedule(_input_from(req))
    except InfeasiblePlan as e:
        raise HTTPException(status_code=422, detail=e.errors)


@router.post('/export.csv')
def export_csv(req: CompileRequest):
    """Same compile, delivered as a downloadable CSV timetable."""
    try:
        result = compile_schedule(_input_from(req))
    except InfeasiblePlan as e:
        raise HTTPException(status_code=422, detail=e.errors)
    return Response(
        content=to_csv(result),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename="thrive-multigrade-plan.csv"'},
    )


_SLOT_REQUIRED = ('start', 'end', 'kind', 'focus', 'grades', 'objective',
                  'teacher', 'activity', 'materials', 'check')


def _slot_from_dict(d: Dict[str, Any], index: int) -> Slot:
    """Rebuild a Slot from the client's timeline dict, with honest errors."""
    missing = [k for k in _SLOT_REQUIRED if k not in d]
    if missing:
        raise HTTPException(status_code=422,
                            detail=[f'Timeline slot {index + 1} is missing fields: {", ".join(missing)}'])
    try:
        return Slot(
            start=int(d['start']), end=int(d['end']),
            focus=str(d['focus']), grades=[str(x) for x in d['grades']],
            objective=str(d['objective']), teacher=str(d['teacher']),
            activity=str(d['activity']), materials=str(d['materials']),
            check=str(d['check']), kind=str(d['kind']),
            lanes=[{'who': str(l.get('who', '')), 'doing': str(l.get('doing', '')),
                    'is_teacher': str(l.get('is_teacher', ''))}
                   for l in (d.get('lanes') or []) if isinstance(l, dict)],
            early_finishers=str(d.get('early_finishers') or ''),
        )
    except (TypeError, ValueError):
        raise HTTPException(status_code=422,
                            detail=[f'Timeline slot {index + 1} has unreadable start/end times.'])


@router.post('/regenerate')
def regenerate_section(req: RegenerateRequest):
    """Rebuild ONE teacher-turn section from the current inputs.

    Unlike a full regenerate, this keeps every other slot exactly as the
    teacher has it — manual activity rewrites and duration edits survive.
    The rebuilt section keeps the client's start/end (the teacher's duration
    choice) and gets fresh engine content (activity, objective, check, lanes,
    early-finisher plan). The merged timeline is re-validated against the
    same constraints a full compile obeys (contiguous, exact period, every
    grade gets a turn, teacher never double-booked); failures come back as a
    422 naming the slot, never a silently broken schedule.
    """
    inp = _input_from(req)
    try:
        fresh = compile_schedule(inp)
    except InfeasiblePlan as e:
        raise HTTPException(status_code=422, detail=e.errors)

    if req.slot_index >= len(req.slots):
        raise HTTPException(status_code=422,
                            detail=['That section is no longer in the timeline you sent. '
                                    'Open the plan again and try once more.'])
    target = req.slots[req.slot_index]
    target_kind = str(target.get('kind', '')) if isinstance(target, dict) else ''
    if target_kind != 'turn':
        raise HTTPException(status_code=422,
                            detail=['Only teacher-turn sections can be regenerated on their own — '
                                    'the opening and closing are built for the whole class.'])

    slots = [_slot_from_dict(s, i) for i, s in enumerate(req.slots)]

    # Match the target to its grade's turn in the fresh compile: turn order
    # is the same as the grade order, so count the turns before the target.
    fresh_turns = [s for s in fresh['slots'] if s['kind'] == 'turn']
    n_turns_before = sum(1 for s in slots[:req.slot_index] if s.kind == 'turn')
    if n_turns_before >= len(fresh_turns):
        raise HTTPException(status_code=422,
                            detail=['Could not find the matching section in the freshly built plan.'])
    donor: Dict[str, Any] = fresh_turns[n_turns_before]

    t = slots[req.slot_index]
    # Keep the client's timing; replace everything the engine owns.
    t.focus = donor['focus']
    t.grades = list(donor['grades'])
    t.objective = donor['objective']
    t.teacher = donor['teacher']
    t.activity = donor['activity']
    t.materials = inp.materials.strip() or 'Board and locally available objects'
    t.check = donor['check']
    t.lanes = list(donor['lanes'])
    t.early_finishers = donor['early_finishers']

    if not _feasible(slots, inp):
        raise HTTPException(
            status_code=422,
            detail=['The regenerated section no longer fits the rest of your edits: '
                    'the timeline must run contiguously from 00:00 to the end of the period, '
                    'give every grade a teacher turn, and never double-book you. '
                    'Adjust a section length, or regenerate the original plan.'])

    return {
        'status': 'ok',
        'minutes': inp.minutes,
        'subject': inp.subject,
        'slots': [s.__dict__ for s in slots],
        'assessments': fresh['assessments'],
        'engine': 'constraint-constructive',
        'sources': fresh['sources'],
    }
