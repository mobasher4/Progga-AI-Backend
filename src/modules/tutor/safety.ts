// Fast, deterministic guardrails that run BEFORE any text reaches the model,
// and AFTER the model replies. The LLM adds nuanced classification on top.

export const MAX_INPUT_CHARS = 2000;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Bangladeshi mobile numbers (01XXXXXXXXX, +880…) and generic long phone-like digit runs with separators
const PHONE = /(?:\+?880[-\s]?)?\b01[3-9]\d{2}[-\s]?\d{6}\b|\b\d{3,4}[-\s]\d{3,4}[-\s]\d{3,4}\b/g;

/** Remove personal contact info so it is never sent to the model or stored. */
export function redactPII(text: string): { text: string; redacted: boolean } {
  let redacted = false;
  const out = text
    .replace(EMAIL, () => ((redacted = true), "[email hidden]"))
    .replace(PHONE, () => ((redacted = true), "[phone hidden]"));
  return { text: out, redacted };
}

const WELLBEING = [
  /\b(kill|hurt|harm|cut)\s+my\s*self\b/i,
  /\bsuicid/i,
  /\bwant\s+to\s+die\b/i,
  /\bend\s+my\s+life\b/i,
  /\b(being|getting)\s+bullied\b/i,
  /\bnobody\s+(loves|cares\s+about)\s+me\b/i,
  /আত্মহত্যা/,
  /মরে\s*যেতে\s*চাই/,
  /নিজেকে\s*শেষ/,
];

const UNSAFE = [
  /\b(make|build|how\s+to\s+make)\s+(a\s+)?(bomb|explosive|gun|weapon)/i,
  /\b(buy|get|use)\s+(drugs|weed|yaba|heroin|cocaine)\b/i,
  /\bporn|nude|sexy\s+pic/i,
  /\bhack\s+(into|someone|my\s+friend)/i,
  /\b(leak|leaked)\s+(question|exam)\s+paper/i,
];

export type ScreenResult =
  | { ok: true; text: string; redacted: boolean }
  | { ok: false; category: "wellbeing" | "unsafe"; reply: string; text: string };

export function screenInput(raw: string, language = "en"): ScreenResult {
  const { text, redacted } = redactPII(raw.slice(0, MAX_INPUT_CHARS));
  if (WELLBEING.some((r) => r.test(text))) {
    return { ok: false, category: "wellbeing", text, reply: wellbeingReply(language) };
  }
  if (UNSAFE.some((r) => r.test(text))) {
    return {
      ok: false,
      category: "unsafe",
      text,
      reply:
        language === "bn"
          ? "এটা নিয়ে আমি সাহায্য করতে পারব না। কোনো প্রশ্ন থাকলে বাবা-মা বা শিক্ষকের সাথে কথা বলো। চলো পড়াশোনার কিছু শিখি! 🍌"
          : "That's not something I can help with. If you're curious or worried about it, please talk to a parent or teacher. Want to explore a school question instead? 🍌",
    };
  }
  return { ok: true, text, redacted };
}

export function wellbeingReply(language = "en"): string {
  return language === "bn"
    ? "তোমার কথা শুনে আমার মনে হচ্ছে তুমি হয়তো কষ্টে আছো। তোমার অনুভূতি অনেক গুরুত্বপূর্ণ 💛 এখনই একজন বিশ্বস্ত বড় মানুষের সাথে কথা বলো — বাবা-মা, শিক্ষক বা স্কুলের কাউন্সেলর। তুমি একা নও।"
    : "It sounds like you might be going through something really hard. Your feelings matter so much 💛 Please talk to a trusted adult right now — a parent, a teacher, or your school counsellor. You are not alone, and asking for help is brave.";
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\$|\\[a-z]+|[{}\s]/g, "")
    .trim();

/**
 * Leak guard: makes sure the tutor's own words don't contain the secret
 * answer before the student has produced it. Only applied to answers that are
 * distinctive enough to detect reliably (short answers like "5" would cause
 * false positives in ordinary sentences).
 */
export function leaksAnswer(text: string, secret: string): boolean {
  const s = norm(secret);
  if (s.length < 4 && !s.includes("=")) return false;
  return norm(text).includes(s);
}
