"""WhatsApp command router — deterministic actions a linked teacher can run.

Route order (no LLM routing, so a write can never trigger by accident):
  help / मदद → link / connect → plan: → post: → progress → remind: / tasks /
  done <n> → bare plan / post (preview only) → free text → assistant.respond.

Writes (save a plan, publish a post, update training, set a reminder) require
the sender's number to be bound to an account via a one-time pairing code —
see ``whatsapp_links.py``. Unlinked senders get guest behaviour: grounded
guidance with an empty context (never another account's profile) and no
writes of any kind.

All replies are bilingual (English + Hindi) via ``_COPY``; the reply language
follows the message itself (``assistant.detect_language`` upstream).
"""
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from . import assistant as assistant_engine
from . import ratelimit as rl
from . import whatsapp_links
from .db import now
from .models import AssistantMessage, RemindTask, Teacher

log = logging.getLogger(__name__)

# Hindi half of the rate-limit reply (the English half is ratelimit's detail).
# Exposed so api.py can send the same message the webhook uses.
RATE_HI = 'कृपया थोड़ा रुकें और बाद में दोबारा भेजें।'

# Training-course allow-list for the `progress` command.
# MIRRORS `seedCourses` in frontend/lib/storage.ts (c1-c4, four lessons each)
# — keep the two lists in sync when courses change. id -> (title, lesson count).
COURSES: Dict[str, Tuple[str, int]] = {
    'c1': ('Teaching in a multi-grade classroom', 4),
    'c2': ('Foundational literacy: daily routines', 4),
    'c3': ('Low-cost materials for mathematics', 4),
    'c4': ('Inclusive classroom participation', 4),
}

_COURSE_ALIASES: Dict[str, Tuple[str, ...]] = {
    'c1': ('multi-grade', 'multigrade', 'mixed grade', 'pedagogy'),
    'c2': ('literacy', 'reading', 'language'),
    'c3': ('maths', 'mathematics', 'math', 'materials'),
    'c4': ('inclusion', 'inclusive'),
}

# --- bilingual reply templates: {en: ..., hi: ...} -----------------------------

