// Turns a tutor message (Markdown + LaTeX maths + emoji) into plain words that
// a text-to-speech voice reads naturally: "$2x+3=11$" → "2x plus 3 equals 11".

export type SpeechLang = "en" | "bn";

const MAX_CHARS = 1500;
const BENGALI = /[ঀ-৿]/;

/** Which language the words around the maths are in (decides "plus" vs "যোগ"). */
export const detectLang = (text: string): SpeechLang => (BENGALI.test(text) ? "bn" : "en");

const WORDS: Record<SpeechLang, Record<string, string>> = {
  en: {
    plus: "plus", minus: "minus", times: "times", div: "divided by", eq: "equals", neq: "is not equal to",
    lt: "is less than", gt: "is greater than", le: "is at most", ge: "is at least", over: "over",
    sqrt: "the square root of", squared: "squared", cubed: "cubed", pow: "to the power", pi: "pi",
    percent: "percent", deg: "degrees", pm: "plus or minus", approx: "is about", arrow: "gives",
  },
  bn: {
    plus: "যোগ", minus: "বিয়োগ", times: "গুণ", div: "ভাগ", eq: "সমান", neq: "সমান নয়",
    lt: "ছোট", gt: "বড়", le: "ছোট বা সমান", ge: "বড় বা সমান", over: "ভাগ",
    sqrt: "বর্গমূল", squared: "এর বর্গ", cubed: "এর ঘন", pow: "এর ঘাত", pi: "পাই",
    percent: "শতাংশ", deg: "ডিগ্রি", pm: "যোগ বা বিয়োগ", approx: "প্রায়", arrow: "দেয়",
  },
};

/** Reads one LaTeX maths snippet as words. */
export function mathToWords(expr: string, lang: SpeechLang): string {
  const w = WORDS[lang];
  let s = expr;
  // structures first (innermost braces only, repeated for nesting)
  for (let i = 0; i < 4; i++) {
    s = s
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, ` $1 ${w.over} $2 `)
      .replace(/\\sqrt\{([^{}]*)\}/g, lang === "bn" ? ` $1 এর ${w.sqrt} ` : ` ${w.sqrt} $1 `)
      .replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, " $1 ");
  }
  s = s
    .replace(/\^\{?2\}?/g, ` ${w.squared} `)
    .replace(/\^\{?3\}?/g, ` ${w.cubed} `)
    .replace(/\^\{([^{}]*)\}|\^(\w)/g, (_m, a, b) => ` ${w.pow} ${a ?? b} `)
    .replace(/\\times|×|\\cdot|·/g, ` ${w.times} `)
    .replace(/\\div|÷/g, ` ${w.div} `)
    .replace(/\\pm|±/g, ` ${w.pm} `)
    .replace(/\\neq|≠/g, ` ${w.neq} `)
    .replace(/\\leq?|≤/g, ` ${w.le} `)
    .replace(/\\geq?|≥/g, ` ${w.ge} `)
    .replace(/\\approx|≈/g, ` ${w.approx} `)
    .replace(/\\(?:to|rightarrow|Rightarrow)|→/g, ` ${w.arrow} `)
    .replace(/\\pi|π/g, ` ${w.pi} `)
    .replace(/\\%|%/g, ` ${w.percent} `)
    .replace(/\^\\circ|°|\\circ/g, ` ${w.deg} `)
    .replace(/\\?[{}]|\\[,;!: ]|\\left|\\right/g, " ")
    .replace(/(?<=[\w)\s])\s*[−-]\s*(?=[\w(\s])/g, ` ${w.minus} `)
    .replace(/^\s*[−-]\s*/, ` ${w.minus} `)
    .replace(/\+/g, ` ${w.plus} `)
    .replace(/</g, ` ${w.lt} `)
    .replace(/>/g, ` ${w.gt} `)
    .replace(/=/g, ` ${w.eq} `)
    .replace(/\\[a-zA-Z]+/g, " "); // anything left (unknown commands)
  return s.replace(/\s+/g, " ").trim();
}

/** Markdown + maths + emoji → one block of speakable text. */
export function toSpokenText(markdown: string): string {
  const lang = detectLang(markdown);
  let s = markdown
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, e: string) => ` ${mathToWords(e, lang)}. `)
    .replace(/\$([^$\n]+?)\$/g, (_m, e: string) => ` ${mathToWords(e, lang)} `)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, "$2")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/\p{Extended_Pictographic}|‍|️/gu, " ");

  // each line becomes a sentence so the voice pauses between bullet points
  s = s
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").replace(/\s+([.,!?।:;])/g, "$1").trim())
    .filter(Boolean)
    .map((line) => (/[.!?।:;]$/.test(line) ? line : `${line}.`))
    .join(" ");

  if (s.length > MAX_CHARS) {
    const cut = s.slice(0, MAX_CHARS);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("। "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    s = end > MAX_CHARS / 2 ? cut.slice(0, end + 1) : cut;
  }
  return s.trim();
}
