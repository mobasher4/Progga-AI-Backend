import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { badRequest, conflict, unauthorized } from "../../lib/errors";
import { AUTH_COOKIE, authed, requireAuth, signToken, type Role } from "../../middleware/auth";
import { publicUser } from "../users/presenter";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "slow_down", message: "Too many attempts. Please wait a few minutes." } },
});

const SignupBody = z
  .object({
    name: z.string().trim().min(2).max(60),
    email: z.email().toLowerCase(),
    password: z.string().min(8, "Use at least 8 characters").max(100),
    role: z.enum(["STUDENT", "PARENT", "TEACHER"]).default("STUDENT"),
    grade: z.coerce.number().int().min(3).max(12).optional(),
    language: z.enum(["en", "bn", "mix"]).default("en"),
  })
  .refine((b) => b.role !== "STUDENT" || b.grade !== undefined, { message: "Pick your class", path: ["grade"] });

const LoginBody = z.object({ email: z.email().toLowerCase(), password: z.string().min(1) });

// Unambiguous characters only (no 0/O, 1/I) — easy for kids to read out to a parent.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeLinkCode(): string {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

authRouter.post("/signup", authLimiter, async (req, res) => {
  const body = SignupBody.parse(req.body);
  if (await prisma.user.findUnique({ where: { email: body.email } })) throw conflict("That email already has an account");

  let linkCode = makeLinkCode();
  while (await prisma.user.findUnique({ where: { linkCode } })) linkCode = makeLinkCode();

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash: await bcrypt.hash(body.password, 12),
      role: body.role,
      grade: body.role === "STUDENT" ? body.grade : null,
      language: body.language,
      linkCode,
      dailyTutorLimit: env.DEFAULT_DAILY_TUTOR_LIMIT,
    },
  });
  const token = signToken({ id: user.id, role: user.role as Role });
  setAuthCookie(res, token);
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const { email, password } = LoginBody.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  // Same message for unknown email and wrong password (no account enumeration).
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw unauthorized("Email or password is incorrect");
  const token = signToken({ id: user.id, role: user.role as Role });
  setAuthCookie(res, token);
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: authed(req).id } });
  if (!user) throw unauthorized();
  res.json({ user: publicUser(user) });
});

const PasswordBody = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) });

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const body = PasswordBody.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: authed(req).id } });
  if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw badRequest("Current password is incorrect");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(body.newPassword, 12) } });
  res.json({ ok: true });
});