_COPY: Dict[str, Dict[str, str]] = {
    'help': {
        'en': ('I can do more than answer questions. Commands:\n'
               '- plan: Grade 2 and 3, 40 min, maths - builds and SAVES a schedule\n'
               '- post: My title — the rest is the body - shares it with the community\n'
               '- progress c1 2 - marks 2/4 lessons done in course c1\n'
               '- remind: tomorrow 8am check c1 - saves a reminder\n'
               '- tasks - lists your reminders; done 2 - marks one finished\n'
               '- link CODE - connect this number to your THRIVE account\n'
               'Anything else gets a normal answer.'),
        'hi': 'मैं जवाब देने से आगे भी काम कर सकता हूँ। आदेश:\n- plan: Grade 2 and 3, 40 min, maths — समय-सारणी बनाकर सहेजता है\n- post: शीर्षक — बाकी हिस्सा बॉडी है — समुदाय में साझा करता है\n- progress c1 2 — कोर्स c1 में 2/4 पाठ पूरे चिह्नित करता है\n- remind: tomorrow 8am check c1 — अनुस्मारक सहेजता है\n- tasks — आपके अनुस्मारक दिखाएगा; done 2 — एक काम पूरा करता है\n- link CODE — यह नंबर आपके THRIVE खाते से जोड़ता है\nबाकी कोई भी सन्देश सामान्य जवाब लेता है।',
    },
    'link_need_code': {
        'en': ('To connect this number to your THRIVE account: sign in at the THRIVE '
               'website, open Profile -> WhatsApp, and press "Get link code". Then '
               'send here: link CODECODECODE — within 10 minutes.'),
        'hi': 'इस नंबर को THRIVE खाते से जोड़ने के लिए: THRIVE वेबसाइट पर साइन इन करें, Profile -> WhatsApp खोलें और "Get link code" दबाएँ। फिर यहाँ भेजें: link CODECODECODE — 10 मिनट के अंदर।',
    },
    'link_bad_code': {
        'en': ('That code is not one I issued. Open Profile -> WhatsApp on the '
               'website, press "Get link code" again, and send it here within 10 '
               'minutes.'),
        'hi': 'यह कोड मैंने जारी नहीं किया। वेबसाइट पर Profile -> WhatsApp खोलें, "Get link code" दोबारा दबाएँ और 10 मिनट में यहाँ भेजें।',
    },
    'link_expired': {
        'en': ('That code has expired — link codes last 10 minutes. Get a fresh one '
               'from Profile -> WhatsApp on the website.'),
        'hi': 'यह कोड समाप्त हो गया — लिंक कोड 10 मिनट के लिए रहते हैं। वेबसाइट पर Profile -> WhatsApp से नया कोड लें।',
    },
    'link_phone_taken': {
        'en': ('This number is already linked to the account "{name}". To move it '
               'here, that teacher must unlink it from Profile -> WhatsApp first.'),
        'hi': 'यह नंबर पहले से खाते "{name}" से जुड़ा है। इसे यहाँ ले जाने के लिए, उस शिक्षक को पहले Profile -> WhatsApp से unlink करना होगा।',
    },
    'link_already': {
        'en': ('This number is already linked to your account — nothing to do. '
               'Try "help" to see what I can do.'),
        'hi': 'यह नंबर पहले से आपके खाते से जुड़ा है — कुछ नहीं करना। मेरी क्षमताएँ देखने के लिए "help" भेजें।',
    },
    'linked': {
        'en': ('Connected to {name}. Everything you save from this number — plans, '
               'posts, progress, reminders — goes to that account.'),
        'hi': '{name} से जुड़ गया। इस नंबर से आप जो भी सहेजेंगे — योजनाएँ, पोस्ट, प्रगति, अनुस्मारक — उसी खाते में जाएँगे।',
    },
        'relinked': {
        'en': ('Done — this number is now linked to {name}. Your earlier number '
               'was unlinked.'),
        'hi': 'हो गया — यह नंबर अब {name} से जुड़ा है। आपका पुराना नंबर unlink हो गया।',
    },
    'progress_no_count': {
        'en': ('Tell me how many lessons are done, e.g. progress c1 2 (out of 4).'),
        'hi': 'कितन पाठ पूरे हं, यह बतएं, जैसे: progress c1 2 (4 में से).',
    },
    'post_preview': {
        'en': ('This would be published in the community:\n\nTitle: {title}\n\n'
               '{body}\n\nTo publish it, send the same message starting with '
               '"post:".'),
        'hi': 'यह समुदाय में प्रकाशित होगा:\n\nशीर्षक: {title}\n\n{body}\n\nप्रकाशित करने के लिए वही सन्देश "post:" से शुरू करके भेजें।',
    },
    'not_linked': {
        'en': ('That action needs a THRIVE account. Send "link" to see how to '
               'connect this number, or just ask me anything — I will answer '
               'either way.'),
        'hi': 'इस काम के लिए THRIVE खाता चाहिए। इस नंबर को जोड़ने का तरीका देखने के लिए "link" भेजें, या मुझसे कुछ भी पूछें — जवाब मिलेगा ही।',
    },
    'plan_saved': {
        'en': ('Saved as plan #{id} to your account — open it in Curriculum '
               'Studio.\n\n{reply}\nReview the timeline before class.'),
        'hi': 'प्लान #{id} के रूप में आपके खाते में सहेजा गया — Curriculum Studio में खोलें।\n\n{reply}\nकक्षा से पहले समय-सारणी की समीक्षा करें।',
    },
    'plan_preview': {
        'en': ('Here is the plan that would be saved:\n\n{reply}\nTo save it, '
               'send the same message starting with "plan:".'),
        'hi': 'यह वह प्लान है जो सहेजा जाएगा:\n\n{reply}\nसहेजने के लिए वही सन्देश "plan:" से शुरू करके भेजें।',
    },
    'plan_no_request': {
        'en': ('I could not find a plan in that message. Try:\n'
               'plan: Grade 2 and 3, 40 min, maths'),
        'hi': 'उस सन्देश में मुझे प्लान नहीं मिला। ऐसे आज़माएँ:\nplan: Grade 2 and 3, 40 min, maths',
    },
    'plan_generic_fail': {
        'en': ('I could not build a schedule from that message. Try:\n'
               'plan: Grade 2 and 3, 40 min, maths'),
        'hi': 'उस सन्देश से मैं समय-सारणी नहीं बना सका। ऐसे आज़माएँ:\nplan: Grade 2 and 3, 40 min, maths',
    },
    'post_saved': {
        'en': ('Posted #{id} to the community under "{title}". View it in the '
               'Community section.'),
        'hi': 'पोस्ट #{id} "{title}" शीर्षक से समुदाय में जा चुकी है। Community खंड में देखें।',
    },
    'post_needs_title': {
        'en': ('A post needs a title of at least 5 letters. Format:\n'
               'post: My title — the body here (at least a sentence)'),
        'hi': 'पोस्ट के लीए कम से कम 5 अक़्सरों का शीर्षक चाहिए। प्रारूप:\npost: मेरा शीर्षक — यहाँ बॉडी (कम से कम एक वाक्य)',
    },
    'post_needs_body': {
        'en': ('The body is too short — give at least one full sentence after the '
               'title. Example:\npost: Paper-folding fractions — fold once for '
               'half, twice for quarter, then compare.'),
        'hi': 'पोस्ट के लीए कम से कम 5 अक़्सरों का शीर्षक चाहिए। प्रारूप:\npost: मेरा शीर्षक — यहाँ बॉडी (कम से कम एक वाक्य)',
    },
    'post_generic_fail': {
        'en': ('I could not publish that post. Make sure the title has 5+ letters '
               'and the body a full sentence, then try again.'),
        'hi': 'पोस्ट के लीए कम से कम 5 अक़्सरों का शीर्षक चाहिए। प्रारूप:\npost: मेरा शीर्षक — यहाँ बॉडी (कम से कम एक वाक्य)',
    },
    'course_unknown': {
        'en': ('I know these training courses: c1 {c1}, c2 {c2}, c3 {c3}, c4 '
               '{c4}.\nTry: progress c1 2'),
        'hi': 'मुझे ये कोर्स पता हैं: c1 {c1}, c2 {c2}, c3 {c3}, c4 {c4}.\nआज़माएँ: progress c1 2',
    },
    'course_ambiguous': {
        'en': ('"{text}" could be {options}. Use the code, e.g. progress c1 2.'),
        'hi': '"{}" का मतलब {options} हो सकता है। कोड का प्रयोग करें, जैसे progress c1 2।',
    },
    'progress_saved': {
        'en': ('{cid} · {title}: {done}/{total} lessons done. {next}'),
        'hi': '{cid} · {title}: {total} में से {done} पाठ पूरे। {next}',
    },
    'progress_next': {
        'en': 'Keep going — the Training Centre bar will update.',
        'hi': 'आगे बढ़ें — Training Centre की पट्टी अपडेट हो जाएगी।',
    },
    'progress_final': {
        'en': 'Course complete — well done.',
        'hi': 'कोर्स पूरा — बहुत बढ़िया।',
    },
    'remind_saved': {
        'en': ('Reminder set: "{text}" — {when}.\nCheck "tasks" any time.'),
        'hi': 'अनुस्मारक सेट: "{text}" — {when}.\n"tasks" से कभी भी देखें।',
    },
    'remind_bad_format': {
        'en': ('I could not read that time. Use today or tomorrow with an hour, '
               'e.g.:\nremind: tomorrow 8am check c1'),
        'hi': 'वह समय समझ नहीं आया। today या tomorrow के साथ घंटा लिखें:\nremind: tomorrow 8am check c1',
    },
    'remind_no_text': {
        'en': ('What should I remind you about? Format:\n'
               'remind: tomorrow 8am check c1'),
        'hi': 'मैं आपको किसके बारे में रिमाइंड करूँ? प्रारूप:\nremind: tomorrow 8am check c1',
    },
    'tasks_empty': {
        'en': 'No reminders yet. Set one: remind: tomorrow 8am check c1',
        'hi': 'अभी कोई अनुस्मारक नहीं। ऐसे सेट करें: remind: tomorrow 8am check c1',
    },
    'tasks_list': {
        'en': 'Your reminders:\n{rows}\nMark one done: done {first}',
        'hi': 'आपके अनुस्मारक:\n{rows}\nएक पूरा करने के लिए: done {first}',
    },
    'done_done': {
        'en': 'Marked reminder {id} as done.',
        'hi': 'अनुस्मारक {id} पूरा चिह्नित कर दिया।',
    },
    'done_not_found': {
        'en': ('I could not find reminder {id} — check "tasks" for the current '
               'list and their numbers.'),
        'hi': 'अनुस्मारक {id} नहीं मिला — "tasks" से मौजूदा सूची और नंबर देखें।',
    },
    'linked_status': {
        'en': 'Already linked to {name}. Type "help" for the command list.',
        'hi': 'पहले से {name} से जुड़ा है। कॉमांड सूची के लिए "help" लिखें।',
    },
}


