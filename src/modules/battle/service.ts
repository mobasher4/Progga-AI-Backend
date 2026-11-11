// Battle Arena: matchmaking, live 1v1 state, scoring and trophies.
//
// Everything lives in Postgres and clients poll about once a second, so it works
// the same on one long-running server or many serverless instances. Each player
// answers at their own pace (15 s per question); both see the other's score live
// but never their answers. A practice rival steps in after ~10 s of searching.

import type { Battle, BattlePlayer, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { badRequest, notFound } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { XP } from "../gamification/catalog";
import { levelFromXp } from "../gamification/levels";
import { award } from "../gamification/service";
import { LEAGUES, battleDifficulty, leagueFor, leagueView, trophyChange } from "./leagues";
import { BATTLE_SIZE, type BattleQuestion, buildBattleQuestions } from "./questions";
import { type PlannedAnswer, planRival, rivalName, rivalSkin } from "./rivals";

export const TIME_LIMIT_MS = 15_000;
export const REVEAL_MS = 2_000; // pause after each answer to show right/wrong
const INTRO_MS = 7_500; // "opponent found" + VS splash + 3-2-1
const LATE_GRACE_MS = 2_500; // network slack on the per-question clock
const SEARCH_MIN_MS = 7_500; // how long we wait for a real student…
const SEARCH_MAX_MS = 10_000; // …before a practice rival joins
const TICKET_STALE_MS = 4_500; // a searcher who stopped polling is gone

const now = () => new Date();
const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

interface Answer {
  choice: number;
  correct: boolean;
  ms: number;
  at?: number; // bots only
}

const pointsOf = (a: Answer) => (a.correct ? 2 : a.choice === -1 ? 0 : -1); // half-points
export const displayScore = (score2: number) => score2 / 2;

/** "Rafi Ahmed" → "Rafi A." — students only ever see first names + initial. */
export function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

// ── Profiles ─────────────────────────────────────────────

export async function profileFor(userId: string, grade: number) {
  return prisma.battleProfile.upsert({
    where: { userId_grade: { userId, grade } },
    create: { userId, grade },
    update: {},
  });
}

async function studentOrThrow(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.grade) throw badRequest("Set your class in your profile to enter the Battle Arena.");
  return { ...user, grade: user.grade };
}

/** A battle this student is still playing (so a refresh or a second tab resumes it). */
async function liveBattleOf(userId: string) {
  const p = await prisma.battlePlayer.findFirst({
    where: { userId, battle: { status: "live", deadline: { gt: now() } } },
    orderBy: { battle: { createdAt: "desc" } },
    select: { battleId: true },
  });
  return p?.battleId ?? null;
}

// ── Matchmaking ──────────────────────────────────────────

export async function startSearch(userId: string) {
  const [user, live] = await Promise.all([studentOrThrow(userId), liveBattleOf(userId)]);
  if (live) return { status: "matched" as const, battleId: live, ticketId: null, now: Date.now() };

  const profile = await profileFor(userId, user.grade);
  const t = now();
  const fresh = {
    grade: user.grade,
    trophies: profile.trophies,
    botAt: new Date(t.getTime() + randInt(SEARCH_MIN_MS, SEARCH_MAX_MS)),
    lastSeenAt: t,
    battleId: null,
    createdAt: t,
  };
  // one ticket per student: a new search replaces the old one
  const ticket = await prisma.battleTicket.upsert({ where: { userId }, create: { userId, ...fresh }, update: fresh });
  return { status: "searching" as const, ticketId: ticket.id, battleId: null, startedAt: ticket.createdAt.getTime(), now: Date.now() };
}

export async function cancelSearch(userId: string, ticketId: string) {
  // only an unmatched ticket can be cancelled; once matched, the battle is on
  const { count } = await prisma.battleTicket.deleteMany({ where: { id: ticketId, userId, battleId: null } });
  if (count) return { cancelled: true, battleId: null };
  const t = await prisma.battleTicket.findUnique({ where: { id: ticketId } });
  return { cancelled: !t?.battleId, battleId: t?.battleId ?? null };
}

class Lost extends Error {}

