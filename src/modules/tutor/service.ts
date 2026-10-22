import type { Prisma, TutorSession } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { dayKey, dayStartUtc } from "../../lib/dates";
import { badRequest, notFound, tooMany } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { award, type Rewards } from "../gamification/service";
import { relatedLessons } from "../lessons/related";
import {
  applyEvaluation,
  canRevealStep,
  newProgress,
  nextHint,
  openingMessages,
  revealStep,
  soundsStuck,
  type OutMessage,
  type SessionState,
} from "./engine";
import { tutorLLM } from "./llm";
import type { PlanInput } from "./llm/types";
import { screenInput } from "./safety";
import type { Plan, StepProgress } from "./schemas";

const RECENT_MESSAGES = 8;

// ── Mapping ──────────────────────────────────────────────

function toState(s: TutorSession): SessionState {
  return {
    plan: s.plan as unknown as Plan,
    progress: s.progress as unknown as StepProgress[],
    currentStep: s.currentStep,
    hintsUsed: s.hintsUsed,
    wrongAttempts: s.wrongAttempts,
    status: s.status as SessionState["status"],
  };
}

/**
 * The ONLY shape of a session that leaves the server. Expected answers,
 * unseen hints and the final answer stay hidden. Future step goals are locked
 * so the mission map doesn't give the method away.
 */
function publicView(s: TutorSession) {
  const st = toState(s);
  return {
    id: s.id,
    title: s.title,
    topic: s.topic,
    subject: s.subject,
    grade: s.grade,
    mode: s.mode,
    status: s.status,
    problemText: s.problemText,
    hadImage: s.hadImage,
    currentStep: s.currentStep,
    totalSteps: st.plan.steps.length,
    hintsUsed: s.hintsUsed,
    xpEarned: s.xpEarned,
    createdAt: s.createdAt,
    canRevealStep: canRevealStep(st),
    bigIdea: s.status === "solved" ? st.plan.big_idea : null,
    steps: st.plan.steps.map((step, i) => {
      const p = st.progress[i];
      const state = p.solved ? (p.revealed ? "revealed" : "done") : i === s.currentStep && s.status === "active" ? "current" : "locked";
      return {
        index: i,
        goal: state === "locked" ? null : step.goal,
        state,
        // answer choices only for the step being worked on (older plans have none)
        options: state === "current" ? step.options ?? [] : [],
        hintsShown: p.hintsShown,
        hintsTotal: step.hints.length,
      };
    }),
  };
}

async function loadOwned(studentId: string, id: string) {
  const s = await prisma.tutorSession.findUnique({ where: { id } });
  if (!s || s.studentId !== studentId) throw notFound("Session not found");
  return s;
}

async function saveMessages(sessionId: string, role: "student" | "tutor", msgs: OutMessage[]) {
  const created = [];
  for (const m of msgs) {
    created.push(
      await prisma.tutorMessage.create({
        data: { sessionId, role, kind: m.kind, content: m.content, stepIndex: m.stepIndex, meta: (m.meta ?? undefined) as Prisma.InputJsonValue },
      }),
    );
  }
  return created;
}

async function persistState(id: string, state: SessionState, xpGained: number) {
  return prisma.tutorSession.update({
    where: { id },
    data: {
      progress: state.progress as unknown as Prisma.InputJsonValue,
      currentStep: state.currentStep,
      hintsUsed: state.hintsUsed,
      wrongAttempts: state.wrongAttempts,
      status: state.status,
      xpEarned: { increment: xpGained },
    },
  });
}

/**
 * The first time Progga teaches or shows a step in a session, attach our
 * recorded lessons on the topic so the student can watch it explained.
 */
async function withVideos(s: TutorSession, msgs: OutMessage[]): Promise<OutMessage[]> {
  const first = msgs.findIndex((m) => m.kind === "teach" || m.kind === "reveal");
  if (first < 0) return msgs;
  const already = await prisma.tutorMessage.count({ where: { sessionId: s.id, kind: { in: ["teach", "reveal"] } } });
  if (already) return msgs;
  const plan = s.plan as unknown as Plan;
  const step = plan.steps[msgs[first].stepIndex ?? s.currentStep];
  const videos = await relatedLessons({ subject: s.subject, grade: s.grade, text: `${plan.topic} ${s.title} ${s.problemText} ${step?.goal ?? ""}` });
  if (!videos.length) return msgs;
  return msgs.map((m, i) => (i === first ? { ...m, meta: { ...m.meta, videos } } : m));
}

