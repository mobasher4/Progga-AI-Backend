import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export const subjectsRouter = Router();

const Query = z.object({ grade: z.coerce.number().int().min(3).max(12).optional() });

subjectsRouter.get("/", async (req, res) => {
  const { grade } = Query.parse(req.query);
  const subjects = await prisma.subject.findMany({
    where: grade ? { minGrade: { lte: grade }, maxGrade: { gte: grade } } : undefined,
    orderBy: { order: "asc" },
  });
  res.json({ subjects });
});
