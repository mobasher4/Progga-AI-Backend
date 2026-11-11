import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { VoiceConfigSchema, getVoiceConfig, refreshIndicVoices, saveVoiceConfig, ttsProviderInfo, ttsProviders, voiceExists, type VoiceConfig } from "./engines";
import { sendPreview } from "./service";

// Admin-only: choose which text-to-speech engine and voice Progga speaks with.
export const voiceAdminRouter = Router();
voiceAdminRouter.use(requireAuth, requireRole("ADMIN"));

voiceAdminRouter.get("/", async (_req, res) => {
  await refreshIndicVoices();
  res.json({ config: getVoiceConfig(), providers: ttsProviders() });
});

function assertUsable(cfg: VoiceConfig) {
  const p = ttsProviderInfo(cfg.provider);
  if (!p.configured) throw badRequest(`${p.label} needs ${p.keyHint} in backend/.env first`);
  if (!voiceExists(cfg)) throw badRequest(`${p.label} has no voice called "${cfg.voice}"`);
}

voiceAdminRouter.put("/", async (req, res) => {
  const cfg = VoiceConfigSchema.parse(req.body);
  assertUsable(cfg);
  await saveVoiceConfig(cfg);
  res.json({ config: getVoiceConfig() });
});

const PreviewBody = VoiceConfigSchema.extend({ text: z.string().trim().min(1).max(600) });

/** Hear a voice say some sample text before switching to it. */
voiceAdminRouter.post("/preview", async (req, res) => {
  const { text, ...cfg } = PreviewBody.parse(req.body);
  assertUsable(cfg);
  await sendPreview(cfg, text, res);
});
