import type { Evaluation, Plan, Step } from "../schemas";

export interface StudentProfile {
  grade: number;
  language: string;
  subject: string;
}

export interface PlanInput {
  profile: StudentProfile;
  question: string;
  image?: { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string };
}

export interface EvalInput {
  profile: StudentProfile;
  problem: string;
  plan: Plan;
  stepIndex: number;
  step: Step;
  recent: { role: "student" | "tutor"; content: string }[];
  reply: string;
}

export interface TutorLLM {
  readonly name: string;
  readonly model: string;
  /** Whether homework photos can be sent to this engine. */
  readonly supportsImages: boolean;
  plan(input: PlanInput): Promise<Plan>;
  evaluate(input: EvalInput): Promise<Evaluation>;
  /** Re-localize an existing plan when the student switches language mid-session. */
  translatePlan(plan: Plan, language: string): Promise<Plan>;
}
