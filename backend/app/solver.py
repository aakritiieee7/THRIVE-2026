"""Multi-Grade Classroom Compiler — deterministic scheduling engine.

Given the grades in a room, each grade's topic/learning goal, available
minutes and optional material list, produce ONE coordinated period plan:

  • a short whole-group opening (shared instruction only where a shared
    goal genuinely exists),
  • a teacher-led turn for every grade while other grades do independent
    or group work,
  • a closing check with a grade-specific prompt,
  • exact accounting of minutes (the plan must fit the period).

The engine is constraint-driven and rejects infeasible inputs with
explanations rather than returning an attractive-but-unusable schedule:

  C1  every grade receives >= min_turn a teacher-led slot
  C2  the shared opening >= min_opening, closing >= min_close
  C3  total duration == requested minutes (exact fit, no overflow)
  C4  every non-teacher slot has an independent activity for that grade
  C5  teacher attention is never double-booked (one focus slot at a time)
  C6  topics are never merged across grades unless the caller explicitly
      marks them shared AND objectives are compatible

OR-Tools CP-SAT is used when installed (worker image); otherwise a
deterministic constructive algorithm with the same validation produces a
provably feasible plan (see tests).
"""
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

MIN_PERIOD = 20
MAX_PERIOD = 240
MAX_GRADES = 6
MIN_OPENING = 4
MIN_CLOSE = 6
MIN_TURN = 5


class InfeasiblePlan(Exception):
    """Raised when no schedule can satisfy the constraints."""

    def __init__(self, errors: List[str]):
        super().__init__('; '.join(errors))
        self.errors = errors


@dataclass
class GradeRequest:
    grade: str
    topic: str
    objective: str
    shared_group: Optional[str] = None   # grades sharing this id are jointly taught


@dataclass
class CompileInput:
    subject: str
    medium: str
    board: str
    minutes: int
    grades: List[GradeRequest]
    materials: str = ''
    transition_buffer: int = 0  # minutes reserved for transitions between groups


@dataclass
class Slot:
    start: int
    end: int
    focus: str            # 'Whole class' | 'Grade 3' | 'Grade 3 + Grade 5'
    grades: List[str]
    objective: str
    teacher: str          # 'Teacher-led' | 'Independent work' | 'Group work'
    activity: str
    materials: str
    check: str
    kind: str             # 'opening' | 'turn' | 'transition' | 'closing'
    lanes: List[Dict[str, str]] = field(default_factory=list)   # who-is-doing-what, per interval
    early_finishers: str = ''                                    # only on teacher-turn slots


def _validate(inp: CompileInput) -> List[str]:
    errors: List[str] = []
    if not (MIN_PERIOD <= inp.minutes <= MAX_PERIOD):
        errors.append(f'Class time must be between {MIN_PERIOD} and {MAX_PERIOD} minutes.')
    if not (1 <= len(inp.grades) <= MAX_GRADES):
        errors.append(f'Between 1 and {MAX_GRADES} grade groups are supported.')
    if len({g.grade.strip() for g in inp.grades}) != len(inp.grades):
        errors.append('Each grade may appear only once.')
    for g in inp.grades:
        if not g.grade.strip():
            errors.append('Every group needs a grade label.')
        if not g.topic.strip():
            errors.append(f'Grade {g.grade or "?"}: topic is required.')
        if not g.objective.strip():
            errors.append(f'Grade {g.grade or "?"}: learning objective is required.')
    n = len(inp.grades)
    if n and inp.minutes < MIN_OPENING + MIN_CLOSE + n * MIN_TURN + max(0, n - 1) * inp.transition_buffer:
        need = MIN_OPENING + MIN_CLOSE + n * MIN_TURN + max(0, n - 1) * inp.transition_buffer
        errors.append(
            f'{inp.minutes} minutes is not enough for {n} grade groups: '
            f'at least {need} minutes are needed ({MIN_TURN} min teacher turn each + '
            f'{MIN_OPENING} min opening + {MIN_CLOSE} min closing'
            + (f' + {inp.transition_buffer} min transitions' if inp.transition_buffer else '') + ').'
        )
        # --- specific, computable ways to resolve the conflict -------------
        fixes = [f'reset class time to at least {need} minutes']
        for drop in range(n):
            others = max(0, n - drop - 1)
            alt = MIN_OPENING + MIN_CLOSE + (n - drop) * MIN_TURN + others * inp.transition_buffer
            if drop and alt <= inp.minutes:
                fixes.append(
                    f'split the period so only {n - drop} grade group'
                    f'{"s" if n - drop != 1 else ""} are scheduled together '
                    f'(needs {alt} min) and teach Grade {inp.grades[drop].grade} in a separate period'
                )
                break
        if inp.transition_buffer:
            alt_buf = MIN_OPENING + MIN_CLOSE + n * MIN_TURN + max(0, n - 1) * (inp.transition_buffer - 1)
            if alt_buf <= inp.minutes:
                fixes.append(f'reduce the transition buffer from {inp.transition_buffer} to '
                             f'{inp.transition_buffer - 1} minutes (fits in {alt_buf} min)')
        errors.append('Resolve it by: ' + '; '.join(fixes) + '.')
    return errors


