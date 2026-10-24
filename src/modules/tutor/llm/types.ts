import type { Evaluation, Plan, Step, Syllabus } from "../schemas";

export interface StudentProfile {
  grade: number;
  language: string;
  subject: string;
}

export interface PlanInput {
  profile: StudentProfile;
  question: string;
  image?: { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string };
  /** the video lesson the student asked from, if any */
  lesson?: StudiedLesson;
  /** "Start a lesson": teach this syllabus topic from scratch instead of answering a question */
  learn?: { topic: string; chapter?: string };
}

export interface SyllabusInput {
  grade: number;
  subject: string;
  language: string;
}

export interface StudiedLesson {
  title: string;
  chapter: string;
  description: string;
  /** start of the written notes (Markdown), may be empty */
  notes: string;
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
  /** The NCTB chapters and topics for a class + subject. */
  syllabus(input: SyllabusInput): Promise<Syllabus>;
}
