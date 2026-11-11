import { z } from "zod";
import { HttpError } from "../../../lib/errors";
import { logger } from "../../../lib/logger";
import { EVALUATOR_SYSTEM, PLANNER_SYSTEM, SYLLABUS_SYSTEM, TRANSLATOR_SYSTEM, syllabusText } from "../prompts";
import { EvalSchema, PlanSchema, SyllabusSchema, normalizePlan, type Evaluation, type Plan, type Syllabus } from "../schemas";
import { evalText, mergeTranslation, offTrackEvaluation, planText, refusedPlan, translateText } from "./context";
import type { EvalInput, OnPartial, PlanInput, SyllabusInput, TutorLLM } from "./types";

// One engine for every OpenAI-compatible Chat Completions API (OpenAI, DeepSeek, Ollama).
// JSON mode + the exact schema in the system prompt, validated with the same Zod
// schemas Claude uses, with one automatic repair attempt on a bad shape.

export interface ChatEngineOptions {
  provider: "openai" | "deepseek" | "ollama";
  baseUrl: string;
  apiKey: string | undefined;
  /** One model for planning, fact answers and reply checking. */
  model: string;
  vision: boolean;
  /** OpenAI's newer models use max_completion_tokens; DeepSeek uses max_tokens. */
  tokenParam: "max_tokens" | "max_completion_tokens";
  /** OpenAI reasoning models: how hard to think when planning vs. checking a reply. */
  reasoning?: { plan: string; evaluate: string };
  /** Per-request timeout (default 120s). */
  timeoutMs?: number;
  /** Ollama: context window to load the model with (its OpenAI endpoint ignores this, so we use /api/chat). */
  numCtx?: number;
}

type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

interface StreamChunk {
  choices?: { delta?: { content?: string | null; refusal?: string | null }; finish_reason?: string | null }[];
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
const TRANSLATE_SYSTEM = withJsonContract(TRANSLATOR_SYSTEM, PlanSchema);
const SYLLABUS_JSON_SYSTEM = withJsonContract(SYLLABUS_SYSTEM, SyllabusSchema);

function extractJson(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim());
}

/**
 * Smaller (local) models sometimes drop the fields at the end of a long plan.
 * Those are only shown after the student finishes (or are fact-mode extras),
 * so missing ones become empty instead of failing the whole plan.
 */
