import pino from "pino";
import { env } from "../config/env";

// Pretty logs only for a developer's terminal. pino-pretty runs as a worker
// transport, which serverless bundles (e.g. Vercel) can't load, so anywhere
// else we log plain JSON.
function prettyTransport() {
  if (env.isProd || process.env.VERCEL || !process.stdout.isTTY) return undefined;
  try {
    require.resolve("pino-pretty");
  } catch {
    return undefined;
  }
  return { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } };
}

export const logger = pino({
  level: env.isProd ? "info" : "debug",
  // Never log raw student messages or credentials.
  redact: ["req.headers.authorization", "req.headers.cookie", "password", "*.password"],
  transport: prettyTransport(),
});
