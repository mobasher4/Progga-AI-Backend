import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  LLM_PROVIDER: z.enum(["openai", "deepseek", "anthropic", "ollama", "mock", ""]).default(""),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-6-luna"),
  OPENAI_BASE_URL: z.url().default("https://api.openai.com/v1"),
  // Read-aloud: Progga speaks its replies. Engines: OpenAI (OPENAI_API_KEY), Google Gemini TTS
  // (GEMINI_API_KEY) or Azure Speech (AZURE_SPEECH_KEY + region); admins pick one in AI settings.
  VOICE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  OPENAI_TTS_MODEL: z.string().default("gpt-4o-mini-tts"),
  // coral, directed as a 10-year-old, stays the most youthful in both English and Bangla
  OPENAI_TTS_VOICE: z.string().default("coral"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_TTS_MODEL: z.string().default("gemini-3.8-flash-tts"),
  AZURE_SPEECH_KEY: z.string().optional(),
  /** e.g. southeastasia, centralindia, eastus */
  AZURE_SPEECH_REGION: z.string().optional(),
  /** Self-hosted IndicF5 voice server (indicf5/server.py), e.g. http://127.0.0.1:8020 */
  INDICF5_URL: z.url().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default("deepseek-flash"),
  DEEPSEEK_BASE_URL: z.url().default("https://api.deepseek.com"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
  // Local models via Ollama (OpenAI-compatible API, no key). Set the URL to enable it.
  OLLAMA_BASE_URL: z.url().optional(),
  OLLAMA_MODEL: z.string().default("gemma4:12b"),
  /** Context window (tokens) for the local model; the tutor prompt needs well over Ollama's 4096 default. */
  OLLAMA_NUM_CTX: z.coerce.number().int().positive().default(16384),
  DEFAULT_DAILY_TUTOR_LIMIT: z.coerce.number().int().positive().default(25),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment configuration:\n", z.prettifyError(parsed.error));
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  // Vercel doesn't always set NODE_ENV for functions, so treat any Vercel deployment as production.
  isProd: raw.NODE_ENV === "production" || !!process.env.VERCEL,
  corsOrigins: raw.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
  /** Provider used until an admin picks one in AI settings (stored in the database). */
  llmProvider: (raw.LLM_PROVIDER ||
    (raw.OPENAI_API_KEY ? "openai" : raw.DEEPSEEK_API_KEY ? "deepseek" : raw.ANTHROPIC_API_KEY ? "anthropic" : raw.OLLAMA_BASE_URL ? "ollama" : "mock")) as
    | "openai"
    | "deepseek"
    | "anthropic"
    | "ollama"
    | "mock",
};
