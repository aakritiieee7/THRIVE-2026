"""Render every text asset for the THRIVE demo video with Pillow.

This ffmpeg build has no drawtext/subtitles filter, so all on-screen text is
drawn into RGBA PNGs here and composited with the `overlay` filter.
"""
import json
import os
import textwrap

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
CARDS = os.path.join(HERE, "cards")
CAPS = os.path.join(HERE, "captions")
OUT = os.path.join(HERE, "overlays")
W, H = 1920, 1080

INK = (34, 48, 43)
INK_SOFT = (68, 83, 76)
FOREST = (46, 89, 64)
FOREST_DEEP = (35, 69, 52)
IVORY = (250, 247, 241)
CREAM = (243, 238, 227)
HONEY = (200, 144, 33)
MUTED = (113, 128, 111)
SAGE = (127, 160, 139)

FONT_DIR = "/System/Library/Fonts/Avenir Next.ttc"
F_BOLD = 0
F_DEMI = 2
F_MED = 5
F_REG = 7


def font(face, size):
    return ImageFont.truetype(FONT_DIR, size, index=face)


def tracked(draw, xy, text, fnt, fill, tracking=0.0):
    """Draw text with letter-spacing; returns the advance width."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x - xy[0]


def tracked_width(draw, text, fnt, tracking=0.0):
    w = sum(draw.textlength(c, font=fnt) for c in text)
    return w + tracking * max(len(text) - 1, 0)


def centered_tracked(draw, y, text, fnt, fill, tracking=0.0):
    w = tracked_width(draw, text, fnt, tracking)
    tracked(draw, ((W - w) / 2, y), text, fnt, fill, tracking)
    return w


def title_card(path):
    im = Image.new("RGBA", (W, H), CREAM + (255,))
    d = ImageDraw.Draw(im)
    # Soft sage disc, off-centre, for a little depth.
    disc = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(disc)
    dd.ellipse((-260, 620, 780, 1660), fill=SAGE + (70,))
    dd.ellipse((1420, -320, 2320, 560), fill=HONEY + (34,))
    im = Image.alpha_composite(im, disc)
    d = ImageDraw.Draw(im)

    d.rectangle((0, 0, W, 10), fill=FOREST)
    centered_tracked(d, 214, "CODE FOR A BILLION", font(F_MED, 26), FOREST, 7.2)
    centered_tracked(
        d, 254, "BHARAT AGENTIC-AI HACKATHON 2026", font(F_MED, 26), MUTED, 5.4
    )
    centered_tracked(d, 356, "THRIVE", font(F_BOLD, 232), FOREST_DEEP, 6)
    d.rectangle((W / 2 - 58, 636, W / 2 + 58, 640), fill=HONEY)
    for i, line in enumerate(
        [
            "Teacher Hub for Resources, Instruction,",
            "Verified Information & Empowerment",
        ]
    ):
        centered_tracked(d, 688 + i * 54, line, font(F_REG, 40), INK, 0.6)
    centered_tracked(
        d, 852, "EDUCATION TRACK  ·  PRODUCT DEMONSTRATION", font(F_MED, 25), FOREST, 4.6
    )
    centered_tracked(
        d, 900, "Live at thrive-2026-nine.vercel.app", font(F_REG, 22), MUTED, 0.4
    )
    im.convert("RGB").save(path, quality=96)


def closing_card(path):
    im = Image.new("RGBA", (W, H), FOREST_DEEP + (255,))
    disc = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(disc)
    dd.ellipse((-380, -380, 760, 760), fill=SAGE + (46,))
    dd.ellipse((1330, 520, 2300, 1490), fill=HONEY + (30,))
    im = Image.alpha_composite(im, disc)
    d = ImageDraw.Draw(im)

    d.rectangle((0, 0, W, 10), fill=HONEY)
    centered_tracked(d, 330, "THRIVE", font(F_BOLD, 196), IVORY, 7)
    d.rectangle((W / 2 - 54, 566, W / 2 + 54, 570), fill=HONEY)
    centered_tracked(
        d, 616, "Helping teachers thrive, so students flourish.",
        font(F_REG, 44), IVORY, 0.6,
    )
    centered_tracked(
        d, 744, "BUILT FOR TEACHERS WORKING ACROSS SEVERAL GRADES AT ONCE",
        font(F_MED, 23), (203, 220, 205), 4.2,
    )
    centered_tracked(
        d, 824, "thrive-2026-nine.vercel.app", font(F_MED, 26), IVORY, 1.2
    )
    centered_tracked(
        d, 866, "github.com/aakritiieee7/THRIVE-2026", font(F_REG, 23),
        (203, 220, 205), 0.8,
    )
    im.convert("RGB").save(path, quality=96)


def lower_third(path, eyebrow, title):
    """Small top-left scene label with a honey accent bar."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pad_x, pad_y = 34, 74
    f_eye = font(F_MED, 19)
    f_ttl = font(F_DEMI, 30)
    tw = max(tracked_width(d, eyebrow, f_eye, 3.0), d.textlength(title, font=f_ttl))
    box_w = int(tw + pad_x * 2)
    box_h = 104
    d.rounded_rectangle(
        (40, 40, 40 + box_w, 40 + box_h), radius=14,
        fill=(255, 255, 255, 236), outline=(230, 224, 210, 255), width=2,
    )
    d.rounded_rectangle((40, 40, 47, 40 + box_h), radius=3, fill=HONEY)
    tracked(d, (40 + pad_x, 40 + pad_y - 30), eyebrow, f_eye, MUTED, 3.0)
    d.text((40 + pad_x, 40 + pad_y - 2), title, font=f_ttl, fill=INK)
    im.save(path)