export async function pollSearch(userId: string, ticketId: string) {
  const t = now();
  // heartbeat and lookup in one round trip
  const ticket = await prisma.battleTicket.update({ where: { id: ticketId, userId }, data: { lastSeenAt: t } }).catch(() => null);
  if (!ticket) throw notFound("That search has ended. Tap Battle to search again.");
  if (ticket.battleId) return matched(ticket.battleId);
  const waited = t.getTime() - ticket.createdAt.getTime();

  // 1) a real student in the same class, near your trophies (the window widens as you wait)
  const window = 150 + Math.round(waited / 1000) * 40;
  const onlineP = onlineCount(ticket.grade);
  const rivals = await prisma.battleTicket.findMany({
    where: {
      grade: ticket.grade,
      battleId: null,
      id: { not: ticket.id },
      userId: { not: userId },
      lastSeenAt: { gt: new Date(t.getTime() - TICKET_STALE_MS) },
      trophies: { gte: ticket.trophies - window, lte: ticket.trophies + window },
    },
    orderBy: { createdAt: "asc" },
    take: 3,
  });
  for (const rival of rivals) {
    const id = await tryPairHumans(ticket.id, rival.id).catch((err) => {
      if (!(err instanceof Lost)) logger.warn({ err }, "battle pairing failed");
      return null;
    });
    if (id) {
      onlineP.catch(() => 0);
      return matched(id);
    }
  }

  // 2) nobody yet — after ~10 s, a practice rival takes the seat
  if (t >= ticket.botAt) {
    const id = await startRivalBattle(ticket.id).catch((err) => {
      if (!(err instanceof Lost)) throw err;
      return null;
    });
    if (id) {
      onlineP.catch(() => 0);
      return matched(id);
    }
    const again = await prisma.battleTicket.findUnique({ where: { id: ticket.id } });
    if (again?.battleId) {
      onlineP.catch(() => 0);
      return matched(again.battleId);
    }
  }

  const online = await onlineP;
  return { status: "searching" as const, battleId: null, waitedMs: waited, online, now: Date.now() };
}

const matched = (battleId: string) => ({ status: "matched" as const, battleId, now: Date.now() });

/** Claims both tickets atomically; whoever loses a race just keeps searching. */
async function tryPairHumans(mineId: string, theirsId: string): Promise<string> {
  return prisma.$transaction(
    async (tx) => {
      const [first, second] = [mineId, theirsId].sort(); // fixed lock order avoids deadlocks
      const tickets = await tx.battleTicket.findMany({ where: { id: { in: [first, second] }, battleId: null } });
      if (tickets.length !== 2) throw new Lost();

      const [users, profiles] = await Promise.all([
        tx.user.findMany({ where: { id: { in: tickets.map((x) => x.userId) } } }),
        tx.battleProfile.findMany({ where: { userId: { in: tickets.map((x) => x.userId) }, grade: tickets[0].grade } }),
      ]);
      const trophiesOf = (uid: string) => profiles.find((p) => p.userId === uid)?.trophies ?? 0;
      const grade = tickets[0].grade;
      const difficulty = battleDifficulty(...tickets.map((x) => trophiesOf(x.userId)));
      const questions = buildBattleQuestions(grade, difficulty);
      const startsAt = new Date(Date.now() + INTRO_MS);

      const battle = await tx.battle.create({
        data: {
          grade,
          difficulty,
          questions: questions as unknown as Prisma.InputJsonValue,
          startsAt,
          deadline: deadlineFrom(startsAt, questions.length),
          players: {
            create: tickets.map((tk) => {
              const u = users.find((x) => x.id === tk.userId)!;
              return {
                userId: u.id,
                name: u.name,
                skin: u.avatarSkin,
                level: levelFromXp(u.xp),
                trophiesBefore: trophiesOf(u.id),
                questionStartedAt: startsAt,
              };
            }),
          },
        },
      });
      for (const id of [first, second]) {
        const { count } = await tx.battleTicket.updateMany({ where: { id, battleId: null }, data: { battleId: battle.id } });
        if (count !== 1) throw new Lost(); // rolls the battle back too
      }
      return battle.id;
    },
    { maxWait: 8_000, timeout: 15_000 },
  );
}

