// Level n starts at 50·n·(n−1) XP → 0, 100, 300, 600, 1000, 1500, 2100 …
// Early levels come fast (instant motivation); later ones need steady effort.

export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  // Solve 50n² − 50n − xp = 0 for n, take the floor.
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * Math.max(0, xp)) / 50)) / 2));
}

const TITLES: [number, string][] = [
  [1, "Little Sprout"],
  [3, "Curious Mind"],
  [5, "Brave Explorer"],
  [8, "Brain Wizard"],
  [12, "Knowledge Hero"],
  [16, "Wisdom Star"],
  [20, "Great Sage"],
];

export function levelTitle(level: number): string {
  let title = TITLES[0][1];
  for (const [min, name] of TITLES) if (level >= min) title = name;
  return title;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return {
    level,
    title: levelTitle(level),
    xp,
    levelStartXp: floor,
    nextLevelXp: ceil,
    progress: (xp - floor) / (ceil - floor),
  };
}
