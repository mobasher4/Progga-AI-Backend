import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { buildTutor, listModels } from "../tutor/llm";
import { AiConfigSchema, PROVIDER_IDS, getAiConfig, providerInfo, providers, saveAiConfig } from "./config";

// Admin-only: choose which AI provider and models power Progga.
export const aiAdminRouter = Router();
aiAdminRouter.use(requireAuth, requireRole("ADMIN"));

aiAdminRouter.get("/", (_req, res) => {
  res.json({ config: getAiConfig(), providers: providers() });
});

const ModelsQuery = z.object({ provider: z.enum(PROVIDER_IDS) });

aiAdminRouter.get("/models", async (req, res) => {
  const { provider } = ModelsQuery.parse(req.query);
  res.json({ provider, models: await listModels(provider) });
});

function assertUsable(provider: (typeof PROVIDER_IDS)[number]) {
  if (!providerInfo(provider).configured) {
    throw badRequest(`${providerInfo(provider).label} has no API key in backend/.env yet`);
  }
}

aiAdminRouter.put("/", async (req, res) => {
  const cfg = AiConfigSchema.parse(req.body);
  assertUsable(cfg.provider);
  await saveAiConfig(cfg);
  res.json({ config: getAiConfig() });
});

/** Try a provider/model combo on a sample problem and a fact question before saving it. */
aiAdminRouter.post("/test", async (req, res) => {
  const cfg = AiConfigSchema.parse(req.body);
  assertUsable(cfg.provider);
  const tutor = buildTutor(cfg);
  const profile = { grade: 7, language: "en", subject: "math" };

  const t0 = Date.now();
  try {
    const plan = await tutor.plan({ profile, question: "Solve 2x + 3 = 11" });
    const t1 = Date.now();
    const ev = plan.steps[0]
      ? await tutor.evaluate({ profile, problem: "Solve 2x + 3 = 11", plan, stepIndex: 0, step: plan.steps[0], recent: [], reply: "I think we subtract 3 first" })
      : null;
    res.json({
      ok: true,
      planMs: t1 - t0,
      checkMs: Date.now() - t1,
      title: plan.title,
      mode: plan.mode,
      steps: plan.steps.map((s) => s.goal),
      sampleFeedback: ev ? { verdict: ev.verdict, feedback: ev.feedback } : null,
    });
  } catch (err) {
    res.json({ ok: false, planMs: Date.now() - t0, error: err instanceof Error ? err.message : "Test failed" });
  }
});
