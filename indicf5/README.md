# IndicF5 voice server (self-hosted)

Progga's Bangla voice from [AI4Bharat IndicF5](https://huggingface.co/ai4bharat/IndicF5), running on this machine's GPU.
The backend talks to it when an admin picks **IndicF5 (self-hosted)** under /admin → Progga's voice.
English replies still use OpenAI, since IndicF5 only knows Indian languages.

## One-time setup

```bash
cd Progga-AI-Backend/indicf5
python -m venv .venv
.venv/Scripts/python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
.venv/Scripts/python -m pip install -r requirements.txt
```

The model is gated: accept the terms at https://huggingface.co/ai4bharat/IndicF5 (logged in), then:

```bash
.venv/Scripts/hf auth login
```

## Voices

IndicF5 clones the voice of a reference clip. Each voice is `voices/<name>.wav` (5–15 s) plus
`voices/<name>.txt` (its exact transcript). Only clone voices you have permission to use (IndicF5 terms).

`voices/progga` is synthetic: `seed_voice.py` has OpenAI TTS read a cheerful Bangla line as a
10-year-old, so no real person's voice is cloned. Make another with `python seed_voice.py <name> <openai-voice>`.

## Run

```bash
.venv/Scripts/python server.py      # http://127.0.0.1:8020
```

and set `INDICF5_URL=http://127.0.0.1:8020` in `Progga-AI-Backend/.env` (restart the API).
`INDICF5_DEVICE=cpu` runs without the GPU (much slower).
