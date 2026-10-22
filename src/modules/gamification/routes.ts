import { Router } from "express";
import { z } from "zod";
import { authed, requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import * as game from "./service";

export const gamificationRouter = Router();
gamificationRouter.use(requireAuth, requireRole("STUDENT"));

gamificationRouter.get("/quests", async (req, res) => {
  res.json({ quests: await game.getDailyQuests(authed(req).id) });
});

gamificationRouter.post("/quests/:id/claim", async (req, res) => {
  const rewards = await game.claimQuest(authed(req).id, req.params.id as string);
  res.json({ rewards, quests: await game.getDailyQuests(authed(req).id) });
});

gamificationRouter.get("/achievements", async (req, res) => {
  res.json(await game.getAchievements(authed(req).id));
});

gamificationRouter.get("/leaderboard", async (req, res) => {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: authed(req).id } });
  res.json(await game.weeklyLeaderboard(me.id, me.grade ?? 3));
});

gamificationRouter.get("/shop", async (req, res) => {
  res.json(await game.getShop(authed(req).id));
});

const SkinBody = z.object({ skinId: z.string().min(1) });

gamificationRouter.post("/shop/buy", async (req, res) => {
  res.json(await game.buySkin(authed(req).id, SkinBody.parse(req.body).skinId));
});

gamificationRouter.post("/shop/equip", async (req, res) => {
  res.json(await game.equipSkin(authed(req).id, SkinBody.parse(req.body).skinId));
});