async function logSafety(userId: string, category: string, excerpt: string) {
  await prisma.safetyEvent.create({ data: { userId, category, excerpt: excerpt.slice(0, 280) } });
}

// ── Use cases ────────────────────────────────────────────

export async function startSession(
  studentId: string,
  input: { question: string; subject: string; image?: PlanInput["image"] },
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: studentId } });

  const startedToday = await prisma.tutorSession.count({
    where: { studentId, createdAt: { gte: dayStartUtc(dayKey()) } },
  });
  if (startedToday >= user.dailyTutorLimit) {
    throw tooMany(
      user.language === "bn"
        ? `আজ তুমি ${user.dailyTutorLimit}টা প্রশ্ন নিয়ে কাজ করেছ — দারুণ! এবার একটু বিরতি নাও, একটা ভিডিও দেখো বা কুইজ খেলো। 🍌`
        : `You've explored ${user.dailyTutorLimit} problems today — amazing! Take a break, watch a lesson, or play Quiz Arena. 🍌`,
    );
  }

  if (!input.question.trim() && !input.image) throw badRequest("Type a question or add a photo");
  const screened = screenInput(input.question, user.language);
  if (!screened.ok) {
    await logSafety(studentId, screened.category, screened.text);
    return { blocked: true as const, category: screened.category, message: screened.reply };
  }

  const profile = { grade: user.grade ?? 6, language: user.language, subject: input.subject };
  const plan = await tutorLLM.plan({ profile, question: screened.text, image: input.image });

  if (plan.safety !== "ok" || (plan.mode !== "fact" && plan.steps.length === 0)) {
    if (plan.safety !== "ok" && plan.safety !== "off_topic") await logSafety(studentId, plan.safety, screened.text);
    return {
      blocked: true as const,
      category: plan.safety,
      message: plan.safety_reply || "Let's try a school question together! 🍌",
    };
  }

  const session = await prisma.tutorSession.create({
    data: {
      studentId,
      subject: input.subject,
      grade: profile.grade,
      mode: plan.mode,
      language: user.language,
      // a fact is answered immediately, so the session is complete from the start
      status: plan.mode === "fact" ? "solved" : "active",
      title: plan.title || "New adventure",
      topic: plan.topic,
      problemText: screened.text || "(photo)",
      hadImage: !!input.image,
      plan: plan as unknown as Prisma.InputJsonValue,
      progress: newProgress(plan) as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.tutorMessage.create({
    data: { sessionId: session.id, role: "student", kind: "text", content: screened.text || (user.language === "bn" ? "📷 (প্রশ্নের ছবি পাঠিয়েছি)" : "📷 (sent a photo of the problem)") },
  });
  await saveMessages(session.id, "tutor", openingMessages(plan));
  return { blocked: false as const, session: await getSession(studentId, session.id) };
}

export async function getSession(studentId: string, id: string) {
  const s = await loadOwned(studentId, id);
  const messages = await prisma.tutorMessage.findMany({ where: { sessionId: id }, orderBy: { createdAt: "asc" } });
  return { ...publicView(s), messages: messages.map(publicMessage) };
}

function publicMessage(m: { id: string; role: string; kind: string; content: string; stepIndex: number | null; meta: unknown; createdAt: Date }) {
  const meta = (m.meta ?? {}) as Record<string, unknown>;
  // misconception notes are for guardians/teachers, not the student
  const { misconception: _hidden, ...visible } = meta;
  return { id: m.id, role: m.role, kind: m.kind, content: m.content, stepIndex: m.stepIndex, meta: visible, createdAt: m.createdAt };
}

export async function listSessions(studentId: string, limit = 30) {
  const rows = await prisma.tutorSession.findMany({
    where: { studentId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, title: true, subject: true, topic: true, status: true, mode: true, currentStep: true, xpEarned: true, updatedAt: true, plan: true },
  });
  return rows.map(({ plan, ...r }) => ({ ...r, totalSteps: (plan as unknown as Plan).steps.length }));
}

type ActionResult = { session: Awaited<ReturnType<typeof getSession>>; newMessages: ReturnType<typeof publicMessage>[]; rewards: Rewards | null };

/**
 * The student switched language mid-session: translate the rest of the hidden
 * plan once (steps, hints, "why"), so everything after the switch matches.
 */
async function inLanguage(s: TutorSession, language: string): Promise<TutorSession> {
  if (s.language === language || s.status !== "active") return s;
  try {
    const plan = await tutorLLM.translatePlan(s.plan as unknown as Plan, language);
    return await prisma.tutorSession.update({ where: { id: s.id }, data: { plan: plan as unknown as Prisma.InputJsonValue, language } });
  } catch (err) {
    logger.warn({ err: (err as Error).message, sessionId: s.id }, "Plan translation failed; continuing in the original language");
    return s;
  }
}

export async function reply(studentId: string, id: string, raw: string): Promise<ActionResult> {
  let s = await loadOwned(studentId, id);
  if (s.status !== "active") throw badRequest("This adventure is finished — start a new one!");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: studentId } });
  s = await inLanguage(s, user.language);

  const screened = screenInput(raw, user.language);
  const studentMsg = await saveMessages(id, "student", [{ kind: "text", content: screened.text, stepIndex: s.currentStep }]);

  if (!screened.ok) {
    await logSafety(studentId, screened.category, screened.text);
    const tutorMsgs = await saveMessages(id, "tutor", [{ kind: "safety", content: screened.reply, stepIndex: s.currentStep }]);
    return { session: await getSession(studentId, id), newMessages: [...studentMsg, ...tutorMsgs].map(publicMessage), rewards: null };
  }

  const state = toState(s);
  const recent = await prisma.tutorMessage.findMany({ where: { sessionId: id }, orderBy: { createdAt: "desc" }, take: RECENT_MESSAGES + 1 });
  const evaluation = soundsStuck(screened.text)
    ? { verdict: "stuck" as const, feedback: "", follow_up: "", misconception: "" }
    : await tutorLLM.evaluate({
        profile: { grade: s.grade, language: user.language, subject: s.subject },
        problem: s.problemText,
        plan: state.plan,
        stepIndex: state.currentStep,
        step: state.plan.steps[state.currentStep],
        recent: recent
          .slice(1) // skip the reply we just stored
          .reverse()
          .map((m) => ({ role: m.role as "student" | "tutor", content: m.content })),
        reply: screened.text,
      });

  const t = applyEvaluation(state, evaluation, user.language);
  if (t.safetyCategory === "wellbeing") await logSafety(studentId, "wellbeing", screened.text);

  const gained = t.xp.reduce((sum, e) => sum + e.amount, 0);
  const outgoing = await withVideos(s, t.messages);
  await persistState(id, t.state, gained);
  const tutorMsgs = await saveMessages(id, "tutor", outgoing);
  const rewards = t.xp.length ? await award(studentId, t.xp.map((e) => ({ ...e, refId: id })), { hintFreeSolve: t.hintFreeSolve }) : null;

  return { session: await getSession(studentId, id), newMessages: [...studentMsg, ...tutorMsgs].map(publicMessage), rewards };
}

