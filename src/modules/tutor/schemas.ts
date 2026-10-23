import { z } from "zod";

// These schemas are sent to Claude as structured-output formats, so they avoid
// constraints the JSON-schema subset may not support (min/max items etc.).
// Ranges are enforced afterwards in `normalizePlan`.

export const StepSchema = z.object({
  goal: z.string().describe("Short label for this micro-step shown on the student's mission map (max ~8 words)"),
  prompt: z.string().describe("The question Progga asks the student for this step. Never contains the answer."),
  expected: z.string().describe("The answer or key idea the student should produce for this step. Hidden from the student."),
  options: z
    .array(z.string())
    .describe("Exactly 4 short plain-text answer choices the student can tap instead of typing: exactly ONE is correct (matches 'expected'), the other 3 are believable common mistakes. For open-ended steps: 4 sentence starters or sample answers ending with '…'."),
  hints: z.array(z.string()).describe("Exactly 3 hints, from a gentle nudge to a strong scaffold. None may state the step's answer."),
  why: z.string().describe("1-2 sentences explaining WHY this step works, shown after the student gets it right."),
  explain: z
    .string()
    .describe("Shown when the student is stuck: a warm 3-5 sentence explanation that teaches the idea/method of this step with a worked mini-example using DIFFERENT numbers. Never states this step's answer."),
});

export const PlanSchema = z.object({
  safety: z.enum(["ok", "off_topic", "unsafe", "wellbeing"]),
  safety_reply: z.string().describe("Kind, age-appropriate reply when safety is not 'ok'. Empty string when ok."),
  mode: z.enum(["problem", "concept", "fact"]),
  title: z.string().describe("Short friendly title for this session, max 6 words"),
  topic: z.string().describe("Curriculum topic, e.g. 'Linear equations' or 'Photosynthesis'"),
  big_idea: z.string().describe("The core concept in one kid-friendly sentence"),
  intro: z.string().describe("Warm 1-3 sentence opener that restates the problem and invites the student in. Does not solve anything."),
  steps: z.array(StepSchema),
  final_answer: z.string().describe("The complete final answer. Hidden; used only to check the student's work."),
  recap: z.string().describe("2-4 bullet recap of the method, shown only after the student finishes"),
  practice_problem: z.string().describe("One similar problem for the student to try on their own"),
  // "fact" mode only (empty otherwise)
  answer: z.string().describe("fact mode: the direct answer in 1-2 sentences, key answer in bold. Empty otherwise."),
  more_info: z.array(z.string()).describe("fact mode: 2-4 short interesting points of extra context. Empty otherwise."),
  fun_fact: z.string().describe("fact mode: one surprising 'Did you know?' fact. Empty otherwise."),
  explore_next: z.array(z.string()).describe("fact mode: 2-3 follow-up questions the student might ask next. Empty otherwise."),
});

export const EvalSchema = z.object({
  verdict: z.enum(["correct", "partial", "incorrect", "stuck", "asks_for_answer", "question", "off_topic", "wellbeing"]),
  feedback: z.string().describe("1-3 short sentences reacting to the student's reply. Never reveals the step answer or final answer."),
  follow_up: z.string().describe("When not correct: a smaller guiding question that moves the student forward. Empty string when correct."),
  misconception: z.string().describe("Short internal note of the misconception, for the teacher dashboard. Empty if none."),
});

export type Step = z.infer<typeof StepSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type Evaluation = z.infer<typeof EvalSchema>;

export interface StepProgress {
  attempts: number;
  wrong: number;
  hintsShown: number;
  revealed: boolean;
  solved: boolean;
  /** Times Progga stepped in because the student was stuck (missing on older sessions). */
  helped?: number;
}

export const MAX_STEPS = 8;
export const MAX_OPTIONS = 4;

/**
 * Answer choices are pasted into the student's reply box, so they must be plain
 * text. Shuffled here so the right one isn't always where the model put it.
 */
function cleanOptions(options: string[] | undefined): string[] {
  const unique = [...new Set((options ?? []).map((o) => o.replace(/\$/g, "").trim()).filter(Boolean))].slice(0, MAX_OPTIONS);
  if (unique.length < 2) return [];
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique;
}

/** Enforce the shape rules the JSON schema can't express. */
export function normalizePlan(plan: Plan): Plan {
  // A "fact" plan without an answer is useless; a guided plan without steps can't be guided.
  if (plan.mode === "fact" && !plan.answer.trim()) plan = { ...plan, mode: "concept" };
  if (plan.mode !== "fact" && plan.steps.length === 0 && plan.answer.trim()) plan = { ...plan, mode: "fact" };

  if (plan.mode === "fact") {
    return {
      ...plan,
      steps: [],
      final_answer: plan.final_answer || plan.answer,
      more_info: plan.more_info.slice(0, 4),
      explore_next: plan.explore_next.slice(0, 3),
    };
  }
  const steps = plan.steps.slice(0, MAX_STEPS).map((s) => ({
    ...s,
    options: cleanOptions(s.options),
    hints: (s.hints.length ? s.hints : ["Let's slow down and re-read the question together. What is it asking?"]).slice(0, 3),
    explain: s.explain ?? "",
  }));
  return { ...plan, steps, more_info: [], explore_next: [] };
}
