import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authed, requireAuth, requireRole } from "../../middleware/auth";
import { answer, arenaHome, battleState, cancelSearch, pollSearch, startSearch } from "./service";

export const battleRouter = Router();
battleRouter.use(requireAuth, requireRole("STUDENT"));

// Battles poll about once a second, so they get their own per-student budget
// (the global /api limit is per IP, and a whole classroom can share one IP).
battleRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 400,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => `battle:${authed(req).id}`,
  }),
);

battleRouter.get("/arena", async (req, res) => {
  res.json(await arenaHome(authed(req).id));
});

battleRouter.post("/search", async (req, res) => {
  res.status(201).json(await startSearch(authed(req).id));
});

battleRouter.get("/search/:ticketId", async (req, res) => {
  res.json(await pollSearch(authed(req).id, req.params.ticketId as string));
});

battleRouter.delete("/search/:ticketId", async (req, res) => {
  res.json(await cancelSearch(authed(req).id, req.params.ticketId as string));
});

battleRouter.get("/:battleId", async (req, res) => {
  res.json(await battleState(authed(req).id, req.params.battleId as string));
});

const AnswerBody = z.object({
  index: z.coerce.number().int().min(0).max(50),
  choice: z.coerce.number().int().min(-1).max(9), // -1 = time ran out
});

battleRouter.post("/:battleId/answer", async (req, res) => {
  res.json(await answer(authed(req).id, req.params.battleId as string, AnswerBody.parse(req.body)));
});
