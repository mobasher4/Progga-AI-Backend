import type { Prisma, PrismaClient } from "@prisma/client";
import { BIOLOGY_10 } from "./biology";
import { CHEMISTRY_10 } from "./chemistry";
import { ICT_10 } from "./ict";
import { MATH_10 } from "./math";
import { PHYSICS_10 } from "./physics";
import type { ChapterData, CourseData, TopicData } from "./types";

export const COURSES: CourseData[] = [MATH_10, PHYSICS_10, CHEMISTRY_10, BIOLOGY_10, ICT_10];

// Placeholder videos (public 10-second sample clips), cycled through the topics.
// `sec` must be the clip's real length, or the 80%-watched rule can't be met.
// Replace videoUrl with real lesson recordings (mp4 URL) or YouTube ids (provider "youtube").
const V = "https://test-videos.co.uk/vids/";
const CLIPS = [
  { file: "bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4", sec: 10 },
  { file: "jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4", sec: 10 },
  { file: "sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4", sec: 10 },
];

const TOPIC_XP = 15;

/** Clearly-labelled stand-in for topics that don't have hand-written notes yet. */
function demoBody(course: CourseData, number: number, chapter: ChapterData, topic: string) {
  return [
    `> 📘 **Demo lesson.** This topic follows Chapter ${number}, *${chapter.title}*, of the NCTB ${course.book}. Full written notes are coming soon.`,
    "",
    "### What this chapter is about",
    chapter.summary,
    "",
    `### In this topic: ${topic}`,
    "1. Watch the short video above.",
    `2. Read the section on **${topic}** in your textbook and note down the key words, rules and formulas.`,
    "3. Work through the examples at the end of that section.",
    "",
    `> 💡 **Stuck?** Ask Progga about "${topic}" and it will guide you step by step.`,
  ].join("\n");
}

const readingMinutes = (text: string) => Math.max(2, Math.ceil(text.split(/\s+/).length / 120));

/** "$$x$$" on one line renders inline; give display maths its own block ("$$" fences on their own lines). */
const displayMath = (text: string) => text.replace(/^\$\$(.+?)\$\$[ \t]*$/gm, "\n$$$$\n$1\n$$$$\n");

/**
 * Creates or updates every course, chapter and topic by fixed ids, so it can be
 * re-run safely: students' progress and accounts are never touched.
 */
export async function seedCourses(prisma: PrismaClient) {
  let topicCount = 0;
  let clip = 0;

  for (const [ci, course] of COURSES.entries()) {
    const { chapters, ...info } = course;
    await prisma.course.upsert({ where: { id: course.id }, create: { ...info, order: ci }, update: { ...info, order: ci } });

    const chapterIds: string[] = [];
    for (const [i, ch] of chapters.entries()) {
      const number = i + 1;
      const chapterId = `${course.id}-ch${number}`;
      chapterIds.push(chapterId);
      const chapterData = { courseId: course.id, number, title: ch.title, titleBn: ch.titleBn, summary: ch.summary };
      await prisma.chapter.upsert({ where: { id: chapterId }, create: { id: chapterId, ...chapterData }, update: chapterData });

      const topicIds: string[] = [];
      for (const [k, raw] of ch.topics.entries()) {
        const topic: TopicData = typeof raw === "string" ? { title: raw } : raw;
        const id = `${chapterId}-t${k + 1}`;
        topicIds.push(id);
        const video = CLIPS[clip++ % CLIPS.length];
        const body = displayMath(topic.body ?? demoBody(course, number, ch, topic.title));
        const data = {
          subjectId: course.subjectId,
          grade: course.grade,
          chapter: ch.title,
          chapterId,
          title: topic.title,
          description: ch.summary,
          provider: "mp4",
          videoUrl: `${V}${video.file}`,
          durationSec: video.sec,
          xpReward: TOPIC_XP,
          order: k,
          body,
          readingMin: readingMinutes(body),
          // pause halfway through the clip for each checkpoint
          checkpoints: (topic.checkpoints ?? []).map((c, j) => ({ ...c, atSec: Math.floor((video.sec * (j + 1)) / ((topic.checkpoints?.length ?? 1) + 1)) })) as unknown as Prisma.InputJsonValue,
        };
        await prisma.lesson.upsert({ where: { id }, create: { id, ...data }, update: data });
        topicCount++;
      }
      // topics removed from the data
      await prisma.lesson.deleteMany({ where: { chapterId, id: { notIn: topicIds } } });
    }
    // chapters removed from the data (their topics are unlinked, then removed)
    const stale = await prisma.chapter.findMany({ where: { courseId: course.id, id: { notIn: chapterIds } }, select: { id: true } });
    if (stale.length) {
      await prisma.lesson.deleteMany({ where: { chapterId: { in: stale.map((s) => s.id) } } });
      await prisma.chapter.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    }
  }
  return { courses: COURSES.length, chapters: COURSES.reduce((n, c) => n + c.chapters.length, 0), topics: topicCount };
}
