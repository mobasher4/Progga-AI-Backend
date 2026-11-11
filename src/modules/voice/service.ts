import type { Response as ExpressResponse } from "express";
import { env } from "../../config/env";
import { HttpError, notFound } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { getVoiceConfig, synthesize, ttsProviderInfo, type SpeechAudio, type VoiceConfig } from "./engines";
import { detectLang, toSpokenText, type SpeechLang } from "./speech-text";

export const voiceAvailable = () => env.VOICE_ENABLED && ttsProviderInfo(getVoiceConfig().provider).configured;

/** How much the app speeds up (and so lifts) the current voice; see TtsProviderInfo.lift. */
export const voiceLift = () => ttsProviderInfo(getVoiceConfig().provider).lift;

/**
 * Version of the kid delivery directions (engines.ts kidDirections). Bump it when
 * they change so clips saved in the old style are re-recorded.
 */
const VOICE_STYLE = "kid-3";

/**
 * What goes into the saved clip's text, besides the message itself. Bump it when
 * speechFor changes so clips recorded from the old text are re-recorded.
 */
const SPEECH_TEXT = "options-1";

// The headings the chat shows on each kind of message (frontend i18n `chat.*`), read
// aloud before the message so students hear "দারুণ ভেবেছ!" as well as see it.
const HEADINGS: Record<SpeechLang, Record<string, string>> = {
  en: {
    concept: "First, the big idea",
    question: "Now it's your turn!",
    hint: "Hint",
    teach: "Let me explain",
    why: "Why it works",
    reveal: "Here's how this step works",
    walkthrough: "The whole solution, explained",
    recap: "Recap: the method",
    safety: "Progga cares",
    correct: "Nice thinking!",
    partial: "Almost there",
    incorrect: "Let's check that",
    quick: "Quick answer",
    more: "More to know",
    didYouKnow: "Did you know?",
    explore: "Explore next",
    yourAnswer: "Your answer",
    bigIdea: "Big idea",
    options: "Tap the answer you think is right",
  },
  bn: {
    concept: "আগে মূল ধারণাটা বুঝি",
    question: "এবার তোমার পালা!",
    hint: "হিন্ট",
    teach: "চলো বুঝিয়ে বলি",
    why: "কেন কাজ করে",
    reveal: "এই ধাপটা যেভাবে হয়",
    walkthrough: "পুরো সমাধান, বুঝিয়ে বলা",
    recap: "এক নজরে পদ্ধতি",
    safety: "প্রজ্ঞা তোমার পাশে",
    correct: "দারুণ ভেবেছ!",
    partial: "প্রায় হয়ে গেছে",
    incorrect: "চলো একবার দেখি",
    quick: "দ্রুত উত্তর",
    more: "আরও জানো",
    didYouKnow: "তুমি কি জানো?",
    explore: "এরপর জানো",
    yourAnswer: "তোমার উত্তর",
    bigIdea: "মূল ধারণা",
    options: "যেটা ঠিক মনে হয় সেটায় চাপ দাও",
  },
};

// the letters on the answer cards (frontend i18n `session.optionLetters`)
const OPTION_LETTERS: Record<SpeechLang, string[]> = { en: ["A", "B", "C", "D"], bn: ["ক", "খ", "গ", "ঘ"] };

/** Short maths choices ("2x = 8", "-7") are read as maths; words and phrases as they are. */
const looksLikeMaths = (s: string) => /\d/.test(s) && /^[\w\s.+\-−×÷=<>≤≥()/]+$/.test(s) && !/[a-z]{2}/i.test(s);

const VERDICTS = ["correct", "partial", "incorrect"];

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toBnDigits = (n: number) => String(n).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && !!s.trim()) : []);

/**
 * Text Progga says for a message: its heading, the message, and every section shown under it.
 * `options` are the answer cards shown under a question, read out after it.
 */