def copy(key: str, language: str, **fmt: Any) -> str:
    lang = 'hi' if (language or '').lower().startswith('hi') else 'en'
    text = _COPY[key][lang]
    try:
        return text.format(**fmt)
    except (KeyError, IndexError):
        return text


# --- command parsing -----------------------------------------------------------


# Latin words plus Devanagari (Hindi command verbs: योजन, पोस्ट, प्रगत, रिमाइंड).
_WORD = r'[A-Za-zऀ-ॿ]+'


def _head(message: str) -> Optional[Tuple[str, str]]:
    """('word', rest) when the message starts with a command word + space."""
    m = re.match(rf'\s*({_WORD})\s*:?[ \t]+(.*)$', message, re.S)
    if m:
        return m.group(1).lower(), m.group(2).strip()
    return None


def _command(message: str) -> Optional[str]:
    """The command word if the whole (possibly single) message is one of ours."""
    m = re.fullmatch(rf'\s*({_WORD})\s*', message)
    if m and m.group(1).lower() in ('help', 'link', 'connect', 'tasks'):
        return m.group(1).lower()
    return None


def _resolve_course(text: str) -> Optional[str]:
    """Find a course by explicit id or alias; None when none, or ambiguous."""
    m = re.search(r'\bc[1-4]\b', text, re.I)
    if m:
        return m.group(0).lower()
    low = ' ' + text.lower() + ' '
    hits = {cid for cid, aliases in _COURSE_ALIASES.items()
            if any(a in low for a in aliases)}
    if len(hits) == 1:
        return hits.pop()
    return None