export async function hint(studentId: string, id: string): Promise<ActionResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { language: true } });
  const s = await inLanguage(await loadOwned(studentId, id), user.language);
  const r = nextHint(toState(s));
  if (!r) throw badRequest("No more hints for this step — try your best guess, or ask Progga to show this step.");
  await persistState(id, r.state, 0);
  const msgs = await saveMessages(id, "tutor", [r.message]);
  return { session: await getSession(studentId, id), newMessages: msgs.map(publicMessage), rewards: null };
}

export async function reveal(studentId: string, id: string): Promise<ActionResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { language: true } });
  const s = await inLanguage(await loadOwned(studentId, id), user.language);
  const t = revealStep(toState(s), user.language);
  if (!t) throw badRequest("Try the hints first — you might crack it! 💪");
  const gained = t.xp.reduce((sum, e) => sum + e.amount, 0);
  const outgoing = await withVideos(s, t.messages);
  await persistState(id, t.state, gained);
  const msgs = await saveMessages(id, "tutor", outgoing);
  const rewards = t.xp.length ? await award(studentId, t.xp.map((e) => ({ ...e, refId: id }))) : null;
  return { session: await getSession(studentId, id), newMessages: msgs.map(publicMessage), rewards };
}

export async function abandon(studentId: string, id: string) {
  const s = await loadOwned(studentId, id);
  if (s.status === "active") await prisma.tutorSession.update({ where: { id }, data: { status: "abandoned" } });
  return getSession(studentId, id);
}
