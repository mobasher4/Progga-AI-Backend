import { prisma } from "../../lib/prisma";
import { addDays, dayKey, weekStartKey, dayStartUtc } from "../../lib/dates";
import { badRequest, conflict, notFound } from "../../lib/errors";
import { BADGES, QUESTS, SKINS, type BadgeDef, type QuestDef, type XpReason } from "./catalog";
import { levelFromXp, levelProgress } from "./levels";

/** Returned with any action that can earn rewards, so the UI can celebrate. */
export interface Rewards {
  xpGained: number;
  coinsGained: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  streak: number;
  newBadges: BadgeDef[];
}

/** Extra signals only the calling feature knows about (e.g. "solved with zero hints"). */
export interface BadgeContext {
  hintFreeSolve?: boolean;
  perfectQuiz?: boolean;
  combo?: number;
}

const STREAK_MILESTONES: Record<number, number> = { 3: 15, 7: 40, 14: 80, 30: 200 };

/**
 * Updates the daily streak. Must run before XP is granted so a new day's first
 * action counts toward the streak.
 */
async function touchStreak(userId: string): Promise<{ streak: number; bonusXp: number }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const today = dayKey();
  if (user.lastActiveDate === today) return { streak: user.streakDays, bonusXp: 0 };

  const streak = user.lastActiveDate === addDays(today, -1) ? user.streakDays + 1 : 1;
  const bonusXp = STREAK_MILESTONES[streak] ?? 0;
  await prisma.user.update({
    where: { id: userId },
    data: { streakDays: streak, bestStreak: Math.max(user.bestStreak, streak), lastActiveDate: today },
  });
  if (bonusXp) {
    await prisma.xpEvent.create({ data: { userId, amount: bonusXp, reason: "streak", day: today } });
  }
  return { streak, bonusXp };
}

/**
 * Grants XP for a set of events in one go. Coins are earned at 1 per 5 XP.
 */
export async function award(
  userId: string,
  events: { amount: number; reason: XpReason; refId?: string }[],
  ctx: BadgeContext = {},
): Promise<Rewards> {
  const { streak, bonusXp } = await touchStreak(userId);
  const day = dayKey();
  const real = events.filter((e) => e.amount > 0);
  const gained = real.reduce((s, e) => s + e.amount, 0) + bonusXp;
  const coins = Math.floor(gained / 5);

  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } });
  const [, after] = await prisma.$transaction([
    prisma.xpEvent.createMany({ data: real.map((e) => ({ userId, amount: e.amount, reason: e.reason, refId: e.refId, day })) }),
    prisma.user.update({ where: { id: userId }, data: { xp: { increment: gained }, coins: { increment: coins } } }),
  ]);

  const newBadges = await checkBadges(userId, ctx);
  const level = levelFromXp(after.xp);
  return {
    xpGained: gained,
    coinsGained: coins,
    totalXp: after.xp,
    level,
    leveledUp: level > levelFromXp(before.xp),
    streak,
    newBadges,
  };
}

async function checkBadges(userId: string, ctx: BadgeContext): Promise<BadgeDef[]> {
  const [user, owned, counts, conceptCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    prisma.xpEvent.groupBy({ by: ["reason"], where: { userId }, _count: { _all: true } }),
    prisma.tutorSession.count({ where: { studentId: userId, mode: { in: ["concept", "fact"] }, status: "solved" } }),
  ]);
  const have = new Set(owned.map((b) => b.badgeId));
  const count = (r: XpReason) => counts.find((c) => c.reason === r)?._count._all ?? 0;
  const level = levelFromXp(user.xp);

  const earned: Record<string, boolean> = {
    first_step: count("tutor_step") >= 1,
    problem_solver: count("tutor_solved") >= 1,
    brain_builder: count("tutor_solved") >= 10,
    think_tank: count("tutor_solved") >= 50,
    hint_free_hero: !!ctx.hintFreeSolve,
    curious_mind: conceptCount >= 5,
    streak_3: user.streakDays >= 3,
    streak_7: user.streakDays >= 7,
    streak_30: user.streakDays >= 30,
    video_voyager: count("lesson_complete") >= 5,
    quiz_whiz: !!ctx.perfectQuiz,
    combo_king: (ctx.combo ?? 0) >= 5,
    level_5: level >= 5,
    level_10: level >= 10,
  };

  const fresh = BADGES.filter((b) => earned[b.id] && !have.has(b.id));
  if (fresh.length) {
    await prisma.userBadge.createMany({ data: fresh.map((b) => ({ userId, badgeId: b.id })) });
  }
  return fresh;
}

// ── Daily quests ─────────────────────────────────────────

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** One quest per category, picked deterministically per student per day. */
export function questsForDay(userId: string, day: string): QuestDef[] {
  return (["tutor", "lesson", "quiz"] as const).map((cat) => {
    const pool = QUESTS.filter((q) => q.category === cat);
    return pool[hash(`${userId}:${day}:${cat}`) % pool.length];
  });
}

