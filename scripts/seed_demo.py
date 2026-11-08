#!/usr/bin/env python3
"""Seed a demo teacher account for the hackathon walkthrough.

Creates (or resets) ONE clearly-labelled demo teacher with real, server-side
content so the product can be presented with a populated account instead of an
empty state:

  • a teacher profile (state / board / medium / grades / subjects),
  • two lesson plans whose schedules come from the REAL multi-grade compiler —
    nothing here is hand-faked or hand-written as a "schedule",
  • training-centre progress on the real seed courses,
  • community posts and a reply, so the community screen has life.

Everything it writes is marked as demo data in the account name and post
bodies. No curriculum is invented: plan payload `sources` are produced by the
compiler itself and labelled teacher-provided/seeded there.

Usage:
    cd backend && .venv/bin/python ../scripts/seed_demo.py
    # or: python scripts/seed_demo.py   (repo root, with backend on the path)

Demo credentials (printed by the script):
    email:    demo@thrive.in
    password: thrive-demo-2026

Safe to re-run: it resets only its own rows (plans / progress / posts owned by
the demo account) rather than growing duplicates.
"""
import os
import sys

BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend')
sys.path.insert(0, BACKEND_DIR)

# Isolate to the same DB the running app uses (reads DATABASE_URL like the app).
from app.db import Base, SessionLocal, engine, now  # noqa: E402
from app.auth import hash_password  # noqa: E402
from app.models import (CommunityPost, CommunityReply, LessonPlan,  # noqa: E402
                        Teacher, TrainingProgress)
from app.solver import CompileInput, GradeRequest, InfeasiblePlan, compile_schedule  # noqa: E402

DEMO_EMAIL = 'demo@thrive.in'
DEMO_PASSWORD = 'thrive-demo-2026'
DEMO_NAME = 'Demo Teacher (THRIVE)'

PROFILE = {
    'state': 'Bihar',
    'board': 'Bihar SCERT',
    'medium': 'Hindi + English',
    'grades': '3, 4, 5',
    'subjects': 'Mathematics, Environmental Studies',
    'school': 'Demo Middle School',
    'language': 'Hindi',
}

# Two real multi-grade compilations, run through the actual solver.
PLANS = [
    {
        'title': 'Mathematics: Grade 3 & Grade 5 in one period',
        'subject': 'Mathematics',
        'medium': 'Hindi + English',
        'board': 'Bihar SCERT',
        'minutes': 45,
        'grades': [
            {'grade': '3', 'topic': 'Shapes and Patterns',
             'objective': 'Recognize common 2D shapes and create a repeating pattern'},
            {'grade': '5', 'topic': 'Fractions',
             'objective': 'Represent and compare simple fractions using paper folding'},
        ],
        'materials': 'paper, chalk, sticks',
        'transition_buffer': 3,
    },
    {
        'title': 'Environmental Studies: Grade 3 & Grade 4 together',
        'subject': 'Environmental Studies',
        'medium': 'Hindi + English',
        'board': 'Bihar SCERT',
        'minutes': 40,
        'grades': [
            {'grade': '3', 'topic': 'Our neighbourhood',
             'objective': 'Describe the people and places in the immediate neighbourhood'},
            {'grade': '4', 'topic': 'Water and its uses',
             'objective': 'List uses of water and suggest two ways to save it'},
        ],
        'materials': 'chalk, paper, locally available objects',
        'transition_buffer': 3,
    },
]

# course_id -> lessons_done (must match seedCourses ids in frontend/lib/storage.ts)
PROGRESS = {'c1': 4, 'c3': 3, 'c2': 2}

POSTS = [
    {
        'topic': 'Multi-grade',
        'title': 'How do you keep two grades busy while you teach the third?',
        'body': 'Demo post (seeded by scripts/seed_demo.py). When I am on the board with '
                'Grade 5 fractions, Grades 3 and 4 finish early or drift. I have started '
                'writing a visible "when you finish" task on the board before I begin the '
                'teacher turn. What works for you?',
        'replies': [
            'Demo reply (seeded): One shared anchor question, then two parallel independent '
            'tasks pinned to the board. The task must be checkable in under a minute so you '
            'can glance at it between turns.',
        ],
    },
    {
        'topic': 'Mathematics',
        'title': 'Low-cost fractions demo that actually lands in Grade 5',
        'body': 'Demo post (seeded by scripts/seed_demo.py). Paper folding beats the '
                'textbook diagram every time. Fold once for half, twice for quarter, then '
                'compare two folded strips. Costs nothing, and every child has the material '
                'in their hand.',
        'replies': [],
    },
]


