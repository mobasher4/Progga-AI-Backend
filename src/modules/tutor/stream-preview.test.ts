import { describe, expect, it } from "vitest";
import { parsePartialJson } from "./llm/partial-json";
import { evalPreview, planPreview, settled } from "./stream-preview";

/** Every prefix of a JSON document, like a model streaming it in. */
const prefixes = (value: unknown) => {
  const json = JSON.stringify(value, null, 1);
  return Array.from({ length: json.length }, (_, i) => json.slice(0, i + 1));
};

describe("parsePartialJson", () => {
  it("closes an unfinished string and reports where it is", () => {
    const r = parsePartialJson('{"safety":"ok","steps":[{"prompt":"What do we');
    expect(r.value).toEqual({ safety: "ok", steps: [{ prompt: "What do we" }] });
    expect(r.open).toEqual(["steps", 0, "prompt"]);
  });

  it("ignores a half-written key and unfinished escapes", () => {
    expect(parsePartialJson('{"intro":"Hi \\').value).toEqual({ intro: "Hi " });
    expect(parsePartialJson('{"intro":"Hi","key_').value).toEqual({ intro: "Hi" });
  });

  it("parses complete JSON exactly, even inside a code fence", () => {
    const v = { a: "x\ny", b: [1, true, null], c: { d: "é" } };
    expect(parsePartialJson("```json\n" + JSON.stringify(v)).value).toEqual(v);
  });
});

describe("settled", () => {
  it("shows whole words only and never half-open maths", () => {
    expect(settled("Let's solve thi", true)).toBe("Let's solve");
    expect(settled("Subtract $3 from ", true)).toBe("Subtract");
    expect(settled("We get **x =", true)).toBe("We get");
    expect(settled("Done.", false)).toBe("Done.");
  });
});

const plan = {
  safety: "ok",
  safety_reply: "",
  mode: "problem",
  title: "Solving for x",
  topic: "Linear equations",
  big_idea: "Keep the equation balanced.",
  intro: "Let's find the mystery number together!",
  key_idea: "Whatever you do to one side, do to the other.",
  steps: [{ goal: "Undo +3", teach: "", prompt: "What can we do to remove the +3?", expected: "subtract 3", options: [], hints: [], why: "", explain: "" }],
  final_answer: "x = 4",
  walkthrough: "",
  recap: "",
  practice_problem: "",
  answer: "",
  more_info: [],
  fun_fact: "",
  explore_next: [],
};

describe("planPreview", () => {
  it("streams the intro of a question but holds the mini-lesson for the finished plan", () => {
    const seen = prefixes(plan).map((p) => planPreview(p, { lesson: false }));
    expect(seen.some((m) => m.length === 1 && m[0].kind === "text" && m[0].content === "Let's find the mystery")).toBe(true);
    expect(seen.flat().some((m) => m.kind !== "text")).toBe(false);
  });

  it("streams the mini-lesson and step 1 of a lesson, in order", () => {
    const last = planPreview(JSON.stringify(plan), { lesson: true });
    expect(last.map((m) => m.kind)).toEqual(["text", "concept", "question"]);
  });

  it("shows only the reply for a declined question, and the answer for a fact", () => {
    expect(planPreview(JSON.stringify({ ...plan, safety: "off_topic", safety_reply: "Let's try a school question!" }), { lesson: false })).toEqual([
      { kind: "safety", content: "Let's try a school question!" },
    ]);
    expect(planPreview(JSON.stringify({ ...plan, mode: "fact", answer: "**Dhaka**" }), { lesson: false })).toEqual([{ kind: "answer", content: "**Dhaka**", meta: {} }]);
  });

  it("waits until the safety verdict is fully written", () => {
    expect(planPreview('{"safety":"o', { lesson: false })).toEqual([]);
  });
});

describe("evalPreview", () => {
  const secrets = ["subtract 3", "x = 4"];
  const feedback = (text: string, verdict = "incorrect") => ({ verdict, feedback: text, follow_up: "", misconception: "" });

  it("never shows any part of a secret answer the student hasn't reached", () => {
    const leaky = feedback("Close! The trick is to subtract 3 from both sides and you get there.");
    for (const p of prefixes(leaky)) {
      const shown = evalPreview(p, secrets).map((m) => m.content).join(" ").toLowerCase();
      expect(shown).not.toContain("subtract");
    }
  });

  it("streams a safe reply word by word and finishes with all of it", () => {
    const ok = feedback("Not quite, but you're on the right track. Look at the plus sign again.");
    const seen = prefixes(ok).map((p) => evalPreview(p, secrets)[0]?.content ?? "");
    expect(new Set(seen).size).toBeGreaterThan(5);
    expect(seen.at(-1)).toBe(ok.feedback);
  });

  it("shows correct-answer praise without holding anything back", () => {
    const last = evalPreview(JSON.stringify(feedback("Yes! subtract 3 is exactly right.", "correct")), secrets);
    expect(last).toEqual([{ kind: "feedback", content: "Yes! subtract 3 is exactly right.", meta: { verdict: "correct" } }]);
  });
});
