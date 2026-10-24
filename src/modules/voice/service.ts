import type { Response as ExpressResponse } from "express";
import { env } from "../../config/env";
import { HttpError, notFound } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { detectLang, toSpokenText, type SpeechLang } from "./speech-text";

const TIMEOUT_MS = 30_000;

export const voiceAvailable = () => env.VOICE_ENABLED && !!env.OPENAI_API_KEY;

/** How Progga should sound — passed to gpt-4o-mini-tts as delivery instructions. */
function instructions(lang: SpeechLang): string {
  const base =
    "You are Progga, a cheerful and kind robot tutor for school children in Bangladesh. " +
    "Speak warmly and clearly, a little slower than normal conversation, like a patient, encouraging teacher. " +
    "Sound friendly and curious, never robotic or rushed. Pause briefly between sentences. " +
    "When reading maths, say each number and operation clearly.";
  return lang === "bn"
    ? `${base} Speak in natural Bangladeshi Bangla with standard Dhaka pronunciation. Read digits as Bangla numbers.`
    : `${base} Speak simple, clear English. Some words may be Banglish (Bangla written in English letters): pronounce those the Bangla way.`;
}

/** Text Progga says for a message (fact answers also read their fun fact). */
function speechFor(message: { content: string; kind: string; meta: unknown }): string {
  const meta = (message.meta ?? {}) as Record<string, unknown>;
  const lang = detectLang(message.content);
  let text = message.content;
  if (message.kind === "answer" && typeof meta.funFact === "string" && meta.funFact) {
    text += `\n\n${lang === "bn" ? "তুমি কি জানো?" : "Did you know?"} ${meta.funFact}`;
  }
  return toSpokenText(text);
}

async function requestSpeech(input: string, lang: SpeechLang): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${env.OPENAI_BASE_URL}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OPENAI_TTS_MODEL,
        voice: env.OPENAI_TTS_VOICE,
        input,
        instructions: instructions(lang),
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "TTS request failed");
    throw new HttpError(503, "Progga's voice is taking a nap. Please try again.", "tts_timeout");
  }
  if (!res.ok || !res.body) {
    logger.error({ status: res.status, detail: (await res.text().catch(() => "")).slice(0, 300) }, "TTS API error");
    throw new HttpError(503, "Progga's voice isn't available right now.", "tts_error");
  }
  return res;
}

/**
 * Sends Progga's voice for one of its own messages in a session the student
 * owns. Replays come from the database; a first request streams the audio to
 * the browser as OpenAI generates it (so speaking starts within a second) and
 * saves a copy for next time.
 */
export async function sendSpeech(studentId: string, sessionId: string, messageId: string, res: ExpressResponse): Promise<void> {
  if (!voiceAvailable()) throw new HttpError(503, "Progga's voice is turned off.", "tts_disabled");

  const message = await prisma.tutorMessage.findUnique({
    where: { id: messageId },
    include: { session: { select: { studentId: true } }, speech: true },
  });
  if (!message || message.sessionId !== sessionId || message.session.studentId !== studentId || message.role !== "tutor") {
    throw notFound("Message not found");
  }

  const { OPENAI_TTS_VOICE: voice, OPENAI_TTS_MODEL: model } = env;
  res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" });

  if (message.speech && message.speech.voice === voice && message.speech.model === model) {
    const audio = Buffer.from(message.speech.audio);
    res.set("Content-Length", String(audio.length));
    res.end(audio);
    return;
  }

  const text = speechFor(message);
  if (!text) throw notFound("Nothing to read");
  const upstream = await requestSpeech(text, detectLang(text));

  // Stream chunks through while collecting them for the cache.
  const chunks: Uint8Array[] = [];
  const reader = upstream.body!.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    if (!res.destroyed) res.write(value); // keep caching even if the student navigated away
  }
  if (!res.destroyed) res.end();

  const audio = Uint8Array.from(Buffer.concat(chunks));
  await prisma.speechClip
    .upsert({ where: { messageId }, create: { messageId, voice, model, audio }, update: { voice, model, audio } })
    .catch((err) => logger.warn({ err: (err as Error).message, messageId }, "Could not cache speech"));
}
