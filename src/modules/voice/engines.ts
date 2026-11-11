import { z } from "zod";
import { env } from "../../config/env";
import { HttpError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import type { SpeechLang } from "./speech-text";

// Text-to-speech engines for Progga's voice. Defaults come from .env; an admin can
// switch engine and voice at runtime from AI settings, which is saved in the DB.

export const TTS_PROVIDER_IDS = ["indicf5", "openai", "gemini", "azure"] as const;
export type TtsProviderId = (typeof TTS_PROVIDER_IDS)[number];

export interface VoiceOption {
  id: string;
  label: string;
  note?: string;
}

export interface TtsProviderInfo {
  id: TtsProviderId;
  label: string;
  configured: boolean;
  /** what the key needs to be in backend/.env */
  keyHint: string;
  model: string;
  /** how well it speaks Bangladeshi Bangla, shown to admins */
  bangla: string;
  voices: VoiceOption[];
  defaultVoice: string;
  /**
   * Playback speed-up the app applies with pitch preservation off, making the voice
   * sound younger. Adult voices need it; Gemini is already asked to sound like a kid.
   */
  lift: number;
}

// gpt-4o-mini-tts voices. coral, directed as a 10-year-old, stays the most youthful in both languages.
const OPENAI_VOICES: VoiceOption[] = [
  { id: "coral", label: "Coral", note: "Warm, youthful (default)" },
  { id: "marin", label: "Marin", note: "Natural, newest" },
  { id: "cedar", label: "Cedar", note: "Natural, newest" },
  { id: "nova", label: "Nova", note: "Bright" },
  { id: "shimmer", label: "Shimmer", note: "Soft" },
  { id: "sage", label: "Sage", note: "Calm" },
  { id: "ballad", label: "Ballad", note: "Expressive" },
  { id: "verse", label: "Verse", note: "Expressive" },
  { id: "alloy", label: "Alloy", note: "Neutral" },
  { id: "ash", label: "Ash", note: "Clear" },
  { id: "echo", label: "Echo", note: "Deep" },
  { id: "fable", label: "Fable", note: "Storyteller" },
  { id: "onyx", label: "Onyx", note: "Deep" },
];

// Gemini TTS prebuilt voices with Google's own one-word descriptions; the youthful,
// upbeat ones suit Progga best and are listed first.
const GEMINI_VOICES: VoiceOption[] = [
  ["Leda", "Youthful"], ["Puck", "Upbeat"], ["Laomedeia", "Upbeat"], ["Sadachbia", "Lively"], ["Fenrir", "Excitable"],
  ["Zephyr", "Bright"], ["Autonoe", "Bright"], ["Aoede", "Breezy"], ["Achird", "Friendly"], ["Sulafat", "Warm"],
  ["Vindemiatrix", "Gentle"], ["Achernar", "Soft"], ["Callirrhoe", "Easy-going"], ["Umbriel", "Easy-going"],
  ["Zubenelgenubi", "Casual"], ["Iapetus", "Clear"], ["Erinome", "Clear"], ["Despina", "Smooth"], ["Algieba", "Smooth"],
  ["Schedar", "Even"], ["Pulcherrima", "Forward"], ["Charon", "Informative"], ["Rasalgethi", "Informative"],
  ["Sadaltager", "Knowledgeable"], ["Kore", "Firm"], ["Orus", "Firm"], ["Alnilam", "Firm"], ["Enceladus", "Breathy"],
  ["Gacrux", "Mature"], ["Algenib", "Gravelly"],
].map(([id, note]) => ({ id, label: id, note }));

// Azure neural voices are tied to one language, so each choice pairs a Bangla voice
// with an English one for English replies.
const AZURE_VOICES: Record<string, { label: string; note: string; bn: string; bnLang: string; en: string }> = {
  nabanita: { label: "Nabanita", note: "Female · Bangladesh (bn-BD)", bn: "bn-BD-NabanitaNeural", bnLang: "bn-BD", en: "en-US-AnaNeural" },
  pradeep: { label: "Pradeep", note: "Male · Bangladesh (bn-BD)", bn: "bn-BD-PradeepNeural", bnLang: "bn-BD", en: "en-US-GuyNeural" },
  tanishaa: { label: "Tanishaa", note: "Female · India (bn-IN)", bn: "bn-IN-TanishaaNeural", bnLang: "bn-IN", en: "en-IN-NeerjaNeural" },
  bashkar: { label: "Bashkar", note: "Male · India (bn-IN)", bn: "bn-IN-BashkarNeural", bnLang: "bn-IN", en: "en-IN-PrabhatNeural" },
};

// Voices on the self-hosted IndicF5 server: each is a reference clip it clones (indicf5/voices).
let indicVoices: VoiceOption[] = [];

/** Asks the IndicF5 server which voices it has; keeps the last list if it is down. */
export async function refreshIndicVoices() {
  if (!env.INDICF5_URL) return;
  try {
    const res = await fetch(`${env.INDICF5_URL}/voices`, { signal: AbortSignal.timeout(3000) });
    const { voices } = (await res.json()) as { voices: string[] };
    indicVoices = voices.map((id) => ({ id, label: id, note: "Cloned from indicf5/voices" }));
  } catch {
    logger.warn({ url: env.INDICF5_URL }, "IndicF5 voice server is not reachable");
  }
}

export function ttsProviders(): TtsProviderInfo[] {
  return [
    {
      id: "indicf5",
      label: "IndicF5 (self-hosted)",
      configured: !!env.INDICF5_URL,
      keyHint: "INDICF5_URL (run indicf5/server.py)",
      model: "ai4bharat/IndicF5",
      bangla: "Bangla from AI4Bharat's Indic model on this machine; English replies use OpenAI",
      voices: indicVoices,
      defaultVoice: indicVoices[0]?.id ?? "progga",
      lift: 1.12,
    },
    {
      id: "gemini",
      label: "Google Gemini TTS",
      configured: !!env.GEMINI_API_KEY,
      keyHint: "GEMINI_API_KEY",
      model: env.GEMINI_TTS_MODEL,
      bangla: "Natural Bangla, follows the kid style directions",
      voices: GEMINI_VOICES,
      defaultVoice: "Leda",
      lift: 1.04,
    },
    {
      id: "azure",
      label: "Azure Speech",
      configured: !!env.AZURE_SPEECH_KEY && !!env.AZURE_SPEECH_REGION,
      keyHint: "AZURE_SPEECH_KEY + AZURE_SPEECH_REGION",
      model: "neural",
      bangla: "Native Bangladeshi voices (bn-BD), clear pronunciation",
      voices: Object.entries(AZURE_VOICES).map(([id, v]) => ({ id, label: v.label, note: v.note })),
      defaultVoice: "nabanita",
      lift: 1.12,
    },
    {
      id: "openai",
      label: "OpenAI",
      configured: !!env.OPENAI_API_KEY,
      keyHint: "OPENAI_API_KEY",
      model: env.OPENAI_TTS_MODEL,
      bangla: "Understandable Bangla with a foreign accent",
      voices: OPENAI_VOICES,
      defaultVoice: env.OPENAI_TTS_VOICE,
      lift: 1.12,
    },
  ];
}

export const ttsProviderInfo = (id: TtsProviderId) => ttsProviders().find((p) => p.id === id)!;

export const VoiceConfigSchema = z.object({
  provider: z.enum(TTS_PROVIDER_IDS),
  voice: z.string().trim().min(1).max(60),
});
export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;

/** The voice must be one the engine offers (OpenAI accepts any id, for newer voices). */
export function voiceExists(cfg: VoiceConfig): boolean {
  // the IndicF5 server may still be starting; it reports unknown voices itself
  if (cfg.provider === "openai" || (cfg.provider === "indicf5" && !indicVoices.length)) return true;
  return ttsProviderInfo(cfg.provider).voices.some((v) => v.id === cfg.voice);
}

const SETTING_KEY = "voice.config";

function envDefault(): VoiceConfig {
  // OpenAI first so existing setups keep their voice until an admin switches
  const p = ttsProviders().find((x) => x.id === "openai" && x.configured) ?? ttsProviders().find((x) => x.configured) ?? ttsProviderInfo("openai");
  return { provider: p.id, voice: p.defaultVoice };
}

let current: VoiceConfig = envDefault();

export const getVoiceConfig = () => current;

/** Loads the admin-chosen voice from the DB (falls back to .env if unset or no longer usable). */
export async function loadVoiceConfig() {
  await refreshIndicVoices();
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return;
  const parsed = VoiceConfigSchema.safeParse(JSON.parse(row.value));
  if (parsed.success && ttsProviderInfo(parsed.data.provider).configured && voiceExists(parsed.data)) current = parsed.data;
  else logger.warn("Saved voice settings are invalid or missing an API key; using .env defaults");
}

export async function saveVoiceConfig(cfg: VoiceConfig) {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(cfg) },
    update: { value: JSON.stringify(cfg) },
  });
  current = cfg;
}

