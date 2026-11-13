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


_FALLBACK_RULES: List[Tuple[str, str, str]] = [
    (r'multi.?grade|multiple grade|mixed grade|अलग-अलग कक्षा|एक कक्षा में',
     'Multi-grade rhythm: open with a 5-minute whole-group question, then run short '
     'teacher-led turns grade by grade. While you are with one grade, the others follow '
     'a visible "when you finish" task written on the board. Close with one quick check '
     'per grade. Share instruction only when the learning goal is genuinely common.',
     'एक कक्षा में कई कक्षाएँ: 5 मिनट की समूह-चर्चा से शुरुआत करें, फिर कक्षा-दर-कक्षा '
     'छोटी-छोटी शिक्षक-लियाएँ हर चक्कर करें। जब आप एक कक्षा के साथ हों, बाकी कक्षाएँ '
     'बोर्ड पर लिखा "ख़त्म होते ही करें" कार्य करें। अंत में हर कक्षा के लिए एक जल्दी '
     'जाँच करें। सिर्फ़ तभी सामूहिक शिक्षा दें जब शिख्ण लक्ष्य वाक़ई सामान्य हो।'),
    (r'read|literacy|language|reading|पढ़|पठन|सक्षरता|भाषा',
     'Reading routine: read a short familiar passage aloud once, read again with paired '
     'reading, then ask one literal and one inferential question. Learners who need '
     'support can match picture and word cards; those ready for more can propose a new '
     'title and justify it.',
     'हिंदी में पठन क्रम: एक छोटी परिचित खंड आवाज़ में एक बार पढ़ाएँ, फिर जोड़ी-पढ़न से '
     'दोबारा पढ़ाएँ, फिर एक सीधा और एक अनुमान पर आधारित प्रश्न पूछें। जिन विद्यार्थियों को '
     'सहायता चाहिए उन्हें चित्र-शब्द कार्ड मिलाएँ; जो और के लिए तैयार हैं वे नया शीर्षक '
     'सुझाएँ और उसकी व्याख्या करें।'),
    (r'math|number|fraction|shape|गणित|संख्या|भगण',
     'Make it visible: model one example with locally available objects (sticks, seeds, '
     'paper). Ask learners to show thinking with objects, a drawing or a number sentence. '
     'Partners compare methods, then a short independent check. Keep the shared example; '
     'vary the follow-up question by grade.',
     'इसे दिखाना सिखाएँ: पास की सामग्री (डंडे, बीज, कागज़) से एक उदाहरण दिखाएँ। विद्यार्थियों '
     'से वस्तुओं, चित्र या संख्या-वाक्य से सोच दिखाने को कहें। साथी अपनी विधियों की तुलना '
     'करें, फिर एक छोटी स्वतंत्र जाँच करें। सामूहिक उदाहरण रखें; कक्षा के अनुसार '
     'अनुवर्ती प्रश्न बदलें।'),
    (r'assess|worksheet|check|question|मूल्यांकन|परीक्षण|जाँच|प्रश्न',
     'Quick learning check: one example to show, one explanation of the method, one '
     'slightly different example to try. Use a separate prompt for each grade so the '
     'check matches that grade’s goal, and note who manages independently, with a '
     'hint, or needs another model.',
     'त्वरित अधिगम-जाँच: एक उदाहरण दिखाएँ, विधि की एक व्याख्या करें, और आज़माने के लिए '
     'एक थोड़ा अलग उदाहरण दें। हर कक्षा के लिए अलग प्रॉम्प्ट दें ताकि जाँच उसी कक्षा के '
     'लक्ष्य से मेल खाए, और नोट करें कि कौन स्वतंत्र रूप से, कौन संकेत के साथ, और कौन '
     'दूसरी व्याख्या से आगे बढ़ रहा है।'),
    (r'manage|attention|behavio|disrupt|discipline|शांति|व्यवस्थ',
     'Reset routine: pause, give one short concrete direction, and make the first step '
     'visible on the board. Proximity or a choice between two appropriate tasks can help '
     'a learner rejoin. Follow your school’s safeguarding procedures if a concern persists.',
     'पुनःस्थापन क्रम: थमाएँ, एक छोटी-सी स्पष्ट दिशा दें, और पहला कदम बोर्ड पर दिखाएँ। '
     'निकटता या दो उचित कार्यों में से विकल्प किसी विद्यार्थी को फिर से जुड़ने में मदद '
     'कर सकता है। यदि चिंता बना रहती है, तो अपने विद्यालय की संरक्षण प्रक्रियाओं का '
     'पालन करें।'),
    (r'activit|game|play|गतिविधि',
     'Low-cost activity: pick one concept, choose two safe local materials, give one clear '
     'instruction, and let pairs produce a result you can check quickly. Rotate one shared '
     'material between grades if it must be conserved.',
     'कम-लागत गतिविधि: एक अवधारणा चुनें, दो सुरक्षित स्थानीय सामग्री चुनें, एक स्पष्ट '
     'निर्देश दें, और जोड़ों को वह परिणाम बनाने दें जिसकी आप जल्दी जाँच कर सकें। यदि '
     'सामग्री बचावनी हो तो कक्षाओं के बीच एक सामूहिक सामग्री घुमाएँ।'),
]