export async function getDailyQuests(userId: string) {
  const day = dayKey();
  const quests = questsForDay(userId, day);
  const [counts, claims] = await Promise.all([
    prisma.xpEvent.groupBy({ by: ["reason"], where: { userId, day }, _count: { _all: true } }),
    prisma.questClaim.findMany({ where: { userId, day } }),
  ]);
  return quests.map((q) => {
    const progress = counts.find((c) => c.reason === q.metric)?._count._all ?? 0;
    return {
      ...q,
      progress: Math.min(progress, q.target),
      complete: progress >= q.target,
      claimed: claims.some((c) => c.questId === q.id),
    };
  });
}

export async function claimQuest(userId: string, questId: string): Promise<Rewards> {
  const quest = (await getDailyQuests(userId)).find((q) => q.id === questId);
  if (!quest) throw notFound("That quest isn't active today");
  if (!quest.complete) throw badRequest("Finish the quest first!");
  if (quest.claimed) throw conflict("Already claimed");

  await prisma.questClaim.create({ data: { userId, questId, day: dayKey() } });
  await prisma.user.update({ where: { id: userId }, data: { coins: { increment: quest.rewardCoins } } });
  const rewards = await award(userId, [{ amount: quest.rewardXp, reason: "quest", refId: questId }]);
  return { ...rewards, coinsGained: rewards.coinsGained + quest.rewardCoins };
}

// ── Leaderboard ──────────────────────────────────────────

export const GRADE_BANDS = [
  { id: "explorers", label: "Class 3–5", min: 3, max: 5 },
  { id: "adventurers", label: "Class 6–8", min: 6, max: 8 },
  { id: "challengers", label: "Class 9–10 (SSC)", min: 9, max: 10 },
  { id: "scholars", label: "Class 11–12 (HSC)", min: 11, max: 12 },
];

export const bandForGrade = (grade: number) => GRADE_BANDS.find((b) => grade >= b.min && grade <= b.max) ?? GRADE_BANDS[0];

/** Kids' privacy: show first name + last initial only. */
export function publicName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

export async function weeklyLeaderboard(userId: string, grade: number) {
  const band = bandForGrade(grade);
  const since = dayStartUtc(weekStartKey());
  const rows = await prisma.xpEvent.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: since }, user: { role: "STUDENT", grade: { gte: band.min, lte: band.max } } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 50,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, avatarSkin: true, xp: true },
  });
  const entries = rows.map((r, i) => {
    const u = users.find((x) => x.id === r.userId)!;
    return {
      rank: i + 1,
      name: publicName(u.name),
      avatarSkin: u.avatarSkin,
      level: levelFromXp(u.xp),
      weeklyXp: r._sum.amount ?? 0,
      isMe: u.id === userId,
    };
  });
  return { band, weekStart: weekStartKey(), entries: entries.slice(0, 20), me: entries.find((e) => e.isMe) ?? null };
}

// ── Shop ─────────────────────────────────────────────────

export async function getShop(userId: string) {
  const [user, owned] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { coins: true, avatarSkin: true } }),
    prisma.userItem.findMany({ where: { userId }, select: { itemId: true } }),
  ]);
  const ownedIds = new Set(["classic", ...owned.map((o) => o.itemId)]);
  return {
    coins: user.coins,
    equipped: user.avatarSkin,
    skins: SKINS.map((s) => ({ ...s, owned: ownedIds.has(s.id) })),
  };
}

export async function buySkin(userId: string, skinId: string) {
  const skin = SKINS.find((s) => s.id === skinId);
  if (!skin) throw notFound("Skin not found");
  const shop = await getShop(userId);
  if (shop.skins.find((s) => s.id === skinId)?.owned) throw conflict("You already own this skin");
  if (shop.coins < skin.cost) throw badRequest("Not enough Kola coins yet — keep learning! 🍌");

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { coins: { decrement: skin.cost }, avatarSkin: skin.id } }),
    prisma.userItem.create({ data: { userId, itemId: skin.id } }),
  ]);
  return getShop(userId);
}

export async function equipSkin(userId: string, skinId: string) {
  const shop = await getShop(userId);
  if (!shop.skins.find((s) => s.id === skinId)?.owned) throw badRequest("Unlock this skin first");
  await prisma.user.update({ where: { id: userId }, data: { avatarSkin: skinId } });
  return getShop(userId);
}

export async function getAchievements(userId: string) {
  const [user, owned] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.userBadge.findMany({ where: { userId } }),
  ]);
  return {
    level: levelProgress(user.xp),
    streak: user.streakDays,
    bestStreak: user.bestStreak,
    badges: BADGES.map((b) => ({ ...b, earnedAt: owned.find((o) => o.badgeId === b.id)?.earnedAt ?? null })),
  };
}
