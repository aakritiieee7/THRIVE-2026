"""Assistant retrieval + fallback behaviour."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.assistant import respond, retrieve  # noqa: E402


def test_retrieve_multigrade_hits():
    hits = retrieve('how do I manage a multi-grade classroom')
    assert hits
    assert any('multi' in (str(h.get('tags', '')) + str(h.get('title', ''))).lower() for h in hits)


def test_retrieve_unrelated_query_returns_empty_or_weak():
    hits = retrieve('quantum chromodynamics lattice gauge theory', min_score=3)
    assert hits == []  # no corpus item scores that high for unrelated jargon


def test_local_reply_has_sources():
    out = respond('Suggest a multi-grade maths routine', {'state': 'Bihar', 'grades': '3,5'}, 'English')
    assert out['mode'] == 'local-grounded'
    assert out['sources']
    assert 'multi-grade' in out['reply'].lower() or 'teacher-led' in out['reply'].lower()


def test_local_reply_unknown_topic_is_honest():
    out = respond('zzzz qqqq unknown', {}, 'English')
    assert 'do not have a verified source' in out['reply']


def test_hindi_language_flag():
    out = respond('reading activity', {}, 'Hindi')
    assert 'हिंदी' in out['reply']


def test_hindi_reply_is_devanagari_not_transliteration():
    # The Hindi path must actually answer in Devanagari, not prepend a
    # transliterated notice to an English body.
    out = respond('reading activity', {}, 'Hindi')
    dev = sum(1 for ch in out['reply'] if 'ऀ' <= ch <= 'ॿ')
    assert dev > 30


def test_detect_language():
    from app.assistant import detect_language
    assert detect_language('How do I teach fractions') == 'English'
    assert detect_language('मुझे गणित पढ़ाना है') == 'Hindi'
    assert detect_language('') == 'English'
