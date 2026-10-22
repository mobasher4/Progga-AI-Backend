import { XP, type XpReason } from "../gamification/catalog";
import type { Evaluation, Plan, StepProgress } from "./schemas";
import { leaksAnswer } from "./safety";

// Pure state machine for a tutoring session. No I/O — easy to unit-test.
// The service layer persists whatever this returns.

export type MsgKind = "text" | "question" | "hint" | "teach" | "feedback" | "why" | "celebrate" | "recap" | "reveal" | "safety" | "answer";

export interface OutMessage {
  kind: MsgKind;
  content: string;
  stepIndex?: number;
  meta?: Record<string, unknown>;
}

export interface SessionState {
  plan: Plan;
  progress: StepProgress[];
  currentStep: number;
  hintsUsed: number;
  wrongAttempts: number;
  status: "active" | "solved" | "abandoned";
}

export interface Transition {
  state: SessionState;
  messages: OutMessage[];
  xp: { amount: number; reason: XpReason }[];
  hintFreeSolve: boolean;
  safetyCategory?: "wellbeing" | "off_topic";
}

/** Wrong answers on a step before Progga proactively suggests a hint. */
export const SUGGEST_HINT_AFTER = 2;
/** Wrong answers needed (with all hints used) before "show me this step" unlocks. */
export const REVEAL_AFTER_WRONG = 2;
/** From this many wrong answers on a step, Progga stops nudging and starts teaching. */
export const TEACH_AFTER_WRONG = 2;

const STUCK_RE =
  /\b(can['’]?t|cannot|can not)\b|\bi (don['’]?t|do not) (know|understand|get)|\b(help|stuck|confused|no idea|idk)\b|\b(pari ?na|parchi ?na|parbo ?na|bujhi ?na|bujhchi ?na|bujhte parchi ?na|jani ?na)\b|পারি না|পারছি না|পারব না|বুঝি না|বুঝছি না|বুঝতে পারছি না|জানি না|সাহায্য|হেল্প/i;

/** Short "I can't do it" / "help" replies, recognised without asking the AI. */
export const soundsStuck = (reply: string): boolean => reply.trim().length <= 80 && STUCK_RE.test(reply);

export const newProgress = (plan: Plan): StepProgress[] =>
  plan.steps.map(() => ({ attempts: 0, wrong: 0, hintsShown: 0, revealed: false, solved: false, helped: 0 }));

export function openingMessages(plan: Plan): OutMessage[] {
  // Facts can't be reasoned out — answer straight away, then widen the student's view.
  if (plan.mode === "fact") {
    return [
      {
        kind: "answer",
        content: plan.answer,
        meta: { moreInfo: plan.more_info, funFact: plan.fun_fact || undefined, explore: plan.explore_next, bigIdea: plan.big_idea || undefined },
      },
    ];
  }
  const out: OutMessage[] = plan.intro ? [{ kind: "text", content: plan.intro }] : [];
  if (plan.steps[0]) out.push({ kind: "question", content: plan.steps[0].prompt, stepIndex: 0 });
  return out;
}

export function canRevealStep(state: SessionState): boolean {
  const step = state.plan.steps[state.currentStep];
  const p = state.progress[state.currentStep];
  return !!step && !!p && state.status === "active" && p.hintsShown >= step.hints.length && p.wrong >= REVEAL_AFTER_WRONG;
}

const clone = (s: SessionState): SessionState => ({ ...s, progress: s.progress.map((p) => ({ ...p })) });