async function startRivalBattle(ticketId: string): Promise<string> {
  return prisma.$transaction(
    async (tx) => {
      const ticket = await tx.battleTicket.findUnique({ where: { id: ticketId } });
      if (!ticket || ticket.battleId) throw new Lost();
      const [user, profile] = await Promise.all([
        tx.user.findUniqueOrThrow({ where: { id: ticket.userId } }),
        tx.battleProfile.findUnique({ where: { userId_grade: { userId: ticket.userId, grade: ticket.grade } } }),
      ]);
      const trophies = profile?.trophies ?? 0;
      const rivalTrophies = Math.max(0, trophies + randInt(-45, 45));
      const difficulty = battleDifficulty(trophies, rivalTrophies);
      const questions = buildBattleQuestions(ticket.grade, difficulty);
      const plan = planRival({ questions, difficulty, form: profile?.winStreak ?? 0, timeLimitMs: TIME_LIMIT_MS, revealMs: REVEAL_MS });
      const startsAt = new Date(Date.now() + INTRO_MS);
      const level = Math.max(1, levelFromXp(user.xp) + randInt(-2, 2));

      const battle = await tx.battle.create({
        data: {
          grade: ticket.grade,
          difficulty,
          vsBot: true,
          questions: questions as unknown as Prisma.InputJsonValue,
          startsAt,
          deadline: deadlineFrom(startsAt, questions.length),
          players: {
            create: [
              { userId: user.id, name: user.name, skin: user.avatarSkin, level: levelFromXp(user.xp), trophiesBefore: trophies, questionStartedAt: startsAt },
              { isBot: true, name: rivalName(user.name), skin: rivalSkin(), level, trophiesBefore: rivalTrophies, questionStartedAt: startsAt, answers: plan as unknown as Prisma.InputJsonValue },
            ],
          },
        },
      });
      const { count } = await tx.battleTicket.updateMany({ where: { id: ticket.id, battleId: null }, data: { battleId: battle.id } });
      if (count !== 1) throw new Lost();
      return battle.id;
    },
    { maxWait: 8_000, timeout: 15_000 },
  );
}

const deadlineFrom = (startsAt: Date, n: number) => new Date(startsAt.getTime() + n * (TIME_LIMIT_MS + REVEAL_MS) + 10_000);

/** Real students in this class who are searching or battling right now. */
export async function onlineCount(grade: number): Promise<number> {
  const t = Date.now();
  const [searching, playing] = await Promise.all([
    prisma.battleTicket.findMany({ where: { grade, lastSeenAt: { gt: new Date(t - 15_000) } }, select: { userId: true } }),
    prisma.battlePlayer.findMany({
      where: { isBot: false, battle: { grade, status: "live", deadline: { gt: new Date(t) } } },
      select: { userId: true },
    }),
  ]);
  return new Set([...searching, ...playing].map((x) => x.userId)).size;
}

// ── Live battle ──────────────────────────────────────────

type FullBattle = Battle & { players: BattlePlayer[] };

const questionsOf = (b: Battle) => b.questions as unknown as BattleQuestion[];
const answersOf = (p: BattlePlayer) => p.answers as unknown as Answer[];

/** What a player has done so far. A rival's answers are revealed only as its clock reaches them. */
function progressOf(b: Battle, p: BattlePlayer, at: number) {
  const all = answersOf(p);
  const shown = p.isBot ? (all as PlannedAnswer[]).filter((a) => b.startsAt.getTime() + a.at <= at) : all;
  const total = questionsOf(b).length;
  return {
    answered: shown.length,
    score2: shown.reduce((s, a) => s + pointsOf(a), 0),
    ms: shown.reduce((s, a) => s + a.ms, 0),
    finished: shown.length >= total,
    lastAt: p.isBot ? b.startsAt.getTime() + ((all as PlannedAnswer[]).at(-1)?.at ?? 0) : p.finishedAt?.getTime() ?? null,
  };
}

async function loadBattle(battleId: string, userId: string): Promise<FullBattle> {
  const b = await prisma.battle.findUnique({ where: { id: battleId }, include: { players: true } });
  if (!b || !b.players.some((p) => p.userId === userId)) throw notFound("Battle not found");
  return b;
}

export async function battleState(userId: string, battleId: string) {
  let b = await loadBattle(battleId, userId);
  if (b.status === "live" && readyToFinish(b, Date.now())) {
    await finishBattle(b.id);
    b = await loadBattle(battleId, userId);
  }
  return viewFor(b, userId);
}

function readyToFinish(b: FullBattle, at: number): boolean {
  if (at >= b.deadline.getTime()) return true;
  return b.players.every((p) => progressOf(b, p, at).finished);
}

