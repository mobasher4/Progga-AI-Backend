import { BANK, type BankRow } from "./bank";
import { GENERATORS, type Generator } from "./generators";
import { type BattleQuestion, bnDigits, clampD, pick, shuffle } from "./kit";

export type { BattleQuestion } from "./kit";

export const BATTLE_SIZE = 10;

/** Per-slot difficulty: warm up, hold, then finish hard. */
const RAMP = [-1, -1, 0, 0, 0, 0, 0, 1, 1, 1];

function fromBank(row: BankRow, id: string): BattleQuestion {
  const [, , difficulty, subject, topic, prompt, options, optionsBn, answer, explanation] = row;
  const order = shuffle(options.map((_, i) => i));
  return {
    id,
    subject,
    topic: topic[0],
    topicBn: topic[1],
    prompt: prompt[0],
    promptBn: prompt[1],
    options: order.map((i) => options[i]),
    optionsBn: order.map((i) => optionsBn?.[i] ?? bnDigits(options[i])),
    answerIndex: order.indexOf(answer),
    explanation: explanation[0],
    explanationBn: explanation[1],
    difficulty,
  };
}

const MAX_PER_KIND = 2;

function generate(gens: Generator[], d: number, grade: number, avoid: Set<string>, used: Map<string, number>): BattleQuestion | null {
  const fresh = gens.filter((g) => (used.get(g.id) ?? 0) < MAX_PER_KIND);
  if (!fresh.length) return null;
  for (let tries = 0; tries < 12; tries++) {
    try {
      const g = pick(fresh);
      const q = g.make(d, grade);
      if (avoid.has(q.prompt)) continue;
      used.set(g.id, (used.get(g.id) ?? 0) + 1);
      return q;
    } catch {
      // a rare degenerate draw (e.g. duplicate options) — just roll again
    }
  }
  return null;
}

/**
 * Ten questions for one battle in this class, tuned to the league's difficulty.
 * Roughly 6 generated (maths and, from Class 9, physics/chemistry/ICT) and 4
 * from the hand-written bank (science, Bangladesh & world, English, Bangla, ICT),
 * ordered so the battle starts gentle and ends tough.
 */
export function buildBattleQuestions(grade: number, difficulty: number): BattleQuestion[] {
  const gens = GENERATORS.filter((g) => grade >= g.min && grade <= g.max);
  const mathGens = gens.filter((g) => g.subject === "math");
  const otherGens = gens.filter((g) => g.subject !== "math");
  const bank = BANK.filter(([lo, hi]) => grade >= lo && grade <= hi);

  const slots = shuffle(RAMP.map((r) => clampD(difficulty + r)));
  const bankSlots = new Set(shuffle([...slots.keys()]).slice(0, 4));
  const out: BattleQuestion[] = [];
  const seen = new Set<string>();
  const usedBank = new Set<BankRow>();
  const usedKinds = new Map<string, number>();

  slots.forEach((d, i) => {
    let q: BattleQuestion | null = null;
    if (bankSlots.has(i)) {
      // closest difficulty first, a little randomness among equals
      const candidates = bank
        .filter((row) => !usedBank.has(row))
        .map((row) => ({ row, gap: Math.abs(row[2] - d) + Math.random() * 0.9 }))
        .sort((a, b) => a.gap - b.gap);
      const best = candidates[0];
      if (best && best.gap < 2.5) {
        usedBank.add(best.row);
        q = fromBank(best.row, `b${i}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
      }
    }
    if (!q) {
      // from Class 9 about a third of generated questions are science/ICT
      const pool = otherGens.length && Math.random() < (grade >= 9 ? 0.4 : 0.15) ? otherGens : mathGens.length ? mathGens : gens;
      q = generate(pool, d, grade, seen, usedKinds) ?? generate(gens, d, grade, seen, usedKinds) ?? generate(gens, d, grade, seen, new Map());
    }
    if (q) {
      seen.add(q.prompt);
      out.push({ ...q, difficulty: d });
    }
  });

  // Gentle → tough; ties keep their shuffled order.
  return out.sort((a, b) => a.difficulty - b.difficulty).slice(0, BATTLE_SIZE);
}
