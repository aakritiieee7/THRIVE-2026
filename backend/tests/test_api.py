"""API integration tests (SQLite, no external services).

Run:  cd backend && python -m pytest tests/ -q
(conftest.py pins DATABASE_URL to an isolated SQLite file first.)
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.db import Base, engine  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth(client):
    r = client.post('/auth/signup', json={'name': 'Test Teacher', 'email': 't@example.com', 'password': 'secret1'})
    assert r.status_code == 200, r.text
    token = r.json()['token']
    return {'Authorization': f'Bearer {token}'}


def test_health(client):
    assert client.get('/health').json() == {'status': 'ok'}


def test_signup_login_me(client, auth):
    me = client.get('/auth/me', headers=auth)
    assert me.status_code == 200
    assert me.json()['name'] == 'Test Teacher'

    bad = client.post('/auth/login', json={'email': 't@example.com', 'password': 'wrong'})
    assert bad.status_code == 401

    ok = client.post('/auth/login', json={'email': 't@example.com', 'password': 'secret1'})
    assert ok.status_code == 200
    assert ok.json()['token']


def test_profile_update_persists(client, auth):
    r = client.put('/auth/me', headers=auth, json={'name': 'Aarohi Sharma',
                                                   'profile': {'state': 'Bihar', 'grades': '3,5'}})
    assert r.status_code == 200
    body = r.json()
    assert body['name'] == 'Aarohi Sharma'
    assert body['profile']['state'] == 'Bihar'
    me = client.get('/auth/me', headers=auth).json()
    assert me['profile']['grades'] == '3,5'


def test_me_requires_auth(client):
    assert client.get('/auth/me').status_code == 401


def test_duplicate_signup_rejected(client, auth):
    r = client.post('/auth/signup', json={'name': 'X Y', 'email': 't@example.com', 'password': 'secret1'})
    assert r.status_code == 409


def test_compiler_rejects_infeasible(client):
    r = client.post('/compiler/run', json={
        'minutes': 20, 'grades': [{'grade': str(i), 'topic': 'T', 'objective': 'O'} for i in range(1, 6)]
    })
    assert r.status_code == 422


def test_compiler_feasible_plan_exact_fit(client):
    r = client.post('/compiler/run', json={
        'subject': 'Mathematics', 'minutes': 45,
        'grades': [
            {'grade': '3', 'topic': 'Shapes', 'objective': 'Name shapes'},
            {'grade': '5', 'topic': 'Fractions', 'objective': 'Compare fractions'},
        ],
    })
    assert r.status_code == 200, r.text
    slots = r.json()['slots']
    assert slots[-1]['end'] == 45
    assert all(a['end'] == b['start'] for a, b in zip(slots, slots[1:]))


def test_compiler_export_csv(client):
    r = client.post('/compiler/export.csv', json={
        'minutes': 40,
        'grades': [{'grade': '2', 'topic': 'Patterns', 'objective': 'Extend patterns'}],
    })
    assert r.status_code == 200
    assert r.headers['content-type'].startswith('text/csv')
    assert r.text.splitlines()[0].startswith('"Start"')


def test_plans_crud(client, auth):
    created = client.post('/plans', headers=auth, json={
        'title': 'Grade 3 shapes', 'subject': 'Mathematics', 'minutes': 45,
        'payload': {'grades': [{'grade': '3'}], 'schedule': []},
    })
    assert created.status_code == 200, created.text
    pid = created.json()['id']

    listed = client.get('/plans', headers=auth)
    assert any(p['id'] == pid for p in listed.json())

    updated = client.put(f'/plans/{pid}', headers=auth, json={
        'title': 'Grade 3 shapes v2', 'subject': 'Mathematics', 'minutes': 45, 'payload': {}})
    assert updated.json()['title'] == 'Grade 3 shapes v2'

    deleted = client.delete(f'/plans/{pid}', headers=auth)
    assert deleted.status_code == 200
    assert all(p['id'] != pid for p in client.get('/plans', headers=auth).json())


def test_plans_require_auth_and_ownership(client, auth):
    assert client.get('/plans').status_code == 401
    created = client.post('/plans', headers=auth, json={'title': 'p1', 'minutes': 30, 'payload': {}})
    pid = created.json()['id']
    # second account cannot delete first account's plan
    r2 = client.post('/auth/signup', json={'name': 'Other', 'email': 'o@example.com', 'password': 'secret1'})
    other = {'Authorization': f"Bearer {r2.json()['token']}"}
    assert client.delete(f'/plans/{pid}', headers=other).status_code == 404


def test_training_progress_roundtrip(client, auth):
    r = client.put('/training/progress', headers=auth, json={'course_id': 'c1', 'lessons_done': 2})
    assert r.status_code == 200 and r.json()['lessons_done'] == 2
    r = client.put('/training/progress', headers=auth, json={'course_id': 'c1', 'lessons_done': 3})
    assert r.json()['lessons_done'] == 3
    rows = client.get('/training/progress', headers=auth).json()
    assert len(rows) == 1 and rows[0]['lessons_done'] == 3


def test_updates_bookmarks(client, auth):
    assert client.get('/updates/bookmarks', headers=auth).json()['item_ids'] == []
    client.put('/updates/bookmarks/u1', headers=auth)
    client.put('/updates/bookmarks/u1', headers=auth)  # idempotent
    assert client.get('/updates/bookmarks', headers=auth).json()['item_ids'] == ['u1']
    client.delete('/updates/bookmarks/u1', headers=auth)
    assert client.get('/updates/bookmarks', headers=auth).json()['item_ids'] == []


def test_community_flow(client, auth):
    post = client.post('/community/posts', headers=auth, json={
        'topic': 'Multi-grade', 'title': 'Board task cards', 'body': 'I write three next-step tasks before class starts.'})
    assert post.status_code == 200, post.text
    pid = post.json()['id']
    assert client.post(f'/community/posts/{pid}/replies', headers=auth,
                       json={'body': 'Nice idea, I will try it.'}).status_code == 200
    listed = client.get('/community/posts').json()
    assert any(p['id'] == pid for p in listed)
    assert client.post(f'/community/posts/{pid}/report', headers=auth).json()['reports'] == 1


def test_community_post_requires_auth(client):
    assert client.post('/community/posts', json={'title': 'abc', 'body': 'abcdefgh'}).status_code == 401


def test_assistant_chat_and_history(client, auth):
    r = client.post('/assistant/chat', headers=auth, json={'message': 'How do I run a multi-grade maths class?', 'language': 'English'})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body['reply']
    assert body['sources'], 'replies must carry sources'
    assert body['mode'] in ('local-grounded', 'llm-grounded')

    history = client.get('/assistant/messages', headers=auth).json()
    assert len(history) == 2
    assert client.delete('/assistant/messages', headers=auth).status_code == 200
    assert client.get('/assistant/messages', headers=auth).json() == []


def test_assistant_requires_auth(client):
    assert client.post('/assistant/chat', json={'message': 'hello'}).status_code == 401


def test_curriculum_endpoints(client):
    sample = client.get('/curriculum/sample').json()
    assert sample['board'] == 'NCERT'
    chapters = client.get('/curriculum/chapters', params={'grade': '3'}).json()
    assert chapters['grade'] == '3'
    assert chapters['subjects'][0]['chapters']
    assert client.get('/curriculum/chapters', params={'grade': '99'}).status_code == 404
