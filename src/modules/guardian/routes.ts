import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { addDays, dayKey, dayStartUtc } from "../../lib/dates";
import { conflict, forbidden, notFound } from "../../lib/errors";
import { authed, requireAuth, requireRole } from "../../middleware/auth";
import { levelProgress } from "../gamification/levels";
import type { Plan, StepProgress } from "../tutor/schemas";

// Parents and teachers see progress, learning habits and safety alerts for
// the students who shared their link code with them.
export const guardianRouter = Router();
guardianRouter.use(requireAuth, requireRole("PARENT", "TEACHER", "ADMIN"));

async function assertLinked(guardianId: string, studentId: string) {
  const link = await prisma.guardianLink.findUnique({ where: { guardianId_studentId: { guardianId, studentId } } });
  if (!link) throw forbidden("This student isn't linked to your account");
}

guardianRouter.get("/students", async (req, res) => {
  const links = await prisma.guardianLink.findMany({
    where: { guardianId: authed(req).id },
    include: { student: true },
    orderBy: { createdAt: "asc" },
  });
  const weekAgo = dayStartUtc(addDays(dayKey(), -6));
  const students = await Promise.all(
    links.map(async ({ student: s }) => {
      const [weekXp, solved, alerts] = await Promise.all([
        prisma.xpEvent.aggregate({ where: { userId: s.id, createdAt: { gte: weekAgo } }, _sum: { amount: true } }),
        prisma.tutorSession.count({ where: { studentId: s.id, status: "solved", updatedAt: { gte: weekAgo } } }),
        prisma.safetyEvent.count({ where: { userId: s.id, category: { in: ["wellbeing", "unsafe"] }, createdAt: { gte: weekAgo } } }),
      ]);
      return {
        id: s.id,
        name: s.name,
        grade: s.grade,
        avatarSkin: s.avatarSkin,
        level: levelProgress(s.xp),
        streak: s.streakDays,
        lastActive: s.lastActiveDate,
        weekXp: weekXp._sum.amount ?? 0,
        weekSolved: solved,
        alerts,
      };
    }),
  );
  res.json({ students });
});

const LinkBody = z.object({ code: z.string().trim().toUpperCase().length(6) });

guardianRouter.post("/link", async (req, res) => {
  const { code } = LinkBody.parse(req.body);
  const student = await prisma.user.findUnique({ where: { linkCode: code } });
  if (!student || student.role !== "STUDENT") throw notFound("No student found with that code");
  const guardianId = authed(req).id;
  const exists = await prisma.guardianLink.findUnique({ where: { guardianId_studentId: { guardianId, studentId: student.id } } });
  if (exists) throw conflict(`${student.name} is already linked`);
  await prisma.guardianLink.create({ data: { guardianId, studentId: student.id } });
  res.status(201).json({ student: { id: student.id, name: student.name, grade: student.grade } });
});

guardianRouter.delete("/students/:id", async (req, res) => {
  const guardianId = authed(req).id;
  await assertLinked(guardianId, req.params.id as string);
  await prisma.guardianLink.delete({ where: { guardianId_studentId: { guardianId, studentId: req.params.id as string } } });
  res.json({ ok: true });
});

const SettingsBody = z.object({ dailyTutorLimit: z.coerce.number().int().min(1).max(100) });

guardianRouter.patch("/students/:id/settings", async (req, res) => {
  await assertLinked(authed(req).id, req.params.id as string);
  const body = SettingsBody.parse(req.body);
  const s = await prisma.user.update({ where: { id: req.params.id as string }, data: body });
  res.json({ dailyTutorLimit: s.dailyTutorLimit });
});

