import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { badRequest, conflict, notFound } from "../../lib/errors";
import { authed, requireAuth, requireRole } from "../../middleware/auth";
import { XP } from "../gamification/catalog";
import { award } from "../gamification/service";
import { lessonCard } from "./presenter";

export const lessonsRouter = Router();
lessonsRouter.use(requireAuth);

interface Checkpoint {
  atSec: number;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

/** Students must watch this share of a video before completing it. */
const COMPLETE_RATIO = 0.8;

const ListQuery = z.object({
  subject: z.string().optional(),
  grade: z.coerce.number().int().min(3).max(12).optional(),
  q: z.string().trim().max(60).optional(),
});

lessonsRouter.get("/", async (req, res) => {
  const { subject, grade, q } = ListQuery.parse(req.query);
  const userId = authed(req).id;
  const lessons = await prisma.lesson.findMany({
    where: {
      subjectId: subject || undefined,
      grade: grade || undefined,
      OR: q ? [{ title: { contains: q } }, { chapter: { contains: q } }] : undefined,
    },
    include: { subject: true, progress: { where: { userId } } },
    orderBy: [{ grade: "asc" }, { subjectId: "asc" }, { order: "asc" }],
  });
  res.json({
    lessons: lessons.map((l) => ({
      ...lessonCard(l),
      progress: l.progress[0] ? Math.min(1, l.progress[0].watchedSec / l.durationSec) : 0,
      completed: l.progress[0]?.completed ?? false,
    })),
  });
});

async function loadLesson(id: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id }, include: { subject: true } });
  if (!lesson) throw notFound("Lesson not found");
  return lesson;
}

async function progressFor(userId: string, lessonId: string) {
  return prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId },
    update: {},
  });
}

lessonsRouter.get("/:id", async (req, res) => {
  const userId = authed(req).id;
  const lesson = await loadLesson(req.params.id as string);
  const progress = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId: lesson.id } } });
  const checkpoints = lesson.checkpoints as unknown as Checkpoint[];
  const correct = (progress?.checkpointsCorrect as number[] | undefined) ?? [];
  const related = await prisma.lesson.findMany({
    where: { subjectId: lesson.subjectId, grade: lesson.grade, id: { not: lesson.id } },
    include: { subject: true },
    orderBy: { order: "asc" },
    take: 4,
  });

  res.json({
    lesson: {
      ...lessonCard(lesson),
      description: lesson.description,
      provider: lesson.provider,
      videoUrl: lesson.videoUrl,
      // answers stay on the server
      checkpoints: checkpoints.map((c, i) => ({ index: i, atSec: c.atSec, question: c.question, options: c.options, answered: correct.includes(i) })),
    },
    progress: { watchedSec: progress?.watchedSec ?? 0, completed: progress?.completed ?? false, canComplete: (progress?.watchedSec ?? 0) >= lesson.durationSec * COMPLETE_RATIO },
    related: related.map(lessonCard),
  });
});

const ProgressBody = z.object({ watchedSec: z.coerce.number().int().min(0) });

lessonsRouter.post("/:id/progress", requireRole("STUDENT"), async (req, res) => {
  const userId = authed(req).id;
  const lesson = await loadLesson(req.params.id as string);
  const { watchedSec } = ProgressBody.parse(req.body);
  const current = await progressFor(userId, lesson.id);
  // progress only moves forward and never past the end
  const next = Math.min(lesson.durationSec, Math.max(current.watchedSec, watchedSec));
  const updated = await prisma.lessonProgress.update({ where: { id: current.id }, data: { watchedSec: next } });
  res.json({ watchedSec: updated.watchedSec, canComplete: updated.watchedSec >= lesson.durationSec * COMPLETE_RATIO });
});

const CheckpointBody = z.object({ choice: z.coerce.number().int().min(0) });

lessonsRouter.post("/:id/checkpoints/:index", requireRole("STUDENT"), async (req, res) => {
  const userId = authed(req).id;
  const lesson = await loadLesson(req.params.id as string);
  const index = Number(req.params.index);
  const cp = (lesson.checkpoints as unknown as Checkpoint[])[index];
  if (!cp) throw notFound("Checkpoint not found");
  const { choice } = CheckpointBody.parse(req.body);
  const correct = choice === cp.answerIndex;

  const progress = await progressFor(userId, lesson.id);
  const done = (progress.checkpointsCorrect as number[]) ?? [];
  let rewards = null;
  if (correct && !done.includes(index)) {
    await prisma.lessonProgress.update({
      where: { id: progress.id },
      data: { checkpointsCorrect: [...done, index] as unknown as Prisma.InputJsonValue },
    });
    rewards = await award(userId, [{ amount: XP.checkpoint, reason: "checkpoint", refId: `${lesson.id}:${index}` }]);
  }
  // On a wrong answer we only send the explanation, so the student can rewatch and retry.
  res.json({ correct, explanation: cp.explanation, answerIndex: correct ? cp.answerIndex : null, rewards });
});

lessonsRouter.post("/:id/complete", requireRole("STUDENT"), async (req, res) => {
  const userId = authed(req).id;
  const lesson = await loadLesson(req.params.id as string);
  const progress = await progressFor(userId, lesson.id);
  if (progress.completed) throw conflict("Lesson already completed");
  if (progress.watchedSec < lesson.durationSec * COMPLETE_RATIO) throw badRequest("Watch a bit more of the video first! 🎬");
  await prisma.lessonProgress.update({ where: { id: progress.id }, data: { completed: true } });
  const rewards = await award(userId, [{ amount: lesson.xpReward, reason: "lesson_complete", refId: lesson.id }]);
  res.json({ completed: true, rewards });
});
