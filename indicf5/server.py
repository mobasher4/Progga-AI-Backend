"""Self-hosted IndicF5 (AI4Bharat) text-to-speech for Progga's Bangla voice.

IndicF5 clones the voice in a short reference clip, so each voice is a pair in
voices/: <name>.wav (5-15 s of speech) and <name>.txt (its exact transcript).

    POST /tts     {"text": "...", "voice": "progga"}  ->  audio/wav (24 kHz mono 16-bit)
    GET  /voices  ->  {"voices": ["progga", ...]}
    GET  /health  ->  {"ok": true, "device": "cuda", ...}

Run:  .venv\\Scripts\\python server.py   (binds 127.0.0.1:8020; INDICF5_PORT / INDICF5_DEVICE to change)
"""

import io
import os
import threading
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from transformers import AutoModel

HERE = Path(__file__).resolve().parent
VOICES = HERE / "voices"
SAMPLE_RATE = 24_000
DEVICE = os.environ.get("INDICF5_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")

print(f"Loading IndicF5 on {DEVICE}…", flush=True)
t0 = time.time()
model = AutoModel.from_pretrained("ai4bharat/IndicF5", trust_remote_code=True).to(DEVICE)
print(f"IndicF5 ready in {time.time() - t0:.1f}s", flush=True)

# one GPU, one model: generate one clip at a time
lock = threading.Lock()
app = FastAPI(title="Progga IndicF5 TTS")


def voice_names() -> list[str]:
    return sorted(p.stem for p in VOICES.glob("*.wav") if p.with_suffix(".txt").exists())


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voice: str = "progga"


@app.get("/health")
def health():
    return {"ok": True, "device": DEVICE, "voices": voice_names()}


@app.get("/voices")
def voices():
    return {"voices": voice_names()}


@app.post("/tts")
def tts(req: TtsRequest):
    if req.voice not in voice_names():
        raise HTTPException(404, f"No voice called {req.voice!r}; add voices/{req.voice}.wav and .txt")
    ref_audio = VOICES / f"{req.voice}.wav"
    ref_text = (VOICES / f"{req.voice}.txt").read_text(encoding="utf-8").strip()

    t0 = time.time()
    with lock, torch.inference_mode():
        audio = model(req.text, ref_audio_path=str(ref_audio), ref_text=ref_text)
    audio = np.asarray(audio)
    if audio.dtype == np.int16:
        audio = audio.astype(np.float32) / 32768.0

    buf = io.BytesIO()
    sf.write(buf, audio.astype(np.float32), SAMPLE_RATE, format="WAV", subtype="PCM_16")
    seconds = len(audio) / SAMPLE_RATE
    print(f"tts voice={req.voice} chars={len(req.text)} audio={seconds:.1f}s took={time.time() - t0:.1f}s", flush=True)
    return Response(buf.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("INDICF5_PORT", "8020")))
