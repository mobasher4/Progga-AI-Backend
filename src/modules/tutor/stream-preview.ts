import type { MsgKind } from "./engine";
import { parsePartialJson, samePath, type JsonPath } from "./llm/partial-json";
import { leaksAnswer } from "./safety";

// Live previews of what Progga is writing, sent to the student word by word.
// Only text the student would see anyway is previewed, and only once nothing
// hidden (expected answers, the final answer) could slip out through it.
// The saved messages that follow always replace the preview.

export interface PreviewMessage {
  kind: MsgKind;
  content: string;
  meta?: Record<string, unknown>;
}

export type OnPreview = (messages: PreviewMessage[]) => void;

/** Text that is safe to show while it's still being written: whole words only, no half-open maths or bold. */
export function settled(text: string, writing: boolean): string {
  if (!writing) return text.trim();
  const lastBreak = text.search(/\s\S*$/);
  let t = lastBreak >= 0 ? text.slice(0, lastBreak) : "";
  if ((t.match(/\$\$/g) ?? []).length % 2) t = t.slice(0, t.lastIndexOf("$$"));
  if ((t.replace(/\$\$/g, "").match(/(?<!\\)\$/g) ?? []).length % 2) t = t.slice(0, t.lastIndexOf("$"));
  if ((t.match(/\*\*/g) ?? []).length % 2) t = t.slice(0, t.lastIndexOf("**"));
  return t.trimEnd();
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

function reader(json: string) {
  const { value, open } = parsePartialJson(json);
  return {
    root: asObj(value),
    /** true once this field's value is fully written */
    done: (path: JsonPath) => !samePath(open, path),
    text: (path: JsonPath, v: unknown) => (typeof v === "string" ? settled(v, samePath(open, path)) : ""),
  };
}

/** Opening of a new chat, from a plan in progress. `lesson`: "Start a lesson", where the mini-lesson may be shown freely. */
export function planPreview(json: string, { lesson }: { lesson: boolean }): PreviewMessage[] {
  const { root: p, done, text } = reader(json);
  if (typeof p.safety !== "string" || !done(["safety"])) return [];
  if (p.safety !== "ok") {
    const reply = text(["safety_reply"], p.safety_reply);
    return reply ? [{ kind: "safety", content: reply }] : [];
  }
  if (typeof p.mode !== "string" || !done(["mode"])) return [];
  if (p.mode === "fact") {
    const answer = text(["answer"], p.answer);
    return answer ? [{ kind: "answer", content: answer, meta: {} }] : [];
  }

  const out: PreviewMessage[] = [];
  const intro = text(["intro"], p.intro);
  if (intro) out.push({ kind: "text", content: intro });
  // For a question, the mini-lesson is checked against the hidden answers, which the
  // model writes later, so it (and step 1 after it) waits for the finished plan.
  if (!lesson || !("key_idea" in p)) return out;

  const keyIdea = text(["key_idea"], p.key_idea);
  if (keyIdea) out.push({ kind: "concept", content: keyIdea });
  if (!done(["key_idea"])) return out;

  const step = asObj(Array.isArray(p.steps) ? p.steps[0] : undefined);
  const teach = text(["steps", 0, "teach"], step.teach);
  if (teach) out.push({ kind: "teach", content: teach, meta: { lesson: true } });
  if ("prompt" in step && (!("teach" in step) || done(["steps", 0, "teach"]))) {
    const prompt = text(["steps", 0, "prompt"], step.prompt);
    if (prompt) out.push({ kind: "question", content: prompt });
  }
  return out;
}

/** Progga's reaction to a reply, while it's being written. `secrets`: answers the student hasn't produced yet. */
export function evalPreview(json: string, secrets: string[]): PreviewMessage[] {
  const { root: e, done } = reader(json);
  if (typeof e.verdict !== "string" || !done(["verdict"])) return [];
  const raw = typeof e.feedback === "string" ? e.feedback : "";
  const writing = !done(["feedback"]);
  if (e.verdict === "wellbeing") {
    const content = settled(raw, writing);
    return content ? [{ kind: "safety", content }] : [];
  }

  let shown = raw;
  if (e.verdict !== "correct") {
    // the saved message will carry a gentle "let's figure it out" line instead
    if (secrets.some((s) => leaksAnswer(raw, s))) return [];
    // hold back a tail long enough that a half-written answer never appears
    if (writing) shown = raw.slice(0, Math.max(0, raw.length - Math.max(0, ...secrets.map((s) => s.length * 2 + 4))));
  }
  const content = settled(shown, writing);
  return content ? [{ kind: "feedback", content, meta: { verdict: e.verdict } }] : [];
}

/** Turns streamed JSON into preview updates, sending one only when what the student sees changes. */
export function previewer(build: (json: string) => PreviewMessage[], onPreview?: OnPreview) {
  if (!onPreview) return undefined;
  let last = "[]";
  return (json: string) => {
    const messages = build(json);
    const key = JSON.stringify(messages);
    if (key === last) return;
    last = key;
    onPreview(messages);
  };
}
