import { z } from "zod";
import { HttpError } from "../../../lib/errors";
import { logger } from "../../../lib/logger";
import { EVALUATOR_SYSTEM, PLANNER_SYSTEM } from "../prompts";
import { EvalSchema, PlanSchema, normalizePlan, type Evaluation, type Plan } from "../schemas";
import { evalText, offTrackEvaluation, planText, refusedPlan } from "./context";
import type { EvalInput, PlanInput, TutorLLM } from "./types";

// One engine for every OpenAI-compatible Chat Completions API (OpenAI, DeepSeek).
// JSON mode + the exact schema in the system prompt, validated with the same Zod
// schemas Claude uses, with one automatic repair attempt on a bad shape.

export interface ChatEngineOptions {
  provider: "openai" | "deepseek";
  baseUrl: string;
  apiKey: string | undefined;
  /** One model for planning, fact answers and reply checking. */
  model: string;
  vision: boolean;
  /** OpenAI's newer models use max_completion_tokens; DeepSeek uses max_tokens. */
  tokenParam: "max_tokens" | "max_completion_tokens";
  /** OpenAI reasoning models: how hard to think when planning vs. checking a reply. */
  reasoning?: { plan: string; evaluate: string };
}

type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

interface ChatResponse {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
}

const TIMEOUT_MS = 120_000;

/** Models that rejected `reasoning_effort` (e.g. gpt-4o) — we stop sending it to them. */
const noReasoning = new Set<string>();

function withJsonContract(system: string, schema: z.ZodType): string {
  return `${system}

## Output format
Reply with ONE valid JSON object and nothing else (no markdown, no code fences). It must match this JSON schema exactly, with every field present:
${JSON.stringify(z.toJSONSchema(schema))}`;
}

const PLAN_SYSTEM = withJsonContract(PLANNER_SYSTEM, PlanSchema);
const EVAL_SYSTEM = withJsonContract(EVALUATOR_SYSTEM, EvalSchema);

function extractJson(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim());
}

class FilteredError extends Error {}

export class ChatCompletionsTutor implements TutorLLM {
  readonly name: string;
  readonly model: string;
  readonly supportsImages: boolean;

  constructor(private readonly opts: ChatEngineOptions) {
    this.name = opts.provider;
    this.model = opts.model;
    this.supportsImages = opts.vision;
  }

  async plan(input: PlanInput): Promise<Plan> {
    if (input.image && !this.opts.vision) {
      throw new HttpError(400, "Progga can't read photos right now. Please type your question instead! ✏️", "no_vision");
    }
    const text = planText(input);
    const user: ChatMessage["content"] = input.image
      ? [
          { type: "text", text },
          { type: "image_url", image_url: { url: `data:${input.image.mediaType};base64,${input.image.base64}` } },
        ]
      : text;
    try {
      const plan = await this.structured(PlanSchema, this.opts.model, PLAN_SYSTEM, user, 8000, this.opts.reasoning?.plan);
      return normalizePlan(plan);
    } catch (err) {
      if (err instanceof FilteredError) return refusedPlan(input.profile);
      throw err;
    }
  }

  async evaluate(input: EvalInput): Promise<Evaluation> {
    try {
      return await this.structured(EvalSchema, this.opts.model, EVAL_SYSTEM, evalText(input), 2000, this.opts.reasoning?.evaluate);
    } catch (err) {
      if (err instanceof FilteredError) return offTrackEvaluation(input.step);
      throw err;
    }
  }

  private async structured<T>(
    schema: z.ZodType<T>,
    model: string,
    system: string,
    user: ChatMessage["content"],
    maxTokens: number,
    reasoning: string | undefined,
  ): Promise<T> {
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    for (let attempt = 0; attempt < 2; attempt++) {
      const content = await this.chat(model, messages, maxTokens, reasoning);
      let problem: string;
      try {
        const parsed = schema.safeParse(extractJson(content));
        if (parsed.success) return parsed.data;
        problem = z.prettifyError(parsed.error);
      } catch {
        problem = "The response was not valid JSON.";
      }
      logger.warn({ provider: this.name, model, attempt, problem }, "AI returned an invalid shape");
      messages.push(
        { role: "assistant", content },
        { role: "user", content: `That JSON did not match the schema:\n${problem}\nReply again with only the corrected JSON object.` },
      );
    }
    throw new HttpError(502, "Progga got a bit confused. Please try again!", "llm_parse");
  }

  private async chat(model: string, messages: ChatMessage[], maxTokens: number, reasoning: string | undefined): Promise<string> {
    if (!this.opts.apiKey) throw new HttpError(503, "Progga's brain is offline right now.", "llm_auth");

    const body: Record<string, unknown> = {
      model,
      messages,
      response_format: { type: "json_object" },
      [this.opts.tokenParam]: maxTokens,
    };
    if (reasoning && !noReasoning.has(model)) body.reasoning_effort = reasoning;
    logger.debug({ provider: this.name, model, task: messages[0].content === EVAL_SYSTEM ? "check" : "plan" }, "AI call");

    let res: Response;
    try {
      res = await fetch(`${this.opts.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.opts.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      logger.error({ provider: this.name, err: (err as Error).message }, "AI request failed");
      throw new HttpError(503, "Progga is taking too long to think. Please try again.", "llm_timeout");
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // Older (non-reasoning) models reject reasoning_effort: remember and retry without it.
      if (res.status === 400 && body.reasoning_effort && /reasoning_effort/i.test(detail)) {
        noReasoning.add(model);
        return this.chat(model, messages, maxTokens, undefined);
      }
      logger.error({ provider: this.name, model, status: res.status, detail: detail.slice(0, 300) }, "AI API error");
      if (res.status === 401) throw new HttpError(503, "Progga's brain is offline right now.", "llm_auth");
      if (res.status === 402) throw new HttpError(503, "Progga's brain needs a recharge (API balance is empty).", "llm_balance");
      if (res.status === 404) throw new HttpError(503, `The AI model "${model}" isn't available. Ask an admin to pick another one.`, "llm_model");
      if (res.status === 429) throw new HttpError(503, "Lots of students are learning right now! Try again in a moment.", "llm_busy");
      throw new HttpError(502, "Progga couldn't think that through. Please try again.", "llm_error");
    }

    const data = (await res.json()) as ChatResponse;
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "content_filter" || choice?.message?.refusal) throw new FilteredError("filtered");
    const content = choice?.message?.content;
    if (!content) throw new HttpError(502, "Progga got a bit confused. Please try again!", "llm_empty");
    return content;
  }
}

/** Chat-capable models the key can use (the /models list also contains embeddings, TTS, images…). */
export async function listChatModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new HttpError(502, `Couldn't load the model list (HTTP ${res.status})`, "llm_models");
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? [])
    .map((m) => m.id)
    .filter((id) => !/embedding|tts|whisper|transcribe|audio|realtime|image|dall-e|moderation|search|instruct|babbage|davinci|sora|codex/i.test(id))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}
