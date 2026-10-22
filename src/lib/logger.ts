import pino from "pino";
import { env } from "../config/env";

export const logger = pino({
  level: env.isProd ? "info" : "debug",
  // Never log raw student messages or credentials.
  redact: ["req.headers.authorization", "req.headers.cookie", "password", "*.password"],
  transport: env.isProd ? undefined : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});
