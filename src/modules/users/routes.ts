import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authed, requireAuth, requireRole } from "../../middleware/auth";
import { getDailyQuests } from "../gamification/service";
import { lessonCard } from "../lessons/presenter";
import { listSessions } from "../tutor/service";
import { publicUser } from "./presenter";

export const usersRouter = Router();
usersRouter.use(requireAuth);

const UpdateBody = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  language: z.enum(["en", "bn", "mix"]).optional(),
  grade: z.coerce.number().int().min(3).max(12).optional(),
});

usersRouter.patch("/", async (req, res) => {
  const me = authed(req);
  const body = UpdateBody.parse(req.body);
  if (me.role !== "STUDENT") delete body.grade;
  const user = await prisma.user.update({ where: { id: me.id }, data: body });
  res.json({ user: publicUser(user) });
});

/** Everything the student home screen needs in one round trip. */
usersRouter.get("/dashboard", requireRole("STUDENT"), async (req, res) => {
  const id = authed(req).id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  const grade = user.grade ?? 6;

  const [quests, sessions, inProgress, badgeCount, subjects] = await Promise.all([
    getDailyQuests(id),
    listSessions(id, 5),
    prisma.lessonProgress.findMany({
      where: { userId: id, completed: false, watchedSec: { gt: 0 } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: { lesson: { include: { subject: true } } },
    }),
    prisma.userBadge.count({ where: { userId: id } }),
    prisma.subject.findMany({ where: { minGrade: { lte: grade }, maxGrade: { gte: grade } }, orderBy: { order: "asc" } }),
  ]);

  const recommended = await prisma.lesson.findMany({
    where: { grade: { in: [grade - 1, grade, grade + 1] }, progress: { none: { userId: id } } },
    include: { subject: true },
    orderBy: [{ grade: "desc" }, { order: "asc" }],
    take: 4,
  });

  res.json({
    user: publicUser(user),
    quests,
    recentSessions: sessions,
    continueLessons: inProgress.map((p) => ({
      ...lessonCard(p.lesson),
      progress: Math.min(1, p.watchedSec / p.lesson.durationSec),
    })),
    recommendedLessons: recommended.map(lessonCard),
    badgeCount,
    subjects,
  });
});