const PLAN_TAIL_DEFAULTS: Record<string, string | string[]> = {
  safety_reply: "",
  key_idea: "",
  walkthrough: "",
  recap: "",
  practice_problem: "",
  answer: "",
  more_info: [],
  fun_fact: "",
  explore_next: [],
};
function fillPlanTail(schema: z.ZodType, value: unknown): unknown {
  if (schema !== (PlanSchema as z.ZodType) || !value || typeof value !== "object") return value;
  const plan = { ...PLAN_TAIL_DEFAULTS, ...(value as Record<string, unknown>) };
  // "bullet recap" / "numbered walkthrough" sometimes come back as lists of lines
  for (const key of ["recap", "walkthrough", "final_answer"]) {
    const v = plan[key];
    if (Array.isArray(v)) plan[key] = v.map((line) => (key === "recap" && !/^\s*[-*•]/.test(String(line)) ? `- ${line}` : String(line))).join("\n");
  }
  if (typeof plan.final_answer !== "string") plan.final_answer = typeof plan.answer === "string" ? plan.answer : "";
  return plan;
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

  async plan(input: PlanInput, onPartial?: OnPartial): Promise<Plan> {
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
      const plan = await this.structured(PlanSchema, this.opts.model, PLAN_SYSTEM, user, 8000, this.opts.reasoning?.plan, onPartial);
      return normalizePlan(plan);
    } catch (err) {
      if (err instanceof FilteredError) return refusedPlan(input.profile);
      throw err;
    }
  }

  async evaluate(input: EvalInput, onPartial?: OnPartial): Promise<Evaluation> {
    try {
      return await this.structured(EvalSchema, this.opts.model, EVAL_SYSTEM, evalText(input), 2000, this.opts.reasoning?.evaluate, onPartial);
    } catch (err) {
      if (err instanceof FilteredError) return offTrackEvaluation(input.step);
      throw err;
    }
  }

  async translatePlan(plan: Plan, language: string): Promise<Plan> {
    const translated = await this.structured(PlanSchema, this.opts.model, TRANSLATE_SYSTEM, translateText(plan, language), 8000, this.opts.reasoning?.evaluate);
    return mergeTranslation(plan, normalizePlan(translated));
  }

  async syllabus({ grade, subject, language }: SyllabusInput): Promise<Syllabus> {
    return this.structured(SyllabusSchema, this.opts.model, SYLLABUS_JSON_SYSTEM, syllabusText(grade, subject, language), 6000, this.opts.reasoning?.evaluate);
  }

  private async structured<T>(
    schema: z.ZodType<T>,
    model: string,
    system: string,
    user: ChatMessage["content"],
    maxTokens: number,
    reasoning: string | undefined,
    onPartial?: OnPartial,
  ): Promise<T> {
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) onPartial?.(""); // the repaired answer streams from the start again
      const content = await this.chat(model, messages, maxTokens, reasoning, onPartial);
      let problem: string;
      try {
        const parsed = schema.safeParse(fillPlanTail(schema, extractJson(content)));
        if (parsed.success) return parsed.data;
        problem = z.prettifyError(parsed.error);
      } catch {
        problem = "The response was not valid JSON.";
      }
      logger.warn({ provider: this.name, model, attempt, problem, sample: content.slice(0, 300) }, "AI returned an invalid shape");
      messages.push(
        { role: "assistant", content },
        { role: "user", content: `That JSON did not match the schema:\n${problem}\nReply again with only the corrected JSON object.` },
      );
    }
    throw new HttpError(502, "Progga got a bit confused. Please try again!", "llm_parse");
  }

  private async chat(model: string, messages: ChatMessage[], maxTokens: number, reasoning: string | undefined, onPartial?: OnPartial): Promise<string> {
    if (this.opts.provider === "ollama") return this.ollamaChat(model, messages, maxTokens, onPartial);
    if (!this.opts.apiKey) throw new HttpError(503, "Progga's brain is offline right now.", "llm_auth");

    const body: Record<string, unknown> = {
      model,
      messages,
      response_format: { type: "json_object" },
      [this.opts.tokenParam]: maxTokens,
      ...(onPartial ? { stream: true } : {}),
    };
    if (reasoning && !noReasoning.has(model)) body.reasoning_effort = reasoning;
    logger.debug({ provider: this.name, model, task: messages[0].content === EVAL_SYSTEM ? "check" : "plan" }, "AI call");

    let res: Response;
    try {
      res = await fetch(`${this.opts.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.opts.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? TIMEOUT_MS),
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
        return this.chat(model, messages, maxTokens, undefined, onPartial);
      }
      logger.error({ provider: this.name, model, status: res.status, detail: detail.slice(0, 300) }, "AI API error");
      if (res.status === 401) throw new HttpError(503, "Progga's brain is offline right now.", "llm_auth");
      if (res.status === 402) throw new HttpError(503, "Progga's brain needs a recharge (API balance is empty).", "llm_balance");
      if (res.status === 404) throw new HttpError(503, `The AI model "${model}" isn't available. Ask an admin to pick another one.`, "llm_model");
      if (res.status === 429) throw new HttpError(503, "Lots of students are learning right now! Try again in a moment.", "llm_busy");
      throw new HttpError(502, "Progga couldn't think that through. Please try again.", "llm_error");
    }

    let content: string | null | undefined;
    let filtered = false;
    if (onPartial) {
      // Server-Sent Events: `data: {choices:[{delta:{content}}]}` … `data: [DONE]`
      let streamed = "";
      await this.readLines(res, (line) => {
        if (!line.startsWith("data:")) return;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") return;
        const choice = (JSON.parse(payload) as StreamChunk).choices?.[0];
        if (choice?.finish_reason === "content_filter" || choice?.delta?.refusal) filtered = true;
        if (choice?.delta?.content) {
          streamed += choice.delta.content;
          onPartial(streamed);
        }
      });
      content = streamed;
    } else {
      const choice = ((await res.json()) as ChatResponse).choices?.[0];
      filtered = choice?.finish_reason === "content_filter" || !!choice?.message?.refusal;
      content = choice?.message?.content;
    }
    if (filtered) throw new FilteredError("filtered");
    if (!content) throw new HttpError(502, "Progga got a bit confused. Please try again!", "llm_empty");
    return content;
  }

  /** Reads a streamed response line by line (SSE or NDJSON). */
  private async readLines(res: Response, onLine: (line: string) => void) {
    if (!res.body) throw new HttpError(502, "Progga got a bit confused. Please try again!", "llm_empty");
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) onLine(line.trim());
      }
      if (buffer.trim()) onLine(buffer.trim());
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (err instanceof SyntaxError) throw new HttpError(502, "Progga got a bit confused. Please try again!", "llm_error");
      logger.error({ provider: this.name, err: (err as Error).message }, "AI stream broke off");
      throw new HttpError(503, "Progga is taking too long to think. Please try again.", "llm_timeout");
    }
  }

  /** Ollama's native API: lets us set the context window and turn "thinking" off, which /v1 can't. */
  private async ollamaChat(model: string, messages: ChatMessage[], maxTokens: number, onPartial?: OnPartial): Promise<string> {
    const body = {
      model,
      stream: !!onPartial,
      format: "json",
      think: false,
      options: { num_ctx: this.opts.numCtx ?? 16384, num_predict: maxTokens },
      messages: messages.map((m) =>
        typeof m.content === "string"
          ? { role: m.role, content: m.content }
          : {
              role: m.role,
              content: m.content.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n"),
              images: m.content.flatMap((p) => (p.type === "image_url" ? [p.image_url.url.replace(/^data:[^,]*,/, "")] : [])),
            },
      ),
    };
    logger.debug({ provider: this.name, model }, "AI call");

    let res: Response;
    try {
      res = await fetch(`${this.opts.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? TIMEOUT_MS),
      });
    } catch (err) {
      logger.error({ provider: this.name, err: (err as Error).message }, "AI request failed");
      throw new HttpError(503, "Progga's local brain isn't answering. Is Ollama running?", "llm_timeout");
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logger.error({ provider: this.name, model, status: res.status, detail: detail.slice(0, 300) }, "AI API error");
      if (res.status === 404) throw new HttpError(503, `The local model "${model}" isn't installed. Run: ollama pull ${model}`, "llm_model");
      throw new HttpError(502, "Progga couldn't think that through. Please try again.", "llm_error");
    }
    type OllamaChunk = { message?: { content?: string }; done_reason?: string; error?: string };
    let content = "";
    let doneReason: string | undefined;
    if (onPartial) {
      // one JSON object per line, the last with `done: true`
      await this.readLines(res, (line) => {
        const chunk = JSON.parse(line) as OllamaChunk;
        if (chunk.error) {
          logger.error({ provider: this.name, model, error: chunk.error }, "AI stream error");
          throw new HttpError(502, "Progga couldn't think that through. Please try again.", "llm_error");
        }
        if (chunk.done_reason) doneReason = chunk.done_reason;
        if (chunk.message?.content) {
          content += chunk.message.content;
          onPartial(content);
        }
      });
    } else {
      const data = (await res.json()) as OllamaChunk;
      content = data.message?.content ?? "";
      doneReason = data.done_reason;
    }
    if (!content) throw new HttpError(502, "Progga got a bit confused. Please try again!", "llm_empty");
    if (doneReason === "length") logger.warn({ provider: this.name, model, maxTokens }, "Local model hit its token limit");
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