def build_payload(plan: dict) -> dict:
    """Run the REAL compiler for a plan's grade set and build the saved payload.

    Returns None if the compiler refuses the input (we never hand-write a
    schedule to get around a feasibility check).
    """
    inp = CompileInput(
        subject=plan['subject'], medium=plan['medium'], board=plan['board'],
        minutes=plan['minutes'],
        materials=plan['materials'], transition_buffer=plan['transition_buffer'],
        grades=[GradeRequest(grade=g['grade'], topic=g['topic'], objective=g['objective'])
                for g in plan['grades']],
    )
    try:
        result = compile_schedule(inp)
    except InfeasiblePlan as e:
        print(f'  ! compiler refused "{plan["title"]}": {e.errors}')
        return None
    return {
        'title': plan['title'],
        'grades': plan['grades'],
        'minutes': plan['minutes'],
        'subject': plan['subject'],
        'medium': plan['medium'],
        'board': plan['board'],
        'materials': plan['materials'],
        'buffer': plan['transition_buffer'],
        'schedule': result['slots'],
        'assessments': result['assessments'],
        'sources': result['sources'],
        'savedAt': now(),
    }


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        teacher = db.query(Teacher).filter(Teacher.email == DEMO_EMAIL).first()
        if teacher is None:
            teacher = Teacher(name=DEMO_NAME, email=DEMO_EMAIL,
                              password_hash=hash_password(DEMO_PASSWORD),
                              profile=dict(PROFILE), created_at=now())
            db.add(teacher)
            db.flush()
            print(f'+ created demo account {DEMO_EMAIL}')
        else:
            teacher.name = DEMO_NAME
            teacher.password_hash = hash_password(DEMO_PASSWORD)
            teacher.profile = dict(PROFILE)
            print(f'= reset demo account {DEMO_EMAIL}')

        # Reset only this demo account's rows so re-runs don't duplicate.
        db.query(LessonPlan).filter(LessonPlan.teacher_id == teacher.id).delete()
        db.query(TrainingProgress).filter(TrainingProgress.teacher_id == teacher.id).delete()
        for post in db.query(CommunityPost).filter(CommunityPost.teacher_id == teacher.id):
            db.query(CommunityReply).filter(CommunityReply.post_id == post.id).delete()
        db.query(CommunityPost).filter(CommunityPost.teacher_id == teacher.id).delete()
        db.flush()

        made = 0
        for plan in PLANS:
            payload = build_payload(plan)
            if payload is None:
                continue
            db.add(LessonPlan(teacher_id=teacher.id, title=plan['title'],
                              subject=plan['subject'], medium=plan['medium'],
                              board=plan['board'], minutes=plan['minutes'],
                              payload=payload, created_at=now()))
            made += 1
        print(f'+ {made}/{len(PLANS)} lesson plans (schedules from the real compiler)')

        for cid, n in PROGRESS.items():
            db.add(TrainingProgress(teacher_id=teacher.id, course_id=cid,
                                    lessons_done=n, updated_at=now()))
        print(f'+ {len(PROGRESS)} training progress rows')

        for p in POSTS:
            post = CommunityPost(teacher_id=teacher.id, topic=p['topic'], title=p['title'],
                                 body=p['body'], reports=0, created_at=now())
            db.add(post)
            db.flush()
            for r in p['replies']:
                db.add(CommunityReply(post_id=post.id, teacher_id=teacher.id,
                                      body=r, created_at=now()))
        print(f'+ {len(POSTS)} community posts')

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print('\nDemo account ready:')
    print(f'  email:    {DEMO_EMAIL}')
    print(f'  password: {DEMO_PASSWORD}')


if __name__ == '__main__':
    seed()
