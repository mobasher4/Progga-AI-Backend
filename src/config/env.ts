import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  LLM_PROVIDER: z.enum(["openai", "deepseek", "anthropic", "mock", ""]).default(""),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-6-luna"),
  OPENAI_BASE_URL: z.url().default("https://api.openai.com/v1"),
  // Read-aloud: Progga speaks its replies with OpenAI text-to-speech (needs OPENAI_API_KEY).
  VOICE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  OPENAI_TTS_MODEL: z.string().default("gpt-4o-mini-tts"),
  OPENAI_TTS_VOICE: z.string().default("coral"),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default("deepseek-flash"),
  DEEPSEEK_BASE_URL: z.url().default("https://api.deepseek.com"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
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
    (raw.OPENAI_API_KEY ? "openai" : raw.DEEPSEEK_API_KEY ? "deepseek" : raw.ANTHROPIC_API_KEY ? "anthropic" : "mock")) as
    | "openai"
    | "deepseek"
    | "anthropic"
    | "mock",
};
