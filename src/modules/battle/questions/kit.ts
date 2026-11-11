// Shared helpers for battle questions.

export interface BattleQuestion {
  id: string;
  subject: string; // math | science | physics | chemistry | ict | english | bangla | gk
  topic: string;
  topicBn: string;
  prompt: string;
  promptBn: string;
  options: string[];
  optionsBn: string[];
  answerIndex: number;
  explanation: string;
  explanationBn: string;
  difficulty: number; // 1..6
}

export type Bi = [en: string, bn: string];

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
/** ASCII digits → Bangla digits (formulas use Unicode sub/superscripts, which are left alone). */
export const bnDigits = (s: string) => s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

export const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const clampD = (d: number) => Math.min(6, Math.max(1, Math.round(d)));

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "−": "⁻", "-": "⁻" };
/** "x^12" → "x¹²" so powers read like the textbook. */
export const pretty = (s: string) => s.replace(/\^([−-]?\d+)/g, (_, e: string) => [...e].map((c) => SUP[c] ?? c).join(""));

/** Trims float noise: 0.30000000000000004 → "0.3" */
export const num = (v: number) => String(Math.round(v * 1e6) / 1e6);

let seq = 0;
const newId = () => `q${Date.now().toString(36)}${(seq++ % 1296).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface McqInput {
  subject: string;
  topic: Bi;
  difficulty: number;
  prompt: Bi;
  answer: string | number;
  /** Plausible mistakes; extras are trimmed, gaps are filled with near-misses for numbers. */
  wrong: (string | number)[];
  explanation: Bi;
  /** Bangla answers when they differ from a digit swap (e.g. units in words). */
  answerBn?: string;
  wrongBn?: string[];
  unit?: Bi; // appended to every option: " taka" / " টাকা"
}

/** Builds a 4-option multiple-choice question with shuffled options. */
export function mcq(q: McqInput): Omit<BattleQuestion, "id"> & { id: string } {
  const correct = String(q.answer);
  const seen = new Set([correct]);
  // a child who knows the answer is positive shouldn't be offered "−3"
  const nonNegative = Number(correct) >= 0;
  const wrongEn: string[] = [];
  const wrongBn: string[] = [];
  q.wrong.forEach((w, i) => {
    const s = String(w);
    if (seen.has(s) || wrongEn.length >= 3) return;
    if (nonNegative && typeof w === "number" && w < 0) return;
    seen.add(s);
    wrongEn.push(s);
    wrongBn.push(q.wrongBn?.[i] ?? s);
  });
  // top up numeric answers with near-misses
  const n = Number(correct);
  for (let k = 1; wrongEn.length < 3 && Number.isFinite(n) && k < 50; k++) {
    for (const cand of [n + k, n - k, n + 10 * k]) {
      const s = num(cand);
      if (wrongEn.length < 3 && !seen.has(s) && cand >= 0) {
        seen.add(s);
        wrongEn.push(s);
        wrongBn.push(s);
      }
    }
  }
  if (wrongEn.length < 3) throw new Error(`Not enough options for: ${q.prompt[0]}`);

  const order = shuffle([0, 1, 2, 3]);
  const en = [correct, ...wrongEn];
  const bn = [q.answerBn ?? correct, ...wrongBn];
  const [uEn, uBn] = q.unit ?? ["", ""];
  return {
    id: newId(),
    subject: q.subject,
    topic: q.topic[0],
    topicBn: q.topic[1],
    prompt: pretty(q.prompt[0]),
    promptBn: bnDigits(pretty(q.prompt[1])),
    options: order.map((i) => pretty(en[i] + uEn)),
    optionsBn: order.map((i) => bnDigits(pretty(bn[i] + uBn))),
    answerIndex: order.indexOf(0),
    explanation: pretty(q.explanation[0]),
    explanationBn: bnDigits(pretty(q.explanation[1])),
    difficulty: clampD(q.difficulty),
  };
}

/** Pretty signed term for equations: (3, "x") → "+ 3x", (−1, "x") → "− x" */
export function term(coef: number, v = "", first = false): string {
  if (coef === 0) return "";
  const abs = Math.abs(coef);
  const body = v && abs === 1 ? v : `${abs}${v}`;
  if (first) return coef < 0 ? `−${body}` : body;
  return coef < 0 ? ` − ${body}` : ` + ${body}`;
}

/** −5 → "−5" with a real minus sign */
export const signed = (v: number) => (v < 0 ? `−${Math.abs(v)}` : String(v));
