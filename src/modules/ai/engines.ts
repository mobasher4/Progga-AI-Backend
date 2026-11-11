import { logger } from "../../lib/logger";
import { buildTutor, listModels, tutorLLM, type TutorLLM } from "../tutor/llm";
import { aiConfigVersion, getAiConfig, providerInfo, providers, type AiConfig } from "./config";

// Engines a student may pick in the chat: the admin's choice (the default),
// every cloud provider that has a key, and every model installed in Ollama.

export interface EngineChoice {
  /** `provider:model` — what the client sends back */
  id: string;
  provider: AiConfig["provider"];
  model: string;
  label: string;
  vision: boolean;
  isDefault: boolean;
}

const idOf = (c: AiConfig) => `${c.provider}:${c.model}`;

let ollamaCache: { at: number; models: string[] } | null = null;

/** Installed local models, re-read at most once a minute (and never fatal if Ollama is down). */
async function ollamaModels(): Promise<string[]> {
  if (ollamaCache && Date.now() - ollamaCache.at < 60_000) return ollamaCache.models;
  let models: string[] = [];
  try {
    models = await listModels("ollama");
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Couldn't list local Ollama models");
  }
  ollamaCache = { at: Date.now(), models };
  return models;
}

export async function studentEngines(): Promise<EngineChoice[]> {
  const def = getAiConfig();
  const configs: AiConfig[] = [def];
  for (const p of providers()) {
    if (!p.configured || p.id === "mock") continue;
    if (p.id === "ollama") for (const model of await ollamaModels()) configs.push({ provider: "ollama", model });
    else configs.push({ provider: p.id, model: p.defaultModel });
  }
  const seen = new Set<string>();
  return configs.flatMap((c) => {
    const id = idOf(c);
    if (seen.has(id)) return [];
    seen.add(id);
    const info = providerInfo(c.provider);
    return [{ id, provider: c.provider, model: c.model, label: `${info.label} · ${c.model}`, vision: info.vision, isDefault: id === idOf(def) }];
  });
}

const built = new Map<string, { version: number; tutor: TutorLLM }>();

/** The engine for one request: the student's pick when it's on the list, otherwise the admin's choice. */
export async function tutorFor(engine?: string): Promise<TutorLLM> {
  if (!engine) return tutorLLM;
  const choice = (await studentEngines()).find((e) => e.id === engine);
  if (!choice || choice.isDefault) return tutorLLM;
  const version = aiConfigVersion();
  const cached = built.get(choice.id);
  if (cached?.version === version) return cached.tutor;
  const tutor = buildTutor({ provider: choice.provider, model: choice.model });
  built.set(choice.id, { version, tutor });
  return tutor;
}