export async function answer(userId: string, battleId: string, body: { index: number; choice: number }) {
  const b = await loadBattle(battleId, userId);
  const me = b.players.find((p) => p.userId === userId)!;
  const qs = questionsOf(b);
  const at = Date.now();

  if (b.status !== "live") return { ...(await battleState(userId, battleId)), last: null };
  if (at < b.startsAt.getTime() - 500) throw badRequest("The battle hasn't started yet");
  if (body.index < me.answered) {
    // a retry of an answer we already have: replay its result
    const prev = answersOf(me)[body.index];
    return { ...viewFor(b, userId), last: lastResult(qs[body.index], prev, body.index) };
  }
  if (body.index !== me.answered || body.index >= qs.length) throw badRequest("Answer the current question");

  const q = qs[body.index];
  const elapsed = at - me.questionStartedAt.getTime();
  const late = elapsed > TIME_LIMIT_MS + LATE_GRACE_MS;
  const choice = late || body.choice < 0 || body.choice >= q.options.length ? -1 : body.choice;
  const a: Answer = { choice, correct: choice === q.answerIndex, ms: Math.max(0, Math.min(TIME_LIMIT_MS, elapsed)) };
  const done = body.index + 1 >= qs.length;

  const { count } = await prisma.battlePlayer.updateMany({
    where: { id: me.id, answered: body.index },
    data: {
      answered: body.index + 1,
      answers: [...answersOf(me), a] as unknown as Prisma.InputJsonValue,
      score2: { increment: pointsOf(a) },
      totalMs: { increment: a.ms },
      questionStartedAt: new Date(at + REVEAL_MS),
      finishedAt: done ? new Date(at) : null,
    },
  });
  if (!count) {
    // the same answer raced in twice; report the stored one
    const fresh = await loadBattle(battleId, userId);
    const stored = answersOf(fresh.players.find((p) => p.userId === userId)!)[body.index];
    return { ...viewFor(fresh, userId), last: stored ? lastResult(q, stored, body.index) : null };
  }

  // apply the write locally rather than re-reading the battle
  const updated: BattlePlayer = {
    ...me,
    answered: body.index + 1,
    answers: [...answersOf(me), a] as unknown as Prisma.JsonValue,
    score2: me.score2 + pointsOf(a),
    totalMs: me.totalMs + a.ms,
    questionStartedAt: new Date(at + REVEAL_MS),
    finishedAt: done ? new Date(at) : null,
  };
  const local: FullBattle = { ...b, players: b.players.map((p) => (p.id === me.id ? updated : p)) };
  if (readyToFinish(local, Date.now())) {
    return { ...(await battleState(userId, battleId)), last: lastResult(q, a, body.index) };
  }
  return { ...viewFor(local, userId), last: lastResult(q, a, body.index) };
}

const lastResult = (q: BattleQuestion, a: Answer, index: number) => ({
  index,
  choice: a.choice,
  correct: a.correct,
  answerIndex: q.answerIndex,
  points: pointsOf(a) / 2,
  explanation: q.explanation,
  explanationBn: q.explanationBn,
});

// ── Finishing: result, trophies, XP ──────────────────────

