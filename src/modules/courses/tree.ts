import { prisma } from "../../lib/prisma";

/**
 * A course with its chapters, topics and one student's progress. Four flat
 * queries run in parallel: nested includes would cost a database round trip per
 * level, which adds up fast when the database is far away.
 */
export async function loadCourseTree(courseId: string, userId: string) {
  const [course, chapters, lessons, progress] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, include: { subject: true } }),
    prisma.chapter.findMany({ where: { courseId }, orderBy: { number: "asc" } }),
    prisma.lesson.findMany({
      where: { unit: { courseId } },
      orderBy: { order: "asc" },
      select: { id: true, title: true, chapterId: true, durationSec: true, readingMin: true, xpReward: true, checkpoints: true, body: true },
    }),
    prisma.lessonProgress.findMany({
      where: { userId, lesson: { unit: { courseId } } },
      select: { lessonId: true, watchedSec: true, readDone: true, completed: true },
    }),
  ]);
  if (!course) return null;
  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
  return {
    course,
    chapters: chapters.map((ch) => ({
      ...ch,
      lessons: lessons.filter((l) => l.chapterId === ch.id).map((l) => ({ ...l, progress: byLesson.get(l.id) })),
    })),
  };
}
