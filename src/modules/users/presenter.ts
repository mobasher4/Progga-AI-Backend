import type { User } from "@prisma/client";
import { levelProgress } from "../gamification/levels";
import { skinById } from "../gamification/catalog";
import { profileStatus, readProfile } from "./profile";

/** Same-origin URL of a user's photo; the version busts caches after a change. */
export const photoUrl = (u: Pick<User, "id" | "photoUpdatedAt">) => (u.photoUpdatedAt ? `/api/photos/${u.id}?v=${u.photoUpdatedAt.getTime()}` : null);

export function publicUser(u: User) {
  const isStudent = u.role === "STUDENT";
  const { rewardedAt, ...profile } = readProfile(u);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    grade: u.grade,
    birthdate: u.birthdate,
    language: u.language,
    photoUrl: photoUrl(u),
    profile,
    profileStatus: { ...profileStatus(u), rewarded: !!rewardedAt },
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
