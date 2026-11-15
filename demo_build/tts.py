"""Generate narration audio plus word-boundary timings with edge-tts.

Audio and timings come from the same synthesis pass, so the captions and the
SRT line up with the exact MP3s the video is assembled from.
"""
import asyncio
import json
import os
import sys

import edge_tts

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from narration import SEGMENTS  # noqa: E402

VOICE = "en-IN-NeerjaNeural"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio")


async def render(slug: str, text: str) -> dict:
    c = edge_tts.Communicate(
        text, VOICE, rate="+0%", pitch="+0Hz", boundary="WordBoundary"
    )
    audio = bytearray()
    words = []
    async for chunk in c.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            # offset/duration are in 100-nanosecond ticks
            words.append(
                {
                    "t": chunk["offset"] / 10_000_000.0,
                    "d": chunk["duration"] / 10_000_000.0,
                    "w": chunk["text"],
                }
            )
    path = os.path.join(OUT, f"{slug}.mp3")
    with open(path, "wb") as fh:
        fh.write(audio)
    meta = {"slug": slug, "text": text, "words": words}
    with open(os.path.join(OUT, f"{slug}.json"), "w") as fh:
        json.dump(meta, fh, indent=1)
    return meta


async def main() -> None:
    total = 0.0
    for slug, text in SEGMENTS:
        meta = await render(slug, text)
        last = meta["words"][-1] if meta["words"] else {"t": 0, "d": 0}
        end = last["t"] + last["d"]
        total += end
        print(f"{slug:14s} {len(meta['words']):3d} words  last word ends {end:6.2f}s")
    print(f"narration total (last word) {total:.2f}s")


if __name__ == "__main__":
    asyncio.run(main())