# Language-neutral boilerplate for the offline path, in both reply languages.
_LOCAL_STRINGS = {
    'en': {
        'no_source': (
            'I do not have a verified source in THRIVE’s current curriculum corpus for that '
            'question. Describe the grade, subject and topic, and I will help structure a '
            'practical next step you can review against your official syllabus.'
        ),
        'context': 'Using your teaching context: {ctx}.',
        'adapt': 'Adapt this to your learners and confirm curriculum points against your current syllabus.',
        'no_source_title': 'THRIVE local teaching guidance',
        'why_matched': 'matched your question',
        'why_fallback': 'pattern-based fallback, not an official curriculum source',
    },
    'hi': {
        'no_source': (
            'THRIVE की वर्तमान पाठ्यक्रम-सामग्री में इस प्रश्न का सत्यापित स्रोत मेरे पास नहीं '
            'है। कक्षा, विषय और विषय-वस्तु बताएँ, और मैं आपकी आधिकारिक पाठ्यचर्या से मिलाप '
            'कर सकने वाला एक व्यावहारिक अगला कदम तैयार करने में मदद करूँगा।'
        ),
        'context': 'आपकी शिक्षण-परिस्थिति का उपयोग: {ctx}.',
        'adapt': 'अपने विद्यार्थियों के अनुसार इसे अनुकूलित करें और पाठ्यक्रम बिंदुओं की पुष्टि '
                 'अपनी वर्तमान पाठ्यचर्या से करें।',
        'no_source_title': 'THRIVE स्थानीय शिक्षण-संकेत',
        'why_matched': 'आपके प्रश्न से मिला',
        'why_fallback': 'प्रारूप-आधारित मार्गदर्शन, आधिकारिक पाठ्यक्रम स्रोत नहीं',
    },
}


def detect_language(text: str) -> str:
    """Infer the reply language from a message when the caller didn't state one.

    Devanagari anywhere in the text means the teacher wrote in Hindi; otherwise
    we default to English. Used by the WhatsApp and web bridges so a teacher can
    simply type in their language without a selector.
    """
    if text and any('ऀ' <= ch <= 'ॿ' for ch in text):
        return 'Hindi'
    return 'English'


def _lang_key(language: str) -> str:
    return 'hi' if language.lower().startswith('hi') else 'en'


def _local_reply(query: str, context: Dict[str, Any], language: str) -> Tuple[str, List[Dict[str, Any]]]:
    lang = _lang_key(language)
    s = _LOCAL_STRINGS[lang]
    hits = retrieve(query)

    rule_body = None
    for pattern, en_body, hi_body in _FALLBACK_RULES:
        if re.search(pattern, query, re.I):
            rule_body = en_body if lang == 'en' else hi_body
            break

    parts: List[str] = []
    if rule_body:
        parts.append(rule_body)
    elif hits:
        parts.append(hits[0].get('text', ''))
    else:
        parts.append(s['no_source'])

    grades = context.get('grades')
    grade_bit = ('कक्षा ' + str(grades)) if grades and lang == 'hi' else (
        ('Grades ' + str(grades)) if grades else None)
    ctx_bits = [context.get('state'), context.get('board'), grade_bit,
                context.get('subjects'), context.get('medium')]
    ctx_line = ' · '.join(str(b) for b in ctx_bits if b)
    if ctx_line:
        parts.append(s['context'].format(ctx=ctx_line))
    parts.append(s['adapt'])

    reply = '\n\n'.join(parts)

    sources = [
        {'title': h.get('title'), 'org': h.get('org'), 'url': h.get('url'), 'why': s['why_matched']}
        for h in hits
    ]
    if not sources:
        sources = [{'title': s['no_source_title'], 'org': 'THRIVE', 'url': '', 'why': s['why_fallback']}]
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
    # First explicit 'Grade N' anchors the list; afterwards every 'Grade N'
    # mention counts (repeated keyword included), while bare numbers only
    # count next to a comma/'and' separator: "Grade 2, 3 and 4" is one list,
    # "45 minutes" is not a grade.
    m = _GRADE_RE.search(query)
    if not m:
        return grades
    grades.append(m.group(1))
    bare = re.compile(r'\s*(?:[,&]\s*|\s+and\s+|\s+or\s+)\s*(?:grade\s*)?([1-9]|1[0-2])(?!\d)', re.I)
    pos = m.end()
    while len(grades) < 6:
        m2 = bare.match(query, pos)
        if m2 and m2.group(1) not in grades:
            grades.append(m2.group(1))
            pos = m2.end()
            continue
        m3 = _GRADE_RE.search(query, pos)
        if not m3 or m3.group(1) in grades:
            break
        grades.append(m3.group(1))
        pos = m3.end()
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
        'message': query,
        'context_topics': context.get('topics') or {},
    }