function speechFor(message: { content: string; kind: string; meta: unknown }, options: string[] = []): string {
  const meta = (message.meta ?? {}) as Record<string, unknown>;
  const lang = detectLang(message.content);
  const h = HEADINGS[lang];
  const lines: string[] = [];

  if (message.kind === "answer") {
    lines.push(h.quick, message.content);
    const more = strings(meta.moreInfo);
    if (more.length) lines.push(h.more, ...more);
    if (typeof meta.funFact === "string" && meta.funFact) lines.push(h.didYouKnow, meta.funFact);
    const explore = strings(meta.explore);
    if (explore.length) lines.push(h.explore, ...explore);
  } else if (message.kind === "celebrate") {
    lines.push(message.content);
    // same rule as the card: concept sessions and long prose answers show no "your answer"
    const answer = typeof meta.finalAnswer === "string" ? meta.finalAnswer : "";
    if (answer && !answer.startsWith("(") && answer.length <= 120) lines.push(`${h.yourAnswer}: ${answer}`);
    if (typeof meta.bigIdea === "string" && meta.bigIdea) lines.push(`${h.bigIdea}: ${meta.bigIdea}`);
  } else {
    let heading: string | undefined;
    // only these verdicts get a heading on screen (off-topic and question replies don't)
    if (message.kind === "feedback") heading = VERDICTS.includes(meta.verdict as string) ? h[meta.verdict as string] : undefined;
    else if (message.kind === "hint" && typeof meta.level === "number") {
      const of = Number(meta.of);
      heading =
        lang === "bn"
          ? `${h.hint} ${toBnDigits(meta.level)}${of ? `, মোট ${toBnDigits(of)}টা` : ""}`
          : `${h.hint} ${meta.level}${of ? ` of ${of}` : ""}`;
    } else heading = h[message.kind];
    if (heading) lines.push(heading);
    lines.push(message.content);
    if (options.length) {
      lines.push(h.options);
      options.forEach((o, i) => lines.push(`${OPTION_LETTERS[lang][i] ?? i + 1}: ${looksLikeMaths(o) ? `$${o}$` : o}`));
    }
  }
  return toSpokenText(lines.join("\n"));
}

/** The answer cards for the step a question message belongs to (they live in the hidden plan). */
function optionsFor(message: { kind: string; stepIndex: number | null }, plan: unknown): string[] {
  if (message.kind !== "question" || message.stepIndex === null) return [];
  const steps = (plan as { steps?: { options?: unknown }[] } | null)?.steps;
  return strings(steps?.[message.stepIndex]?.options);
}

/** Saved clips don't record their format: Gemini's are WAV files, the others MP3. */
const audioType = (audio: Uint8Array) => (Buffer.from(audio.subarray(0, 4)).toString("latin1") === "RIFF" ? "audio/wav" : "audio/mpeg");

/** Streams engine audio to the browser while collecting it; returns the whole clip. */
async function pipeAudio(speech: SpeechAudio, res: ExpressResponse): Promise<Uint8Array<ArrayBuffer>> {
  res.set("Content-Type", speech.contentType);
  const chunks: Uint8Array[] = [];
  for await (const chunk of speech.chunks) {
    chunks.push(chunk);
    if (!res.destroyed) res.write(chunk); // keep collecting even if the student navigated away
  }
  if (!res.destroyed) res.end();
  return Uint8Array.from(Buffer.concat(chunks));
}

/** Admin preview: speak any sample text with a voice before switching to it (nothing is saved). */
export async function sendPreview(cfg: VoiceConfig, sample: string, res: ExpressResponse): Promise<void> {
  const text = toSpokenText(sample);
  if (!text) throw new HttpError(400, "Type something for Progga to say.", "empty_text");
  res.set("Cache-Control", "no-store");
  await pipeAudio(await synthesize(cfg, text, detectLang(text)), res);
}

/**
 * Sends Progga's voice for one of its own messages in a session the student
 * owns. Replays come from the database; a first request streams the audio to
 * the browser as the engine generates it (so speaking starts quickly) and
 * saves a copy for next time.
 */
export async function sendSpeech(studentId: string, sessionId: string, messageId: string, res: ExpressResponse): Promise<void> {
  if (!voiceAvailable()) throw new HttpError(503, "Progga's voice is turned off.", "tts_disabled");

  const message = await prisma.tutorMessage.findUnique({
    where: { id: messageId },
    include: { session: { select: { studentId: true, plan: true } }, speech: true },
  });
  if (!message || message.sessionId !== sessionId || message.session.studentId !== studentId || message.role !== "tutor") {
    throw notFound("Message not found");
  }

  const cfg = getVoiceConfig();
  const { model } = ttsProviderInfo(cfg.provider);
  // The saved clip must match the engine, voice, style AND text. OpenAI keeps its older
  // key (no engine prefix) so clips recorded before engines were selectable still count.
  const voice = `${cfg.provider === "openai" ? "" : `${cfg.provider}:`}${cfg.voice}/${VOICE_STYLE}/${SPEECH_TEXT}`;
  // the URL stays the same when an admin switches voice, so the browser must not keep old clips
  res.set("Cache-Control", "private, no-cache");

  if (message.speech && message.speech.voice === voice && message.speech.model === model) {
    const audio = Buffer.from(message.speech.audio);
    res.set({ "Content-Type": audioType(message.speech.audio), "Content-Length": String(audio.length) });
    res.end(audio);
    return;
  }

  const text = speechFor(message, optionsFor(message, message.session.plan));
  if (!text) throw notFound("Nothing to read");
  const audio = await pipeAudio(await synthesize(cfg, text, detectLang(text)), res);
  await prisma.speechClip
    .upsert({ where: { messageId }, create: { messageId, voice, model, audio }, update: { voice, model, audio } })
    .catch((err) => logger.warn({ err: (err as Error).message, messageId }, "Could not cache speech"));
}