// Fixed tutor lines, in the student's chosen language (AI-written text is already localized by the prompt).
const TEXT = {
  en: {
    solvedClean: "🎉 You solved the WHOLE thing without a single hint. That's real thinking power!",
    solved: "🎉 You did it! Every step was your own brainwork.",
    practice: "**Try one on your own:**",
    leakGuard: "Let's figure this part out together — you're closer than you think!",
    reveal: (expected: string, why: string) => `Here's this step: **${expected}**\n\n💡 ${why}\n\nNo worries — now you've seen how it works. Let's keep going!`,
    stuck: "That's totally okay — being stuck is part of learning! Let's work through it together. 💪",
    nowTry: "**Now you try your step:**",
  },
  bn: {
    solvedClean: "🎉 একটাও হিন্ট ছাড়াই তুমি পুরোটা সমাধান করেছ। এটাই আসল চিন্তার শক্তি!",
    solved: "🎉 তুমি পেরেছ! প্রতিটা ধাপ তোমার নিজের মাথা খাটিয়ে করা।",
    practice: "**এবার নিজে একটা চেষ্টা করো:**",
    leakGuard: "চলো এই অংশটা একসাথে বের করি — তুমি যতটা ভাবছ তার চেয়ে অনেক কাছে আছ!",
    reveal: (expected: string, why: string) => `এই ধাপটা হলো: **${expected}**\n\n💡 ${why}\n\nচিন্তা নেই — এখন তুমি দেখলে কীভাবে কাজ করে। চলো এগিয়ে যাই!`,
    stuck: "একদম ঠিক আছে — আটকে যাওয়াও শেখার অংশ! চলো একসাথে বুঝে নিই। 💪",
    nowTry: "**এবার তোমার ধাপটা চেষ্টা করো:**",
  },
  mix: {
    solvedClean: "🎉 Ekta hint chara-i tumi puro ta solve korecho. Eta-i asol thinking power!",
    solved: "🎉 Tumi perecho! Protiti step tomar nijer brainwork.",
    practice: "**Ebar nije ekta try koro:**",
    leakGuard: "Cholo ei part ta ekshathe ber kori — tumi onek kache acho!",
    reveal: (expected: string, why: string) => `Ei step ta holo: **${expected}**\n\n💡 ${why}\n\nChinta nai — ekhon tumi dekhle kivabe kaj kore. Cholo egiye jai!`,
    stuck: "Ekdom thik ache — atke jawa-o shekhar part! Cholo ekshathe bujhe nei. 💪",
    nowTry: "**Ebar tomar step ta try koro:**",
  },
};
type Lang = keyof typeof TEXT;
const text = (lang: string) => TEXT[(lang in TEXT ? lang : "en") as Lang];

/** Moves to the next step or finishes the session. Shared by "correct" and "reveal". */
function advance(state: SessionState, messages: OutMessage[], xp: Transition["xp"], lang: string): boolean {
  const tx = text(lang);
  const next = state.currentStep + 1;
  if (next < state.plan.steps.length) {
    state.currentStep = next;
    messages.push({ kind: "question", content: state.plan.steps[next].prompt, stepIndex: next });
    return false;
  }
  // Finished the whole path 🎉
  state.status = "solved";
  const anyRevealed = state.progress.some((p) => p.revealed);
  const hintFreeSolve = state.hintsUsed === 0 && !anyRevealed;
  const bonus = Math.max(10, XP.tutorSolved - XP.tutorSolvedHintPenalty * state.hintsUsed - (anyRevealed ? 10 : 0));
  xp.push({ amount: bonus, reason: "tutor_solved" });
  messages.push({
    kind: "celebrate",
    content: hintFreeSolve ? tx.solvedClean : tx.solved,
    meta: { finalAnswer: state.plan.final_answer, bigIdea: state.plan.big_idea },
  });
  if (state.plan.recap) messages.push({ kind: "recap", content: state.plan.recap });
  if (state.plan.practice_problem) {
    messages.push({ kind: "text", content: `${tx.practice} ${state.plan.practice_problem}`, meta: { practice: state.plan.practice_problem } });
  }
  return hintFreeSolve;
}

/** Shows the current step's answer with its reasoning, then moves on. */
function showStep(state: SessionState, messages: OutMessage[], xp: Transition["xp"], lang: string): boolean {
  const i = state.currentStep;
  const step = state.plan.steps[i];
  state.progress[i].revealed = true;
  state.progress[i].solved = true;
  messages.push({ kind: "reveal", content: text(lang).reveal(step.expected, step.why), stepIndex: i });
  return advance(state, messages, xp, lang);
}

/** The step's teaching explanation, or a hint-based fallback for older plans or one that would leak the answer. */
function teachingFor(state: SessionState): string {
  const step = state.plan.steps[state.currentStep];
  const leaks = (s: string) => leaksAnswer(s, step.expected) || leaksAnswer(s, state.plan.final_answer);
  const explain = step.explain?.trim();
  if (explain && !leaks(explain)) return explain;
  return [step.hints[0], !leaks(step.why) ? step.why : ""].filter(Boolean).join("\n\n");
}

/**
 * Progga steps in when a student is stuck ("I can't", asks for help, keeps
 * missing): first a proper explanation, then the strongest hint, and if that
 * still isn't enough, it shows this step and carries on with the next one.
 */
