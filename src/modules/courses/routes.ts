import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { authed, requireAuth } from "../../middleware/auth";
import { lessonCard } from "../lessons/presenter";
import { topicStatus } from "../lessons/progress";
import { loadCourseTree } from "./tree";

// Class-wise NCTB courses: Course → Chapter → topic (a Lesson with a video and written notes).
export const coursesRouter = Router();
coursesRouter.use(requireAuth);

const subjectView = (s: { id: string; name: string; nameBn: string; icon: string; color: string }) => ({
  id: s.id,
  name: s.name,
  nameBn: s.nameBn,
  icon: s.icon,
  color: s.color,
});

const CatalogQuery = z.object({ grade: z.coerce.number().int().min(3).max(12) });

/** One class's catalogue: a course card per subject taught in that class (or "coming soon"). */
coursesRouter.get("/", async (req, res) => {
  const { grade } = CatalogQuery.parse(req.query);
  const userId = authed(req).id;
  // flat queries in parallel (see loadCourseTree for why)
  const inGrade = { unit: { course: { grade } } };
  const [subjects, courses, chapters, topics, done, quick, withCourses] = await Promise.all([
    prisma.subject.findMany({ where: { minGrade: { lte: grade }, maxGrade: { gte: grade } }, orderBy: { order: "asc" } }),
    prisma.course.findMany({ where: { grade }, include: { subject: true }, orderBy: { order: "asc" } }),
    prisma.chapter.findMany({ where: { course: { grade } }, select: { id: true, courseId: true } }),
    prisma.lesson.findMany({ where: inGrade, select: { id: true, chapterId: true, durationSec: true } }),
    prisma.lessonProgress.findMany({ where: { userId, completed: true, lesson: inGrade }, select: { lessonId: true } }),
    prisma.lesson.findMany({ where: { grade, chapterId: null }, include: { subject: true, progress: { where: { userId } } }, orderBy: { order: "asc" } }),
    prisma.course.findMany({ select: { grade: true }, distinct: ["grade"] }),
  ]);
  const doneIds = new Set(done.map((d) => d.lessonId));

  const cards = courses.map((c) => {
    const chapterIds = new Set(chapters.filter((ch) => ch.courseId === c.id).map((ch) => ch.id));
    const own = topics.filter((tp) => tp.chapterId && chapterIds.has(tp.chapterId));
    return {
      id: c.id,
      title: c.title,
      titleBn: c.titleBn,
      book: c.book,
      description: c.description,
      subject: subjectView(c.subject),
      chapters: chapterIds.size,
      topics: own.length,
      videoSec: own.reduce((sum, tp) => sum + tp.durationSec, 0),
      completed: own.filter((tp) => doneIds.has(tp.id)).length,
      comingSoon: false,
    };
  });
  // subjects of this class that don't have a course yet
  const soon = subjects
    .filter((s) => !courses.some((c) => c.subjectId === s.id))
    .map((s) => ({ id: null, title: s.name, titleBn: s.nameBn, book: "", description: "", subject: subjectView(s), chapters: 0, topics: 0, videoSec: 0, completed: 0, comingSoon: true }));

  res.json({
    grade,
    gradesWithCourses: withCourses.map((c) => c.grade).sort((a, b) => a - b),
    courses: [...cards, ...soon],
    quickLessons: quick.map((l) => ({
      ...lessonCard(l),
      progress: l.progress[0] ? Math.min(1, l.progress[0].watchedSec / l.durationSec) : 0,
      completed: l.progress[0]?.completed ?? false,
    })),
  });
});

/** A course page: every chapter with its topics and the student's progress through them. */
coursesRouter.get("/:id", async (req, res) => {
  const tree = await loadCourseTree(req.params.id as string, authed(req).id);
  if (!tree) throw notFound("Course not found");
  const { course } = tree;

  const chapters = tree.chapters.map((ch) => ({
    id: ch.id,
    number: ch.number,
    title: ch.title,
    titleBn: ch.titleBn,
    summary: ch.summary,
    topics: ch.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      durationSec: l.durationSec,
      readingMin: l.readingMin,
      checkpoints: (l.checkpoints as unknown[]).length,
      xpReward: l.xpReward,
      ...topicStatus(l, l.progress),
    })),
  }));
  const topics = chapters.flatMap((c) => c.topics);
  // carry on after the last finished topic (like Coursera), else the first unfinished one
  const lastDone = topics.map((t) => t.completed).lastIndexOf(true);
  const next = topics.slice(lastDone + 1).find((t) => !t.completed) ?? topics.find((t) => !t.completed) ?? topics[0] ?? null;

  res.json({
    course: {
      id: course.id,
      title: course.title,
      titleBn: course.titleBn,
      book: course.book,
      description: course.description,
      grade: course.grade,
      subject: subjectView(course.subject),
    },
    chapters,
    stats: {
      chapters: chapters.length,
      topics: topics.length,
      completed: topics.filter((t) => t.completed).length,
      videoSec: topics.reduce((sum, t) => sum + t.durationSec, 0),
      readingMin: topics.reduce((sum, t) => sum + t.readingMin, 0),
      checkpoints: topics.reduce((sum, t) => sum + t.checkpoints, 0),
    },
    next: next ? { id: next.id, title: next.title, started: topics.some((t) => t.completed || t.videoDone || t.readDone) } : null,
  });
});