async function finishBattle(battleId: string) {
  const at = Date.now();
  const claimed = await prisma.battle.updateMany({ where: { id: battleId, status: "live" }, data: { status: "done", finishedAt: new Date(at) } });
  if (!claimed.count) return; // someone else is finishing it

  const b = await prisma.battle.findUniqueOrThrow({ where: { id: battleId }, include: { players: true } });
  const total = questionsOf(b).length;
  // Final tallies: a bot's whole plan; for students, unanswered questions are timeouts.
  const finals = b.players.map((p) => {
    const answers = answersOf(p);
    const missing = Math.max(0, total - answers.length);
    return {
      p,
      score2: answers.reduce((s, a) => s + pointsOf(a), 0),
      ms: answers.reduce((s, a) => s + a.ms, 0) + missing * TIME_LIMIT_MS,
    };
  });
  const [x, y] = finals;
  const outcome = (me: typeof x, them: typeof x): "win" | "loss" | "draw" =>
    me.score2 !== them.score2 ? (me.score2 > them.score2 ? "win" : "loss") : me.ms !== them.ms ? (me.ms < them.ms ? "win" : "loss") : "draw";

  for (const [me, them] of [[x, y], [y, x]] as const) {
    const result = outcome(me, them);
    if (me.p.isBot || !me.p.userId) {
      await prisma.battlePlayer.update({ where: { id: me.p.id }, data: { result } });
      continue;
    }
    const userId = me.p.userId;
    const profile = await profileFor(userId, b.grade);
    const delta = trophyChange(profile.trophies, them.p.trophiesBefore, result);
    const trophies = Math.max(0, profile.trophies + delta);
    const form = profile.winStreak;
    const nextForm = result === "win" ? Math.max(0, form) + 1 : result === "loss" ? Math.min(0, form) - 1 : 0;
    const correct = answersOf(me.p).filter((a) => a.correct).length;
    const xp = (result === "win" ? XP.battleWin : result === "draw" ? XP.battleDraw : XP.battlePlayed) + correct * XP.battleCorrect;

    await prisma.$transaction([
      prisma.battleProfile.update({
        where: { id: profile.id },
        data: {
          trophies,
          bestTrophies: Math.max(profile.bestTrophies, trophies),
          wins: { increment: result === "win" ? 1 : 0 },
          losses: { increment: result === "loss" ? 1 : 0 },
          draws: { increment: result === "draw" ? 1 : 0 },
          winStreak: nextForm,
          bestStreak: Math.max(profile.bestStreak, nextForm),
        },
      }),
      prisma.battlePlayer.update({ where: { id: me.p.id }, data: { result, trophyDelta: trophies - profile.trophies, xpGained: xp } }),
    ]);
    await award(userId, [{ amount: xp, reason: result === "win" ? "battle_win" : "battle_played", refId: b.id }]).catch((err) =>
      logger.error({ err }, "battle XP award failed"),
    );
  }
  await prisma.battleTicket.deleteMany({ where: { battleId } });
}

/** Sweeps battles whose players walked away, so trophies still settle. */
export async function finishExpiredBattles(userId: string) {
  const stale = await prisma.battle.findMany({
    where: { status: "live", deadline: { lt: now() }, players: { some: { userId } } },
    select: { id: true },
    take: 5,
  });
  for (const s of stale) await finishBattle(s.id);
}

// ── Views ────────────────────────────────────────────────

function playerCard(b: FullBattle, p: BattlePlayer, at: number) {
  const prog = progressOf(b, p, at);
  const lv = leagueFor(p.trophiesBefore);
  return {
    name: shortName(p.name),
    skin: p.skin,
    level: p.level,
    trophies: p.trophiesBefore,
    league: { id: lv.id, family: lv.family, division: lv.division, name: lv.name },
    score: displayScore(prog.score2),
    answered: prog.answered,
    finished: prog.finished,
  };
}

