import { Router } from "express";
import type { Prisma, QuizAttempt } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { badRequest, notFound } from "../../lib/errors";
import { authed, requireAuth, requireRole } from "../../middleware/auth";
import { XP } from "../gamification/catalog";
import { award } from "../gamification/service";

export const quizRouter = Router();
quizRouter.use(requireAuth, requireRole("STUDENT"));

const ROUND_SIZE = 8;
const START_HEARTS = 3;
const SPEED_WINDOW_MS = 15_000;

interface Answer {
  questionId: string;
  choice: number;
  correct: boolean;
  ms: number;
  points: number;
}

/** Points = 100 base + up to 50 speed bonus, multiplied by the combo (max ×2). */
export function scoreAnswer(correct: boolean, ms: number, combo: number): number {
  if (!correct) return 0;
  const speed = Math.round(50 * Math.max(0, 1 - ms / SPEED_WINDOW_MS));
  const multiplier = Math.min(2, 1 + 0.2 * combo);
  return Math.round((100 + speed) * multiplier);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function attemptView(a: QuizAttempt) {
  const answers = a.answers as unknown as Answer[];
  return {
    id: a.id,
    subjectId: a.subjectId,
    total: (a.questionIds as string[]).length,
    answered: answers.length,
    correctCount: a.correctCount,
    score: a.score,
    combo: a.combo,
    bestCombo: a.bestCombo,
    hearts: a.hearts,
    finished: !!a.finishedAt,
  };
}

const StartBody = z.object({ subjectId: z.string().min(1), grade: z.coerce.number().int().min(3).max(12).optional() });

quizRouter.post("/start", async (req, res) => {
  const userId = authed(req).id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const { subjectId, grade: g } = StartBody.parse(req.body);
  const grade = g ?? user.grade ?? 6;

  // Prefer the student's class, widen to neighbours if the bank is thin.
  let pool = await prisma.quizQuestion.findMany({ where: { subjectId, grade } });
  if (pool.length < ROUND_SIZE) {
    pool = await prisma.quizQuestion.findMany({ where: { subjectId, grade: { gte: grade - 2, lte: grade + 1 } } });
  }
  if (pool.length === 0) throw notFound("No quiz questions for this subject yet — check back soon!");

  const questions = shuffle(pool).slice(0, ROUND_SIZE);
  const attempt = await prisma.quizAttempt.create({
    data: {
      userId,
      subjectId,
      grade,
      questionIds: questions.map((q) => q.id) as unknown as Prisma.InputJsonValue,
      answers: [] as unknown as Prisma.InputJsonValue,
      hearts: START_HEARTS,
    },
  });

  res.status(201).json({
    attempt: attemptView(attempt),
    questions: questions.map((q) => ({ id: q.id, topic: q.topic, prompt: q.prompt, options: q.options, difficulty: q.difficulty })),
  });
});

const AnswerBody = z.object({
  questionId: z.string().min(1),
  choice: z.coerce.number().int().min(-1), // -1 = timed out
  ms: z.coerce.number().int().min(0).max(120_000),
});

quizRouter.post("/:attemptId/answer", async (req, res) => {
  const userId = authed(req).id;
  const attempt = await prisma.quizAttempt.findUnique({ where: { id: req.params.attemptId as string } });
  if (!attempt || attempt.userId !== userId) throw notFound("Quiz not found");
  if (attempt.finishedAt) throw badRequest("This round is over");

  const body = AnswerBody.parse(req.body);
  const ids = attempt.questionIds as string[];
  const answers = attempt.answers as unknown as Answer[];
  if (ids[answers.length] !== body.questionId) throw badRequest("Answer the current question");

  const q = await prisma.quizQuestion.findUniqueOrThrow({ where: { id: body.questionId } });
  const correct = body.choice === q.answerIndex;
  const combo = correct ? attempt.combo + 1 : 0;
  const points = scoreAnswer(correct, body.ms, attempt.combo);
  const hearts = correct ? attempt.hearts : attempt.hearts - 1;
  const nextAnswers = [...answers, { questionId: q.id, choice: body.choice, correct, ms: body.ms, points }];
  const finished = nextAnswers.length >= ids.length || hearts <= 0;

  const updated = await prisma.quizAttempt.update({
    where: { id: attempt.id },
    data: {
      answers: nextAnswers as unknown as Prisma.InputJsonValue,
      combo,
      bestCombo: Math.max(attempt.bestCombo, combo),
      hearts,
      score: attempt.score + points,
      correctCount: attempt.correctCount + (correct ? 1 : 0),
      finishedAt: finished ? new Date() : null,
    },
  });

  let rewards = null;
  let summary = null;
  if (finished) {
    const perfect = updated.correctCount === ids.length;
    rewards = await award(
      userId,
      [
        ...Array.from({ length: updated.correctCount }, () => ({ amount: XP.quizCorrect, reason: "quiz_correct" as const, refId: attempt.id })),
        { amount: XP.quizFinish + (perfect ? XP.quizPerfectBonus : 0), reason: "quiz_finish", refId: attempt.id },
      ],
      { perfectQuiz: perfect, combo: updated.bestCombo },
    );
    summary = { perfect, accuracy: updated.correctCount / ids.length, outOfHearts: hearts <= 0 && nextAnswers.length < ids.length };
  }

  res.json({
    correct,
    answerIndex: q.answerIndex,
    explanation: q.explanation,
    points,
    attempt: attemptView(updated),
    rewards,
    summary,
  });
});

quizRouter.get("/history", async (req, res) => {
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: authed(req).id, finishedAt: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  res.json({ attempts: attempts.map(attemptView) });
});