def _fmt_clock(m: int) -> str:
    return f'{m // 60:02d}:{m % 60:02d}'


def _clean_topic(raw: str) -> str:
    """Trim the tail the topic regex overshoots with.

    "Mathematics in 45 minutes" → "Mathematics"; "shapes, Grade 4 patterns"
    → "shapes"; anything that still names another grade (the capture ran
    across a conjunction) is discarded so we never invent a topic.
    """
    topic = (raw or '').strip(' .,-')
    # cut at a following grade mention ("shapes, Grade 4 patterns")
    topic = re.split(r'\s+grade\s*\d|\s*,\s*grade\s', topic, maxsplit=1, flags=re.I)[0]
    # cut at minutes/time tails ("Mathematics in 45 minutes")
    topic = re.split(r'\s+in\s+\d{1,3}\s*(?:minutes?|mins?)\b', topic, maxsplit=1, flags=re.I)[0]
    # cut trailing connector words with nothing after them
    topic = re.sub(r'[\s,]*(?:and|or|&|in|on|about|for|to|with)\s*$', '', topic, flags=re.I).strip(' .,-')
    if re.search(r'\bgrade\b', topic, re.I) or re.fullmatch(r'\d{1,2}', topic or ''):
        return ''
    return topic


def build_plan(req: Dict[str, Any], language: str = 'English') -> Dict[str, Any]:
    """Run the constraint compiler once and expose the render *and* the raw result.

    Returns the plan_reply contract ({reply, sources, mode}) plus:
      compiled   — the solver payload on success (slots/assessments/…), else None
      infeasible — the solver's explicit error list when it refused, else None
      inputs     — what was actually requested (grades, minutes, subject, topics)
    Nothing here fabricates: an infeasible request comes back with the engine's
    reasons and no schedule. plan_reply() wraps this for the chat contract.
    """
    from .solver import CompileInput, GradeRequest, InfeasiblePlan, compile_schedule

    subject = req['subject']
    # Real topics wherever the teacher gave them: "Grade 2 numbers, Grade 3 shapes"
    # in the message, or a grades/subjects topic map on the profile/context.
    msg = str(req.get('message') or '')
    ctx_topics = req.get('context_topics') or {}
    topics: Dict[str, str] = {}
    for g in req['grades']:
        gs = str(g)
        topic = ''
        m = re.search(rf'grade\s*{gs}\s*(?:is\s+|on\s+|about\s+)?([A-Za-z][A-Za-z \-/]{{1,40}})', msg, re.I)
        if m:
            topic = _clean_topic(m.group(1))
        if not topic and isinstance(ctx_topics, dict):
            topic = str(ctx_topics.get(gs) or ctx_topics.get(f'Grade {gs}') or '').strip()
        topics[gs] = topic or f'{subject} — Grade {gs}'
    grades = [GradeRequest(grade=str(g), topic=topics[str(g)],
                           objective=f'Practise one {subject.lower()} idea suitable for Grade {g}')
              for g in req['grades']]
    inputs = {'grades': [g.grade for g in grades],
              'minutes': int(req['minutes']),
              'subject': subject,
              'topics': topics}
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
                'mode': 'local-grounded',
                'compiled': None, 'infeasible': list(e.errors), 'inputs': inputs}

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
                  'your official syllabus before class.']
    return {'reply': '\n'.join(lines),
            'sources': result['sources'] + [{'title': 'THRIVE schedule constraints', 'org': 'THRIVE',
                                             'why': 'schedule generated by the constraint compiler'}],
            'mode': 'local-grounded',
            'compiled': result, 'infeasible': None, 'inputs': inputs}


def plan_reply(req: Dict[str, Any], language: str = 'English') -> Dict[str, Any]:
    """Plan reply for chat/bridge/WhatsApp — build_plan() plus its raw result.

    Returns {reply, sources, mode} (the contract every caller reads) plus
    compiled/inputs when available, so channels can save the real schedule.
    Extra keys are dropped by the ChatOut response model; they never leak.
    """
    out = build_plan(req, language)
    return {'reply': out['reply'], 'sources': out['sources'], 'mode': out['mode'],
            'compiled': out.get('compiled'), 'inputs': out.get('inputs')}


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
