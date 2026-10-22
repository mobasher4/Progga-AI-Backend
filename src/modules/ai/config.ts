import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";

// Which AI engine Progga uses right now. Defaults come from .env; an admin can
// switch provider/model at runtime from AI settings, which is saved in the DB.

export const PROVIDER_IDS = ["openai", "deepseek", "anthropic", "mock"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  configured: boolean;
  vision: boolean;
  defaultModel: string;
}

export function providers(): ProviderInfo[] {
  return [
    { id: "openai", label: "OpenAI", configured: !!env.OPENAI_API_KEY, vision: true, defaultModel: env.OPENAI_MODEL },
    { id: "deepseek", label: "DeepSeek", configured: !!env.DEEPSEEK_API_KEY, vision: false, defaultModel: env.DEEPSEEK_MODEL },
    { id: "anthropic", label: "Anthropic Claude", configured: !!env.ANTHROPIC_API_KEY, vision: true, defaultModel: env.ANTHROPIC_MODEL },
    { id: "mock", label: "Offline practice (mock)", configured: true, vision: true, defaultModel: "offline" },
  ];
}

export const providerInfo = (id: ProviderId) => providers().find((p) => p.id === id)!;

export const AiConfigSchema = z.object({
  provider: z.enum(PROVIDER_IDS),
  /** The one model used for everything: planning lessons, answering facts and checking replies. */
  model: z.string().trim().min(1).max(100),
});
export type AiConfig = z.infer<typeof AiConfigSchema>;

const SETTING_KEY = "ai.config";

function envDefault(): AiConfig {
  const p = providerInfo(env.llmProvider);
  return { provider: p.id, model: p.defaultModel };
}

let current: AiConfig = envDefault();
let version = 0;

export const getAiConfig = () => current;
/** Bumps whenever the config changes, so engines can be rebuilt lazily. */
export const aiConfigVersion = () => version;

/** Loads the admin-chosen engine from the DB (falls back to .env if unset or no longer usable). */
export async function loadAiConfig() {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return;
  const parsed = AiConfigSchema.safeParse(JSON.parse(row.value));
  if (parsed.success && providerInfo(parsed.data.provider).configured) {
    current = parsed.data;
    version++;
  } else {
    logger.warn("Saved AI settings are invalid or missing an API key; using .env defaults");
  }
}

export async function saveAiConfig(cfg: AiConfig) {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(cfg) },
    update: { value: JSON.stringify(cfg) },
  });
  current = cfg;
  version++;
}
