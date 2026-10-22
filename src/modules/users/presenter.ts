import type { User } from "@prisma/client";
import { levelProgress } from "../gamification/levels";
import { skinById } from "../gamification/catalog";

export function publicUser(u: User) {
  const isStudent = u.role === "STUDENT";
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    grade: u.grade,
    language: u.language,
    createdAt: u.createdAt,
    ...(isStudent && {
      avatarSkin: u.avatarSkin,
      skin: skinById(u.avatarSkin),
      coins: u.coins,
      streak: u.streakDays,
      bestStreak: u.bestStreak,
      linkCode: u.linkCode,
      dailyTutorLimit: u.dailyTutorLimit,
      level: levelProgress(u.xp),
    }),
  };
}