// ── Speaking ─────────────────────────────────────────────

/** Audio as it arrives from the engine, so the first words can play while the rest downloads. */
export interface SpeechAudio {
  contentType: string;
  chunks: AsyncIterable<Uint8Array>;
}

/** How Progga should sound: a kid, so students hear a friend learning alongside them rather than a teacher. */
function kidDirections(lang: SpeechLang): string {
  // Tested on reply-length text: without the "throughout the whole passage" line, voices drift
  // back into an adult register after the first sentence.
  const base =
    "Identity: a 10-year-old child: Progga, the cheerful robot buddy of a school student in Bangladesh. You ARE a kid, not an adult doing a voice. " +
    "Pitch: high and light, like a young child, throughout the WHOLE passage, never dropping into an adult register, even in long sentences. " +
    // the app plays clips slightly faster (and so younger-sounding), so ask for an unhurried pace
    "Tone: bubbly, excited, curious, smiling. Pace: unhurried and clear, noticeably slower than a normal chat, with short pauses between sentences. " +
    "Volume: full and well projected; never whisper or trail off. When reading maths, say each number and operation clearly.";
  return lang === "bn"
    ? `${base} Speak in natural Bangladeshi Bangla with standard Dhaka pronunciation. Read digits as Bangla numbers.`
    : `${base} Speak simple, clear English.`;
}

