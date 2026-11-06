"""Constraint tests for the multi-grade compiler engine."""
import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.solver import CompileInput, GradeRequest, InfeasiblePlan, compile_schedule, to_csv


def make_grades(n=2):
    return [
        GradeRequest(grade=str(i + 1), topic=f'Topic {i + 1}',
                     objective=f'Objective {i + 1}')
        for i in range(n)
    ]


def base(**kw):
    data = dict(subject='Mathematics', medium='English', board='NCERT',
                minutes=45, grades=make_grades(2), materials='paper, chalk')
    data.update(kw)
    return CompileInput(**data)


def test_exact_fit_two_grades():
    result = compile_schedule(base())
    slots = result['slots']
    assert slots[-1]['end'] == 45
    assert all(a['end'] == b['start'] for a, b in zip(slots, slots[1:]))
    assert slots[0]['start'] == 0


def test_every_grade_gets_teacher_turn():
    result = compile_schedule(base(grades=make_grades(3), minutes=60))
    turns = [s for s in result['slots'] if s['kind'] == 'turn']
    assert len(turns) == 3
    assert {t['focus'] for t in turns} == {'Grade 1', 'Grade 2', 'Grade 3'}


def test_rejects_too_little_time():
    with pytest.raises(InfeasiblePlan) as e:
        compile_schedule(base(grades=make_grades(4), minutes=20))
    assert any('not enough' in err for err in e.value.errors)


def test_rejects_missing_objective():
    bad = base()
    bad.grades[0].objective = '  '
    with pytest.raises(InfeasiblePlan):
        compile_schedule(bad)


def test_rejects_duplicate_grades():
    with pytest.raises(InfeasiblePlan) as e:
        compile_schedule(base(grades=[GradeRequest('3', 'A', 'oa'), GradeRequest('3', 'B', 'ob')]))
    assert any('only once' in err for err in e.value.errors)


def test_rejects_out_of_range_minutes():
    with pytest.raises(InfeasiblePlan):
        compile_schedule(base(minutes=5))
    with pytest.raises(InfeasiblePlan):
        compile_schedule(base(minutes=500))


def test_independent_work_assigned_while_teacher_busy():
    result = compile_schedule(base(grades=make_grades(3), minutes=45))
    turns = [s for s in result['slots'] if s['kind'] == 'turn']
    for t in turns:
        others = [g for g in ('Grade 1', 'Grade 2', 'Grade 3') if g != t['focus']]
        if others:
            assert 'independent' in t['activity'].lower()


def test_teacher_not_double_booked():
    result = compile_schedule(base(grades=make_grades(4), minutes=60))
    teacher_slots = [s for s in result['slots'] if s['teacher'] == 'Teacher-led']
    for a, b in zip(teacher_slots, teacher_slots[1:]):
        assert a['end'] <= b['start']


def test_shared_group_creates_joint_opening():
    grades = [
        GradeRequest('1', 'Numbers 1-20', 'Count to 20', shared_group='num'),
        GradeRequest('2', 'Numbers to 99', 'Read two-digit numbers', shared_group='num'),
        GradeRequest('3', 'Shapes', 'Name shapes'),
    ]
    result = compile_schedule(base(grades=grades, minutes=50))
    opening = result['slots'][0]
    assert opening['kind'] == 'opening'
    assert 'shared' in opening['activity'].lower() or 'joint' in opening['activity'].lower()
    assert opening['start'] == 0


def test_no_merge_without_shared_group():
    result = compile_schedule(base(grades=make_grades(3), minutes=45))
    opening = result['slots'][0]
    # no cross-grade topic merging: opening keeps each objective distinct
    turns = [s for s in result['slots'] if s['kind'] == 'turn']
    assert all('Objective' in t['objective'] for t in turns)


def test_transition_buffer_accounted():
    result = compile_schedule(base(grades=make_grades(3), minutes=55, transition_buffer=2))
    transitions = [s for s in result['slots'] if s['kind'] == 'transition']
    assert len(transitions) == 2
    assert result['slots'][-1]['end'] == 55


def test_assessment_per_grade():
    result = compile_schedule(base(grades=make_grades(3), minutes=45))
    assert len(result['assessments']) == 3
    assert {a['grade'] for a in result['assessments']} == {'1', '2', '3'}


def test_csv_export_shape():
    result = compile_schedule(base())
    csv_text = to_csv(result)
    lines = csv_text.splitlines()
    assert lines[0].startswith('"Start"')
    assert len(lines) == len(result['slots']) + 1


def test_single_grade_class():
    result = compile_schedule(base(grades=make_grades(1), minutes=30))
    turns = [s for s in result['slots'] if s['kind'] == 'turn']
    assert len(turns) == 1
    assert result['slots'][-1]['end'] == 30
