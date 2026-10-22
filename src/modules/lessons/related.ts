import { prisma } from "../../lib/prisma";
import { lessonCard } from "./presenter";

const STOPWORDS = new Set(["the", "and", "for", "with", "what", "how", "why", "this", "that", "find", "from", "into", "your", "are"]);

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((w) => w.replace(/s$/, ""))
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );

/**
 * Our recorded lessons that best match a tutoring topic: same subject first,
 * then shared keywords with the topic/problem, then the closest class.
 */
export async function relatedLessons(q: { subject: string; grade: number; text: string }, take = 2) {
  const lessons = await prisma.lesson.findMany({ include: { subject: true } });
  const want = words(q.text);
  return lessons
    .map((l) => {
      const have = words(`${l.title} ${l.chapter} ${l.description}`);
      const overlap = [...want].filter((w) => have.has(w)).length;
      const sameSubject = l.subjectId === q.subject;
      return { l, overlap, sameSubject, score: (sameSubject ? 5 : 0) + overlap * 3 - Math.abs(l.grade - q.grade) * 0.5 };
    })
    .filter((x) => x.sameSubject || x.overlap > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, take)
    .map((x) => lessonCard(x.l));
}