_REMIND_RE = re.compile(r'(?:(today|tomorrow)\s+)?'
                        r'(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(.*)$', re.I)


def _parse_remind(rest: str) -> Tuple[Optional[str], str]:
    """Split 'remind: tomorrow 8am check c1' into (when, text).

    `when` is 'today' | 'tomorrow' (with the hour folded in, e.g. 'tomorrow 08:00')
    or None when no recognised time is present; `text` is what follows.
    """
    rest = (rest or '').strip()
    m = _REMIND_RE.match(rest)
    if not m:
        return None, rest
    day = (m.group(1) or 'today').lower()
    hour = int(m.group(2))
    minute = int(m.group(3) or 0)
    mer = (m.group(4) or '').lower()
    if mer == 'pm' and hour != 12:
        hour += 12
    if mer == 'am' and hour == 12:
        hour = 0
    if hour > 23 or minute > 59:
        return None, rest
    return f'{day} {hour:02d}:{minute:02d}', m.group(5).strip()


# --- per-command handlers (all return {'reply', 'saved_id', 'wrote': bool}) ----


def _do_help(teacher: Optional[Teacher], language: str) -> Dict[str, Any]:
    return {'reply': copy('help', language), 'saved_id': None, 'wrote': False}


def _do_link(phone: str, message: str, teacher: Optional[Teacher],
             language: str, db: Session) -> Dict[str, Any]:
    from .api import LINK_PER_HOUR

    phone = whatsapp_links.normalize_phone(phone)
    rl.allow('wa-link:' + phone, LINK_PER_HOUR, 'link attempts')

    head = _head(message)
    rest = head[1] if head else ''
    result = whatsapp_links.redeem(phone, rest, db)
    if not result['ok']:
        owner = result.get('owner_name', '')
        key = {
            'phone-taken': 'link_phone_taken',
            'bad-code': 'link_bad_code',
            'expired': 'link_expired',
            'no-code': 'link_bad_code',
            'no-phone': 'link_bad_code',
        }.get(result['reason'], 'link_bad_code')
        fmt = {'name': owner} if key == 'link_phone_taken' else {}
        return {'reply': copy(key, language, **fmt), 'saved_id': None, 'wrote': True}

    linked = result['teacher']
    if result.get('relinked'):
        reply = copy('relinked', language, name=linked.name, old='')
    elif result['reason'] == 'already':
        reply = copy('link_already', language)
    else:
        reply = copy('linked', language, name=linked.name)
    return {'reply': reply, 'saved_id': None, 'wrote': result['reason'] != 'already'}


