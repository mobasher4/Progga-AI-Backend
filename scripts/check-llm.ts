/* eslint-disable no-console */
// Verifies the AI connection: plans one maths problem and one fact question,
// then grades one sample reply. Usage: npm run check:llm
import { loadAiConfig } from "../src/modules/ai/config";
import { tutorLLM } from "../src/modules/tutor/llm";

const profile = { grade: 7, language: "en", subject: "math" };

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  const out = await fn();
  console.log(`✅ ${label} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  return out;
}

async function main() {
  await loadAiConfig();
  console.log(`Tutor brain: ${tutorLLM.name} · ${tutorLLM.model} · photos: ${tutorLLM.supportsImages ? "yes" : "no"}`);
  if (tutorLLM.name === "mock") {
    console.log("⚠️  No AI key found. Add OPENAI_API_KEY, DEEPSEEK_API_KEY or ANTHROPIC_API_KEY to backend/.env, then run this again.");
    process.exit(1);
  }

  const plan = await timed("Planned a maths problem", () => tutorLLM.plan({ profile, question: "Solve 2x + 3 = 11" }));
  console.log(`   mode: ${plan.mode} · topic: ${plan.topic}`);
  plan.steps.forEach((s, i) => console.log(`   step ${i + 1}: ${s.goal} — "${s.prompt}" (expects: ${s.expected})`));

  const fact = await timed("Answered a fact question", () =>
    tutorLLM.plan({ profile: { ...profile, subject: "bgs" }, question: "What is the capital of Bangladesh?" }),
  );
  console.log(`   mode: ${fact.mode} · answer: ${fact.answer}`);
  console.log(`   more info: ${fact.more_info.length} points · explore: ${fact.explore_next.join(" | ")}`);

  if (plan.steps[0]) {
    const ev = await timed("Graded a student reply", () =>
      tutorLLM.evaluate({ profile, problem: "Solve 2x + 3 = 11", plan, stepIndex: 0, step: plan.steps[0], recent: [], reply: "just tell me the answer" }),
    );
    console.log(`   verdict: ${ev.verdict} · feedback: ${ev.feedback}`);
  }
}

main().catch((err) => {
  console.error("❌ AI check failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
