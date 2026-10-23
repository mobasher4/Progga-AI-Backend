import type { LessonProgress } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { award } from "../gamification/service";

/** Students must watch this share of a video before completing it. */
export const COMPLETE_RATIO = 0.8;

interface LessonLike {
  id: string;
  durationSec: number;
  body: string;
  xpReward: number;
}

/** Where a student is with one lesson/topic: the video, the written notes and the whole thing. */
export function topicStatus(lesson: LessonLike, p: Pick<LessonProgress, "watchedSec" | "readDone" | "completed"> | null | undefined) {
  return {
    videoDone: (p?.watchedSec ?? 0) >= lesson.durationSec * COMPLETE_RATIO,
    hasReading: lesson.body.length > 0,
    readDone: !!p?.readDone,
    completed: !!p?.completed,
  };
}

/**
 * Course topics complete themselves (and pay XP once) when the video is watched
 * and the notes, if any, are read.
 */
export async function maybeComplete(userId: string, lesson: LessonLike, progress: LessonProgress) {
  const s = topicStatus(lesson, progress);
  if (s.completed || !s.videoDone || (s.hasReading && !s.readDone)) return null;
  // the conditional update means two racing requests can't both pay out
  const { count } = await prisma.lessonProgress.updateMany({ where: { id: progress.id, completed: false }, data: { completed: true } });
  if (!count) return null;
  return award(userId, [{ amount: lesson.xpReward, reason: "lesson_complete", refId: lesson.id }]);
}
