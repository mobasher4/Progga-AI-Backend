import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authed, requireAuth, requireRole } from "../../middleware/auth";
import { badRequest } from "../../lib/errors";
import { jsonOrStream } from "../../lib/sse";
import { prisma } from "../../lib/prisma";
import * as tutor from "./service";
import { MAX_INPUT_CHARS } from "./safety";
import { studentEngines, tutorFor } from "../ai/engines";
import { sendSpeech } from "../voice/service";

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
  lessonId: z.string().min(1).max(40).optional(),
  /** the AI model the student picked (`provider:model` from GET /engines) */
  engine: z.string().max(160).optional(),
});

/** AI models the student can choose from in the chat; the admin's choice is the default. */
tutorRouter.get("/engines", async (_req, res) => {
  res.json({ engines: await studentEngines() });
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
  const llm = await tutorFor(body.engine);
  if (image && !llm.supportsImages) throw badRequest("Progga can't read photos right now. Please type your question instead! ✏️");
  // `Accept: text/event-stream` → Progga's opening streams in word by word (see lib/sse)
  await jsonOrStream(req, res, (onPreview) => tutor.startSession(authed(req).id, { ...body, image }, onPreview, llm), (r) => (r.blocked ? 200 : 201));
});

tutorRouter.get("/sessions/:id", async (req, res) => {
  res.json({ session: await tutor.getSession(authed(req).id, req.params.id as string) });
});

tutorRouter.delete("/sessions/:id", async (req, res) => {
  await tutor.deleteSession(authed(req).id, req.params.id as string);
  res.status(204).end();
});

// "Start a lesson": pick a class, a subject and one of its NCTB topics, and Progga teaches it from scratch.
const SyllabusQuery = z.object({ grade: z.coerce.number().int().min(3).max(12), subject: z.string().min(1).max(40) });

tutorRouter.get("/syllabus", aiLimiter, async (req, res) => {
  const { grade, subject } = SyllabusQuery.parse(req.query);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: authed(req).id }, select: { language: true } });
  res.json(await tutor.syllabus(grade, subject, user.language));
});

const LessonBody = z.object({
  grade: z.coerce.number().int().min(3).max(12),
  subject: z.string().min(1).max(40),
  topic: z.string().trim().min(2).max(160),
  chapter: z.string().trim().max(160).optional(),
  engine: z.string().max(160).optional(),
});

tutorRouter.post("/lessons", aiLimiter, async (req, res) => {
  const { grade, subject, topic, chapter, engine } = LessonBody.parse(req.body);
  const llm = await tutorFor(engine);
  await jsonOrStream(
    req,
    res,
    (onPreview) => tutor.startSession(authed(req).id, { question: "", subject, learn: { grade, topic, chapter } }, onPreview, llm),
    (r) => (r.blocked ? 200 : 201),
  );
});

const ReplyBody = z.object({ message: z.string().trim().min(1).max(MAX_INPUT_CHARS), engine: z.string().max(160).optional() });

tutorRouter.post("/sessions/:id/reply", aiLimiter, async (req, res) => {
  const { message, engine } = ReplyBody.parse(req.body);
  const llm = await tutorFor(engine);
  await jsonOrStream(req, res, (onPreview) => tutor.reply(authed(req).id, req.params.id as string, message, onPreview, llm));
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

// Read-aloud: Progga's voice for one of its messages (cached after the first request).
const speechLimiter = rateLimit({
  windowMs: 60_000,
  limit: 40,
  keyGenerator: (req) => req.user?.id ?? "anon",
  message: { error: { code: "slow_down", message: "Progga needs a quick breather before talking again. 🍌" } },
});

tutorRouter.get("/sessions/:id/messages/:messageId/speech", speechLimiter, async (req, res) => {
  await sendSpeech(authed(req).id, req.params.id as string, req.params.messageId as string, res);
});
