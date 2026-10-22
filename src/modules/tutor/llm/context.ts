// Builds the per-request user message for every provider, so Claude and
// DeepSeek see exactly the same lesson context.
import { LANGUAGE_LABEL, gradeBand } from "../prompts";
import type { Evaluation, Plan, Step } from "../schemas";
import type { EvalInput, PlanInput, StudentProfile } from "./types";

/** Used when a provider declines or filters a question. */
export const refusedPlan = (p: StudentProfile): Plan => ({
  safety: "unsafe",
  safety_reply:
    p.language === "bn"
      ? "এই প্রশ্নে আমি সাহায্য করতে পারব না। চলো পড়াশোনার কোনো প্রশ্ন নিয়ে কাজ করি! 🍌"
      : "That's not something I can help with. Let's pick a school question to explore together! 🍌",
  mode: "concept",
  title: "",
  topic: "",
  big_idea: "",
  intro: "",
  steps: [],
  final_answer: "",
  recap: "",
  practice_problem: "",
  answer: "",
  more_info: [],
  fun_fact: "",
  explore_next: [],
});

export const translateText = (plan: Plan, language: string) =>
  `<target_language>${language}</target_language>\n<plan>\n${JSON.stringify(plan)}\n</plan>`;

/**
 * Accept a translated plan only if its shape is intact, and always restore the
 * hidden fields from the original so a translation can never change the answers.
 */
export function mergeTranslation(original: Plan, translated: Plan): Plan {
  const sameShape =
    translated.steps.length === original.steps.length &&
    translated.steps.every((s, i) => s.hints.length === original.steps[i].hints.length);
  if (!sameShape) return original;
  return {
    ...translated,
    safety: original.safety,
    mode: original.mode,
    topic: original.topic,
    final_answer: original.final_answer,
    steps: translated.steps.map((s, i) => ({ ...s, expected: original.steps[i].expected })),
  };
}

/** Safe fallback when a reply can't be graded: keep the student on the current step. */
export const offTrackEvaluation = (step: Step): Evaluation => ({
  verdict: "off_topic",
  feedback: "Hmm, let's keep our focus on the problem together. 🍌",
  follow_up: step.prompt,
  misconception: "",
});

export function profileBlock(p: StudentProfile): string {
  return [
    `<student_profile>`,
    `class: ${p.grade} — ${gradeBand(p.grade)}`,
    `language: ${LANGUAGE_LABEL[p.language] ?? LANGUAGE_LABEL.en}`,
    `subject: ${p.subject}`,
    `</student_profile>`,
  ].join("\n");
}

export function planText(input: PlanInput): string {
  return [
    profileBlock(input.profile),
    input.image ? "The student attached a photo of their question. Read it carefully and restate the problem in your intro." : "",
    `<student_question>\n${input.question || "(see photo)"}\n</student_question>`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function evalText(input: EvalInput): string {
  const { plan, step, stepIndex } = input;
  const solvedSoFar = plan.steps
    .slice(0, stepIndex)
    .map((s, i) => `${i + 1}. ${s.goal} → ${s.expected}`)
    .join("\n");

  return [
    profileBlock(input.profile),
    `<lesson_context>`,
    `problem: ${input.problem}`,
    `mode: ${plan.mode}; topic: ${plan.topic}`,
    `final_answer (secret): ${plan.final_answer}`,
    solvedSoFar ? `steps already completed:\n${solvedSoFar}` : "",
    `</lesson_context>`,
    `<current_step number="${stepIndex + 1}" of="${plan.steps.length}">`,
    `goal: ${step.goal}`,
    `question asked: ${step.prompt}`,
    `expected (secret): ${step.expected}`,
    `</current_step>`,
    `<recent_conversation>`,
    ...input.recent.map((m) => `${m.role === "student" ? "Student" : "Progga"}: ${m.content}`),
    `</recent_conversation>`,
    `<student_reply>\n${input.reply}\n</student_reply>`,
  ]
    .filter(Boolean)
    .join("\n");
}
