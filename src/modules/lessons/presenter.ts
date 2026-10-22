export function lessonCard(l: {
  id: string;
  title: string;
  chapter: string;
  grade: number;
  durationSec: number;
  xpReward: number;
  provider: string;
  videoUrl: string;
  subject: { id: string; name: string; icon: string; color: string };
}) {
  return {
    id: l.id,
    title: l.title,
    chapter: l.chapter,
    grade: l.grade,
    durationSec: l.durationSec,
    xpReward: l.xpReward,
    thumbnail: l.provider === "youtube" ? `https://i.ytimg.com/vi/${l.videoUrl}/hqdefault.jpg` : null,
    subject: { id: l.subject.id, name: l.subject.name, icon: l.subject.icon, color: l.subject.color },
  };
}
