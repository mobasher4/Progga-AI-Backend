// Static game content. Kept in code (not the DB) so it's versioned and
// reviewable; only *ownership/progress* lives in the database.

export type XpReason =
  | "tutor_step"
  | "tutor_step_clean"
  | "tutor_solved"
  | "lesson_complete"
  | "checkpoint"
  | "quiz_correct"
  | "quiz_finish"
  | "quest"
  | "streak";

/** XP values for every action, tuned so *thinking* pays more than *watching*. */
export const XP = {
  tutorStep: 10,
  tutorStepCleanBonus: 5, // no hints and no wrong attempts on that step
  tutorSolved: 30,
  tutorSolvedHintPenalty: 5, // per hint, floor at 10
  checkpoint: 5,
  quizCorrect: 5,
  quizFinish: 15,
  quizPerfectBonus: 25,
} as const;

// ── Badges ───────────────────────────────────────────────

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold";
}

export const BADGES: BadgeDef[] = [
  { id: "first_step", name: "First Step", description: "Got your first tutor step right", icon: "👣", tier: "bronze" },
  { id: "problem_solver", name: "Problem Solver", description: "Solved your first problem with Progga", icon: "🧩", tier: "bronze" },
  { id: "brain_builder", name: "Brain Builder", description: "Solved 10 problems step by step", icon: "🧠", tier: "silver" },
  { id: "think_tank", name: "Think Tank", description: "Solved 50 problems step by step", icon: "🏛️", tier: "gold" },
  { id: "hint_free_hero", name: "Hint-Free Hero", description: "Solved a whole problem without a single hint", icon: "🦸", tier: "silver" },
  { id: "curious_mind", name: "Curious Mind", description: "Explored 5 concepts with Progga", icon: "🔭", tier: "bronze" },
  { id: "streak_3", name: "On Fire", description: "Learned 3 days in a row", icon: "🔥", tier: "bronze" },
  { id: "streak_7", name: "Week Warrior", description: "Learned 7 days in a row", icon: "⚡", tier: "silver" },
  { id: "streak_30", name: "Unstoppable", description: "Learned 30 days in a row", icon: "🌟", tier: "gold" },
  { id: "video_voyager", name: "Video Voyager", description: "Completed 5 video lessons", icon: "🎬", tier: "silver" },
  { id: "quiz_whiz", name: "Quiz Whiz", description: "Got a perfect score in Quiz Arena", icon: "🏆", tier: "silver" },
  { id: "combo_king", name: "Combo Master", description: "Hit a 5x combo in Quiz Arena", icon: "🎯", tier: "bronze" },
  { id: "level_5", name: "Rising Star", description: "Reached level 5", icon: "🚀", tier: "silver" },
  { id: "level_10", name: "Superstar", description: "Reached level 10", icon: "💫", tier: "gold" },
];

// ── Daily quests ─────────────────────────────────────────

export interface QuestDef {
  id: string;
  title: string;
  metric: XpReason;
  target: number;
  category: "tutor" | "lesson" | "quiz";
  rewardXp: number;
  rewardCoins: number;
  icon: string;
}

export const QUESTS: QuestDef[] = [
  { id: "steps_5", title: "Climb 5 steps with Progga", metric: "tutor_step", target: 5, category: "tutor", rewardXp: 20, rewardCoins: 10, icon: "🪜" },
  { id: "solve_1", title: "Solve 1 problem the smart way", metric: "tutor_solved", target: 1, category: "tutor", rewardXp: 25, rewardCoins: 12, icon: "🧩" },
  { id: "clean_3", title: "Nail 3 steps without hints", metric: "tutor_step_clean", target: 3, category: "tutor", rewardXp: 25, rewardCoins: 15, icon: "🎯" },
  { id: "lesson_1", title: "Finish a video lesson", metric: "lesson_complete", target: 1, category: "lesson", rewardXp: 20, rewardCoins: 10, icon: "🎬" },
  { id: "checkpoint_2", title: "Answer 2 video checkpoints", metric: "checkpoint", target: 2, category: "lesson", rewardXp: 15, rewardCoins: 8, icon: "⏸️" },
  { id: "quiz_1", title: "Play a Quiz Arena round", metric: "quiz_finish", target: 1, category: "quiz", rewardXp: 15, rewardCoins: 8, icon: "⚔️" },
  { id: "quiz_correct_8", title: "Answer 8 quiz questions right", metric: "quiz_correct", target: 8, category: "quiz", rewardXp: 25, rewardCoins: 12, icon: "✅" },
];

// ── Robot skins (spent with Kola coins — "kola" is Bangla for banana 🍌) ──

export interface SkinDef {
  id: string;
  name: string;
  cost: number;
  palette: { body: string; accent: string; visor: string; eye: string; cheek: string };
}

export const SKINS: SkinDef[] = [
  { id: "classic", name: "Classic Grape", cost: 0, palette: { body: "#6C4CF1", accent: "#FFD43B", visor: "#1E1B3A", eye: "#7CF5D4", cheek: "#FF8FA3" } },
  { id: "mango", name: "Mango Tango", cost: 60, palette: { body: "#FF9F1C", accent: "#FFE66D", visor: "#2B1D0E", eye: "#FFF3B0", cheek: "#FF6B6B" } },
  { id: "mint", name: "Minty Fresh", cost: 80, palette: { body: "#2ED9A3", accent: "#FFD43B", visor: "#103B33", eye: "#B9FFF0", cheek: "#FF8FA3" } },
  { id: "ocean", name: "Ocean Wave", cost: 120, palette: { body: "#3BA7FF", accent: "#FFD43B", visor: "#0B2545", eye: "#9BF6FF", cheek: "#FFADAD" } },
  { id: "rose", name: "Rosy Spark", cost: 120, palette: { body: "#FF6FA5", accent: "#FFE066", visor: "#3A0F24", eye: "#FFD6E8", cheek: "#FFFFFF" } },
  { id: "ninja", name: "Shadow Ninja", cost: 200, palette: { body: "#2D2A45", accent: "#FF4D6D", visor: "#0D0C17", eye: "#FF4D6D", cheek: "#6C4CF1" } },
  { id: "galaxy", name: "Galaxy Glow", cost: 300, palette: { body: "#3A0CA3", accent: "#F72585", visor: "#10002B", eye: "#4CC9F0", cheek: "#F72585" } },
  { id: "gold", name: "Golden Banana", cost: 500, palette: { body: "#F5B700", accent: "#FFFFFF", visor: "#3D2C00", eye: "#FFF8DC", cheek: "#FF9F1C" } },
];

export const skinById = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0];
