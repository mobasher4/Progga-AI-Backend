import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "../../../config/env";
import { HttpError } from "../../../lib/errors";
import { logger } from "../../../lib/logger";
import { EVALUATOR_SYSTEM, PLANNER_SYSTEM, SYLLABUS_SYSTEM, TRANSLATOR_SYSTEM, syllabusText } from "../prompts";
import { EvalSchema, PlanSchema, SyllabusSchema, normalizePlan, type Evaluation, type Plan, type Syllabus } from "../schemas";
import { evalText, mergeTranslation, offTrackEvaluation, planText, refusedPlan, translateText } from "./context";
import type { EvalInput, PlanInput, SyllabusInput, TutorLLM } from "./types";

// Server-side fallback: if a safety classifier declines, the API re-runs the
// request on a fallback model inside the same call.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class AnthropicTutor implements TutorLLM {
  readonly name = "anthropic";
  readonly supportsImages = true;
  private client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : new Anthropic();

  constructor(readonly model: string) {}

  async plan(input: PlanInput): Promise<Plan> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (input.image) {
      content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.base64 } });
    }
    content.push({ type: "text", text: planText(input) });

    const res = await this.call(() =>
      this.client.beta.messages.parse({
        model: this.model,
        max_tokens: 16000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: [{ type: "text", text: PLANNER_SYSTEM, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "medium", format: zodOutputFormat(PlanSchema) },
        messages: [{ role: "user", content }],
      }),
    );

    if (res.stop_reason === "refusal") return refusedPlan(input.profile);
    if (!res.parsed_output) throw new HttpError(502, "Progga got a bit confused. Please try again!", "llm_parse");
    return normalizePlan(res.parsed_output);
  }

  async evaluate(input: EvalInput): Promise<Evaluation> {
    const res = await this.call(() =>
      this.client.beta.messages.parse({
        model: this.model,
        max_tokens: 4000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: [{ type: "text", text: EVALUATOR_SYSTEM, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "low", format: zodOutputFormat(EvalSchema) },
        messages: [{ role: "user", content: evalText(input) }],
      }),
    );

    if (res.stop_reason === "refusal" || !res.parsed_output) return offTrackEvaluation(input.step);
    return res.parsed_output;
  }

  async translatePlan(plan: Plan, language: string): Promise<Plan> {
    const res = await this.call(() =>
      this.client.beta.messages.parse({
        model: this.model,
        max_tokens: 16000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: [{ type: "text", text: TRANSLATOR_SYSTEM, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "low", format: zodOutputFormat(PlanSchema) },
        messages: [{ role: "user", content: translateText(plan, language) }],
      }),
    );
    if (res.stop_reason === "refusal" || !res.parsed_output) return plan;
    return mergeTranslation(plan, normalizePlan(res.parsed_output));
  }

  async syllabus({ grade, subject, language }: SyllabusInput): Promise<Syllabus> {
    const res = await this.call(() =>
      this.client.beta.messages.parse({
        model: this.model,
        max_tokens: 8000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: [{ type: "text", text: SYLLABUS_SYSTEM, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "low", format: zodOutputFormat(SyllabusSchema) },
        messages: [{ role: "user", content: syllabusText(grade, subject, language) }],
      }),
    );
    if (!res.parsed_output) throw new HttpError(502, "Progga couldn't open the syllabus. Please try again!", "llm_parse");
    return res.parsed_output;
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof Anthropic.NotFoundError) {
        throw new HttpError(503, "That Claude model isn't available. Ask an admin to pick another one.", "llm_model");
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new HttpError(503, "Lots of students are learning right now! Try again in a moment.", "llm_busy");
      }
      if (err instanceof Anthropic.AuthenticationError) {
        logger.error("Anthropic authentication failed — check ANTHROPIC_API_KEY");
        throw new HttpError(503, "Progga's brain is offline right now.", "llm_auth");
      }
      if (err instanceof Anthropic.APIError) {
        logger.error({ status: err.status, msg: err.message }, "Anthropic API error");
        throw new HttpError(502, "Progga couldn't think that through. Please try again.", "llm_error");
      }
      throw err;
    }
  }
}