def _do_plan(text: str, teacher: Optional[Teacher], language: str,
             db: Session, profile: Dict[str, Any],
             preview: bool = False) -> Dict[str, Any]:
    from .api import _build_whatsapp_plan

    if not teacher:
        return {'reply': copy('not_linked', language), 'saved_id': None, 'wrote': False}
    try:
        out = _build_whatsapp_plan(text, profile, language, db, teacher,
                                   save=not preview)
    except (HTTPException, ValidationError, KeyError) as e:
        log.warning('plan command failed: %s', e)
        return {'reply': copy('plan_generic_fail', language), 'saved_id': None,
                'wrote': False}
    if out is None:
        return {'reply': copy('plan_no_request', language), 'saved_id': None,
                'wrote': False}
    return out


def _do_post(text: str, teacher: Optional[Teacher], language: str,
             db: Session) -> Dict[str, Any]:
    from .api import save_post

    if not teacher:
        return {'reply': copy('not_linked', language), 'saved_id': None, 'wrote': False}
    parts = re.split(r'\s+[—–-]{1,2}\s+|\s+', text, maxsplit=1)
    title = parts[0].strip() if parts else ''
    body = parts[1].strip() if len(parts) > 1 else ''
    try:
        out = save_post(title, body, teacher, db)
    except HTTPException as e:
        key = 'post_needs_title' if e.status_code == 422 and 'title' in str(e.detail) \
            else 'post_needs_body'
        return {'reply': copy(key, language), 'saved_id': None, 'wrote': False}
    except (HTTPException, ValidationError, KeyError):
        log.exception('post command failed')
        return {'reply': copy('post_generic_fail', language), 'saved_id': None,
                'wrote': False}
    return {'reply': copy('post_saved', language, id=out['id'], title=out['title']),
            'saved_id': out['id'], 'wrote': True}


def _do_progress(text: str, teacher: Optional[Teacher], language: str,
                 db: Session) -> Dict[str, Any]:
    if not teacher:
        return {'reply': copy('not_linked', language), 'saved_id': None, 'wrote': False}
    cid = _resolve_course(text)
    if cid is None:
        return {'reply': copy('course_unknown', language,
                              c1=COURSES['c1'][0], c2=COURSES['c2'][0],
                              c3=COURSES['c3'][0], c4=COURSES['c4'][0]),
                'saved_id': None, 'wrote': False}
    m = re.search(r'(\d{1,3})', text)
    if not m:
        return {'reply': copy('progress_no_count', language), 'saved_id': None,
                'wrote': False}
    count = int(m.group(1))
    total = COURSES[cid][1]
    count = max(0, min(count, total))  # clamp, never invent a course
    from .api import set_progress_direct
    set_progress_direct(cid, count, teacher, db)
    key = 'progress_final' if count >= total else 'progress_next'
    return {'reply': copy('progress_saved', language, cid=cid,
                          title=COURSES[cid][0], done=count, total=total,
                          next=copy(key, language)),
            'saved_id': None, 'wrote': True}


def _do_remind(text: str, teacher: Optional[Teacher], language: str,
               db: Session) -> Dict[str, Any]:
    if not teacher:
        return {'reply': copy('not_linked', language), 'saved_id': None, 'wrote': False}
    when, text_part = _parse_remind(text)
    if when is None:
        return {'reply': copy('remind_bad_format', language), 'saved_id': None,
                'wrote': False}
    text_part = text_part.strip()
    if len(text_part) < 2:
        return {'reply': copy('remind_no_text', language), 'saved_id': None,
                'wrote': False}
    from .api import save_reminder
    task = save_reminder(text_part[:200], when, teacher, db)
    return {'reply': copy('remind_saved', language, text=text_part[:200], when=when),
            'saved_id': task.id, 'wrote': True}


def _do_tasks(teacher: Optional[Teacher], language: str, db: Session) -> Dict[str, Any]:
    if not teacher:
        return {'reply': copy('not_linked', language), 'saved_id': None, 'wrote': False}
    rows = db.query(RemindTask).filter(
        RemindTask.teacher_id == teacher.id, RemindTask.done == 0)\
        .order_by(RemindTask.id.asc()).all()
    if not rows:
        return {'reply': copy('tasks_empty', language), 'saved_id': None, 'wrote': False}
    lines = '\n'.join(f'{r.id}. {r.text} — {r.remind_at}' for r in rows)
    return {'reply': copy('tasks_list', language, rows=lines, first=rows[0].id),
            'saved_id': None, 'wrote': False}