def chunk_words(words, max_chars=86):
    """Group word timings into whole-clause caption chunks.

    Captions are built sentence by sentence, and a sentence that is too long to
    read in one go is split at its middle comma (never mid-phrase), so no cue
    starts or ends on half a clause.
    """
    sentences, cur = [], []
    for w in words:
        cur.append(w)
        if w["w"][-1] in ".?!":
            sentences.append(cur)
            cur = []
    if cur:
        sentences.append(cur)

    chunks = []
    for sent in sentences:
        text = " ".join(w["w"] for w in sent)
        if len(text) <= max_chars or len(sent) < 6:
            chunks.append(sent)
            continue
        # Split near the middle, and only where the script already has a comma.
        running, best = 0, None
        for i, w in enumerate(sent[:-1]):
            running += len(w["w"]) + 1
            if w["w"].endswith((",", ";", ":")):
                score = abs(running - len(text) / 2)
                if best is None or score < best[0]:
                    best = (score, i + 1)
        cut = best[1] if best else len(sent) // 2
        chunks.append(sent[:cut])
        chunks.append(sent[cut:])
    return chunks


def timed_words(meta):
    """Pair each word boundary with its punctuated token from the script.

    edge-tts reports bare words (no commas or full stops), so captions that used
    the boundary text alone read run-on. The source text keeps the punctuation
    and has the same word count, so align the two by index.
    """
    toks = meta["text"].split()
    words = meta["words"]
    if len(toks) == len(words):
        return [{"t": w["t"], "d": w["d"], "w": t} for w, t in zip(words, toks)]
    return words


def caption_png(path, text):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = font(F_MED, 38)
    lines = textwrap.wrap(text, width=52)
    if len(lines) > 2:
        lines = textwrap.wrap(text, width=62)[:2]
    lh = 50
    band_h = lh * len(lines) + 34
    y0 = H - 74 - band_h
    widths = [d.textlength(l, font=f) for l in lines]
    band_w = int(max(widths) + 96)
    cx = W / 2
    d.rounded_rectangle(
        (cx - band_w / 2, y0, cx + band_w / 2, y0 + band_h),
        radius=16, fill=(27, 43, 35, 214),
    )
    for i, line in enumerate(lines):
        lw = d.textlength(line, font=f)
        d.text((cx - lw / 2, y0 + 20 + i * lh), line, font=f, fill=(252, 250, 245))
    im.save(path)


SCENES = [
    # (slug, eyebrow, title) — a None eyebrow means "card, no scene label"
    ("02_landing", "OVERVIEW", "What THRIVE is"),
    ("03_home", "TODAY", "One calm page for the day"),
    ("04_compiler", "CURRICULUM STUDIO", "Multi-Grade Classroom Compiler"),
    ("05_guided", "CURRICULUM STUDIO", "Guided setup"),
    ("06_assistant", "TEACHING ASSISTANT", "Sourced answers, English or Hindi"),
    ("07_training", "TRAINING CENTRE", "Short practice modules"),
    ("08_updates", "VERIFIED UPDATES", "Policy news with sources"),
    ("09_community", "TEACHER COMMUNITY", "What actually works"),
]


def main():
    for p in (CARDS, CAPS, OUT):
        os.makedirs(p, exist_ok=True)
    title_card(os.path.join(CARDS, "title.png"))
    closing_card(os.path.join(CARDS, "closing.png"))
    for slug, eyebrow, title in SCENES:
        lower_third(os.path.join(OUT, f"{slug}_label.png"), eyebrow, title)

    manifest = {}
    for slug, _, _ in SCENES:
        meta = json.load(open(os.path.join(HERE, "audio", f"{slug}.json")))
        items = []
        for i, words in enumerate(chunk_words(timed_words(meta))):
            text = " ".join(w["w"] for w in words)
            text = text[0].upper() + text[1:]
            if not text.endswith((".", "!", "?")):
                text += "."
            start = max(words[0]["t"] - 0.14, 0.0)
            # Hold each caption until the next one starts, so there is no gap
            end = words[-1]["t"] + words[-1]["d"] + 0.55
            name = f"{slug}_{i:02d}.png"
            caption_png(os.path.join(CAPS, name), text)
            items.append({"png": name, "text": text, "start": start, "end": end})
        # Hold each caption until the next one appears (no flicker between cues).
        for a, b in zip(items, items[1:]):
            a["end"] = max(a["end"], b["start"] - 0.05)
        manifest[slug] = items
        print(f"{slug:14s} {len(items):2d} captions")
    with open(os.path.join(HERE, "captions.json"), "w") as fh:
        json.dump(manifest, fh, indent=1)


if __name__ == "__main__":
    main()
