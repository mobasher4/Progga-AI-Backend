"""Makes IndicF5's reference voice ("seed") synthetically, so no real person's voice is cloned.

Asks OpenAI TTS (key from ../.env) to read a cheerful Bangla line as Progga, a 10-year-old
robot buddy, and saves it as voices/<name>.wav with the line as voices/<name>.txt.

    .venv\\Scripts\\python seed_voice.py [name] [openai-voice]      (defaults: progga coral)

Listen to the result: IndicF5 copies its timbre and delivery. If OpenAI misreads a word, edit
the .txt to match what was actually said, or run again.
"""

import json
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
NAME = sys.argv[1] if len(sys.argv) > 1 else "progga"
VOICE = sys.argv[2] if len(sys.argv) > 2 else "coral"

# ~10 s, varied sounds, ends upbeat: what IndicF5 learns Progga sounds like
LINE = "হাই বন্ধু! আমি প্রজ্ঞা। চলো আজ একসাথে মজার একটা অঙ্ক করি। তুমি তো দারুণ ভাবো, তাই না? এবার তোমার পালা!"

DIRECTIONS = (
    "Identity: a 10-year-old child: Progga, the cheerful robot buddy of a school student in Bangladesh. "
    "Pitch: high and light, like a young child, throughout. Tone: bubbly, warm, smiling. "
    "Pace: unhurried and clear, with short pauses between sentences. "
    "Speak in natural Bangladeshi Bangla with standard Dhaka pronunciation."
)


def env_value(key: str) -> str:
    for line in (HERE.parent / ".env").read_text(encoding="utf-8-sig").splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"')
    sys.exit(f"{key} is not set in Progga-AI-Backend/.env")


def fix_wav_sizes(wav: bytes) -> bytes:
    """OpenAI streams WAV with placeholder (0xFFFFFFFF) sizes; audio loaders need the real ones."""
    data_at = wav.index(b"data")
    out = bytearray(wav)
    out[4:8] = (len(wav) - 8).to_bytes(4, "little")
    out[data_at + 4 : data_at + 8] = (len(wav) - data_at - 8).to_bytes(4, "little")
    return bytes(out)


def main():
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=json.dumps(
            {"model": "gpt-4o-mini-tts", "voice": VOICE, "input": LINE, "instructions": DIRECTIONS, "response_format": "wav"}
        ).encode(),
        headers={"Authorization": f"Bearer {env_value('OPENAI_API_KEY')}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        audio = fix_wav_sizes(res.read())

    voices = HERE / "voices"
    voices.mkdir(exist_ok=True)
    (voices / f"{NAME}.wav").write_bytes(audio)
    (voices / f"{NAME}.txt").write_text(LINE, encoding="utf-8")
    print(f"Saved voices/{NAME}.wav ({len(audio) // 1024} KB) and voices/{NAME}.txt")


if __name__ == "__main__":
    main()
