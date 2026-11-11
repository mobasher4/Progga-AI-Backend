// Battle Arena leagues. Every class has its own ladder: a Class 8 student only
// meets Class 8 rivals and climbs the Class 8 league. Trophy thresholds follow
// the classic trophy-road layout (Bronze III at 400 … Legend at 5000).

export type LeagueFamily = "unranked" | "bronze" | "silver" | "gold" | "crystal" | "master" | "champion" | "titan" | "legend";

export interface League {
  id: string; // bronze-3
  family: LeagueFamily;
  division: 0 | 1 | 2 | 3; // III = 3 (entry) … I = 1; 0 for Unranked/Legend
  name: string; // "Bronze League III"
  min: number; // trophies needed
  difficulty: number; // 1..6 — how hard the battle questions are
}

const FAMILIES: [LeagueFamily, string, number[], number][] = [
  // family, name, [III, II, I] thresholds, question difficulty
  ["bronze", "Bronze", [400, 500, 600], 1],
  ["silver", "Silver", [800, 1000, 1200], 2],
  ["gold", "Gold", [1400, 1600, 1800], 3],
  ["crystal", "Crystal", [2000, 2200, 2400], 4],
  ["master", "Master", [2600, 2800, 3000], 5],
  ["champion", "Champion", [3200, 3500, 3800], 6],
  ["titan", "Titan", [4100, 4400, 4700], 6],
];

const ROMAN = ["", "I", "II", "III"] as const;

export const LEAGUES: League[] = [
  { id: "unranked", family: "unranked", division: 0, name: "Unranked", min: 0, difficulty: 1 },
  ...FAMILIES.flatMap(([family, name, mins, difficulty]) =>
    mins.map((min, i) => {
      const division = (3 - i) as 3 | 2 | 1;
      return { id: `${family}-${division}`, family, division, name: `${name} League ${ROMAN[division]}`, min, difficulty };
    }),
  ),
  { id: "legend", family: "legend", division: 0, name: "Legend League", min: 5000, difficulty: 6 },
];

export function leagueFor(trophies: number): League {
  let league = LEAGUES[0];
  for (const l of LEAGUES) if (trophies >= l.min) league = l;
  return league;
}

export function nextLeague(trophies: number): League | null {
  return LEAGUES.find((l) => l.min > trophies) ?? null;
}

/** Question difficulty for a battle between these trophy counts. */
export function battleDifficulty(...trophies: number[]): number {
  const avg = trophies.reduce((s, t) => s + t, 0) / Math.max(1, trophies.length);
  return leagueFor(avg).difficulty;
}

/** Losing hurts less while you're finding your feet. */
const LOSS_FACTOR: Record<LeagueFamily, number> = {
  unranked: 0.5,
  bronze: 0.75,
  silver: 0.9,
  gold: 1,
  crystal: 1,
  master: 1,
  champion: 1,
  titan: 1,
  legend: 1,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Trophies won or lost. Beating a stronger rival pays more; losing to a weaker
 * one costs more. Equal rivals: about +30 for a win, −20 for a loss.
 */
export function trophyChange(mine: number, theirs: number, result: "win" | "loss" | "draw"): number {
  if (result === "draw") return 0;
  const expected = 1 / (1 + 10 ** ((theirs - mine) / 400));
  const family = leagueFor(mine).family;
  if (result === "win") {
    const gain = clamp(Math.round(10 + 40 * (1 - expected)), 12, 45);
    return family === "unranked" ? Math.round(gain * 1.4) : gain;
  }
  const loss = clamp(Math.round((6 + 28 * expected) * LOSS_FACTOR[family]), 4, 35);
  return -Math.min(loss, mine); // never below zero
}

/** What a student sees about a league (and their place in it). */
export function leagueView(trophies: number) {
  const league = leagueFor(trophies);
  const next = nextLeague(trophies);
  return {
    league,
    next,
    progress: next ? (trophies - league.min) / (next.min - league.min) : 1,
  };
}