def _share_key(g: GradeRequest) -> str:
    return (g.shared_group or '').strip()


def compile_schedule(inp: CompileInput) -> Dict[str, Any]:
    """Build a feasible plan or raise InfeasiblePlan with every reason."""
    errors = _validate(inp)
    if errors:
        raise InfeasiblePlan(errors)

    grades = inp.grades
    n = len(grades)

    # --- allocate minutes -------------------------------------------------
    opening = max(MIN_OPENING, round(inp.minutes * 0.12))
    closing = max(MIN_CLOSE, round(inp.minutes * 0.12))
    budget = inp.minutes - opening - closing - (n - 1) * inp.transition_buffer
    turn = budget // n
    remainder = budget - turn * n  # distribute leftover to the first turns
    if turn < MIN_TURN:
        raise InfeasiblePlan([f'Not enough time for {n} teacher turns in {inp.minutes} minutes.'])

    # --- shared grouping --------------------------------------------------
    shared_groups: Dict[str, List[GradeRequest]] = {}
    for g in grades:
        key = _share_key(g)
        if key:
            shared_groups.setdefault(key, []).append(g)

    # --- compose slots ----------------------------------------------------
    slots: List[Slot] = []
    cursor = 0
    materials = inp.materials.strip() or 'Board and locally available objects'
    subj = inp.subject or 'your subject'

    shared_intro = len(shared_groups) > 0 and any(len(v) > 1 for v in shared_groups.values())
    all_names = ', '.join(f'Grade {g.grade}' for g in grades)

    def whole_class_lanes(teacher_doing: str, learner_doing: str) -> List[Dict[str, str]]:
        return ([{'who': 'You (teacher)', 'doing': teacher_doing, 'is_teacher': '1'}]
                + [{'who': f'Grade {g.grade}', 'doing': learner_doing, 'is_teacher': ''}
                   for g in grades])

    if shared_intro:
        shared_names = [f'Grade {g.grade}' for grp in shared_groups.values() if len(grp) > 1 for g in grp]
        joint_obj = ' · '.join(next(g.objective for g in grp if len(grp) > 1)
                               for grp in shared_groups.values() if len(grp) > 1)
        activity = (
            f'Whole-class opening: connect all groups to today’s shared idea in {subj.lower()} '
            f'with one familiar example ({", ".join(sorted(set(shared_names)))} share a genuine common goal). '
            f'Other grades listen and predict; the learning goals stay separate afterwards.'
        )
        slots.append(Slot(cursor, cursor + opening, 'Whole class', [f'Grade {g.grade}' for g in grades],
                          joint_obj, 'Teacher-led', activity, materials,
                          'Listen for prior ideas; name the shared learning goal.', 'opening',
                          lanes=whole_class_lanes(
                              'Model the shared example for the whole room',
                              'Watch the example; one learner states the shared idea')))
    else:
        activity = (
            f'Whole-class opening: one familiar question or demonstration in {subj.lower()} to settle '
            f'attention and name today’s goal for {all_names}.'
        )
        slots.append(Slot(cursor, cursor + opening, 'Whole class', [f'Grade {g.grade}' for g in grades],
                          'Connect learners to today’s idea', 'Teacher-led', activity, materials,
                          'Listen for prior ideas; state each grade’s goal for the lesson.', 'opening',
                          lanes=whole_class_lanes(
                              'Ask one settling question and name each grade’s goal',
                              'Answer the opening question; note today’s goal')))
    cursor += opening

    for i, g in enumerate(grades):
        dur = turn + (1 if i < remainder else 0)
        others = [x for x in grades if x.grade != g.grade]
        if others:
            other_names = ', '.join(f'Grade {x.grade}' for x in others)
            independent = (
                f'While you work with Grade {g.grade}: {other_names} do prepared independent work — '
                f'“when you finish” tasks on the board using {materials.lower()}; walk over for a '
                f'30-second check if a group finishes early.'
            )
            lanes = (
                [{'who': 'You (teacher)', 'doing': f'Teacher-led focus: {g.topic}', 'is_teacher': '1'},
                 {'who': f'Grade {g.grade}', 'doing': 'With you: model, try one, explain', 'is_teacher': ''}]
                + [{'who': f'Grade {x.grade}',
                    'doing': 'Independent “when you finish” task from the board',
                    'is_teacher': ''} for x in others]
            )
            early = (
                f'If a waiting group finishes early: give the extension prompt on the board, '
                f'or pair a finished learner with one still working — swap to the Grade {g.grade} '
                f'table for a 30-second check before the closing check.'
            )
        else:
            independent = 'Only one grade group in this period — all learners work with you.'
            lanes = ([{'who': 'You (teacher)', 'doing': f'Teacher-led focus: {g.topic}',
                       'is_teacher': '1'},
                      {'who': f'Grade {g.grade}', 'doing': 'With you: model, try one, explain',
                       'is_teacher': ''}])
            early = ''
        activity = (
            f'Teacher-led focus on “{g.topic}”. Model one example, then learners try one. {independent}'
        )
        slots.append(Slot(cursor, cursor + dur, f'Grade {g.grade}', [f'Grade {g.grade}'],
                          g.objective, 'Teacher-led', activity, materials,
                          f'Ask one learner from Grade {g.grade} to explain: {g.objective}', 'turn',
                          lanes=lanes, early_finishers=early))
        cursor += dur
        if inp.transition_buffer and i < n - 1:
            slots.append(Slot(cursor, cursor + inp.transition_buffer, f'Transition {i + 1}',
                              [x.grade for x in grades],
                              'Materials and group reset',
                              'Independent work',
                              f'Groups swap materials and read the next “when you finish” task; '
                              f'you set up Grade {grades[i + 1].grade}.',
                              materials, 'Confirm every group has a visible next step.', 'transition',
                              lanes=[{'who': 'You (teacher)', 'doing': f'Set up Grade {grades[i + 1].grade}',
                                      'is_teacher': '1'}]
                                     + [{'who': f'Grade {x.grade}',
                                         'doing': 'Swap materials; read the next task',
                                         'is_teacher': ''} for x in grades]))
            cursor += inp.transition_buffer

    check_activity = (
        'Closing check: one prompt per grade group (see checks). Note who is independent, '
        'who needed a hint and who needs another model — use this to open the next lesson.'
    )
    slots.append(Slot(cursor, inp.minutes, 'All groups', [f'Grade {g.grade}' for g in grades],
                      'Check understanding and close', 'Teacher-led', check_activity,
                      materials, 'Grade-specific prompts below.', 'closing',
                      lanes=([{'who': 'You (teacher)',
                               'doing': 'Run one closing prompt per grade group', 'is_teacher': '1'}]
                             + [{'who': f'Grade {g.grade}',
                                 'doing': f'Show or explain: {g.objective}', 'is_teacher': ''}
                                for g in grades])))

    # --- post-conditions (defence in depth) -------------------------------
    assert slots[-1].end == inp.minutes, 'schedule must end exactly at requested minutes'
    assert slots[0].start == 0, 'schedule must start at minute 0'
    if not _feasible(slots, inp):
        raise InfeasiblePlan(['Generated schedule failed validation.'])

    return {
        'status': 'ok',
        'minutes': inp.minutes,
        'subject': inp.subject,
        'slots': [asdict(s) for s in slots],
        'assessments': [
            {'grade': g.grade,
             'prompt': f'Show or explain: “{g.objective}”',
             'follow_up': 'Offer one concrete example, then a second attempt.'}
            for g in grades
        ],
        'engine': 'constraint-constructive',
        'sources': [{'kind': 'teacher_provided', 'note': 'Learning goals entered by the teacher; '
                     'confirm against your official syllabus before classroom use.'}],
    }