/** Learning report: habits, independence, topics, misconceptions, safety. */
guardianRouter.get("/students/:id/report", async (req, res) => {
  const studentId = req.params.id as string;
  await assertLinked(authed(req).id, studentId);
  const student = await prisma.user.findUniqueOrThrow({ where: { id: studentId } });

  const today = dayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const since30 = dayStartUtc(addDays(today, -29));

  const [xpByDay, sessions, attempts, lessonsDone, safety, misconceptionMsgs, badges] = await Promise.all([
    prisma.xpEvent.groupBy({ by: ["day"], where: { userId: studentId, day: { in: days } }, _sum: { amount: true } }),
    prisma.tutorSession.findMany({ where: { studentId, createdAt: { gte: since30 } }, orderBy: { createdAt: "desc" } }),
    prisma.quizAttempt.findMany({ where: { userId: studentId, finishedAt: { gte: since30 } } }),
    prisma.lessonProgress.findMany({
      where: { userId: studentId, completed: true },
      include: { lesson: { select: { title: true, subjectId: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.safetyEvent.findMany({ where: { userId: studentId, createdAt: { gte: since30 } }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.tutorMessage.findMany({
      where: { session: { studentId }, kind: "feedback", createdAt: { gte: since30 } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { meta: true, createdAt: true, session: { select: { topic: true } } },
    }),
    prisma.userBadge.count({ where: { userId: studentId } }),
  ]);

  // Independence score: share of tutor steps solved without hints or reveals.
  let stepsSolved = 0;
  let stepsClean = 0;
  for (const s of sessions) {
    const plan = s.plan as unknown as Plan;
    (s.progress as unknown as StepProgress[]).forEach((p, i) => {
      if (!p.solved || !plan.steps[i]) return;
      stepsSolved++;
      if (!p.revealed && p.hintsShown === 0) stepsClean++;
    });
  }

  const topics = new Map<string, number>();
  for (const s of sessions) if (s.topic) topics.set(s.topic, (topics.get(s.topic) ?? 0) + 1);

  const quizBySubject = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    const cur = quizBySubject.get(a.subjectId) ?? { correct: 0, total: 0 };
    cur.correct += a.correctCount;
    cur.total += (a.answers as unknown[]).length;
    quizBySubject.set(a.subjectId, cur);
  }

  const misconceptions = misconceptionMsgs
    .map((m) => ({ note: (m.meta as Record<string, unknown> | null)?.misconception as string | undefined, topic: m.session.topic, at: m.createdAt }))
    .filter((m): m is { note: string; topic: string; at: Date } => !!m.note)
    .slice(0, 8);

  res.json({
    student: {
      id: student.id,
      name: student.name,
      grade: student.grade,
      avatarSkin: student.avatarSkin,
      level: levelProgress(student.xp),
      streak: student.streakDays,
      bestStreak: student.bestStreak,
      dailyTutorLimit: student.dailyTutorLimit,
      badges,
    },
    week: days.map((d) => ({ day: d, xp: xpByDay.find((x) => x.day === d)?._sum.amount ?? 0 })),
    tutor: {
      sessions: sessions.length,
      solved: sessions.filter((s) => s.status === "solved").length,
      abandoned: sessions.filter((s) => s.status === "abandoned").length,
      hintsUsed: sessions.reduce((n, s) => n + s.hintsUsed, 0),
      independence: stepsSolved ? stepsClean / stepsSolved : null,
      topTopics: [...topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([topic, count]) => ({ topic, count })),
      recent: sessions.slice(0, 8).map((s) => ({ id: s.id, title: s.title, subject: s.subject, status: s.status, hintsUsed: s.hintsUsed, createdAt: s.createdAt })),
    },
    quiz: [...quizBySubject.entries()].map(([subjectId, v]) => ({ subjectId, accuracy: v.total ? v.correct / v.total : 0, answered: v.total })),
    lessons: lessonsDone.map((l) => ({ title: l.lesson.title, subjectId: l.lesson.subjectId, at: l.updatedAt })),
    misconceptions,
    safety: safety.map((e) => ({ category: e.category, excerpt: e.excerpt, at: e.createdAt })),
  });
});

/** Read-only transcript so parents/teachers can see *how* their child is thinking. */
guardianRouter.get("/students/:id/sessions/:sessionId", async (req, res) => {
  await assertLinked(authed(req).id, req.params.id as string);
  const s = await prisma.tutorSession.findUnique({
    where: { id: req.params.sessionId as string },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!s || s.studentId !== req.params.id) throw notFound("Session not found");
  res.json({
    session: {
      id: s.id,
      title: s.title,
      topic: s.topic,
      status: s.status,
      problemText: s.problemText,
      hintsUsed: s.hintsUsed,
      messages: s.messages.map((m) => ({ id: m.id, role: m.role, kind: m.kind, content: m.content, stepIndex: m.stepIndex, meta: m.meta ?? {}, createdAt: m.createdAt })),
    },
  });
});