function viewFor(b: FullBattle, userId: string) {
  const at = Date.now();
  const me = b.players.find((p) => p.userId === userId)!;
  const them = b.players.find((p) => p.id !== me.id)!;
  const qs = questionsOf(b);
  const myAnswers = answersOf(me);
  const current = me.answered < qs.length && at >= b.startsAt.getTime() - 500 && b.status === "live" ? qs[me.answered] : null;

  // the other player's request may be mid-way through settling trophies
  const settled = b.status === "done" && (me.result !== null || b.players.length < 2);
  let result = null;
  if (settled) {
    const leagueBefore = leagueFor(me.trophiesBefore);
    const after = me.trophiesBefore + me.trophyDelta;
    const leagueAfter = leagueFor(after);
    const meFinal = progressOf(b, me, Number.MAX_SAFE_INTEGER);
    const themFinal = progressOf(b, them, Number.MAX_SAFE_INTEGER);
    result = {
      outcome: me.result as "win" | "loss" | "draw",
      tieBreak: meFinal.score2 === themFinal.score2 && me.result !== "draw",
      myScore: displayScore(meFinal.score2),
      theirScore: displayScore(themFinal.score2),
      myMs: me.totalMs + Math.max(0, qs.length - myAnswers.length) * TIME_LIMIT_MS,
      theirMs: answersOf(them).reduce((s, a) => s + a.ms, 0) + Math.max(0, qs.length - answersOf(them).length) * TIME_LIMIT_MS,
      trophyDelta: me.trophyDelta,
      trophiesBefore: me.trophiesBefore,
      trophiesAfter: after,
      leagueBefore: leagueBefore.id,
      leagueAfter: leagueAfter.id,
      promoted: LEAGUES.indexOf(leagueAfter) > LEAGUES.indexOf(leagueBefore),
      demoted: LEAGUES.indexOf(leagueAfter) < LEAGUES.indexOf(leagueBefore),
      xpGained: me.xpGained,
      correct: myAnswers.filter((a) => a.correct).length,
      wrong: myAnswers.filter((a) => !a.correct && a.choice !== -1).length,
      review: qs.map((q, i) => ({
        prompt: q.prompt,
        promptBn: q.promptBn,
        options: q.options,
        optionsBn: q.optionsBn,
        answerIndex: q.answerIndex,
        choice: myAnswers[i]?.choice ?? -1,
        explanation: q.explanation,
        explanationBn: q.explanationBn,
        subject: q.subject,
      })),
    };
  }

  return {
    id: b.id,
    grade: b.grade,
    difficulty: b.difficulty,
    status: (settled ? "done" : b.status === "done" ? "finishing" : "live") as "live" | "finishing" | "done",
    total: qs.length || BATTLE_SIZE,
    timeLimitMs: TIME_LIMIT_MS,
    revealMs: REVEAL_MS,
    startsAt: b.startsAt.getTime(),
    deadline: b.deadline.getTime(),
    now: at,
    me: {
      ...playerCard(b, me, at),
      questionStartedAt: me.questionStartedAt.getTime(),
      marks: myAnswers.map((a) => (a.correct ? 1 : a.choice === -1 ? 0 : -1)),
    },
    opponent: playerCard(b, them, at),
    question: current && {
      index: me.answered,
      subject: current.subject,
      topic: current.topic,
      topicBn: current.topicBn,
      prompt: current.prompt,
      promptBn: current.promptBn,
      options: current.options,
      optionsBn: current.optionsBn,
      difficulty: current.difficulty,
    },
    result,
  };
}

// ── Arena home ───────────────────────────────────────────

export async function arenaHome(userId: string) {
  const user = await studentOrThrow(userId);
  const [profile, live, online, top, recent] = await Promise.all([
    finishExpiredBattles(userId).then(() => profileFor(userId, user.grade)),
    liveBattleOf(userId),
    onlineCount(user.grade),
    prisma.battleProfile.findMany({
      where: { grade: user.grade, OR: [{ wins: { gt: 0 } }, { losses: { gt: 0 } }, { draws: { gt: 0 } }] },
      orderBy: [{ trophies: "desc" }, { wins: "desc" }],
      take: 20,
      include: { user: { select: { id: true, name: true, avatarSkin: true, xp: true } } },
    }),
    prisma.battlePlayer.findMany({
      where: { userId, battle: { status: "done", grade: user.grade } },
      orderBy: { battle: { finishedAt: "desc" } },
      take: 8,
      include: { battle: { include: { players: true } } },
    }),
  ]);
  const rank = await prisma.battleProfile.count({ where: { grade: user.grade, trophies: { gt: profile.trophies } } });
  const lv = leagueView(profile.trophies);

  return {
    grade: user.grade,
    online,
    liveBattleId: live,
    profile: {
      trophies: profile.trophies,
      bestTrophies: profile.bestTrophies,
      wins: profile.wins,
      losses: profile.losses,
      draws: profile.draws,
      streak: Math.max(0, profile.winStreak),
      bestStreak: profile.bestStreak,
      rank: rank + 1,
      league: lv.league,
      next: lv.next,
      progress: lv.progress,
    },
    leagues: LEAGUES,
    leaderboard: top.map((p, i) => ({
      rank: i + 1,
      name: shortName(p.user.name),
      skin: p.user.avatarSkin,
      level: levelFromXp(p.user.xp),
      trophies: p.trophies,
      leagueId: leagueFor(p.trophies).id,
      isMe: p.userId === userId,
    })),
    recent: recent.map((p) => {
      const them = p.battle.players.find((x) => x.id !== p.id);
      return {
        id: p.battleId,
        result: p.result,
        trophyDelta: p.trophyDelta,
        myScore: displayScore(p.score2),
        theirScore: displayScore(them ? (answersOf(them) as Answer[]).reduce((s, a) => s + pointsOf(a), 0) : 0),
        opponent: them ? shortName(them.name) : "?",
        opponentSkin: them?.skin ?? "classic",
        at: p.battle.finishedAt?.getTime() ?? p.battle.createdAt.getTime(),
      };
    }),
  };
}
