// Question generators. Each makes a fresh question whose answer is computed,
// never typed in, so battles never run out of questions and are always correct.
// `d` (1..6) is the league difficulty: bigger numbers, more steps, trickier traps.

import { type BattleQuestion, gcd, mcq, num, pick, rand, signed, term } from "./kit";

export interface Generator {
  id: string;
  subject: "math" | "physics" | "chemistry" | "ict";
  min: number; // class range
  max: number;
  make: (d: number, grade: number) => BattleQuestion;
}

const T = {
  add: ["Addition", "যোগ"],
  sub: ["Subtraction", "বিয়োগ"],
  mul: ["Multiplication", "গুণ"],
  div: ["Division", "ভাগ"],
  word: ["Word problem", "কথার অঙ্ক"],
  frac: ["Fractions", "ভগ্নাংশ"],
  geo: ["Geometry", "জ্যামিতি"],
  dec: ["Decimals", "দশমিক"],
  pct: ["Percentage", "শতকরা"],
  avg: ["Average", "গড়"],
  int: ["Integers", "পূর্ণসংখ্যা"],
  lcm: ["LCM & HCF", "ল.সা.গু ও গ.সা.গু"],
  ratio: ["Ratio", "অনুপাত"],
  pow: ["Powers & roots", "ঘাত ও মূল"],
  alg: ["Algebra", "বীজগণিত"],
  eq: ["Equations", "সমীকরণ"],
  money: ["Profit & interest", "লাভ ও মুনাফা"],
  trig: ["Trigonometry", "ত্রিকোণমিতি"],
  seq: ["Sequences", "ধারা"],
  sets: ["Sets", "সেট"],
  log: ["Logarithms", "লগারিদম"],
  coord: ["Coordinate geometry", "স্থানাঙ্ক জ্যামিতি"],
  calc: ["Calculus", "ক্যালকুলাস"],
  matrix: ["Matrices", "ম্যাট্রিক্স"],
  count: ["Permutation & combination", "বিন্যাস ও সমাবেশ"],
  complex: ["Complex numbers", "জটিল সংখ্যা"],
  motion: ["Motion", "গতি"],
  force: ["Force & energy", "বল ও শক্তি"],
  elec: ["Electricity", "তড়িৎ"],
  matter: ["Density", "ঘনত্ব"],
  atom: ["Atomic structure", "পরমাণুর গঠন"],
  mole: ["Mole concept", "মোল ধারণা"],
  binary: ["Number systems", "সংখ্যা পদ্ধতি"],
} as const satisfies Record<string, [string, string]>;

/** Bigger digits as difficulty rises: [lo, hi] ranges per level. */
const scale = (d: number, ranges: [number, number][]) => ranges[Math.min(ranges.length - 1, d - 1)];