const unavailable = (label: string) => new HttpError(503, `Progga's voice (${label}) isn't available right now.`, "tts_error");

async function call(label: string, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    logger.error({ err: (err as Error).message, engine: label }, "TTS request failed");
    throw new HttpError(503, "Progga's voice is taking a nap. Please try again.", "tts_timeout");
  }
  if (!res.ok || !res.body) {
    logger.error({ status: res.status, engine: label, detail: (await res.text().catch(() => "")).slice(0, 300) }, "TTS API error");
    throw unavailable(label);
  }
  return res;
}

async function* readBody(res: Response): AsyncIterable<Uint8Array> {
  const reader = res.body!.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    yield value;
  }
}

async function openaiSpeech(text: string, lang: SpeechLang, voice: string): Promise<SpeechAudio> {
  const res = await call(
    "OpenAI",
    `${env.OPENAI_BASE_URL}/audio/speech`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.OPENAI_TTS_MODEL, voice, input: text, instructions: kidDirections(lang), response_format: "mp3" }),
    },
    30_000,
  );
  return { contentType: "audio/mpeg", chunks: readBody(res) };
}

async function geminiSpeech(text: string, lang: SpeechLang, voice: string): Promise<SpeechAudio> {
  // Gemini reads `text` word for word; how to say it goes in speech_metadata.style.
  const res = await call(
    "Gemini",
    `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_TTS_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text, speech_metadata: { style: kidDirections(lang) } }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { voice } } },
      }),
    },
    60_000,
  );
  const json = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  } | null;
  const audio = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!audio?.data) {
    logger.error({ detail: JSON.stringify(json).slice(0, 300) }, "Gemini TTS returned no audio");
    throw unavailable("Gemini");
  }
  const bytes = Buffer.from(audio.data, "base64");
  // the default reply is a complete WAV file (24 kHz mono 16-bit)
  return { contentType: "audio/wav", chunks: (async function* () { yield bytes; })() };
}

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

async function azureSpeech(text: string, lang: SpeechLang, voice: string): Promise<SpeechAudio> {
  const v = AZURE_VOICES[voice] ?? AZURE_VOICES.nabanita;
  const [name, xmlLang] = lang === "bn" ? [v.bn, v.bnLang] : [v.en, v.en.slice(0, 5)];
  // a touch higher and slower than normal: friendlier for kids (the app's playback lift adds the rest)
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${xmlLang}">` +
    `<voice name="${name}"><prosody pitch="+8%" rate="-8%">${xmlEscape(text)}</prosody></voice></speak>`;
  const res = await call(
    "Azure",
    `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY!,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
        "User-Agent": "progga-api",
      },
      body: ssml,
    },
    30_000,
  );
  return { contentType: "audio/mpeg", chunks: readBody(res) };
}

async function indicf5Speech(text: string, voice: string): Promise<SpeechAudio> {
  // generous timeout: the GPU is shared with the tutor's model
  const res = await call(
    "IndicF5",
    `${env.INDICF5_URL}/tts`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) },
    120_000,
  );
  return { contentType: "audio/wav", chunks: readBody(res) };
}

/** Speaks `text` (already turned into plain words) with the given engine and voice. */
export function synthesize(cfg: VoiceConfig, text: string, lang: SpeechLang): Promise<SpeechAudio> {
  if (cfg.provider === "indicf5") {
    // IndicF5 only knows Indian languages, so English replies go to OpenAI when it has a key
    return lang === "en" && env.OPENAI_API_KEY ? openaiSpeech(text, lang, env.OPENAI_TTS_VOICE) : indicf5Speech(text, cfg.voice);
  }
  if (cfg.provider === "gemini") return geminiSpeech(text, lang, cfg.voice);
  if (cfg.provider === "azure") return azureSpeech(text, lang, cfg.voice);
  return openaiSpeech(text, lang, cfg.voice);
}