def _do_done(text: str, teacher: Optional[Teacher], language: str,
             db: Session) -> Dict[str, Any]:
    if not teacher:
        return {'reply': copy('not_linked', language), 'saved_id': None, 'wrote': False}
    m = re.match(r'\s*(\d{1,6})\s*$', text)
    if not m:
        return {'reply': copy('done_not_found', language, id='?'), 'saved_id': None,
                'wrote': False}
    from .api import toggle_reminder
    task = toggle_reminder(int(m.group(1)), teacher, db)
    if task is None:
        return {'reply': copy('done_not_found', language, id=m.group(1)),
                'saved_id': None, 'wrote': False}
    return {'reply': copy('done_done', language, id=task.id), 'saved_id': task.id,
            'wrote': True}


# --- main entry point ------------------------------------------------------------


def handle(message: str, teacher: Optional[Teacher], language: str,
           db: Session, phone: str = '') -> Dict[str, Any]:
    """Route one WhatsApp message to a command or the free-form assistant.

    Returns {reply, sources, mode, action, saved_id, linked}. `action` is one
    of None (free text) | help | link | plan | post | progress | remind |
    tasks | done. For linked senders the turn is persisted as two
    AssistantMessage rows in the same commit as any write; a persistence
    failure is logged and swallowed — the reply must never be lost.
    """
    message = (message or '').strip()
    profile = dict(teacher.profile or {}) if teacher else {}
    action: Optional[str] = None
    out: Dict[str, Any]

    head = _head(message)
    cmd = _command(message)
    PLAN_WORDS = ('plan', 'योजन', 'प्लान')
    POST_WORDS = ('post', 'पोस्ट', 'पост')
    PROGRESS_WORDS = ('progress', 'प्रगत', 'प्रगति')
    REMIND_WORDS = ('remind', 'रिमंड', 'रमालंडर')
    if cmd == 'help' or message.strip() in ('मदद', 'help me'):
        action = 'help'
        out = _do_help(teacher, language)
    elif cmd in ('link', 'connect') or (head and head[0] in ('link', 'connect')):
        action = 'link'
        out = _do_link(phone, message, teacher, language, db)
    elif head and head[0] in PLAN_WORDS:
        action = 'plan'
        out = _do_plan(head[1], teacher, language, db, profile,
                       preview=not message.lstrip().lower().startswith('plan:'))
    elif head and head[0] in POST_WORDS:
        action = 'post'
        out = _do_post(head[1], teacher, language, db)
    elif head and head[0] in PROGRESS_WORDS:
        action = 'progress'
        out = _do_progress(head[1], teacher, language, db)
    elif head and head[0] in REMIND_WORDS:
        action = 'remind'
        out = _do_remind(head[1], teacher, language, db)
    elif cmd == 'tasks':
        action = 'tasks'
        out = _do_tasks(teacher, language, db)
    elif head and head[0] == 'done':
        action = 'done'
        out = _do_done(head[1], teacher, language, db)
    else:
        result = assistant_engine.respond(message, profile, language)
        out = {'reply': result['reply'], 'saved_id': None, 'wrote': False}
        result['reply'] = out['reply']
        sources = result['sources']
        mode = result['mode']
        return _finish(message, out, teacher, language, db, phone,
                       action=None, sources=sources, mode=mode)

    sources: List[Dict[str, Any]] = []
    mode = 'command'
    if action == 'plan':
        sources = [{'title': 'THRIVE schedule constraints', 'org': 'THRIVE',
                    'why': 'saved via the constraint compiler'
                           if out.get('wrote') else 'preview — nothing saved'}]
    out = _finish(message, out, teacher, language, db, phone,
                  action=action, sources=sources, mode=mode)
    out['action'] = action
    return out


def _finish(message: str, out: Dict[str, Any], teacher: Optional[Teacher],
            language: str, db: Session, phone: str, action: Optional[str],
            sources: List[Dict[str, Any]], mode: str) -> Dict[str, Any]:
    reply = out['reply']
    if teacher is not None:
        try:
            db.add(AssistantMessage(teacher_id=teacher.id, role='teacher',
                                    text=message, sources=[], created_at=now()))
            db.add(AssistantMessage(teacher_id=teacher.id, role='assistant',
                                    text=reply, sources=sources, created_at=now()))
            db.commit()
        except Exception:
            log.exception('persisting WhatsApp turn failed — reply still sent')
            db.rollback()
    return {'reply': reply, 'sources': sources, 'mode': mode, 'action': action,
            'saved_id': out.get('saved_id'), 'linked': teacher is not None}
