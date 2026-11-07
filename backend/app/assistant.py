"""Contextual AI teaching assistant.

Provider abstraction with two paths:
1. `llm`  — an external chat model when LLM_API_KEY (and optionally
   LLM_BASE_URL / LLM_MODEL) are configured. Responses are grounded with
   retrieved curriculum/guidance passages and instructed to cite them.
2. `local` — a deterministic, retrieval-grounded fallback that works with
   no keys and no network, so the assistant is never a dead button.

Both paths return a reply plus the source list that was actually used.
Nothing here fabricates curriculum: retrieved sources come from the local
curriculum/guidance corpus, and the reply is instructed to say when the
corpus does not cover the question.
"""
import json
import os
import re
import urllib.request
from typing import Any, Dict, List, Tuple

_BUNDLED_SOURCES: List[Dict[str, Any]] = []


def _load_corpus() -> List[Dict[str, Any]]:
    if _BUNDLED_SOURCES:
        return _BUNDLED_SOURCES
    candidates = [
        os.path.join(os.path.dirname(__file__), '..', '..', 'curriculum', 'assistant_sources.json'),
        os.path.join('curriculum', 'assistant_sources.json'),
    ]
    for path in candidates:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, list):
                _BUNDLED_SOURCES.extend(data)
                break
        except (OSError, ValueError):
            continue
    return _BUNDLED_SOURCES


def _tokenize(text: str) -> List[str]:
    return re.findall(r'[a-z0-9ऀ-ॿ]{3,}', text.lower())


def retrieve(query: str, k: int = 3, min_score: int = 1) -> List[Dict[str, Any]]:
    """Lexical retrieval over the bundled guidance/curriculum corpus."""
    corpus = _load_corpus()
    q_tokens = set(_tokenize(query))
    if not q_tokens:
        return []
    scored: List[Tuple[int, Dict[str, Any]]] = []
    for item in corpus:
        hay = ' '.join(str(item.get(field, '')) for field in ('title', 'text', 'tags', 'grade')).lower()
        score = sum(1 for t in q_tokens if t in hay)
        if score >= min_score:
            scored.append((score, item))
    scored.sort(key=lambda pair: -pair[0])
    return [item for _, item in scored[:k]]


_FALLBACK_RULES: List[Tuple[str, str]] = [
    (r'multi.?grade|multiple grade|mixed grade|अलग-अलग कक्षा',
     'Multi-grade rhythm: open with a 5-minute whole-group question, then run short '
     'teacher-led turns grade by grade. While you are with one grade, the others follow '
     'a visible "when you finish" task written on the board. Close with one quick check '
     'per grade. Share instruction only when the learning goal is genuinely common.'),
    (r'read|literacy|language|reading|पढ़ने|साक्षरता',
     'Reading routine: read a short familiar passage aloud once, read again with paired '
     'reading, then ask one literal and one inferential question. Learners who need '
     'support can match picture and word cards; those ready for more can propose a new '
     'title and justify it.'),
    (r'math|number|fraction|shape|गणित|संख्या',
     'Make it visible: model one example with locally available objects (sticks, seeds, '
     'paper). Ask learners to show thinking with objects, a drawing or a number sentence. '
     'Partners compare methods, then a short independent check. Keep the shared example; '
     'vary the follow-up question by grade.'),
    (r'assess|worksheet|check|question|मूल्यांकन|प्रश्न',
     'Quick learning check: one example to show, one explanation of the method, one '
     'slightly different example to try. Use a separate prompt for each grade so the '
     'check matches that grade’s goal, and note who manages independently, with a '
     'hint, or needs another model.'),
    (r'manage|attention|behavio|disrupt|discipline|शांति',
     'Reset routine: pause, give one short concrete direction, and make the first step '
     'visible on the board. Proximity or a choice between two appropriate tasks can help '
     'a learner rejoin. Follow your school’s safeguarding procedures if a concern persists.'),
    (r'activit|game|play|गतिविधि',
     'Low-cost activity: pick one concept, choose two safe local materials, give one clear '
     'instruction, and let pairs produce a result you can check quickly. Rotate one shared '
     'material between grades if it must be conserved.'),
]


