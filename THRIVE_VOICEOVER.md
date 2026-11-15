# THRIVE — Demo Voiceover Script

The narration below is the **exact spoken text** of `THRIVE_VOICEOVER.mp3` /
`THRIVE_DEMO.mp4`. It is generated from `demo_build/narration.py` and voiced with
Microsoft's `en-IN-NeerjaNeural` Indian English voice (rate +0%), so what you read
here is what the recording says, word for word.

- Total narration: **170.6 s (2 m 50.6 s)**
- Delivery: warm, steady, unhurried. Let each full stop land. No hard sell.
- The video's burned-in captions and `THRIVE_SUBTITLES.srt` are cut from the same
  word-boundary timings, so they match this text exactly.

---

## 01 · Title (0:00 – 0:07)

THRIVE. A teacher's daily companion, built for India's classrooms.

## 02 · Overview — the landing page (0:07 – 0:27)

This is THRIVE, the Teacher Hub for Resources, Instruction, Verified Information and Empowerment. It is built for teachers working in India's government and low-fee schools, where one teacher often handles several grade groups at once. THRIVE is built around that reality.

## 03 · Today — one calm page (0:27 – 0:41)

When a teacher signs in, everything needed for the day sits on one calm page. Saved plans, training progress, and the latest updates from the education department, each linked back to an official source.

## 04 · Curriculum Studio — Multi-Grade Classroom Compiler (0:41 – 1:14)

The heart of THRIVE is the Multi-Grade Classroom Compiler. A teacher says which grades are in the room, for how long, and what the children should learn. THRIVE builds one coordinated period. A shared opening, a dedicated teacher-led turn for each grade, independent work for the groups who are waiting, and the minutes always add up exactly. And if the plan is not possible in the time available, THRIVE says so, and explains why, instead of hiding it.

## 05 · Curriculum Studio — Guided setup (1:14 – 1:30)

When a teacher is not sure where to start, guided setup asks a few simple questions and prepares the plan. Any part of it can be changed, and every section can be regenerated on its own, so a teacher's own edits are never lost.

## 06 · Teaching Assistant (1:30 – 1:55)

Then there is the Teaching Assistant. A teacher can ask, in English or in Hindi, how to explain evaporation using nothing but chalk and a blackboard. The answer is built from THRIVE's curriculum corpus, and every reply shows its sources, so it can be checked. When the corpus does not cover something, THRIVE says so, rather than making it up.

## 07 · Training Centre (1:55 – 2:12)

The Training Centre holds short practice modules written by THRIVE. Progress is saved, and each module links to verified professional development from DIKSHA and NISHTHA. It is a learning record, not an official certificate.

## 08 · Verified Education Updates (2:12 – 2:26)

Verified Education Updates collects policy news and official resources, each with its source, with search and bookmarks. No unverified circulars, and no invented announcements.

## 09 · Teacher Community (2:26 – 2:35)

And the Teacher Community lets teachers share what actually works in the classroom, with replies, helpful votes, and moderation.

## 10 · Closing (2:35 – 2:51)

There is one more way in. Teachers can message THRIVE on WhatsApp, and get the same sourced answers, right from a phone. THRIVE. Helping teachers thrive, so students flourish.

---

## Claim check

Every statement above is true of the shipped product as verified on 15 November 2026:

| Claim | Evidence |
|---|---|
| Five build areas in one app | Curriculum Studio, Assistant, Training Centre, Updates, Community all live on the deployed frontend |
| Multi-grade compiler produces one coordinated period with exact minutes | `backend/app/compiler.py` + solver tests (feasibility, minute accounting, double-booking, independent work, shared group) |
| Impossible plans are refused with reasons | Covered by solver rejection tests and the in-app infeasibility message |
| Sections can be regenerated individually without losing edits | "Regenerate this section" endpoint and its tests |
| Assistant is retrieval-grounded with per-reply sources, English/Hindi | `/assistant` returns sources for every reply; Hindi via reply-language switch; out-of-corpus questions are stated as such |
| Training progress is a learning record, not a certificate | Stated in-app and in the module copy |
| Updates carry source links, no invented circulars | Seeded from official, source-linked resources only |
| WhatsApp is a way in | WhatsApp Cloud API webhook + bridge in the backend; `/demo` page shows status |

**Not claimed** in the voiceover, and deliberately so: no user numbers, no school
partnerships, no learning-outcome improvements, no pan-India board coverage, no
endorsement by NCERT, DIKSHA, NISHTHA, SCERTs or the Azim Premji Foundation.
