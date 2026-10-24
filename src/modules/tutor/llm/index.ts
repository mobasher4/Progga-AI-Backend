import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../../config/env";
import { aiConfigVersion, getAiConfig, type AiConfig, type ProviderId } from "../../ai/config";
import { AnthropicTutor } from "./anthropic";
import { ChatCompletionsTutor, listChatModels } from "./chat-completions";
import { MockTutor } from "./mock";
import type { TutorLLM } from "./types";

/** Builds an engine for a given provider + models (also used by the admin "Test" button). */
export function buildTutor(cfg: AiConfig): TutorLLM {
  switch (cfg.provider) {
    case "openai":
      return new ChatCompletionsTutor({
        provider: "openai",
        baseUrl: env.OPENAI_BASE_URL,
        apiKey: env.OPENAI_API_KEY,
        model: cfg.model,
        vision: true,
        tokenParam: "max_completion_tokens",
        reasoning: { plan: "low", evaluate: "low" },
      });
    case "deepseek":
      return new ChatCompletionsTutor({
        provider: "deepseek",
        baseUrl: env.DEEPSEEK_BASE_URL,
        apiKey: env.DEEPSEEK_API_KEY,
        model: cfg.model,
        vision: false,
        tokenParam: "max_tokens",
      });
    case "anthropic":
      return new AnthropicTutor(cfg.model);
    default:
      return new MockTutor();
  }
}

let cached: { version: number; tutor: TutorLLM } | null = null;

function current(): TutorLLM {
  const version = aiConfigVersion();
  if (!cached || cached.version !== version) cached = { version, tutor: buildTutor(getAiConfig()) };
  return cached.tutor;
}

/** Always delegates to the engine an admin has currently selected — switching needs no restart. */
export const tutorLLM: TutorLLM = {
  get name() {
    return current().name;
  },
  get model() {
    return current().model;
  },
  get supportsImages() {
    return current().supportsImages;
  },
  plan: (input) => current().plan(input),
  evaluate: (input) => current().evaluate(input),
  translatePlan: (plan, language) => current().translatePlan(plan, language),
  syllabus: (input) => current().syllabus(input),
};

/** Models an admin can choose from for a provider. */
export async function listModels(provider: ProviderId): Promise<string[]> {
  switch (provider) {
    case "openai":
      return env.OPENAI_API_KEY ? listChatModels(env.OPENAI_BASE_URL, env.OPENAI_API_KEY) : [];
    case "deepseek":
      return env.DEEPSEEK_API_KEY ? listChatModels(env.DEEPSEEK_BASE_URL, env.DEEPSEEK_API_KEY) : [];
    case "anthropic": {
      if (!env.ANTHROPIC_API_KEY) return [];
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
      const ids: string[] = [];
      for await (const m of client.models.list()) ids.push(m.id);
      return ids;
    }
    default:
      return ["offline"];
  }
}

export type { TutorLLM } from "./types";
