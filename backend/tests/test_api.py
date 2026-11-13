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


def test_training_bookmarks(client, auth):
    assert client.get('/training/bookmarks', headers=auth).json()['item_ids'] == []
    client.put('/training/bookmarks/c1', headers=auth)
    client.put('/training/bookmarks/c1', headers=auth)  # idempotent
    assert client.get('/training/bookmarks', headers=auth).json()['item_ids'] == ['c1']
    client.delete('/training/bookmarks/c1', headers=auth)
    assert client.get('/training/bookmarks', headers=auth).json()['item_ids'] == []
    # auth required
    assert client.get('/training/bookmarks').status_code == 401


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


def test_account_deletion_purges_everything(client, auth):
    """DELETE /auth/me removes the account and every row keyed to it."""
    # A plan, a training row, a bookmark, an assistant message, a reminder.
    plan = client.post('/plans', headers=auth, json={'title': 'to delete', 'minutes': 30, 'payload': {}}).json()
    client.put('/training/progress', headers=auth, json={'course_id': 'c1', 'lessons_done': 2})
    client.put('/updates/bookmarks/u1', headers=auth)
    client.post('/assistant/chat', headers=auth, json={'message': 'hello'})
    client.post('/reminders', headers=auth, json={'text': 'check c1', 'remind_at': '2026-11-10T08:00:00Z'})
    post = client.post('/community/posts', headers=auth, json={
        'topic': 'Multi-grade', 'title': 'A post I will delete', 'body': 'Body of the post to be removed.'}).json()
    # Helpful votes this teacher cast on ANOTHER teacher's post — a plain-FK
    # row that must be purged before the account can go.
    r2 = client.post('/auth/signup', json={'name': 'Peer', 'email': 'peer@example.com', 'password': 'secret1'})
    peer = {'Authorization': f"Bearer {r2.json()['token']}"}
    peer_post = client.post('/community/posts', headers=peer, json={
        'topic': 'Literacy', 'title': 'Peer post to vote on', 'body': 'A peer writes this for the vote test.'}).json()
    assert client.post(f"/community/posts/{peer_post['id']}/helpful", headers=auth).json()['my_helpful'] is True

    r = client.request('DELETE', '/auth/me', headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()['status'] == 'deleted'

    # The token no longer resolves to an account.
    assert client.get('/auth/me', headers=auth).status_code == 401
    assert client.post('/auth/login', json={'email': 't@example.com', 'password': 'secret1'}).status_code == 401
    # Owned rows are gone, and the community post was taken down too.
    assert client.get('/plans', headers=auth).status_code == 401
    assert all(p['id'] != post['id'] for p in client.get('/community/posts').json())
    # The email is free again for a fresh signup.
    fresh = client.post('/auth/signup', json={'name': 'Fresh', 'email': 't@example.com', 'password': 'newpass1'})
    assert fresh.status_code == 200, fresh.text


def test_community_edit_delete_and_helpful_votes(client, auth):
    post = client.post('/community/posts', headers=auth, json={
        'topic': 'Literacy', 'title': 'Pair reading routine', 'body': 'Two learners read the same page, then swap.'})
    assert post.status_code == 200, post.text
    pid = post.json()['id']
    # author_id is exposed so the client can tell teachers what they own
    assert post.json()['author_id'] > 0

    updated = client.put(f'/community/posts/{pid}', headers=auth, json={
        'topic': 'Literacy', 'title': 'Pair reading routine v2', 'body': 'Two learners read the same page, then swap roles.'})
    assert updated.status_code == 200 and updated.json()['title'] == 'Pair reading routine v2'

    # a second account may not edit or delete someone else's post
    r2 = client.post('/auth/signup', json={'name': 'Other', 'email': 'o@example.com', 'password': 'secret1'})
    other = {'Authorization': f"Bearer {r2.json()['token']}"}
    assert client.put(f'/community/posts/{pid}', headers=other,
                      json={'topic': 'Literacy', 'title': 'Hijacked title', 'body': 'Trying to edit another teacher.'}).status_code == 404
    assert client.delete(f'/community/posts/{pid}', headers=other).status_code == 404

    # helpful votes are server-stored and toggle per teacher
    assert client.post(f'/community/posts/{pid}/helpful', headers=auth).json() == {'helpful': 1, 'my_helpful': True}
    assert client.post(f'/community/posts/{pid}/helpful', headers=auth).json() == {'helpful': 0, 'my_helpful': False}
    assert client.post(f'/community/posts/{pid}/helpful', headers=auth).json()['helpful'] == 1
    listed = {p['id']: p for p in client.get('/community/posts', headers=auth).json()}
    assert listed[pid]['helpful'] == 1 and listed[pid]['my_helpful'] is True
    # unauthenticated readers see the count but no personal mark
    anon = {p['id']: p for p in client.get('/community/posts').json()}
    assert anon[pid]['helpful'] == 1 and anon[pid]['my_helpful'] is False

    # the author deletes it: replies and votes go with it
    client.post(f'/community/posts/{pid}/replies', headers=auth, json={'body': 'We tried it too.'})
    assert client.delete(f'/community/posts/{pid}', headers=auth).status_code == 200
    assert all(p['id'] != pid for p in client.get('/community/posts').json())
    # repeat delete is a 404, not a crash
    assert client.delete(f'/community/posts/{pid}', headers=auth).status_code == 404


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


def test_infeasible_reply_suggests_resolutions(client):
    """The API surfaces the engine's 'Resolve it by' guidance, not a bare 422."""
    r = client.post('/compiler/run', json={
        'minutes': 25, 'transition_buffer': 3,
        'grades': [{'grade': str(i), 'topic': 'T', 'objective': 'O'} for i in (1, 2, 3)],
    })
    assert r.status_code == 422
    detail = r.json()['detail']
    assert any('Resolve it by:' in e for e in detail)
    assert any('reset class time' in e for e in detail)


def test_compiler_slots_expose_lanes(client):
    r = client.post('/compiler/run', json={
        'subject': 'Mathematics', 'minutes': 45,
        'grades': [
            {'grade': '3', 'topic': 'Shapes', 'objective': 'Name shapes'},
            {'grade': '4', 'topic': 'Patterns', 'objective': 'Extend patterns'},
            {'grade': '5', 'topic': 'Fractions', 'objective': 'Compare fractions'},
        ],
    })
    assert r.status_code == 200, r.text
    for slot in r.json()['slots']:
        assert slot['lanes'], f"slot at {slot['start']} missing lanes"
        assert sum(1 for l in slot['lanes'] if l.get('is_teacher')) == 1
    turns = [s for s in r.json()['slots'] if s['kind'] == 'turn']
    assert all(t['early_finishers'] for t in turns)


def test_whatsapp_webhook_verifies_and_replies(client):
    r = client.get('/assistant/whatsapp',
                   params={'hub.mode': 'subscribe', 'hub.verify_token': 'thrive-verify',
                           'hub.challenge': '424242'})
    assert r.status_code == 200 and r.text == '424242'
    bad = client.get('/assistant/whatsapp',
                     params={'hub.mode': 'subscribe', 'hub.verify_token': 'nope',
                             'hub.challenge': '1'})
    assert bad.status_code == 403

    r = client.post('/assistant/whatsapp', json={'entry': [{'changes': [{'value': {
        'messages': [{'from': '+910000000000',
                      'text': {'body': 'How do I plan a multi-grade maths period?'}}]}}]}]})
    assert r.status_code == 200
    body = r.json()
    assert body['channel'] == 'whatsapp'
    assert body['from'] == '+910000000000'
    assert body['reply'] and body['mode'] in ('local-grounded', 'llm-grounded', 'grounded')
    assert isinstance(body['sources'], list) and body['sources']


def test_guest_session_ask_and_quota(client):
    from app import guest as guest_layer
    guest_layer.reset_state()
    r = client.post('/guest/session')
    assert r.status_code == 200, r.text
    tok = r.json()['guest_token']
    assert r.json()['plan_limit'] == 5

    ask = client.post('/guest/ask', headers={'x-guest-token': tok},
                      json={'message': 'Grade 3 and 4, 45 minutes, EVS. Make a plan.'})
    assert ask.status_code == 200, ask.text
    assert ask.json()['asks_remaining'] == 19
    assert ask.json()['reply']

    bad = client.post('/guest/ask', headers={'x-guest-token': 'guest-nope'},
                      json={'message': 'hi'})
    assert bad.status_code == 401
    # the httponly cookie set by /guest/session also authenticates
    via_cookie = client.post('/guest/ask', json={'message': 'hi'})
    assert via_cookie.status_code == 200
    client.cookies.clear()
    no_tok = client.post('/guest/ask', json={'message': 'hi'})
    assert no_tok.status_code == 401


def test_guest_plan_drafts_and_upgrade(client, auth):
    from app import guest as guest_layer
    guest_layer.reset_state()
    r = client.post('/guest/session')
    tok = r.json()['guest_token']
    headers = {'x-guest-token': tok}
    created = client.post('/guest/plans', headers=headers,
                          json={'title': 'Guest draft 1', 'minutes': 40, 'payload': {'grades': ['2']}})
    assert created.status_code == 200, created.text

    listed = client.get('/guest/plans', headers=headers).json()
    assert [p['title'] for p in listed] == ['Guest draft 1']

    # drafts are invisible to accounts
    assert all(p['title'] != 'Guest draft 1' for p in client.get('/plans', headers=auth).json())

    up = client.post('/guest/upgrade', headers=auth, json={'guest_token': tok})
    assert up.status_code == 200 and up.json()['adopted'] == 1
    plans = client.get('/plans', headers=auth).json()
    assert any(p['title'] == 'Guest draft 1' for p in plans)

    # retired guest token no longer works
    assert client.get('/guest/plans', headers=headers).status_code == 401
    # adopted token cannot be reused to claim again
    assert client.post('/guest/upgrade', headers=auth, json={'guest_token': tok}).json()['adopted'] == 0


def test_whatsapp_status_is_honest(client):
    r = client.get('/assistant/whatsapp/status')
    assert r.status_code == 200
    body = r.json()
    # No credentials in the test environment — must not claim live sends.
    assert body['configured'] is False
    assert body['live'] is False
    assert body['mode'] == 'simulation'
    assert 'WHATSAPP_TOKEN' in body['note']


def test_open_assistant_endpoints_rate_limited(client):
    from app import ratelimit as rl
    rl.reset_state()
    rl.ASK_PER_HOUR = 2  # drop the window for the test
    try:
        assert client.post('/assistant/ask', json={'message': 'quick check'}).status_code == 200
        assert client.post('/assistant/ask', json={'message': 'quick check'}).status_code == 200
        # third ask from the same connection is throttled
        third = client.post('/assistant/ask', json={'message': 'again'})
        assert third.status_code == 429
        assert 'wait' in third.json()['detail'].lower()
        # the bridge is rate-limited on its own key and is unaffected
        assert client.post('/assistant/bridge', json={'channel': 'webchat', 'from': 'w1', 'message': 'quick check'}).status_code == 200
    finally:
        rl.reset_state()
        rl.ASK_PER_HOUR = 30


def test_whatsapp_inbound_hindi_auto_language(client):
    from app import ratelimit as rl
    rl.reset_state()
    # A teacher types in Hindi; the webhook infers Hindi and replies in Devanagari.
    r = client.post('/assistant/whatsapp', json={'entry': [{'changes': [{'value': {
        'messages': [{'from': '+915550001111',
                      'text': {'body': 'मुझको गणित पढ़ाना है'}}]}}]}]})
    assert r.status_code == 200
    body = r.json()
    assert body['kind'] == 'message'
    assert sum(1 for ch in body['reply'] if 'ऀ' <= ch <= 'ॿ') > 20


def test_whatsapp_delivery_status_acknowledged_not_answered(client):
    from app import ratelimit as rl
    rl.reset_state()
    r = client.post('/assistant/whatsapp', json={'entry': [{'changes': [{'value': {
        'statuses': [{'id': 'wamid.abc', 'to': '+915550001111', 'status': 'delivered'}]}}]}]})
    assert r.status_code == 200
    body = r.json()
    assert body['kind'] == 'status'
    assert body['acknowledged'] is True
    assert body['status'] == 'delivered'
    assert body['message_id'] == 'wamid.abc'
    assert 'reply' not in body  # a receipt must not spawn an assistant reply


def _wa_message(client, phone, body):
    """POST one inbound WhatsApp message the way Meta's webhook delivers it."""
    return client.post('/assistant/whatsapp', json={'entry': [{'changes': [{'value': {
        'messages': [{'from': phone, 'text': {'body': body}}]}}]}]})


def test_whatsapp_link_code_redeem_and_write(client, auth):
    """Full link flow: mint on the web, redeem via webhook, then a command
    from the linked number writes to the account. Regression test for two
    bugs that kept the 56-test suite green while linking silently failed:
    (1) the code was matched with a substring `in` on the alphabet string,
    rejecting every random code; (2) the 10-minute TTL was parsed with a
    local-time mktime, expiring fresh codes on any non-UTC machine."""
    # 1. Mint a one-time code on the (signed-in) web surface.
    issued = client.post('/assistant/whatsapp/link-code', headers=auth)
    assert issued.status_code == 200, issued.text
    code = issued.json()['code']
    assert len(code) == 8 and all(ch not in '0O1I' for ch in code)

    # 2. Redeem it by sending it from a WhatsApp number — this must bind.
    phone = '+919000011111'
    r = _wa_message(client, phone, 'link ' + code)
    assert r.status_code == 200
    body = r.json()
    assert body['action'] == 'link'
    assert 'Connected' in body['reply'] or 'जुड़' in body['reply'], body['reply']

    # The number is now bound (masked, never the full digits).
    status = client.get('/assistant/whatsapp/link', headers=auth).json()
    assert status['linked'] is True
    assert status['phone_masked'].endswith('1111')

    # 3. A command from the linked number writes to THAT account.
    plan = _wa_message(client, phone, 'plan: Grade 2 and 3, 40 min, maths')
    assert plan.status_code == 200
    p = plan.json()
    assert p['action'] == 'plan'
    assert p['saved_id'] is not None
    saved = client.get('/plans', headers=auth).json()
    assert any(x['id'] == p['saved_id'] for x in saved), 'plan from WhatsApp must be saved to the account'

    # 4. A DIFFERENT, unlinked number gets guest behaviour and cannot write.
    other = _wa_message(client, '+919000099999', 'plan: Grade 2 and 3, 40 min, maths')
    assert other.json()['action'] == 'plan'
    assert other.json()['saved_id'] is None
    assert 'THRIVE account' in other.json()['reply'] or 'खात' in other.json()['reply']


def test_whatsapp_link_code_single_use_and_expired(client, auth):
    """A redeemed code cannot be reused; a code that no longer matches is refused."""
    code = client.post('/assistant/whatsapp/link-code', headers=auth).json()['code']
    phone = '+919000022222'

    first = _wa_message(client, phone, 'link ' + code)
    assert first.json()['action'] == 'link'
    assert 'Connected' in first.json()['reply']

    # A *different* number replaying the consumed code gets nothing — single-use.
    replay = _wa_message(client, '+919000033333', 'link ' + code)
    assert replay.json()['action'] == 'link'
    assert 'not one I issued' in replay.json()['reply'] or 'नह' in replay.json()['reply']


# ---------------------------------------------------------------------------
# Section-level regeneration (POST /compiler/regenerate): rebuild ONE teacher
# turn while every other slot — including the teacher's own edits — survives.
# ---------------------------------------------------------------------------

def _compile_two_grade(client):
    body = {
        'subject': 'Mathematics', 'medium': 'English', 'board': 'NCERT',
        'minutes': 45, 'materials': 'paper, chalk', 'transition_buffer': 0,
        'grades': [
            {'grade': '3', 'topic': 'Shapes', 'objective': 'Name shapes'},
            {'grade': '5', 'topic': 'Fractions', 'objective': 'Compare fractions'},
        ],
    }
    r = client.post('/compiler/run', json=body)
    assert r.status_code == 200, r.text
    return body, r.json()['slots']


def test_regenerate_single_section_keeps_timeline(client):
    body, slots = _compile_two_grade(client)
    turn_i = next(i for i, s in enumerate(slots) if s['kind'] == 'turn')
    r = client.post('/compiler/regenerate', json={**body, 'slot_index': turn_i, 'slots': slots})
    assert r.status_code == 200, r.text
    out = r.json()['slots']
    # same shape, same clock times, fresh content on the target section
    assert [(s['start'], s['end']) for s in out] == [(s['start'], s['end']) for s in slots]
    assert out[turn_i]['activity']
    assert out[turn_i]['lanes']
    assert r.json()['assessments'], 'regenerated plan still carries assessments'


def test_regenerate_preserves_manual_edits(client):
    import copy
    body, slots = _compile_two_grade(client)
    turn_i = next(i for i, s in enumerate(slots) if s['kind'] == 'turn')
    # Teacher lengthened the turn (closing absorbs) and rewrote the OTHER
    # turn's activity by hand — both edits must survive a section regen.
    edited = copy.deepcopy(slots)
    edited[turn_i]['end'] += 5
    for s in edited[turn_i + 1:]:
        s['start'] += 5
        s['end'] += 5
    edited[-1]['end'] = 45  # the client's prefix-sum re-budget never overruns
    other = turn_i + 1 if turn_i + 1 < len(edited) else turn_i - 1
    edited[other]['activity'] = 'My hand-written independent task.'

    r = client.post('/compiler/regenerate', json={**body, 'slot_index': turn_i, 'slots': edited})
    assert r.status_code == 200, r.text
    out = r.json()['slots']
    assert out[turn_i]['end'] - out[turn_i]['start'] == edited[turn_i]['end'] - edited[turn_i]['start']
    assert [(s['start'], s['end']) for s in out] == [(s['start'], s['end']) for s in edited]
    assert out[other]['activity'] == 'My hand-written independent task.'
    assert out[-1]['end'] == 45


def test_regenerate_refuses_non_turn_and_broken_timelines(client):
    body, slots = _compile_two_grade(client)
    turn_i = next(i for i, s in enumerate(slots) if s['kind'] == 'turn')

    # the opening is whole-class — not a section you regenerate alone
    r = client.post('/compiler/regenerate', json={**body, 'slot_index': 0, 'slots': slots})
    assert r.status_code == 422
    assert any('teacher-turn' in e for e in r.json()['detail'])

    # out-of-range section
    r = client.post('/compiler/regenerate', json={**body, 'slot_index': 99, 'slots': slots})
    assert r.status_code == 422

    # a timeline with a gap fails validation instead of returning a lying plan
    import copy
    broken = copy.deepcopy(slots)
    broken[turn_i + 1]['start'] += 1
    broken[turn_i + 1]['end'] += 1
    r = client.post('/compiler/regenerate', json={**body, 'slot_index': turn_i, 'slots': broken})
    assert r.status_code == 422
    assert any('contiguously' in e for e in r.json()['detail'])