export const GENERATORS: Generator[] = [
  // ── Class 3–5 arithmetic ───────────────────────────────
  {
    id: "add", subject: "math", min: 3, max: 5,
    make: (d, g) => {
      const lvl = Math.min(6, d + (g - 3));
      const [lo, hi] = scale(lvl, [[10, 49], [25, 99], [100, 499], [150, 999], [1000, 4999], [2500, 9999]]);
      const a = rand(lo, hi), b = rand(lo, hi), c = a + b;
      return mcq({
        subject: "math", topic: T.add, difficulty: d,
        prompt: [`What is ${a} + ${b}?`, `${a} + ${b} = কত?`],
        answer: c, wrong: [c + 10, c - 10, c + 1, c - 1, c + 100],
        explanation: [`${a} + ${b} = ${c}. Add ones, then tens, carrying when a column passes 9.`, `${a} + ${b} = ${c}। একক, তারপর দশক যোগ করো; ৯ ছাড়ালে হাতে রাখো।`],
      });
    },
  },
  {
    id: "sub", subject: "math", min: 3, max: 5,
    make: (d, g) => {
      const lvl = Math.min(6, d + (g - 3));
      const [lo, hi] = scale(lvl, [[20, 99], [40, 99], [200, 999], [300, 999], [2000, 9999], [5000, 99999]]);
      const a = rand(lo, hi), b = rand(Math.floor(lo / 2), a - 1), c = a - b;
      return mcq({
        subject: "math", topic: T.sub, difficulty: d,
        prompt: [`What is ${a} − ${b}?`, `${a} − ${b} = কত?`],
        answer: c, wrong: [c + 10, c - 10, c + 2, a + b, c + 1],
        explanation: [`${a} − ${b} = ${c}. Check: ${c} + ${b} = ${a}.`, `${a} − ${b} = ${c}। যাচাই: ${c} + ${b} = ${a}।`],
      });
    },
  },
  {
    id: "mul", subject: "math", min: 3, max: 6,
    make: (d, g) => {
      const lvl = Math.min(6, d + Math.max(0, g - 4));
      const [a, b] =
        lvl <= 1 ? [rand(2, 5), rand(2, 9)] : lvl === 2 ? [rand(6, 9), rand(3, 9)] : lvl === 3 ? [rand(6, 12), rand(6, 12)]
        : lvl === 4 ? [rand(13, 49), rand(3, 9)] : lvl === 5 ? [rand(12, 39), rand(11, 29)] : [rand(101, 499), rand(12, 39)];
      const c = a * b;
      return mcq({
        subject: "math", topic: T.mul, difficulty: d,
        prompt: [`What is ${a} × ${b}?`, `${a} × ${b} = কত?`],
        answer: c, wrong: [c + a, c - a, c + b, c + 10, c - b],
        explanation: [`${a} × ${b} = ${c}.`, `${a} × ${b} = ${c}।`],
      });
    },
  },
  {
    id: "div", subject: "math", min: 4, max: 6,
    make: (d) => {
      const [blo, bhi] = scale(d, [[2, 5], [3, 9], [6, 12], [11, 19], [12, 25], [21, 49]]);
      const [qlo, qhi] = scale(d, [[2, 9], [3, 12], [6, 15], [8, 25], [12, 49], [21, 99]]);
      const b = rand(blo, bhi), q = rand(qlo, qhi), a = b * q;
      return mcq({
        subject: "math", topic: T.div, difficulty: d,
        prompt: [`What is ${a} ÷ ${b}?`, `${a} ÷ ${b} = কত?`],
        answer: q, wrong: [q + 1, q - 1, q + 2, q + 10],
        explanation: [`${b} × ${q} = ${a}, so ${a} ÷ ${b} = ${q}.`, `${b} × ${q} = ${a}, তাই ${a} ÷ ${b} = ${q}।`],
      });
    },
  },
  {
    id: "missing", subject: "math", min: 3, max: 4,
    make: (d) => {
      const [lo, hi] = scale(d, [[5, 30], [10, 60], [20, 99], [50, 300], [100, 900], [500, 2500]]);
      const x = rand(lo, hi), a = rand(lo, hi), c = x + a;
      return mcq({
        subject: "math", topic: T.add, difficulty: d,
        prompt: [`Fill the box: ☐ + ${a} = ${c}`, `খালি ঘর পূরণ করো: ☐ + ${a} = ${c}`],
        answer: x, wrong: [c + a, x + 1, x - 1, x + 10],
        explanation: [`☐ = ${c} − ${a} = ${x}.`, `☐ = ${c} − ${a} = ${x}।`],
      });
    },
  },
  {
    id: "shop", subject: "math", min: 3, max: 5,
    make: (d) => {
      const items: [string, string][] = [["pen", "কলম"], ["mango", "আম"], ["notebook", "খাতা"], ["pencil", "পেন্সিল"], ["egg", "ডিম"], ["banana", "কলা"]];
      const [en, bn] = pick(items);
      const price = rand(...scale(d, [[2, 9], [5, 15], [8, 25], [12, 45], [15, 75], [25, 120]]));
      const qty = rand(...scale(d, [[2, 5], [3, 9], [4, 12], [6, 15], [8, 24], [12, 36]]));
      const total = price * qty;
      if (d >= 4) {
        const paid = Math.ceil((total + 1) / 100) * 100 + (d >= 5 ? 100 : 0);
        const change = paid - total;
        return mcq({
          subject: "math", topic: T.word, difficulty: d,
          prompt: [`One ${en} costs ${price} taka. Mitu buys ${qty} and pays ${paid} taka. How much change does she get?`, `একটি ${bn}ের দাম ${price} টাকা। মিতু ${qty}টি কিনে ${paid} টাকা দিল। সে কত টাকা ফেরত পাবে?`],
          answer: change, wrong: [total, change + price, change - price, change + 10], unit: [" taka", " টাকা"],
          explanation: [`Cost = ${price} × ${qty} = ${total}. Change = ${paid} − ${total} = ${change} taka.`, `দাম = ${price} × ${qty} = ${total}। ফেরত = ${paid} − ${total} = ${change} টাকা।`],
        });
      }
      return mcq({
        subject: "math", topic: T.word, difficulty: d,
        prompt: [`One ${en} costs ${price} taka. How much do ${qty} cost?`, `একটি ${bn}ের দাম ${price} টাকা। ${qty}টির দাম কত?`],
        answer: total, wrong: [price + qty, total + price, total - price, total + 10], unit: [" taka", " টাকা"],
        explanation: [`${price} × ${qty} = ${total} taka.`, `${price} × ${qty} = ${total} টাকা।`],
      });
    },
  },
  {
    id: "fractionOf", subject: "math", min: 4, max: 6,
    make: (d) => {
      const k = pick(d <= 2 ? [2, 3, 4, 5] : d <= 4 ? [3, 4, 5, 6, 8] : [6, 7, 8, 9, 12]);
      const m = d <= 2 ? 1 : rand(1, k - 1) || 1;
      const unitVal = rand(...scale(d, [[2, 9], [3, 12], [4, 15], [5, 20], [6, 25], [8, 40]]));
      const N = k * unitVal, ans = m * unitVal;
      const f = `${m}/${k}`;
      return mcq({
        subject: "math", topic: T.frac, difficulty: d,
        prompt: [`What is ${f} of ${N}?`, `${N}-এর ${f} = কত?`],
        answer: ans, wrong: [N / m === Math.round(N / m) ? N / m : ans + unitVal, ans + unitVal, ans - 1 > 0 ? ans - 1 : ans + 2, unitVal * (k - m) || ans + 3],
        explanation: [`${N} ÷ ${k} = ${unitVal}, and ${unitVal} × ${m} = ${ans}.`, `${N} ÷ ${k} = ${unitVal}, আর ${unitVal} × ${m} = ${ans}।`],
      });
    },
  },
  {
    id: "equivFraction", subject: "math", min: 4, max: 6,
    make: (d) => {
      let a = 1, b = 2;
      do {
        b = rand(2, d <= 2 ? 6 : 12);
        a = rand(1, b - 1);
      } while (gcd(a, b) !== 1);
      const k = rand(2, d <= 2 ? 4 : d <= 4 ? 7 : 12);
      const ans = `${a * k}/${b * k}`;
      return mcq({
        subject: "math", topic: T.frac, difficulty: d,
        prompt: [`Which fraction is equal to ${a}/${b}?`, `কোন ভগ্নাংশটি ${a}/${b}-এর সমান?`],
        answer: ans, wrong: [`${a + k}/${b + k}`, `${a * k}/${b * k + 1}`, `${a * k + 1}/${b * k}`, `${b * k}/${a * k}`],
        explanation: [`Multiply top and bottom by ${k}: ${a}/${b} = ${ans}.`, `লব ও হরকে ${k} দিয়ে গুণ করো: ${a}/${b} = ${ans}।`],
      });
    },
  },
  {
    id: "rect", subject: "math", min: 4, max: 7,
    make: (d, g) => {
      const l = rand(...scale(d, [[3, 9], [5, 15], [8, 25], [12, 40], [15, 60], [25, 99]]));
      const w = rand(2, Math.max(3, l - 1));
      const area = g >= 5 && Math.random() < 0.6;
      if (d >= 5 && area) {
        // find the width from area and length
        const A = l * w;
        return mcq({
          subject: "math", topic: T.geo, difficulty: d,
          prompt: [`A rectangle has area ${A} m² and length ${l} m. What is its width?`, `একটি আয়তক্ষেত্রের ক্ষেত্রফল ${A} বর্গমিটার এবং দৈর্ঘ্য ${l} মিটার। প্রস্থ কত?`],
          answer: w, wrong: [A - l, w + 2, Math.round(A / 2 - l), l - w || w + 3], unit: [" m", " মিটার"],
          explanation: [`Width = area ÷ length = ${A} ÷ ${l} = ${w} m.`, `প্রস্থ = ক্ষেত্রফল ÷ দৈর্ঘ্য = ${A} ÷ ${l} = ${w} মিটার।`],
        });
      }
      if (area) {
        return mcq({
          subject: "math", topic: T.geo, difficulty: d,
          prompt: [`A rectangle is ${l} cm long and ${w} cm wide. What is its area?`, `একটি আয়তক্ষেত্রের দৈর্ঘ্য ${l} সেমি, প্রস্থ ${w} সেমি। ক্ষেত্রফল কত?`],
          answer: l * w, wrong: [2 * (l + w), l + w, l * w + l, l * w - w], unit: [" cm²", " বর্গসেমি"],
          explanation: [`Area = length × width = ${l} × ${w} = ${l * w} cm².`, `ক্ষেত্রফল = দৈর্ঘ্য × প্রস্থ = ${l} × ${w} = ${l * w} বর্গসেমি।`],
        });
      }
      return mcq({
        subject: "math", topic: T.geo, difficulty: d,
        prompt: [`A rectangle is ${l} cm long and ${w} cm wide. What is its perimeter?`, `একটি আয়তক্ষেত্রের দৈর্ঘ্য ${l} সেমি, প্রস্থ ${w} সেমি। পরিসীমা কত?`],
        answer: 2 * (l + w), wrong: [l * w, l + w, 2 * l + w, 4 * l], unit: [" cm", " সেমি"],
        explanation: [`Perimeter = 2 × (${l} + ${w}) = ${2 * (l + w)} cm.`, `পরিসীমা = ২ × (${l} + ${w}) = ${2 * (l + w)} সেমি।`],
      });
    },
  },
  {
    id: "decimals", subject: "math", min: 5, max: 7,
    make: (d) => {
      const places = d <= 2 ? 1 : 2;
      const f = 10 ** places;
      const a = rand(1, d <= 3 ? 9 * f : 99 * f), b = rand(1, d <= 3 ? 9 * f : 50 * f);
      const sub = d >= 3 && Math.random() < 0.5 && a > b;
      const c = sub ? a - b : a + b;
      const fmt = (v: number) => (v / f).toFixed(places);
      const mixed = d >= 4 && places === 2;
      // mixed places: 4.5 + 0.25 style trap
      const aStr = mixed && a % 10 === 0 ? (a / f).toFixed(1) : fmt(a);
      return mcq({
        subject: "math", topic: T.dec, difficulty: d,
        prompt: [`${aStr} ${sub ? "−" : "+"} ${fmt(b)} = ?`, `${aStr} ${sub ? "−" : "+"} ${fmt(b)} = কত?`],
        answer: fmt(c), wrong: [fmt(c + f / 10), fmt(Math.abs(c - f / 10)), fmt(c + 1), fmt(c * 10)],
        explanation: [`Line up the decimal points, then ${sub ? "subtract" : "add"}: ${fmt(c)}.`, `দশমিক বিন্দু এক লাইনে রেখে ${sub ? "বিয়োগ" : "যোগ"} করো: ${fmt(c)}।`],
      });
    },
  },
  {
    id: "percent", subject: "math", min: 5, max: 8,
    make: (d) => {
      const p = pick(d <= 1 ? [10, 50, 25] : d <= 3 ? [5, 15, 20, 30, 40, 75] : d <= 5 ? [12, 35, 45, 65, 85] : [120, 150, 175, 8, 16]);
      const step = 100 / gcd(p, 100);
      const N = step * rand(1, d <= 2 ? 10 : d <= 4 ? 25 : 60);
      const ans = (p * N) / 100;
      return mcq({
        subject: "math", topic: T.pct, difficulty: d,
        prompt: [`What is ${p}% of ${N}?`, `${N}-এর ${p}% = কত?`],
        answer: num(ans), wrong: [num(ans + N / 10), num(ans * 2), num(N - ans), num(ans + 5)],
        explanation: [`${p}% of ${N} = ${p} × ${N} ÷ 100 = ${num(ans)}.`, `${N}-এর ${p}% = ${p} × ${N} ÷ ১০০ = ${num(ans)}।`],
      });
    },
  },
  {
    id: "average", subject: "math", min: 5, max: 8,
    make: (d) => {
      const n = d <= 2 ? 3 : d <= 4 ? 4 : 5;
      const mean = rand(...scale(d, [[4, 20], [10, 40], [20, 80], [30, 99], [50, 150], [100, 400]]));
      const vals: number[] = [];
      let rest = 0;
      for (let i = 0; i < n - 1; i++) {
        const dev = rand(-Math.min(mean - 1, 3 + d * 3), 3 + d * 3);
        vals.push(mean + dev);
        rest -= dev;
      }
      vals.push(mean + rest);
      if (vals.some((v) => v <= 0)) return GENERATORS.find((x) => x.id === "percent")!.make(d, 6);
      const sum = vals.reduce((s, v) => s + v, 0);
      return mcq({
        subject: "math", topic: T.avg, difficulty: d,
        prompt: [`What is the average of ${vals.join(", ")}?`, `${vals.join(", ")}-এর গড় কত?`],
        answer: mean, wrong: [mean + 1, mean - 1, sum, Math.round(sum / (n - 1))],
        explanation: [`Sum = ${sum}, and ${sum} ÷ ${n} = ${mean}.`, `যোগফল = ${sum}, আর ${sum} ÷ ${n} = ${mean}।`],
      });
    },
  },
  // ── Class 6–8 ──────────────────────────────────────────
  {
    id: "integers", subject: "math", min: 6, max: 8,
    make: (d) => {
      const r = scale(d, [[1, 12], [5, 20], [8, 30], [10, 50], [15, 80], [20, 99]]);
      const a = rand(...r) * (Math.random() < 0.6 ? -1 : 1);
      const b = rand(...r) * (Math.random() < 0.5 ? -1 : 1);
      let prompt: string, ans: number;
      if (d >= 5) {
        const c = rand(2, 9) * (Math.random() < 0.5 ? -1 : 1);
        prompt = `(${signed(a)}) × (${signed(c)}) + (${signed(b)})`;
        ans = a * c + b;
      } else if (d >= 3) {
        const c = rand(2, 9) * (Math.random() < 0.5 ? -1 : 1);
        prompt = `(${signed(a)}) × (${signed(c)})`;
        ans = a * c;
      } else {
        prompt = `(${signed(a)}) + (${signed(b)})`;
        ans = a + b;
      }
      return mcq({
        subject: "math", topic: T.int, difficulty: d,
        prompt: [`${prompt} = ?`, `${prompt} = কত?`],
        answer: signed(ans), wrong: [signed(-ans || 1), signed(ans + 2), signed(ans - 2), signed(ans + 10)],
        explanation: [`Watch the signs: the answer is ${signed(ans)}.`, `চিহ্নের দিকে খেয়াল রাখো: উত্তর ${signed(ans)}।`],
      });
    },
  },
  {
    id: "lcmhcf", subject: "math", min: 6, max: 8,
    make: (d) => {
      let p = 2, q = 3;
      do {
        p = rand(2, d <= 3 ? 5 : 9);
        q = rand(2, d <= 3 ? 7 : 11);
      } while (p === q || gcd(p, q) !== 1);
      const h = rand(...scale(d, [[2, 4], [2, 6], [3, 8], [4, 12], [6, 15], [8, 20]]));
      const a = h * p, b = h * q, lcm = h * p * q;
      if (Math.random() < 0.5) {
        return mcq({
          subject: "math", topic: T.lcm, difficulty: d,
          prompt: [`What is the LCM of ${a} and ${b}?`, `${a} ও ${b}-এর ল.সা.গু কত?`],
          answer: lcm, wrong: [a * b === lcm ? lcm * 2 : a * b, h, lcm + h, Math.max(a, b)],
          explanation: [`HCF is ${h}, so LCM = ${a} × ${b} ÷ ${h} = ${lcm}.`, `গ.সা.গু ${h}, তাই ল.সা.গু = ${a} × ${b} ÷ ${h} = ${lcm}।`],
        });
      }
      return mcq({
        subject: "math", topic: T.lcm, difficulty: d,
        prompt: [`What is the HCF of ${a} and ${b}?`, `${a} ও ${b}-এর গ.সা.গু কত?`],
        answer: h, wrong: [lcm, h * 2, h === 2 ? 1 : h - 1, p * q],
        explanation: [`${a} = ${h} × ${p} and ${b} = ${h} × ${q}; the biggest shared factor is ${h}.`, `${a} = ${h} × ${p} এবং ${b} = ${h} × ${q}; সবচেয়ে বড় সাধারণ গুণনীয়ক ${h}।`],
      });
    },
  },
  {
    id: "ratio", subject: "math", min: 6, max: 8,
    make: (d) => {
      let p = 1, q = 2;
      do {
        p = rand(1, d <= 2 ? 5 : 9);
        q = rand(2, d <= 2 ? 6 : 11);
      } while (p === q || gcd(p, q) !== 1);
      const k = rand(...scale(d, [[2, 5], [3, 8], [4, 12], [6, 15], [8, 20], [12, 30]]));
      if (d >= 4) {
        const total = (p + q) * k;
        return mcq({
          subject: "math", topic: T.ratio, difficulty: d,
          prompt: [`Share ${total} taka between Rina and Joy in the ratio ${p} : ${q}. How much does Rina get?`, `${total} টাকা রিনা ও জয়ের মধ্যে ${p} : ${q} অনুপাতে ভাগ করো। রিনা কত পাবে?`],
          answer: p * k, wrong: [q * k, Math.round(total / 2), p * k + k, total - p], unit: [" taka", " টাকা"],
          explanation: [`${p} + ${q} = ${p + q} parts, each part = ${total} ÷ ${p + q} = ${k}. Rina gets ${p} × ${k} = ${p * k}.`, `মোট ${p + q} ভাগ, প্রতি ভাগ = ${total} ÷ ${p + q} = ${k}। রিনা পাবে ${p} × ${k} = ${p * k}।`],
        });
      }
      return mcq({
        subject: "math", topic: T.ratio, difficulty: d,
        prompt: [`Simplify the ratio ${p * k} : ${q * k}.`, `${p * k} : ${q * k} অনুপাতটিকে সরল করো।`],
        answer: `${p} : ${q}`, wrong: [`${q} : ${p}`, `${p + 1} : ${q}`, `${p} : ${q + 1}`, `${p * 2} : ${q * 2 + 1}`],
        explanation: [`Divide both by ${k}: ${p} : ${q}.`, `দুটোকেই ${k} দিয়ে ভাগ করো: ${p} : ${q}।`],
      });
    },
  },
  {
    id: "powers", subject: "math", min: 6, max: 9,
    make: (d) => {
      const kind = d <= 2 ? "sq" : pick(d <= 4 ? ["sq", "root", "pow2"] : ["root", "cube", "cuberoot", "pow2"]);
      if (kind === "root") {
        const r = rand(...scale(d, [[2, 10], [4, 12], [11, 20], [13, 25], [16, 35], [21, 49]]));
        return mcq({
          subject: "math", topic: T.pow, difficulty: d,
          prompt: [`√${r * r} = ?`, `√${r * r} = কত?`], answer: r, wrong: [r + 1, r - 1, r * 2, Math.round((r * r) / 2)],
          explanation: [`${r} × ${r} = ${r * r}, so √${r * r} = ${r}.`, `${r} × ${r} = ${r * r}, তাই √${r * r} = ${r}।`],
        });
      }
      if (kind === "cube" || kind === "cuberoot") {
        const r = rand(2, d >= 6 ? 15 : 10);
        return kind === "cube"
          ? mcq({ subject: "math", topic: T.pow, difficulty: d, prompt: [`${r}³ = ?`, `${r}³ = কত?`], answer: r ** 3, wrong: [r * 3, r * r, r ** 3 + r, (r + 1) ** 3], explanation: [`${r} × ${r} × ${r} = ${r ** 3}.`, `${r} × ${r} × ${r} = ${r ** 3}।`] })
          : mcq({ subject: "math", topic: T.pow, difficulty: d, prompt: [`∛${r ** 3} = ?`, `∛${r ** 3} = কত?`], answer: r, wrong: [r + 1, r - 1, r * 3, r * r], explanation: [`${r}³ = ${r ** 3}.`, `${r}³ = ${r ** 3}।`] });
      }
      if (kind === "pow2") {
        const e = rand(4, d >= 5 ? 12 : 9);
        return mcq({ subject: "math", topic: T.pow, difficulty: d, prompt: [`2^${e} = ?`, `2^${e} = কত?`], answer: 2 ** e, wrong: [2 * e, 2 ** (e - 1), 2 ** (e + 1), e ** 2], explanation: [`Double ${e} times: 2^${e} = ${2 ** e}.`, `২-কে ${e} বার গুণ করো: ${2 ** e}।`] });
      }
      const r = rand(...scale(d, [[2, 12], [8, 15]]));
      return mcq({ subject: "math", topic: T.pow, difficulty: d, prompt: [`${r}² = ?`, `${r}² = কত?`], answer: r * r, wrong: [r * 2, r * r + r, (r + 1) ** 2, r * r - 1], explanation: [`${r} × ${r} = ${r * r}.`, `${r} × ${r} = ${r * r}।`] });
    },
  },
  {
    id: "linear", subject: "math", min: 7, max: 9,
    make: (d) => {
      const x = rand(-3, 12) || 4;
      if (d >= 5) {
        // ax + b = cx + e
        const a = rand(3, 9), c = rand(1, a - 1), b = rand(-15, 15);
        const e = (a - c) * x + b;
        return mcq({
          subject: "math", topic: T.eq, difficulty: d,
          prompt: [`Solve: ${a}x${term(b)} = ${c}x${term(e)}`, `সমাধান করো: ${a}x${term(b)} = ${c}x${term(e)}`],
          answer: `x = ${signed(x)}`, wrong: [`x = ${signed(x + 1)}`, `x = ${signed(-x || 2)}`, `x = ${signed(x + 3)}`, `x = ${signed(x * 2 || 5)}`],
          explanation: [`Move x terms left: ${a - c}x = ${e - b}, so x = ${signed(x)}.`, `x-এর পদ বামে নাও: ${a - c}x = ${e - b}, তাই x = ${signed(x)}।`],
        });
      }
      const a = d <= 1 ? 1 : rand(2, d <= 3 ? 6 : 12);
      const b = rand(1, 10 + d * 5) * (d >= 3 && Math.random() < 0.4 ? -1 : 1);
      const c = a * x + b;
      return mcq({
        subject: "math", topic: T.eq, difficulty: d,
        prompt: [`If ${term(a, "x", true)}${term(b)} = ${signed(c)}, then x = ?`, `যদি ${term(a, "x", true)}${term(b)} = ${signed(c)} হয়, তবে x = কত?`],
        answer: signed(x), wrong: [signed(x + 1), signed(x - 1), signed(c - b), signed(c + b)],
        explanation: [`${a === 1 ? "x" : `${a}x`} = ${signed(c)} − (${signed(b)}) = ${signed(c - b)}${a === 1 ? "" : `, so x = ${signed(x)}`}.`, `${a === 1 ? "x" : `${a}x`} = ${signed(c - b)}${a === 1 ? "" : `, তাই x = ${signed(x)}`}।`],
      });
    },
  },
  {
    id: "likeTerms", subject: "math", min: 6, max: 8,
    make: (d) => {
      const v = pick(["a", "x", "y", "m"]);
      const p = rand(2, 9 + d * 2), q = rand(1, 9 + d * 2), r = rand(1, p + q - 1);
      const extra = d >= 4 ? rand(2, 9) : 0;
      const ans = p + q - r;
      const expr = `${p}${v} + ${q}${v} − ${r}${v}${extra ? ` + ${extra}${v}²` : ""}`;
      const answer = `${extra ? `${extra}${v}² + ` : ""}${ans === 1 ? "" : ans}${v}`;
      return mcq({
        subject: "math", topic: T.alg, difficulty: d,
        prompt: [`Simplify: ${expr}`, `সরল করো: ${expr}`],
        answer, wrong: [`${extra ? `${extra}${v}² + ` : ""}${p + q + r}${v}`, `${extra ? `${extra + ans}${v}³` : `${ans}${v}²`}`, `${extra ? `${extra}${v}² + ` : ""}${ans + 1}${v}`, `${extra + ans}${v}`],
        explanation: [`Add like terms only: ${p} + ${q} − ${r} = ${ans}.`, `শুধু সদৃশ পদ যোগ করো: ${p} + ${q} − ${r} = ${ans}।`],
      });
    },
  },
  {
    id: "angles", subject: "math", min: 6, max: 9,
    make: (d) => {
      const kind = d <= 2 ? pick(["tri", "comp"]) : d <= 4 ? pick(["tri", "supp", "ext"]) : pick(["ext", "int", "supp"]);
      if (kind === "tri") {
        const a = rand(25, 90), b = rand(20, 160 - a);
        return mcq({ subject: "math", topic: T.geo, difficulty: d, prompt: [`Two angles of a triangle are ${a}° and ${b}°. What is the third?`, `ত্রিভুজের দুটি কোণ ${a}° ও ${b}°। তৃতীয় কোণটি কত?`], answer: `${180 - a - b}°`, wrong: [`${360 - a - b}°`, `${180 - a - b + 10}°`, `${90 - Math.min(a, b)}°`, `${a + b}°`], explanation: [`Angles of a triangle add to 180°: 180 − ${a} − ${b} = ${180 - a - b}°.`, `ত্রিভুজের তিন কোণের যোগফল ১৮০°: ১৮০ − ${a} − ${b} = ${180 - a - b}°।`] });
      }
      if (kind === "comp" || kind === "supp") {
        const total = kind === "comp" ? 90 : 180;
        const a = rand(12, total - 12);
        return mcq({ subject: "math", topic: T.geo, difficulty: d, prompt: [`What is the ${kind === "comp" ? "complement" : "supplement"} of ${a}°?`, `${a}°-এর ${kind === "comp" ? "পূরক" : "সম্পূরক"} কোণ কত?`], answer: `${total - a}°`, wrong: [`${(kind === "comp" ? 180 : 90) - a > 0 ? (kind === "comp" ? 180 : 90) - a : 360 - a}°`, `${total - a + 10}°`, `${360 - a}°`, `${total - a - 5}°`], explanation: [`${kind === "comp" ? "Complementary angles add to 90°" : "Supplementary angles add to 180°"}: ${total} − ${a} = ${total - a}°.`, `${kind === "comp" ? "পূরক কোণের যোগফল ৯০°" : "সম্পূরক কোণের যোগফল ১৮০°"}: ${total} − ${a} = ${total - a}°।`] });
      }
      const n = pick([3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20]);
      if (kind === "ext") {
        return mcq({ subject: "math", topic: T.geo, difficulty: d, prompt: [`Each exterior angle of a regular ${n}-sided polygon is…`, `সুষম ${n} বাহুবিশিষ্ট বহুভুজের প্রতিটি বহিঃস্থ কোণ কত?`], answer: `${360 / n}°`, wrong: [`${180 - 360 / n}°`, `${180 / n}°`.replace(/\.\d+/, ""), `${360 / n + 10}°`, `${(n - 2) * 180}°`], explanation: [`Exterior angles add to 360°: 360 ÷ ${n} = ${360 / n}°.`, `বহিঃস্থ কোণগুলোর যোগফল ৩৬০°: ৩৬০ ÷ ${n} = ${360 / n}°।`] });
      }
      return mcq({ subject: "math", topic: T.geo, difficulty: d, prompt: [`Each interior angle of a regular ${n}-sided polygon is…`, `সুষম ${n} বাহুবিশিষ্ট বহুভুজের প্রতিটি অন্তঃস্থ কোণ কত?`], answer: `${180 - 360 / n}°`, wrong: [`${360 / n}°`, `${(n - 2) * 180}°`, `${180 - 360 / n + 10}°`, `${180 - 360 / n - 15}°`], explanation: [`Interior = 180° − exterior = 180 − ${360 / n} = ${180 - 360 / n}°.`, `অন্তঃস্থ = ১৮০° − বহিঃস্থ = ১৮০ − ${360 / n} = ${180 - 360 / n}°।`] });
    },
  },
  {
    id: "interest", subject: "math", min: 7, max: 10,
    make: (d) => {
      if (d >= 3 && Math.random() < 0.4) {
        const cost = 20 * rand(2, 25 + d * 10);
        const p = pick([5, 10, 15, 20, 25, 30, 40]);
        const sell = cost + (cost * p) / 100;
        return mcq({ subject: "math", topic: T.money, difficulty: d, prompt: [`A shopkeeper buys a bag for ${cost} taka and sells it for ${sell} taka. What is the profit percentage?`, `একজন দোকানি ${cost} টাকায় একটি ব্যাগ কিনে ${sell} টাকায় বিক্রি করল। শতকরা লাভ কত?`], answer: `${p}%`, wrong: [`${sell - cost}%`.length < 6 ? `${sell - cost}%` : `${p + 5}%`, `${p + 5}%`, `${Math.max(1, p - 5)}%`, `${Math.round(((sell - cost) / sell) * 100)}%`], explanation: [`Profit = ${sell - cost}; ${sell - cost} ÷ ${cost} × 100 = ${p}%.`, `লাভ = ${sell - cost}; ${sell - cost} ÷ ${cost} × ১০০ = ${p}%।`] });
      }
      const P = 100 * rand(...scale(d, [[1, 10], [2, 20], [5, 50], [10, 80], [10, 150], [20, 300]]));
      const r = pick(d <= 2 ? [5, 10] : [4, 5, 6, 7, 8, 10, 12]);
      const t = rand(1, d <= 2 ? 3 : 6);
      const I = (P * r * t) / 100;
      return mcq({ subject: "math", topic: T.money, difficulty: d, prompt: [`Simple interest on ${P} taka at ${r}% per year for ${t} year${t > 1 ? "s" : ""}?`, `${P} টাকার ${r}% হার মুনাফায় ${t} বছরের সরল মুনাফা কত?`], answer: num(I), wrong: [num(I + P / 100), num((P * r) / 100), num(P + I), num(I * 2)], unit: [" taka", " টাকা"], explanation: [`I = P × r × t ÷ 100 = ${P} × ${r} × ${t} ÷ 100 = ${num(I)}.`, `মুনাফা = ${P} × ${r} × ${t} ÷ ১০০ = ${num(I)}।`] });
    },
  },
  {
    id: "identity", subject: "math", min: 8, max: 10,
    make: (d) => {
      const a = rand(1, 4 + d * 2), b = rand(1, 4 + d * 2);
      const s = a + b, p = a * b;
      if (d >= 4 && Math.random() < 0.5) {
        const diff = Math.abs(a - b);
        return mcq({ subject: "math", topic: T.alg, difficulty: d, prompt: [`If a + b = ${s} and ab = ${p}, find (a − b)².`, `a + b = ${s} এবং ab = ${p} হলে (a − b)² = কত?`], answer: diff * diff, wrong: [s * s - 2 * p, s * s, s * s + 4 * p, s * s - p], explanation: [`(a − b)² = (a + b)² − 4ab = ${s * s} − ${4 * p} = ${diff * diff}.`, `(a − b)² = (a + b)² − 4ab = ${s * s} − ${4 * p} = ${diff * diff}।`] });
      }
      return mcq({ subject: "math", topic: T.alg, difficulty: d, prompt: [`If a + b = ${s} and ab = ${p}, find a² + b².`, `a + b = ${s} এবং ab = ${p} হলে a² + b² = কত?`], answer: s * s - 2 * p, wrong: [s * s, s * s + 2 * p, s * s - p, s * s - 4 * p], explanation: [`a² + b² = (a + b)² − 2ab = ${s * s} − ${2 * p} = ${s * s - 2 * p}.`, `a² + b² = (a + b)² − 2ab = ${s * s} − ${2 * p} = ${s * s - 2 * p}।`] });
    },
  },
  {
    id: "pythagoras", subject: "math", min: 8, max: 10,
    make: (d) => {
      const [x, y, z] = pick(d <= 2 ? [[3, 4, 5]] : d <= 4 ? [[3, 4, 5], [5, 12, 13], [6, 8, 10]] : [[5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]]);
      const k = d <= 2 ? rand(1, 3) : rand(1, 4);
      const [a, b, c] = [x * k, y * k, z * k];
      if (d >= 3 && Math.random() < 0.5) {
        return mcq({ subject: "math", topic: T.geo, difficulty: d, prompt: [`A right triangle has hypotenuse ${c} cm and one side ${a} cm. The other side is…`, `একটি সমকোণী ত্রিভুজের অতিভুজ ${c} সেমি, একটি বাহু ${a} সেমি। অপর বাহু কত?`], answer: b, wrong: [c - a, c + a, b + k, a], unit: [" cm", " সেমি"], explanation: [`√(${c}² − ${a}²) = √${c * c - a * a} = ${b}.`, `√(${c}² − ${a}²) = √${c * c - a * a} = ${b}।`] });
      }
      return mcq({ subject: "math", topic: T.geo, difficulty: d, prompt: [`A right triangle has legs ${a} cm and ${b} cm. How long is the hypotenuse?`, `একটি সমকোণী ত্রিভুজের দুই বাহু ${a} সেমি ও ${b} সেমি। অতিভুজ কত?`], answer: c, wrong: [a + b, c + k, c * c, b + 1], unit: [" cm", " সেমি"], explanation: [`√(${a}² + ${b}²) = √${c * c} = ${c}.`, `√(${a}² + ${b}²) = √${c * c} = ${c}।`] });
    },
  },
  {
    id: "circle", subject: "math", min: 8, max: 10,
    make: (d) => {
      const r = 7 * rand(1, d <= 3 ? 2 : 5);
      if (Math.random() < 0.5 || d <= 2) {
        const C = (2 * 22 * r) / 7;
        return mcq({ subject: "math", topic: T.geo, difficulty: d, prompt: [`Circumference of a circle with radius ${r} cm? (π = 22/7)`, `${r} সেমি ব্যাসার্ধের বৃত্তের পরিধি কত? (π = ২২/৭)`], answer: C, wrong: [C / 2, (22 * r * r) / 7, C + 22, C * 2], unit: [" cm", " সেমি"], explanation: [`C = 2πr = 2 × 22/7 × ${r} = ${C}.`, `পরিধি = ২πr = ২ × ২২/৭ × ${r} = ${C}।`] });
      }
      const A = (22 * r * r) / 7;
      return mcq({ subject: "math", topic: T.geo, difficulty: d, prompt: [`Area of a circle with radius ${r} cm? (π = 22/7)`, `${r} সেমি ব্যাসার্ধের বৃত্তের ক্ষেত্রফল কত? (π = ২২/৭)`], answer: A, wrong: [(2 * 22 * r) / 7, A * 2, A + 22, (22 * r) / 7], unit: [" cm²", " বর্গসেমি"], explanation: [`A = πr² = 22/7 × ${r * r} = ${A}.`, `ক্ষেত্রফল = πr² = ২২/৭ × ${r * r} = ${A}।`] });
    },
  },
  {
    id: "indices", subject: "math", min: 8, max: 10,
    make: (d) => {
      const base = pick(["a", "x", "2", "3"]);
      const m = rand(2, 4 + d), n = rand(2, 3 + d);
      const kind = d <= 2 ? "mul" : pick(["mul", "pow", "div"]);
      const [expr, e, wrong] =
        kind === "mul" ? [`${base}^${m} × ${base}^${n}`, m + n, [m * n, m + n + 1, Math.abs(m - n) || 1]]
        : kind === "pow" ? [`(${base}^${m})^${n}`, m * n, [m + n, m * n + 1, m ** n]]
        : [`${base}^${m + n} ÷ ${base}^${n}`, m, [(m + n) / n === Math.round((m + n) / n) ? (m + n) / n : m + 1, m + 2 * n, n]];
      return mcq({ subject: "math", topic: T.pow, difficulty: d, prompt: [`${expr} = ?`, `${expr} = কত?`], answer: `${base}^${e}`, wrong: wrong.map((w) => `${base}^${w}`), explanation: [`${kind === "mul" ? "Multiply → add powers" : kind === "pow" ? "Power of a power → multiply powers" : "Divide → subtract powers"}: ${base}^${e}.`, `${kind === "mul" ? "গুণ → ঘাত যোগ" : kind === "pow" ? "ঘাতের ঘাত → ঘাত গুণ" : "ভাগ → ঘাত বিয়োগ"}: ${base}^${e}।`] });
    },
  },
  // ── Class 9–12 ─────────────────────────────────────────
  {
    id: "quadratic", subject: "math", min: 9, max: 11,
    make: (d) => {
      let r1 = rand(-4 - d, 6 + d), r2 = rand(-4 - d, 6 + d);
      if (r1 === r2) r2 = r1 + 2;
      if (d <= 2) [r1, r2] = [Math.abs(r1) || 1, Math.abs(r2) || 3];
      if (r1 === r2) r2 = r1 + 1;
      const [lo, hi] = [Math.min(r1, r2), Math.max(r1, r2)];
      const b = -(lo + hi), c = lo * hi;
      const eq = `x²${term(b, "x")}${term(c)} = 0`;
      const fmt = (a: number, z: number) => `${signed(Math.min(a, z))} and ${signed(Math.max(a, z))}`;
      const fmtBn = (a: number, z: number) => `${signed(Math.min(a, z))} ও ${signed(Math.max(a, z))}`;
      const wrongPairs: [number, number][] = [[-lo, -hi], [lo + 1, hi + 1], [-lo, hi]];
      return mcq({
        subject: "math", topic: T.alg, difficulty: d,
        prompt: [`Roots of ${eq}?`, `${eq} সমীকরণের মূলদ্বয় কত?`],
        answer: fmt(lo, hi), answerBn: fmtBn(lo, hi),
        wrong: wrongPairs.map(([a, z]) => fmt(a, z)), wrongBn: wrongPairs.map(([a, z]) => fmtBn(a, z)),
        explanation: [`It factors as (x ${lo < 0 ? "+" : "−"} ${Math.abs(lo)})(x ${hi < 0 ? "+" : "−"} ${Math.abs(hi)}) = 0.`, `উৎপাদকে: (x ${lo < 0 ? "+" : "−"} ${Math.abs(lo)})(x ${hi < 0 ? "+" : "−"} ${Math.abs(hi)}) = ০।`],
      });
    },
  },
  {
    id: "trig", subject: "math", min: 9, max: 11,
    make: (d) => {
      const easy: [string, string][] = [["sin 30°", "1/2"], ["cos 60°", "1/2"], ["tan 45°", "1"], ["sin 90°", "1"], ["cos 0°", "1"], ["sin 0°", "0"], ["cos 90°", "0"], ["sin 60°", "√3/2"], ["cos 30°", "√3/2"], ["tan 60°", "√3"], ["tan 30°", "1/√3"], ["sin 45°", "1/√2"]];
      const hard: [string, string][] = [["sin²30° + cos²30°", "1"], ["sin 30° + cos 60°", "1"], ["2 sin 30° cos 30°", "√3/2"], ["tan 45° + sin 90°", "2"], ["sin 60° · cos 30°", "3/4"], ["1 − 2 sin²45°", "0"], ["sec²45° − tan²45°", "1"], ["cos²60° − sin²60°", "−1/2"], ["tan 60° · tan 30°", "1"], ["2 cos² 30° − 1", "1/2"]];
      const [expr, ans] = pick(d <= 2 ? easy : d <= 4 ? [...easy, ...hard] : hard);
      const values = ["0", "1/2", "1/√2", "√3/2", "1", "√3", "1/√3", "2", "3/4", "−1/2", "√2"];
      const wrong = values.filter((v) => v !== ans).sort(() => Math.random() - 0.5).slice(0, 3);
      return mcq({ subject: "math", topic: T.trig, difficulty: d, prompt: [`${expr} = ?`, `${expr} = কত?`], answer: ans, wrong, explanation: [`Use the standard values table: ${expr} = ${ans}.`, `আদর্শ মানের তালিকা থেকে: ${expr} = ${ans}।`] });
    },
  },
  {
    id: "ap", subject: "math", min: 9, max: 11,
    make: (d) => {
      const a = rand(1, 10 + d * 2), step = rand(2, 3 + d) * (d >= 5 && Math.random() < 0.4 ? -1 : 1);
      const n = rand(8, 10 + d * 4);
      const seq = [0, 1, 2, 3].map((i) => signed(a + i * step)).join(", ");
      if (d >= 4 && Math.random() < 0.5) {
        const k = rand(5, 10 + d);
        const S = (k * (2 * a + (k - 1) * step)) / 2;
        return mcq({ subject: "math", topic: T.seq, difficulty: d, prompt: [`Sum of the first ${k} terms of ${seq}, …?`, `${seq}, … ধারার প্রথম ${k}টি পদের সমষ্টি কত?`], answer: signed(S), wrong: [signed(S + step * k), signed(k * (a + (k - 1) * step)), signed(S - a), signed(S + a)], explanation: [`S = n/2 × (2a + (n − 1)d) = ${k}/2 × (${2 * a} + ${(k - 1) * step}) = ${signed(S)}.`, `S = n/২ × (২a + (n − ১)d) = ${signed(S)}।`] });
      }
      const t = a + (n - 1) * step;
      return mcq({ subject: "math", topic: T.seq, difficulty: d, prompt: [`What is term ${n} of ${seq}, …?`, `${seq}, … ধারার ${n}তম পদ কত?`], answer: signed(t), wrong: [signed(a + n * step), signed(t - step * 2), signed(n * step), signed(t + 1)], explanation: [`tₙ = a + (n − 1)d = ${a} + ${n - 1} × ${signed(step)} = ${signed(t)}.`, `tₙ = a + (n − ১)d = ${a} + ${n - 1} × ${signed(step)} = ${signed(t)}।`] });
    },
  },
  {
    id: "sets", subject: "math", min: 9, max: 10,
    make: (d) => {
      const both = rand(2, 5 + d * 3), a = both + rand(3, 10 + d * 4), b = both + rand(3, 10 + d * 4);
      const union = a + b - both;
      if (d >= 4) {
        const total = union + rand(2, 15);
        return mcq({ subject: "math", topic: T.sets, difficulty: d, prompt: [`In a class of ${total}, ${a} like cricket, ${b} like football and ${both} like both. How many like neither?`, `${total} জনের একটি শ্রেণিতে ${a} জন ক্রিকেট, ${b} জন ফুটবল এবং ${both} জন দুটোই পছন্দ করে। কতজন কোনোটিই পছন্দ করে না?`], answer: total - union, wrong: [total - a - b > 0 ? total - a - b : total - union + both, total - union + 1, both, total - union - 1], explanation: [`Either = ${a} + ${b} − ${both} = ${union}; neither = ${total} − ${union} = ${total - union}.`, `যেকোনো একটি = ${a} + ${b} − ${both} = ${union}; কোনোটিই না = ${total} − ${union} = ${total - union}।`] });
      }
      return mcq({ subject: "math", topic: T.sets, difficulty: d, prompt: [`n(A) = ${a}, n(B) = ${b}, n(A ∩ B) = ${both}. Find n(A ∪ B).`, `n(A) = ${a}, n(B) = ${b}, n(A ∩ B) = ${both} হলে n(A ∪ B) = কত?`], answer: union, wrong: [a + b, union - both, union + 1, a + b + both], explanation: [`n(A ∪ B) = ${a} + ${b} − ${both} = ${union}.`, `n(A ∪ B) = ${a} + ${b} − ${both} = ${union}।`] });
    },
  },
  {
    id: "logs", subject: "math", min: 9, max: 12,
    make: (d) => {
      const SUB = "₀₁₂₃₄₅₆₇₈₉";
      const sub = (n: number) => String(n).replace(/\d/g, (c) => SUB[Number(c)]);
      if (d >= 4) {
        const [b1, k1] = [pick([2, 3, 5]), rand(2, 4)];
        const [b2, k2] = [pick([2, 3, 10]), rand(1, 4)];
        const ans = k1 + k2;
        const expr = `log${sub(b1)} ${b1 ** k1} + log${sub(b2)} ${b2 ** k2}`;
        return mcq({ subject: "math", topic: T.log, difficulty: d, prompt: [`${expr} = ?`, `${expr} = কত?`], answer: ans, wrong: [k1 * k2, ans + 1, ans - 1, b1 + b2], explanation: [`${k1} + ${k2} = ${ans}.`, `${k1} + ${k2} = ${ans}।`] });
      }
      const b = pick([2, 3, 5, 10]), k = rand(2, b === 10 ? 4 : b === 2 ? 7 : 4);
      return mcq({ subject: "math", topic: T.log, difficulty: d, prompt: [`log${sub(b)} ${b ** k} = ?`, `log${sub(b)} ${b ** k} = কত?`], answer: k, wrong: [k + 1, k - 1, b * k, (b ** k) / b], explanation: [`${b}^${k} = ${b ** k}, so the log is ${k}.`, `${b}^${k} = ${b ** k}, তাই লগ = ${k}।`] });
    },
  },
  {
    id: "coord", subject: "math", min: 9, max: 12,
    make: (d) => {
      const [dx, dy, dist] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15]]);
      const x1 = rand(-5, 5), y1 = rand(-5, 5);
      const sx = Math.random() < 0.5 ? 1 : -1, sy = Math.random() < 0.5 ? 1 : -1;
      const x2 = x1 + sx * dx, y2 = y1 + sy * dy;
      const P = `(${signed(x1)}, ${signed(y1)})`, Q = `(${signed(x2)}, ${signed(y2)})`;
      if (d >= 3 && Math.random() < 0.5) {
        const g = gcd(dy, dx), m = `${sx * sy < 0 ? "−" : ""}${dy / g}${dx / g === 1 ? "" : `/${dx / g}`}`;
        const inv = `${sx * sy < 0 ? "−" : ""}${dx / g}${dy / g === 1 ? "" : `/${dy / g}`}`;
        const neg = m.startsWith("−") ? m.slice(1) : `−${m}`;
        return mcq({ subject: "math", topic: T.coord, difficulty: d, prompt: [`Slope of the line through ${P} and ${Q}?`, `${P} ও ${Q} বিন্দুগামী রেখার ঢাল কত?`], answer: m, wrong: [inv, neg, `${dist}`], explanation: [`m = (y₂ − y₁)/(x₂ − x₁) = ${signed(y2 - y1)}/${signed(x2 - x1)} = ${m}.`, `ঢাল = (y₂ − y₁)/(x₂ − x₁) = ${signed(y2 - y1)}/${signed(x2 - x1)} = ${m}।`] });
      }
      return mcq({ subject: "math", topic: T.coord, difficulty: d, prompt: [`Distance between ${P} and ${Q}?`, `${P} ও ${Q} বিন্দুর দূরত্ব কত?`], answer: dist, wrong: [dx + dy, dist + 1, dist * dist, Math.abs(dx - dy) + dist], explanation: [`√(${dx}² + ${dy}²) = √${dist * dist} = ${dist}.`, `√(${dx}² + ${dy}²) = √${dist * dist} = ${dist}।`] });
    },
  },
  {
    id: "derivative", subject: "math", min: 11, max: 12,
    make: (d) => {
      const a = rand(1, 3 + d), b = rand(-6, 6), c = rand(1, 9), k = rand(-3, 4);
      if (d <= 2) {
        const n = rand(2, 5);
        return mcq({ subject: "math", topic: T.calc, difficulty: d, prompt: [`d/dx (${a === 1 ? "" : a}x^${n}) = ?`, `d/dx (${a === 1 ? "" : a}x^${n}) = কত?`], answer: `${a * n}x^${n - 1}`.replace("x^1", "x"), wrong: [`${a}x^${n - 1}`.replace("x^1", "x"), `${a * n}x^${n}`, `${a * (n + 1)}x^${n + 1}`], explanation: [`Power rule: bring down ${n}, subtract 1 from the power.`, `ঘাত সূত্র: ${n} সামনে আনো, ঘাত থেকে ১ বাদ দাও।`] });
      }
      // f(x) = a x³ + b x² + c x  →  f'(k)
      const val = 3 * a * k * k + 2 * b * k + c;
      const f = `${a === 1 ? "" : a}x³${term(b, "x²")}${term(c, "x")}`;
      return mcq({ subject: "math", topic: T.calc, difficulty: d, prompt: [`If f(x) = ${f}, find f′(${signed(k)}).`, `f(x) = ${f} হলে f′(${signed(k)}) = কত?`], answer: signed(val), wrong: [signed(a * k ** 3 + b * k * k + c * k), signed(val + c), signed(3 * a * k + 2 * b + c), signed(val - 2 * b * k || val + 2)], explanation: [`f′(x) = ${3 * a}x²${term(2 * b, "x")}${term(c)}; at x = ${signed(k)} this is ${signed(val)}.`, `f′(x) = ${3 * a}x²${term(2 * b, "x")}${term(c)}; x = ${signed(k)} বসালে ${signed(val)}।`] });
    },
  },
  {
    id: "integral", subject: "math", min: 11, max: 12,
    make: (d) => {
      const n = rand(1, d >= 4 ? 3 : 2), c = rand(1, 3), k = rand(1, d >= 4 ? 4 : 3);
      const coef = (n + 1) * c; // ∫₀ᵏ (n+1)c xⁿ dx = c kⁿ⁺¹
      const ans = c * k ** (n + 1);
      const f = `${coef}x${n === 1 ? "" : n === 2 ? "²" : "³"}`;
      return mcq({ subject: "math", topic: T.calc, difficulty: d, prompt: [`∫₀^${k} ${f} dx = ?`, `∫₀^${k} ${f} dx = কত?`], answer: ans, wrong: [coef * k ** n, ans * 2, coef * k ** (n + 1), ans + c], explanation: [`Antiderivative: ${c === 1 ? "" : c}x^${n + 1}. At ${k}: ${ans}; at 0: 0.`, `সমাকল: ${c === 1 ? "" : c}x^${n + 1}। ${k}-এ ${ans}, ০-তে ০।`] });
    },
  },
  {
    id: "det", subject: "math", min: 11, max: 12,
    make: (d) => {
      const r = () => rand(-3 - d, 5 + d);
      const [a, b, c, e] = [r(), r(), r(), r()];
      const det = a * e - b * c;
      return mcq({ subject: "math", topic: T.matrix, difficulty: d, prompt: [`Determinant of [[${a}, ${b}], [${c}, ${e}]]?`, `[[${a}, ${b}], [${c}, ${e}]] ম্যাট্রিক্সের নির্ণায়ক কত?`], answer: signed(det), wrong: [signed(a * e + b * c), signed(a * b - c * e), signed(-det || 1), signed(det + 1)], explanation: [`ad − bc = ${a}×${e} − ${b}×${c} = ${signed(det)}.`, `ad − bc = ${a}×${e} − ${b}×${c} = ${signed(det)}।`] });
    },
  },
  {
    id: "ncr", subject: "math", min: 11, max: 12,
    make: (d) => {
      const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
      const n = rand(4, 5 + d), r = rand(2, Math.min(4, n - 1));
      const C = fact(n) / (fact(r) * fact(n - r)), P = fact(n) / fact(n - r);
      return Math.random() < 0.5
        ? mcq({ subject: "math", topic: T.count, difficulty: d, prompt: [`${n}C${r} = ?`, `${n}C${r} = কত?`], answer: C, wrong: [P, C + n, n * r, C * 2], explanation: [`${n}! ÷ (${r}! × ${n - r}!) = ${C}.`, `${n}! ÷ (${r}! × ${n - r}!) = ${C}।`] })
        : mcq({ subject: "math", topic: T.count, difficulty: d, prompt: [`${n}P${r} = ?`, `${n}P${r} = কত?`], answer: P, wrong: [C, P / 2, n ** r, P + n], explanation: [`${n}! ÷ ${n - r}! = ${P}.`, `${n}! ÷ ${n - r}! = ${P}।`] });
    },
  },
  {
    id: "complex", subject: "math", min: 11, max: 12,
    make: (d) => {
      const [x, y, m] = pick([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17]]);
      const z = `${signed(x * (Math.random() < 0.5 ? -1 : 1))} ${Math.random() < 0.5 ? "+" : "−"} ${y}i`;
      if (d >= 4) {
        const n = pick([3, 4, 5, 6, 7, 10, 11, 13, 22, 25]);
        const v = ["1", "i", "−1", "−i"][n % 4];
        return mcq({ subject: "math", topic: T.complex, difficulty: d, prompt: [`i^${n} = ?`, `i^${n} = কত?`], answer: v, wrong: ["1", "i", "−1", "−i"].filter((w) => w !== v), explanation: [`Powers of i repeat every 4: ${n} mod 4 = ${n % 4}, so i^${n} = ${v}.`, `i-এর ঘাত প্রতি ৪-এ ঘুরে আসে: ${n} mod ৪ = ${n % 4}, তাই ${v}।`] });
      }
      return mcq({ subject: "math", topic: T.complex, difficulty: d, prompt: [`|${z}| = ?`, `|${z}| = কত?`], answer: m, wrong: [x + y, m * m, m + 1, Math.abs(x - y) || 2], explanation: [`√(${x}² + ${y}²) = ${m}.`, `√(${x}² + ${y}²) = ${m}।`] });
    },
  },
  // ── Physics ────────────────────────────────────────────
  {
    id: "phys", subject: "physics", min: 9, max: 12,
    make: (d) => {
      const kinds = d <= 2 ? ["speed", "force", "ohm", "density"] : d <= 4 ? ["speed", "accel", "force", "work", "ohm", "pe"] : ["accel", "ke", "pe", "power", "ohmR", "work"];
      const kind = pick(kinds);
      const sc = (lo: number, hi: number) => rand(lo, hi + d * 2);
      switch (kind) {
        case "speed": { const v = sc(2, 20), t = sc(2, 12), s = v * t; return mcq({ subject: "physics", topic: T.motion, difficulty: d, prompt: [`A cyclist covers ${s} m in ${t} s. Average speed?`, `একজন সাইকেলচালক ${t} সেকেন্ডে ${s} মিটার যায়। গড় দ্রুতি কত?`], answer: v, wrong: [s * t, v + 2, Math.round(t / 2) || 1, v * 2], unit: [" m/s", " মি/সে"], explanation: [`v = s/t = ${s}/${t} = ${v} m/s.`, `v = s/t = ${s}/${t} = ${v} মি/সে।`] }); }
        case "accel": { const a = sc(1, 6), t = sc(2, 8), u = rand(0, 10), v = u + a * t; return mcq({ subject: "physics", topic: T.motion, difficulty: d, prompt: [`A car speeds up from ${u} m/s to ${v} m/s in ${t} s. Acceleration?`, `একটি গাড়ির বেগ ${t} সেকেন্ডে ${u} মি/সে থেকে ${v} মি/সে হলো। ত্বরণ কত?`], answer: a, wrong: [Math.round(v / t) === a ? a + 1 : Math.round(v / t), a * 2, v - u, a + 3], unit: [" m/s²", " মি/সে²"], explanation: [`a = (v − u)/t = (${v} − ${u})/${t} = ${a} m/s².`, `a = (v − u)/t = (${v} − ${u})/${t} = ${a} মি/সে²।`] }); }
        case "force": { const m = sc(2, 20), a = sc(1, 9), F = m * a; return mcq({ subject: "physics", topic: T.force, difficulty: d, prompt: [`Force needed to give a ${m} kg mass an acceleration of ${a} m/s²?`, `${m} কেজি ভরের বস্তুতে ${a} মি/সে² ত্বরণ সৃষ্টি করতে কত বল লাগবে?`], answer: F, wrong: [m + a, Math.round(m / a) || 1, F * 2, F + m], unit: [" N", " নিউটন"], explanation: [`F = ma = ${m} × ${a} = ${F} N.`, `F = ma = ${m} × ${a} = ${F} নিউটন।`] }); }
        case "work": { const F = sc(5, 50), s = sc(2, 15), W = F * s; return mcq({ subject: "physics", topic: T.force, difficulty: d, prompt: [`A ${F} N force moves a box ${s} m along its direction. Work done?`, `${F} নিউটন বল একটি বাক্সকে বলের দিকে ${s} মিটার সরাল। কৃতকাজ কত?`], answer: W, wrong: [F + s, W / 2, W * 2, F], unit: [" J", " জুল"], explanation: [`W = Fs = ${F} × ${s} = ${W} J.`, `W = Fs = ${F} × ${s} = ${W} জুল।`] }); }
        case "power": { const P = sc(10, 60), t = sc(2, 10), W = P * t; return mcq({ subject: "physics", topic: T.force, difficulty: d, prompt: [`A motor does ${W} J of work in ${t} s. Its power?`, `একটি মোটর ${t} সেকেন্ডে ${W} জুল কাজ করে। ক্ষমতা কত?`], answer: P, wrong: [W * t, P + t, P * 2, W - t], unit: [" W", " ওয়াট"], explanation: [`P = W/t = ${W}/${t} = ${P} W.`, `P = W/t = ${W}/${t} = ${P} ওয়াট।`] }); }
        case "ke": { const m = 2 * sc(1, 10), v = sc(2, 12), KE = (m * v * v) / 2; return mcq({ subject: "physics", topic: T.force, difficulty: d, prompt: [`Kinetic energy of a ${m} kg ball moving at ${v} m/s?`, `${v} মি/সে বেগে চলমান ${m} কেজি ভরের বলের গতিশক্তি কত?`], answer: KE, wrong: [m * v, m * v * v, KE / 2, KE + m], unit: [" J", " জুল"], explanation: [`KE = ½mv² = ½ × ${m} × ${v * v} = ${KE} J.`, `গতিশক্তি = ½mv² = ½ × ${m} × ${v * v} = ${KE} জুল।`] }); }
        case "pe": { const m = sc(1, 20), h = sc(2, 20), PE = m * 10 * h; return mcq({ subject: "physics", topic: T.force, difficulty: d, prompt: [`Potential energy of a ${m} kg mass at ${h} m height? (g = 10 m/s²)`, `${h} মিটার উচ্চতায় ${m} কেজি ভরের বস্তুর বিভবশক্তি কত? (g = ১০ মি/সে²)`], answer: PE, wrong: [m * h, PE / 2, PE + 10, m * 10], unit: [" J", " জুল"], explanation: [`PE = mgh = ${m} × 10 × ${h} = ${PE} J.`, `বিভবশক্তি = mgh = ${m} × ১০ × ${h} = ${PE} জুল।`] }); }
        case "ohm": { const I = sc(1, 6), R = sc(2, 20), V = I * R; return mcq({ subject: "physics", topic: T.elec, difficulty: d, prompt: [`A current of ${I} A flows through a ${R} Ω resistor. The voltage across it?`, `${R} ওহম রোধের মধ্য দিয়ে ${I} অ্যাম্পিয়ার তড়িৎ প্রবাহিত হলে বিভব পার্থক্য কত?`], answer: V, wrong: [I + R, Math.round(R / I) || 1, V * 2, V + I], unit: [" V", " ভোল্ট"], explanation: [`V = IR = ${I} × ${R} = ${V} V.`, `V = IR = ${I} × ${R} = ${V} ভোল্ট।`] }); }
        case "ohmR": { const I = sc(1, 5), R = sc(3, 30), V = I * R; return mcq({ subject: "physics", topic: T.elec, difficulty: d, prompt: [`A ${V} V battery drives ${I} A through a resistor. Its resistance?`, `${V} ভোল্টের ব্যাটারি একটি রোধে ${I} অ্যাম্পিয়ার তড়িৎ চালায়। রোধ কত?`], answer: R, wrong: [V * I, R + I, V - I, R * 2], unit: [" Ω", " ওহম"], explanation: [`R = V/I = ${V}/${I} = ${R} Ω.`, `R = V/I = ${V}/${I} = ${R} ওহম।`] }); }
        default: { const rho = pick([500, 800, 1000, 2700, 7800]), V = rand(2, 9 + d), m = rho * V; return mcq({ subject: "physics", topic: T.matter, difficulty: d, prompt: [`A block of mass ${m} kg has volume ${V} m³. Its density?`, `${m} কেজি ভর ও ${V} ঘনমিটার আয়তনের একটি বস্তুর ঘনত্ব কত?`], answer: rho, wrong: [m * V, rho / 2, rho + V * 100, rho * 2], unit: [" kg/m³", " কেজি/মি³"], explanation: [`ρ = m/V = ${m}/${V} = ${rho} kg/m³.`, `ঘনত্ব = m/V = ${m}/${V} = ${rho} কেজি/মি³।`] }); }
      }
    },
  },
  // ── Chemistry ──────────────────────────────────────────
  {
    id: "atom", subject: "chemistry", min: 9, max: 12,
    make: (d) => {
      const els: [string, string, string, number, number][] = [
        ["Carbon", "কার্বন", "C", 6, 12], ["Nitrogen", "নাইট্রোজেন", "N", 7, 14], ["Oxygen", "অক্সিজেন", "O", 8, 16], ["Sodium", "সোডিয়াম", "Na", 11, 23],
        ["Magnesium", "ম্যাগনেসিয়াম", "Mg", 12, 24], ["Aluminium", "অ্যালুমিনিয়াম", "Al", 13, 27], ["Chlorine", "ক্লোরিন", "Cl", 17, 35], ["Potassium", "পটাশিয়াম", "K", 19, 39],
        ["Calcium", "ক্যালসিয়াম", "Ca", 20, 40], ["Iron", "আয়রন", "Fe", 26, 56], ["Phosphorus", "ফসফরাস", "P", 15, 31], ["Sulfur", "সালফার", "S", 16, 32],
      ];
      const [en, bn, sym, Z, A] = pick(els);
      const ask = d <= 2 ? "neutrons" : pick(["neutrons", "electrons", "config"]);
      if (ask === "config" && Z <= 20) {
        const shells: number[] = [];
        let left = Z;
        for (const cap of [2, 8, 8, 2]) { const take = Math.min(cap, left); if (take > 0) shells.push(take); left -= take; }
        const right = shells.join(", ");
        const alt1 = [...shells].reverse().join(", ");
        const alt2 = shells.length > 1 ? [...shells.slice(0, -1), shells[shells.length - 1] + 1].join(", ") : `${Z + 1}`;
        const alt3 = shells.length > 1 ? [shells[0] + 1, ...shells.slice(1)].join(", ") : `${Z - 1 || 2}`;
        return mcq({ subject: "chemistry", topic: T.atom, difficulty: d, prompt: [`Electron arrangement (K, L, M, N) of ${en} (Z = ${Z})?`, `${bn} (Z = ${Z})-এর ইলেকট্রন বিন্যাস (K, L, M, N) কোনটি?`], answer: right, wrong: [alt1, alt2, alt3, `${Z}`], explanation: [`Fill shells 2, 8, 8…: ${right}.`, `কক্ষপথ ২, ৮, ৮… করে পূরণ হয়: ${right}।`] });
      }
      if (ask === "electrons") {
        return mcq({ subject: "chemistry", topic: T.atom, difficulty: d, prompt: [`How many electrons does a neutral ${en} atom (${sym}, Z = ${Z}, A = ${A}) have?`, `নিরপেক্ষ ${bn} (${sym}, Z = ${Z}, A = ${A}) পরমাণুতে কয়টি ইলেকট্রন থাকে?`], answer: Z, wrong: [A, A - Z === Z ? Z + 1 : A - Z, Z + 2, A + Z], explanation: [`Neutral atom: electrons = protons = Z = ${Z}.`, `নিরপেক্ষ পরমাণুতে ইলেকট্রন = প্রোটন = Z = ${Z}।`] });
      }
      return mcq({ subject: "chemistry", topic: T.atom, difficulty: d, prompt: [`${en} has Z = ${Z} and A = ${A}. How many neutrons?`, `${bn}-এর Z = ${Z} এবং A = ${A}। নিউট্রন কয়টি?`], answer: A - Z, wrong: [Z === A - Z ? Z + 1 : Z, A, A + Z, A - Z + 2], explanation: [`Neutrons = A − Z = ${A} − ${Z} = ${A - Z}.`, `নিউট্রন = A − Z = ${A} − ${Z} = ${A - Z}।`] });
    },
  },
  {
    id: "mole", subject: "chemistry", min: 9, max: 12,
    make: (d) => {
      const comp: [string, number][] = [["H₂O", 18], ["CO₂", 44], ["NH₃", 17], ["CH₄", 16], ["NaOH", 40], ["CaCO₃", 100], ["H₂SO₄", 98], ["O₂", 32], ["NaCl", 58.5], ["HCl", 36.5], ["C₆H₁₂O₆", 180]];
      const [f, M] = pick(d <= 2 ? comp.slice(0, 6) : comp);
      if (d <= 2 || Math.random() < 0.35) {
        return mcq({ subject: "chemistry", topic: T.mole, difficulty: d, prompt: [`Molar mass of ${f}? (H = 1, C = 12, N = 14, O = 16, Na = 23, S = 32, Cl = 35.5, Ca = 40)`, `${f}-এর আণবিক ভর কত? (H = ১, C = ১২, N = ১৪, O = ১৬, Na = ২৩, S = ৩২, Cl = ৩৫.৫, Ca = ৪০)`], answer: num(M), wrong: [num(M + 2), num(M - 1), num(M + 16), num(M * 2)], unit: [" g/mol", " গ্রাম/মোল"], explanation: [`Add the atomic masses: ${f} = ${num(M)} g/mol.`, `পারমাণবিক ভর যোগ করো: ${f} = ${num(M)} গ্রাম/মোল।`] });
      }
      const n = pick([0.5, 2, 3, 4, 5, 0.25, 1.5]);
      const mass = num(M * n);
      return mcq({ subject: "chemistry", topic: T.mole, difficulty: d, prompt: [`How many moles are in ${mass} g of ${f}? (molar mass ${num(M)} g/mol)`, `${mass} গ্রাম ${f}-এ কত মোল আছে? (আণবিক ভর ${num(M)})`], answer: num(n), wrong: [num(n * 2), num(n + 1), num(M * n * 2), num(n / 2)], unit: [" mol", " মোল"], explanation: [`n = mass ÷ molar mass = ${mass} ÷ ${num(M)} = ${num(n)}.`, `মোল = ভর ÷ আণবিক ভর = ${mass} ÷ ${num(M)} = ${num(n)}।`] });
    },
  },
  // ── ICT ────────────────────────────────────────────────
  {
    id: "binary", subject: "ict", min: 6, max: 12,
    make: (d) => {
      const bits = Math.min(8, 2 + d + (Math.random() < 0.5 ? 1 : 0));
      const v = rand(2 ** (bits - 1), 2 ** bits - 1);
      const b = v.toString(2);
      if (d >= 3 && Math.random() < 0.5) {
        const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === "1" ? "0" : "1") + s.slice(i + 1);
        return mcq({ subject: "ict", topic: T.binary, difficulty: d, prompt: [`Decimal ${v} in binary is…`, `দশমিক ${v}-কে বাইনারিতে লিখলে…`], answer: b, wrong: [flip(b, b.length - 1), flip(b, 1), b.split("").reverse().join("") === b ? flip(b, 2 % b.length) : b.split("").reverse().join("")], wrongBn: [flip(b, b.length - 1), flip(b, 1), b.split("").reverse().join("") === b ? flip(b, 2 % b.length) : b.split("").reverse().join("")], answerBn: b, explanation: [`Divide by 2 repeatedly and read the remainders upward: ${b}.`, `বারবার ২ দিয়ে ভাগ করে ভাগশেষ নিচ থেকে উপরে পড়ো: ${b}।`] });
      }
      return mcq({ subject: "ict", topic: T.binary, difficulty: d, prompt: [`Binary ${b} = ? (decimal)`, `বাইনারি ${b} = দশমিকে কত?`], answer: v, wrong: [v + 1, v - 1, v + 2 ** (bits - 2), Number(b.split("").reverse().join("")) % 1000], explanation: [`Add place values (…8, 4, 2, 1) where the bit is 1: ${v}.`, `যে ঘরে ১ আছে তার স্থানীয় মান (…৮, ৪, ২, ১) যোগ করো: ${v}।`] });
    },
  },
];