def _local_reply(query: str, context: Dict[str, Any], language: str) -> Tuple[str, List[Dict[str, Any]]]:
    hits = retrieve(query)
    rules = [body for pattern, body in _FALLBACK_RULES if re.search(pattern, query, re.I)]

    parts: List[str] = []
    if rules:
        parts.append(rules[0])
    elif hits:
        parts.append(hits[0].get('text', ''))
    else:
        parts.append(
            'I do not have a verified source in THRIVE’s current curriculum corpus for that '
            'question. Describe the grade, subject and topic, and I will help structure a '
            'practical next step you can review against your official syllabus.'
        )

    ctx_bits = [context.get('state'), context.get('board'),
                ('Grades ' + str(context.get('grades'))) if context.get('grades') else None,
                context.get('subjects'), context.get('medium')]
    ctx_line = ' · '.join(str(b) for b in ctx_bits if b)
    if ctx_line:
        parts.append(f'Using your teaching context: {ctx_line}.')
    parts.append('Adapt this to your learners and confirm curriculum points against your current syllabus.')

    reply = '\n\n'.join(parts)
    if language.lower().startswith('hi'):
        reply = ('(हिंदी संस्करण — नीचे मार्गदर्शन अंग्रेज़ी में है; हिंदी पूर्ण सहायता आगामी अपडेट में आएगी।)\n\n' + reply)

    sources = [
        {'title': h.get('title'), 'org': h.get('org'), 'url': h.get('url'), 'why': 'matched your question'}
        for h in hits
    ]
    if not sources:
        sources = [{'title': 'THRIVE local teaching guidance', 'org': 'THRIVE', 'url': '', 'why': 'pattern-based fallback, not an official curriculum source'}]
    return reply, sources


