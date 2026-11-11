import { describe, expect, it } from "vitest";
import { BATTLE_SIZE, buildBattleQuestions } from "./questions";
import { GENERATORS } from "./questions/generators";
import { LEAGUES, battleDifficulty, leagueFor, trophyChange } from "./leagues";
import { planRival } from "./rivals";

const BAD = /undefined|NaN|Infinity|\[object/;

describe("battle questions", () => {
  it("every generator makes valid questions at every class and difficulty", () => {
    for (const g of GENERATORS) {
      for (let grade = g.min; grade <= g.max; grade++) {
        for (let d = 1; d <= 6; d++) {
          for (let i = 0; i < 40; i++) {
            let q;
            try {
              q = g.make(d, grade);
            } catch {
              continue; // the picker re-rolls these; checked below that it's rare
            }
            const where = `${g.id} class ${grade} d${d}: ${q.prompt}`;
            expect(q.options, where).toHaveLength(4);
            expect(q.optionsBn, where).toHaveLength(4);
            expect(new Set(q.options).size, `${where} → ${q.options.join(" | ")}`).toBe(4);
            expect(q.answerIndex, where).toBeGreaterThanOrEqual(0);
            expect(q.answerIndex, where).toBeLessThan(4);
            for (const s of [q.prompt, q.promptBn, q.explanation, q.explanationBn, ...q.options, ...q.optionsBn]) {
              expect(s, where).not.toMatch(BAD);
            }
          }
        }
      }
    }
  });

  it("generators rarely fail", () => {
    let fails = 0;
    let total = 0;
    for (const g of GENERATORS) {
      for (let i = 0; i < 300; i++) {
        total++;
        try {
          g.make(1 + (i % 6), g.min + (i % (g.max - g.min + 1)));
        } catch {
          fails++;
        }
      }
    }
    expect(fails / total).toBeLessThan(0.03);
  });

  it("builds a full, ramped battle for every class and league", () => {
    for (let grade = 3; grade <= 12; grade++) {
      for (let d = 1; d <= 6; d++) {
        const qs = buildBattleQuestions(grade, d);
        expect(qs, `class ${grade} d${d}`).toHaveLength(BATTLE_SIZE);
        expect(new Set(qs.map((q) => q.prompt)).size).toBe(BATTLE_SIZE);
        const ds = qs.map((q) => q.difficulty);
        expect([...ds].sort((a, b) => a - b)).toEqual(ds);
      }
    }
  });
});

describe("leagues & trophies", () => {
  it("has the full ladder in order", () => {
    expect(LEAGUES[0].id).toBe("unranked");
    expect(LEAGUES.at(-1)!.id).toBe("legend");
    for (let i = 1; i < LEAGUES.length; i++) expect(LEAGUES[i].min).toBeGreaterThan(LEAGUES[i - 1].min);
    expect(leagueFor(399).id).toBe("unranked");
    expect(leagueFor(400).name).toBe("Bronze League III");
    expect(leagueFor(1250).name).toBe("Silver League I");
    expect(leagueFor(9999).id).toBe("legend");
  });

  it("gets harder as you climb", () => {
    expect(battleDifficulty(0)).toBe(1);
    expect(battleDifficulty(1500)).toBe(3);
    expect(battleDifficulty(3300)).toBe(6);
  });

  it("pays about +30 / −20 between equals and never goes below zero", () => {
    expect(trophyChange(1000, 1000, "win")).toBe(30);
    expect(trophyChange(1000, 1000, "loss")).toBeLessThan(-15);
    expect(trophyChange(1000, 1400, "win")).toBeGreaterThan(30);
    expect(trophyChange(10, 10, "loss")).toBeGreaterThanOrEqual(-10);
    expect(trophyChange(1000, 1000, "draw")).toBe(0);
  });
});

describe("practice rival", () => {
  it("plans timed answers within the limit", () => {
    const qs = buildBattleQuestions(8, 3);
    const plan = planRival({ questions: qs, difficulty: 3, form: 0, timeLimitMs: 15_000, revealMs: 1_500 });
    expect(plan).toHaveLength(qs.length);
    let last = 0;
    for (const a of plan) {
      expect(a.ms).toBeLessThanOrEqual(15_000);
      expect(a.at).toBeGreaterThan(last);
      last = a.at;
    }
  });
});
