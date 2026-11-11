import type { Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "./errors";
import { logger } from "./logger";

// A route answers with plain JSON, or — when the client sends
// `Accept: text/event-stream` — with Server-Sent Events: `preview` updates while
// the AI writes, then `done` with the same JSON body, or `error`.

export const wantsStream = (req: Request) => (req.get("accept") ?? "").includes("text/event-stream");

function errorBody(err: unknown) {
  if (err instanceof HttpError) return { status: err.status, code: err.code, message: err.message, details: err.details };
  if (err instanceof ZodError) return { status: 400, code: "validation_error", message: "Some fields need fixing" };
  logger.error({ err }, "Unhandled error in stream");
  return { status: 500, code: "server_error", message: "Oops! Something went wrong on our side." };
}

export async function jsonOrStream<T, P>(
  req: Request,
  res: Response,
  run: (onPreview?: (preview: P) => void) => Promise<T>,
  status: (result: T) => number = () => 200,
) {
  if (!wantsStream(req)) {
    const result = await run();
    res.status(status(result)).json(result);
    return;
  }

  res.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // nginx & co.: don't hold events back
  });
  res.flushHeaders();
  const send = (event: string, data: unknown) => {
    if (!res.writableEnded && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  // keeps proxies from closing a quiet connection while a slow model thinks
  const ping = setInterval(() => !res.writableEnded && res.write(": ping\n\n"), 15_000);
  try {
    const result = await run((preview) => send("preview", preview));
    send("done", result);
  } catch (err) {
    send("error", errorBody(err));
  } finally {
    clearInterval(ping);
    res.end();
  }
}