def _llm_reply(query: str, context: Dict[str, Any], language: str) -> Tuple[str, List[Dict[str, Any]]]:
    hits = retrieve(query, k=4)
    context_block = json.dumps(context, ensure_ascii=False)
    source_block = json.dumps(
        [{'title': h.get('title'), 'org': h.get('org'), 'url': h.get('url'), 'text': h.get('text')} for h in hits],
        ensure_ascii=False,
    )
    system = (
        'You are THRIVE, a teaching assistant for Indian school teachers. '
        'Answer practically and briefly (under 200 words). Use ONLY the provided sources for '
        'curriculum or policy facts; if the sources do not cover it, say so plainly and give '
        'general pedagogy clearly labelled as suggestions. Cite sources inline as [1], [2] by '
        f'index. Respond in {"Hindi (Devanagari)" if language.lower().startswith("hi") else "English"}.'
    )
    user = (
        f'Teacher context: {context_block}\nSources: {source_block}\n'
        f'Teacher question: {query}'
    )
    base = os.environ.get('LLM_BASE_URL', 'https://api.openai.com/v1').rstrip('/')
    key = os.environ.get('LLM_API_KEY', '').strip()
    model = os.environ.get('LLM_MODEL', 'gpt-4o-mini')
    payload = {
        'model': model,
        'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
        'temperature': 0.3,
    }
    req = urllib.request.Request(
        f'{base}/chat/completions',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {key}'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    text = data['choices'][0]['message']['content']
    sources = [
        {'title': h.get('title'), 'org': h.get('org'), 'url': h.get('url'), 'why': 'retrieved for this question'}
        for h in hits
    ] or [{'title': 'No corpus match', 'org': 'THRIVE', 'url': '', 'why': 'reply is general pedagogy'}]
    return text, sources


# ---------------------------------------------------------------------------
# Structured plan extraction — powers "give me a plan" on WhatsApp and web.
# The chatbot never reimplements the compiler: when a teacher message carries
# grade/topic/minutes signals, we run the SAME solver (/compiler/run) and
# render its timeline as a chat-friendly message. If the input is incomplete
# or infeasible, we answer honestly with what's missing instead of faking a
# schedule.
# ---------------------------------------------------------------------------

_GRADE_RE = re.compile(r'grade\s*([1-9]|1[0-2])(?!\d)', re.I)
_MIN_RE = re.compile(r'(\d{1,3})\s*(?:minutes?|mins?)\b', re.I)


def _extract_grades(query: str) -> list[str]:
    """Capture "Grade 2, 3 and 4" style lists, not just the first mention.

    Finds the first explicit 'Grade N' and then consumes the list that
    continues after it (commas, 'and', '&', optional repeated 'grade').
    """
    grades: list[str] = []
    m = _GRADE_RE.search(query)
    if not m:
        return grades
    grades.append(m.group(1))
    pos = m.end()
    cont = re.compile(r'\s*(?:[,&]\s*|\s+and\s+|\s+or\s+)(?:grade\s*)?([1-9]|1[0-2])(?!\d)', re.I)
    while len(grades) < 6:
        m2 = cont.match(query, pos)
        if not m2 or m2.group(1) in grades:
            break
        grades.append(m2.group(1))
        pos = m2.end()
    return grades


def extract_plan_request(query: str, context: Dict[str, Any] | None = None) -> Dict[str, Any] | None:
    """Detect a multi-grade lesson-plan request in free text.

    Returns {'grades': [...], 'minutes': int, 'subject': str} when the message
    plausibly asks for a plan, else None. Grades come from the message first,
    then the teacher's context — never invented beyond that.
    """
    context = context or {}
    grades = _extract_grades(query)
    minutes = _MIN_RE.search(query)
    subj = None
    for s in ('Mathematics', 'Environmental Studies', 'Language', 'Science'):
        if s.lower() in query.lower() or s.lower().split()[0] in query.lower():
            subj = s
            break
    if not grades and not minutes:
        return None
    if not grades:
        ctx_grades = re.findall(r'\d+', str(context.get('grades', '')))
        grades = ctx_grades
    if not grades:
        return None
    seen, unique = set(), []
    for g in grades:
        if g not in seen:
            seen.add(g)
            unique.append(g)
    return {
        'grades': unique[:6],
        'minutes': int(minutes.group(1)) if minutes else 45,
        'subject': subj or (str(context.get('subjects') or '').split(',')[0].strip() or 'Mathematics'),
    }


def _fmt_clock(m: int) -> str:
    return f'{m // 60:02d}:{m % 60:02d}'


def plan_reply(req: Dict[str, Any], language: str = 'English') -> Dict[str, Any]:
    """Run the constraint compiler and render a chat-friendly schedule.

    Returns {reply, sources, mode} — same contract as respond(), so callers
    (web bridge, WhatsApp webhook) treat both paths identically.
    """
    from .solver import CompileInput, GradeRequest, InfeasiblePlan, compile_schedule

    subject = req['subject']
    grades = [GradeRequest(grade=str(g), topic=f'{subject} practice for Grade {g}',
                           objective=f'Practise one {subject.lower()} idea suitable for Grade {g}')
              for g in req['grades']]
    inp = CompileInput(subject=subject, medium='English', board='context',
                       minutes=int(req['minutes']), grades=grades)
    try:
        result = compile_schedule(inp)
    except InfeasiblePlan as e:
        lines = [f'I cannot fit {len(grades)} grade groups into {req["minutes"]} minutes:', '']
        lines += [f'• {err}' for err in e.errors]
        lines += ['', 'Tell me the topics you are teaching (e.g. "Grade 2 numbers, Grade 3 shapes, '
                      'Grade 4 patterns") and I will plan each group’s activity.']
        return {'reply': '\n'.join(lines),
                'sources': [{'title': 'THRIVE schedule constraints', 'org': 'THRIVE',
                             'why': 'pattern-based fallback, not an official curriculum source'}],
                'mode': 'local-grounded'}

    lines = [f'{subject} · {req["minutes"]} minutes · Grades {", ".join(req["grades"])}', '']
    for s in result['slots']:
        label = {'opening': 'Whole-class opening', 'turn': f'Teacher focus · {s["focus"]}',
                 'transition': 'Transition', 'closing': 'Closing check'}[s['kind']]
        lines.append(f'{_fmt_clock(s["start"])}–{_fmt_clock(s["end"])}  {label}')
        lines.append(f'  {s["activity"].split(".")[0]}.')
        if s['kind'] == 'turn':
            others = [l['who'] for l in s.get('lanes', []) if not l.get('is_teacher')
                      and l['who'] != s['focus']]
            if others:
                lines.append(f'  While you teach: {", ".join(others)} do the "when you finish" task.')
    lines += ['', 'Closing check (one prompt per grade):']
    lines += [f'• Grade {a["grade"]}: {a["prompt"]}' for a in result['assessments']]
    lines += ['', 'Learning goals above are generated from your request — confirm each against '
                  'your official syllabus before class. Save the full timeline in Curriculum Studio.']
    return {'reply': '\n'.join(lines),
            'sources': result['sources'] + [{'title': 'THRIVE schedule constraints', 'org': 'THRIVE',
                                             'why': 'schedule generated by the constraint compiler'}],
            'mode': 'local-grounded'}


def respond_plan(query: str, context: Dict[str, Any] | None = None,
                 language: str = 'English') -> Dict[str, Any] | None:
    """If the message is a plan request, return a compiler-built reply; else None."""
    req = extract_plan_request(query, context)
    if not req:
        return None
    try:
        return plan_reply(req, language)
    except Exception:
        return None


def respond(query: str, context: Dict[str, Any], language: str = 'English') -> Dict[str, Any]:
    """Return {reply, sources, mode}. Falls back automatically on any failure.

    Plan-shaped messages ("Grade 2, 3 and 4, 40 minutes of mathematics…") are
    answered with a compiler-built schedule before any other path, so web chat
    and WhatsApp share the same planning brain.
    """
    plan = respond_plan(query, context, language)
    if plan is not None:
        return plan
    if os.environ.get('LLM_API_KEY', '').strip():
        try:
            reply, sources = _llm_reply(query, context, language)
            return {'reply': reply, 'sources': sources, 'mode': 'llm-grounded'}
        except Exception:
            pass  # fall through to local path — never surface a dead assistant
    reply, sources = _local_reply(query, context, language)
    return {'reply': reply, 'sources': sources, 'mode': 'local-grounded'}