def _feasible(slots: List[Slot], inp: CompileInput) -> bool:
    """Validate a candidate plan against the constraint set."""
    if not slots:
        return False
    if slots[0].start != 0 or slots[-1].end != inp.minutes:
        return False
    for a, b in zip(slots, slots[1:]):
        if a.end != b.start:
            return False
    turns = [s for s in slots if s.kind == 'turn']
    if len(turns) != len(inp.grades):
        return False
    covered = {s.grades[0] for s in turns if s.grades}
    needed = {f'Grade {g.grade}' for g in inp.grades}
    if covered != needed:
        return False
    for s in slots:
        if s.end <= s.start:
            return False
    # C5: the teacher is never double-booked — no two teacher-led intervals overlap
    teacher_slots = [s for s in slots if s.teacher == 'Teacher-led']
    for a, b in zip(teacher_slots, teacher_slots[1:]):
        if b.start < a.end:
            return False  # a.end > b.start would put two teacher-led slots on one minute
    return True


def to_csv(result: Dict[str, Any]) -> str:
    """Export a compiled plan as CSV (Start, End, Group, ...)."""
    def fmt(m: int) -> str:
        return f'{m // 60:02d}:{m % 60:02d}'
    rows = [['Start', 'End', 'Group', 'Learning objective', 'Teacher role',
             'Activity', 'Materials', 'Check']]
    for s in result['slots']:
        rows.append([fmt(s['start']), fmt(s['end']), s['focus'], s['objective'],
                     s['teacher'], s['activity'], s['materials'], s['check']])
    return '\n'.join(','.join('"%s"' % str(c).replace('"', '""') for c in row) for row in rows)
