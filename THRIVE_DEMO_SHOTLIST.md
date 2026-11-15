# THRIVE — Demo Shot List

Master file: `THRIVE_DEMO.mp4` — 1920×1080, 30 fps, H.264 + AAC stereo 48 kHz,
**170.63 s (2 m 50.6 s)**, 7.4 MB. Burned-in captions, branded title and closing
cards, top-left scene labels, quiet ambient bed under the narration.

| # | Scene | In – Out | Length | On-screen label | Visual | Narration (see `THRIVE_VOICEOVER.md`) |
|---|---|---|---|---|---|---|
| 1 | `01_title` | 0:00.00 – 0:06.97 | 6.97 s | — (branded title card) | Cream ground, sage/honey discs, "CODE FOR A BILLION · BHARAT AGENTIC-AI HACKATHON 2026", THRIVE wordmark, tagline, education track, live URL | Title line |
| 2 | `02_landing` | 0:06.97 – 0:26.56 | 19.59 s | OVERVIEW — What THRIVE is | `demo_frames/01_landing.png` — landing page, five pillars | §2 |
| 3 | `03_home` | 0:26.56 – 0:41.30 | 14.74 s | TODAY — One calm page for the day | `demo_frames/02_home.png` — teacher dashboard | §3 |
| 4 | `04_compiler` | 0:41.30 – 1:13.56 | 32.26 s | CURRICULUM STUDIO — Multi-Grade Classroom Compiler | `demo_frames/03_compiler.png` — the compiler output with per-grade turns and minute accounting | §4 |
| 5 | `05_guided` | 1:13.56 – 1:30.26 | 16.70 s | CURRICULUM STUDIO — Guided setup | `demo_frames/04_guided.png` — guided questions | §5 |
| 6 | `06_assistant` | 1:30.26 – 1:55.29 | 25.02 s | TEACHING ASSISTANT — Sourced answers, English or Hindi | `demo_frames/05_assistant.png` — a reply with its source list | §6 |
| 7 | `07_training` | 1:55.29 – 2:11.71 | 16.43 s | TRAINING CENTRE — Short practice modules | `demo_frames/06_training.png` — modules with progress | §7 |
| 8 | `08_updates` | 2:11.71 – 2:25.51 | 13.80 s | VERIFIED UPDATES — Policy news with sources | `demo_frames/07_updates.png` — source-linked updates | §8 |
| 9 | `09_community` | 2:25.51 – 2:34.71 | 9.20 s | TEACHER COMMUNITY — What actually works | `demo_frames/08_community.png` — peer discussion | §9 |
| 10 | `10_closing` | 2:34.71 – 2:50.63 | 15.86 s | — (branded closing card) | Forest-deep ground, THRIVE wordmark, mission line, live URL + repo | Closing |

## Captions and subtitles

- **Burned-in captions:** 35 cues across scenes 2–9, clause-based (never split
  mid-phrase), held until the next cue so there is no flicker.
- **`THRIVE_SUBTITLES.srt`:** 36 cues covering the whole video including title and
  closing lines, synchronised to the same word-boundary timings.

## Audio

- Narration: Indian English female voice, −19.8 dB mean / −4.4 dB peak overall.
- Music bed: synthesised A-minor pad at ~30% level, 3 s fade-in, 4 s fade-out — measurably
  below the voice throughout.
- Loudness: normalised to −16 LUFS integrated, −1.5 dB true peak.

## Frame verification

Frames were pulled **from the final MP4** (not the source stills) at 3, 12, 34, 51,
80, 100, 121, 149, 160 and 167 s into `demo_frames/check/`. All ten show the expected
card or screen, scene label and a legible caption — no blank or flicker frames.

## Rebuilding

```bash
/private/tmp/ttsvenv/bin/python demo_build/tts.py           # narration + word timings
/private/tmp/ttsvenv/bin/python demo_build/render_assets.py # cards, labels, captions
/private/tmp/ttsvenv/bin/python demo_build/build_video.py   # MP4 + voiceover MP3
```

`THRIVE_SUBTITLES.srt` was generated once from `demo_build/captions.json` plus the
scene start times printed by `build_video.py`. If you re-run the three scripts above,
re-derive the SRT the same way: cue start = scene start + 0.30 s + caption start,
cue end = scene start + 0.30 s + caption end (formatted `HH:MM:SS,mmm`).
