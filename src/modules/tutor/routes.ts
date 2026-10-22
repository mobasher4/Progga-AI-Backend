import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authed, requireAuth, requireRole } from "../../middleware/auth";
import { badRequest } from "../../lib/errors";
import * as tutor from "./service";
import { MAX_INPUT_CHARS } from "./safety";
import { tutorLLM } from "./llm";

export const tutorRouter = Router();
tutorRouter.use(requireAuth, requireRole("STUDENT"));

// Photos are processed in memory and never written to disk or the database.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)),
});

// Per-user burst limit on AI calls (on top of the daily problem limit).
const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (req) => req.user?.id ?? "anon",
  message: { error: { code: "slow_down", message: "Whoa, speedy! Take a breath and think it through. 🍌" } },
});

const StartBody = z.object({
  question: z.string().max(MAX_INPUT_CHARS).default(""),
  subject: z.string().min(1).max(40).default("math"),
});

tutorRouter.get("/sessions", async (req, res) => {
  res.json({ sessions: await tutor.listSessions(authed(req).id) });
});

tutorRouter.post("/sessions", aiLimiter, upload.single("image"), async (req, res) => {
  const body = StartBody.parse(req.body ?? {});
  const image = req.file
    ? { mediaType: req.file.mimetype as "image/jpeg" | "image/png" | "image/webp" | "image/gif", base64: req.file.buffer.toString("base64") }
    : undefined;
  if (!body.question.trim() && !image) throw badRequest("Type a question or add a photo");
  if (image && !tutorLLM.supportsImages) throw badRequest("Progga can't read photos right now. Please type your question instead! ✏️");
  const result = await tutor.startSession(authed(req).id, { ...body, image });
  res.status(result.blocked ? 200 : 201).json(result);
});

tutorRouter.get("/sessions/:id", async (req, res) => {
  res.json({ session: await tutor.getSession(authed(req).id, req.params.id as string) });
});

const ReplyBody = z.object({ message: z.string().trim().min(1).max(MAX_INPUT_CHARS) });

tutorRouter.post("/sessions/:id/reply", aiLimiter, async (req, res) => {
  const { message } = ReplyBody.parse(req.body);
  res.json(await tutor.reply(authed(req).id, req.params.id as string, message));
});

tutorRouter.post("/sessions/:id/hint", async (req, res) => {
  res.json(await tutor.hint(authed(req).id, req.params.id as string));
});

tutorRouter.post("/sessions/:id/reveal-step", async (req, res) => {
  res.json(await tutor.reveal(authed(req).id, req.params.id as string));
});

tutorRouter.post("/sessions/:id/abandon", async (req, res) => {
  res.json({ session: await tutor.abandon(authed(req).id, req.params.id as string) });
});
