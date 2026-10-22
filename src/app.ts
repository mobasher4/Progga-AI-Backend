import type { IncomingMessage, ServerResponse } from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { authRouter } from "./modules/auth/routes";
import { usersRouter } from "./modules/users/routes";
import { subjectsRouter } from "./modules/subjects/routes";
import { tutorRouter } from "./modules/tutor/routes";
import { lessonsRouter } from "./modules/lessons/routes";
import { quizRouter } from "./modules/quiz/routes";
import { gamificationRouter } from "./modules/gamification/routes";
import { guardianRouter } from "./modules/guardian/routes";
import { tutorLLM } from "./modules/tutor/llm";
import { aiAdminRouter } from "./modules/ai/routes";
import { loadAiConfig } from "./modules/ai/config";
import { logger } from "./lib/logger";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(
    "/api",
    rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "progga-api",
      llm: { provider: tutorLLM.name, model: tutorLLM.model, vision: tutorLLM.supportsImages },
      time: new Date().toISOString(),
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/me", usersRouter);
  app.use("/api/subjects", subjectsRouter);
  app.use("/api/tutor", tutorRouter);
  app.use("/api/lessons", lessonsRouter);
  app.use("/api/quiz", quizRouter);
  app.use("/api/game", gamificationRouter);
  app.use("/api/guardian", guardianRouter);
  app.use("/api/admin/ai", aiAdminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();

// Loads the admin-chosen AI engine from the DB. A failure must not take the API
// down: log it and keep the .env defaults.
export const aiConfigReady = loadAiConfig().catch((err) => {
  logger.error({ err }, "Could not load AI settings from the database; using .env defaults");
});

/**
 * Vercel serverless entry. Vercel's Express preset picks src/app.ts and needs it
 * to import express and default-export a handler; src/index.ts is the local server.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await aiConfigReady;
  app(req, res);
}