function help(state: SessionState, messages: OutMessage[], xp: Transition["xp"], lang: string): boolean {
  const i = state.currentStep;
  const step = state.plan.steps[i];
  const p = state.progress[i];
  const helped = p.helped ?? 0;
  p.helped = helped + 1;

  if (helped === 0) {
    state.hintsUsed++;
    messages.push({ kind: "teach", content: teachingFor(state), stepIndex: i });
    messages.push({ kind: "question", content: `${text(lang).nowTry} ${step.prompt}`, stepIndex: i });
    return false;
  }
  if (p.hintsShown < step.hints.length) {
    p.hintsShown = step.hints.length;
    state.hintsUsed++;
    messages.push({ kind: "hint", content: step.hints[step.hints.length - 1], stepIndex: i, meta: { level: p.hintsShown, of: step.hints.length } });
    return false;
  }
  return showStep(state, messages, xp, lang);
}

export function applyEvaluation(prev: SessionState, ev: Evaluation, lang = "en"): Transition {
  const state = clone(prev);
  const i = state.currentStep;
  const step = state.plan.steps[i];
  const p = state.progress[i];
  const messages: OutMessage[] = [];
  const xp: Transition["xp"] = [];
  let hintFreeSolve = false;

  // Leak guard on anything the model wrote while the student hasn't got it yet.
  const safe = (msg: string) =>
    ev.verdict !== "correct" && (leaksAnswer(msg, step.expected) || leaksAnswer(msg, state.plan.final_answer))
      ? text(lang).leakGuard
      : msg;

  switch (ev.verdict) {
    case "correct": {
      p.attempts++;
      p.solved = true;
      xp.push({ amount: XP.tutorStep, reason: "tutor_step" });
      if (p.wrong === 0 && p.hintsShown === 0) xp.push({ amount: XP.tutorStepCleanBonus, reason: "tutor_step_clean" });
      messages.push({ kind: "feedback", content: ev.feedback, stepIndex: i, meta: { verdict: "correct" } });
      if (step.why) messages.push({ kind: "why", content: step.why, stepIndex: i });
      hintFreeSolve = advance(state, messages, xp, lang);
      break;
    }
    case "partial":
    case "incorrect": {
      p.attempts++;
      if (ev.verdict === "incorrect") {
        p.wrong++;
        state.wrongAttempts++;
      }
      messages.push({ kind: "feedback", content: safe(ev.feedback), stepIndex: i, meta: { verdict: ev.verdict, misconception: ev.misconception || undefined } });
      if (ev.verdict === "incorrect" && p.wrong >= TEACH_AFTER_WRONG) {
        hintFreeSolve = help(state, messages, xp, lang);
        break;
      }
      const suggestHint = p.wrong >= SUGGEST_HINT_AFTER && p.hintsShown < step.hints.length;
      if (ev.follow_up) messages.push({ kind: "question", content: safe(ev.follow_up), stepIndex: i, meta: { suggestHint } });
      break;
    }
    case "stuck":
    case "asks_for_answer": {
      messages.push({ kind: "feedback", content: ev.feedback ? safe(ev.feedback) : text(lang).stuck, stepIndex: i, meta: { verdict: ev.verdict } });
      hintFreeSolve = help(state, messages, xp, lang);
      break;
    }
    case "wellbeing":
      messages.push({ kind: "safety", content: ev.feedback, stepIndex: i });
      return { state, messages, xp, hintFreeSolve, safetyCategory: "wellbeing" };
    default: {
      // question | off_topic — no penalty, keep guiding
      messages.push({ kind: "feedback", content: safe(ev.feedback), stepIndex: i, meta: { verdict: ev.verdict } });
      if (ev.follow_up) messages.push({ kind: "question", content: safe(ev.follow_up), stepIndex: i });
      if (ev.verdict === "off_topic") return { state, messages, xp, hintFreeSolve, safetyCategory: "off_topic" };
    }
  }
  return { state, messages, xp, hintFreeSolve };
}

export function nextHint(prev: SessionState): { state: SessionState; message: OutMessage } | null {
  const state = clone(prev);
  const i = state.currentStep;
  const step = state.plan.steps[i];
  const p = state.progress[i];
  if (!step || state.status !== "active" || p.hintsShown >= step.hints.length) return null;
  const hint = step.hints[p.hintsShown];
  p.hintsShown++;
  state.hintsUsed++;
  return {
    state,
    message: { kind: "hint", content: hint, stepIndex: i, meta: { level: p.hintsShown, of: step.hints.length } },
  };
}

/**
 * Last-resort scaffold when a student is truly stuck: reveal ONE micro-step
 * (not the whole solution) with its reasoning, then continue the path so the
 * student still does the remaining steps.
 */
export function revealStep(prev: SessionState, lang = "en"): Transition | null {
  if (!canRevealStep(prev)) return null;
  const state = clone(prev);
  const messages: OutMessage[] = [];
  const xp: Transition["xp"] = [];
  const hintFreeSolve = showStep(state, messages, xp, lang);
  return { state, messages, xp, hintFreeSolve };
}
