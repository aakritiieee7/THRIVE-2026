"""Assemble THRIVE_DEMO.mp4 and THRIVE_VOICEOVER.mp3.

Each scene is rendered as its own MP4 (still frame + scene label + burned-in
caption overlays, narration padded to the scene length), then the scenes are
concatenated and a quiet synthesised music bed is mixed underneath.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FRAMES = os.path.join(ROOT, "demo_frames")
AUDIO = os.path.join(HERE, "audio")
CARDS = os.path.join(HERE, "cards")
OVER = os.path.join(HERE, "overlays")
CAPS = os.path.join(HERE, "captions")
CLIPS = os.path.join(HERE, "clips")
os.makedirs(CLIPS, exist_ok=True)

FPS = 30
LEAD = 0.30          # silence before narration starts in a scene
TAIL = 0.55          # silence after the narration's last word
TITLE_TAIL = 1.20
LABEL_DELAY = 0.55   # scene label fades in just after the cut

SCENES = [
    ("01_title", None, None),
    ("02_landing", "01_landing.png", "OVERVIEW"),
    ("03_home", "02_home.png", None),
    ("04_compiler", "03_compiler.png", None),
    ("05_guided", "04_guided.png", None),
    ("06_assistant", "05_assistant.png", None),
    ("07_training", "06_training.png", None),
    ("08_updates", "07_updates.png", None),
    ("09_community", "08_community.png", None),
    ("10_closing", None, None),
]


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        print("FAILED:", " ".join(cmd[:8]), "...")
        print(p.stderr[-3000:])
        sys.exit(1)
    return p.stdout


def probe(path):
    return float(
        run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", path]).strip()
    )


FRAME_FOR = {
    "02_landing": "01_landing.png",
    "03_home": "02_home.png",
    "04_compiler": "03_compiler.png",
    "05_guided": "04_guided.png",
    "06_assistant": "05_assistant.png",
    "07_training": "06_training.png",
    "08_updates": "07_updates.png",
    "09_community": "08_community.png",
}


def still_for(slug):
    if slug == "01_title":
        return os.path.join(CARDS, "title.png")
    if slug == "10_closing":
        return os.path.join(CARDS, "closing.png")
    return os.path.join(FRAMES, FRAME_FOR[slug])

captions = json.load(open(os.path.join(HERE, "captions.json")))


def build_scene(slug, label_png, dur, out_path):
    still = still_for(slug)
    narr = os.path.join(AUDIO, f"{slug}.mp3")
    items = captions.get(slug, [])

    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
           "-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}",
           "-i", still,
           "-i", narr]
    inputs = 2
    label_idx = None
    if label_png:
        cmd += ["-i", label_png]
        label_idx = inputs
        inputs += 1
    cap_idx = []
    for it in items:
        cmd += ["-i", os.path.join(CAPS, it["png"])]
        cap_idx.append(inputs)
        inputs += 1

    fc = ["[0:v]format=yuv420p,setsar=1[v0]"]
    cur = "v0"
    n = 0
    if label_idx is not None:
        fc.append(
            f"[{cur}][{label_idx}:v]overlay=0:0:"
            f"enable='gte(t,{LABEL_DELAY:.2f})'[v{n + 1}]"
        )
        cur = f"v{n + 1}"
        n += 1
    for it, idx in zip(items, cap_idx):
        a = LEAD + it["start"]
        b = min(LEAD + it["end"], dur - 0.05)
        fc.append(
            f"[{cur}][{idx}:v]overlay=0:0:enable='between(t,{a:.3f},{b:.3f})'"
            f"[v{n + 1}]"
        )
        cur = f"v{n + 1}"
        n += 1
    fc.append(f"[{cur}]format=yuv420p[vout]")

    delay_ms = int(LEAD * 1000)
    fc.append(
        f"[1:a]aresample=48000,adelay={delay_ms}:all=1,"
        f"apad=whole_dur={dur:.3f},atrim=0:{dur:.3f},"
        f"afade=t=in:st=0:d=0.18[aout]"
    )

    cmd += ["-filter_complex", ";".join(fc),
            "-map", "[vout]", "-map", "[aout]",
            "-t", f"{dur:.3f}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-pix_fmt", "yuv420p", "-r", str(FPS),
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", out_path]
    run(cmd)


def main():
    clips = []
    timeline = []
    t = 0.0
    for slug, frame, eyebrow in SCENES:
        meta = json.load(open(os.path.join(AUDIO, f"{slug}.json")))
        last_end = (
            meta["words"][-1]["t"] + meta["words"][-1]["d"]
            if meta["words"] else probe(os.path.join(AUDIO, f"{slug}.mp3"))
        )
        tail = TITLE_TAIL if slug in ("01_title", "10_closing") else TAIL
        dur = round(LEAD + last_end + tail, 3)
        label = (
            os.path.join(OVER, f"{slug}_label.png") if frame else None
        )
        out = os.path.join(CLIPS, f"{slug}.mp4")
        build_scene(slug, label, dur, out)
        clips.append(out)
        timeline.append((slug, t, dur))
        print(f"{slug:14s} dur={dur:6.2f}  starts {t:7.2f}")
        t += dur
    total = round(t, 3)
    print(f"total {total:.2f}s = {int(total // 60)}m {total % 60:.1f}s")

    listfile = os.path.join(CLIPS, "list.txt")
    with open(listfile, "w") as fh:
        for c in clips:
            fh.write(f"file '{c}'\n")

    silent = os.path.join(CLIPS, "concat.mp4")
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-f", "concat", "-safe", "0", "-i", listfile,
         "-c", "copy", "-movflags", "+faststart", silent])

    # Narration-only track for the standalone voiceover deliverable.
    vo = os.path.join(ROOT, "THRIVE_VOICEOVER.mp3")
    parts = []
    for slug, start, dur in timeline:
        parts += ["-i", os.path.join(AUDIO, f"{slug}.mp3")]
    fc = []
    for i, (slug, start, dur) in enumerate(timeline):
        ms = int((start + LEAD) * 1000)
        fc.append(
            f"[{i}:a]aresample=48000,adelay={ms}:all=1,"
            f"apad=whole_dur={total:.3f},atrim=0:{total:.3f}[a{i}]"
        )
    mixin = "".join(f"[a{i}]" for i in range(len(timeline)))
    fc.append(
        f"{mixin}amix=inputs={len(timeline)}:normalize=0:"
        f"dropout_transition=0[vo]"
    )
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *parts,
         "-filter_complex", ";".join(fc), "-map", "[vo]",
         "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "48000", vo])
    print("voiceover ->", vo, f"{probe(vo):.2f}s")

    # Quiet ambient bed: A minor triad pad with a slow swell.
    music = (
        "aevalsrc="
        "'0.050*sin(2*PI*220*t)*(0.62+0.38*sin(2*PI*0.055*t))"
        "+0.042*sin(2*PI*261.626*t)*(0.60+0.40*sin(2*PI*0.041*t+1.1))"
        "+0.034*sin(2*PI*329.628*t)*(0.58+0.42*sin(2*PI*0.067*t+2.2))"
        "+0.030*sin(2*PI*110*t)*(0.70+0.30*sin(2*PI*0.033*t))'"
        f":s=48000:d={total:.3f}"
    )
    out = os.path.join(ROOT, "THRIVE_DEMO.mp4")
    fc2 = (
        "[1:a]lowpass=f=1400,tremolo=f=0.12:d=0.32,"
        "volume=0.30,afade=t=in:st=0:d=3.0[m];"
        "[0:a]aresample=48000[voice];"
        f"[m]afade=t=out:st={max(total - 4.0, 0):.2f}:d=4.0[bed];"
        "[voice][bed]amix=inputs=2:normalize=0:duration=first[mix];"
        "[mix]alimiter=limit=0.94,loudnorm=I=-16:TP=-1.5:LRA=11,"
        "aresample=48000,aformat=channel_layouts=stereo[a]"
    )
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-i", silent, "-f", "lavfi", "-i", music,
         "-filter_complex", fc2,
         "-map", "0:v", "-map", "[a]",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
         "-t", f"{total:.3f}", "-movflags", "+faststart", out])
    print("video ->", out)


if __name__ == "__main__":
    main()
