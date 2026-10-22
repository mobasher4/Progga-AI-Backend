import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./create-app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { loadAiConfig } from "./modules/ai/config";
import { tutorLLM } from "./modules/tutor/llm";

const app = createApp();

// Loads the admin-chosen AI engine from the DB. A failure must not take the API
// down: log it and keep the .env defaults.
const aiConfigReady = loadAiConfig().catch((err) => {
  logger.error({ err }, "Could not load AI settings from the database; using .env defaults");
});

/** Vercel serverless entry: the app is exported instead of listening on a port. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await aiConfigReady;
  app(req, res);
}

async function main() {
  await aiConfigReady;

  const server = app.listen(env.PORT, () => {
    logger.info(`🍌 Progga API listening on http://localhost:${env.PORT} (tutor brain: ${tutorLLM.name} · ${tutorLLM.model})`);
    if (tutorLLM.name === "mock") {
      logger.warn("Using the offline MOCK tutor. Add OPENAI_API_KEY, DEEPSEEK_API_KEY or ANTHROPIC_API_KEY to backend/.env for a real AI.");
    }
  });

  async function shutdown(signal: string) {
    logger.info(`${signal} received, shutting down`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

if (!process.env.VERCEL) void main();
