import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { parseContact, type Contact } from "../../lib/contact";
import { badRequest, conflict, HttpError, unauthorized } from "../../lib/errors";
import { AUTH_COOKIE, GUARDIAN_COOKIE, authed, requireAuth, setSessionCookie, signToken, verifyToken, type Role } from "../../middleware/auth";
import { publicUser } from "../users/presenter";
import { Birthdate } from "../users/profile";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "slow_down", message: "Too many attempts. Please wait a few minutes." } },
});

// ── Email or Bangladeshi mobile number ───────────────────

const ContactField = z.string().transform((v, ctx) => {
  const c = parseContact(v);
  if (!c) {
    ctx.addIssue({ code: "custom", message: "Enter a valid email or mobile number (01XXXXXXXXX)" });
    return z.NEVER;
  }
  return c;
});

/** Older clients send `email`; the new flow sends `contact` (email or mobile). */
const withContact = (b: unknown) =>
  b && typeof b === "object" && !("contact" in b) && "email" in b ? { ...b, contact: (b as { email: unknown }).email } : b;

const findByContact = (c: Contact) => (c.email ? prisma.user.findUnique({ where: { email: c.email } }) : prisma.user.findUnique({ where: { phone: c.phone } }));

const takenMessage = (c: Contact) => (c.email ? "That email already has an account" : "That mobile number already has an account");

// ── Signup ───────────────────────────────────────────────

const Grade = z.coerce.number().int().min(3).max(12); // Class 3 to HSC
const Name = z.string().trim().min(2).max(60);

const SignupBody = z.preprocess(
  withContact,
  z
    .object({
      name: Name,
      contact: ContactField,
      password: z.string().min(8, "Use at least 8 characters").max(100),
      role: z.enum(["STUDENT", "PARENT", "TEACHER"]).default("STUDENT"),
      grade: Grade.optional(),
      birthdate: Birthdate.optional(),
      motivation: z.enum(["excel", "sharp", "fun", "help_child"]).optional(),
      language: z.enum(["en", "bn"]).default("en"),
      // A parent can add their kids in the same step; each gets a profile they switch into.
      children: z.array(z.object({ name: Name, grade: Grade, birthdate: Birthdate.optional() })).max(6).default([]),
    })
    .refine((b) => b.role !== "STUDENT" || b.grade !== undefined, { message: "Pick your class", path: ["grade"] }),
);

const LoginBody = z.preprocess(withContact, z.object({ contact: z.string().trim().min(3), password: z.string().min(1) }));

// Unambiguous characters only (no 0/O, 1/I) — easy for kids to read out to a parent.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeLinkCode(): string {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

async function freshLinkCode(taken: Set<string>): Promise<string> {
  let code = makeLinkCode();
  while (taken.has(code) || (await prisma.user.findUnique({ where: { linkCode: code } }))) code = makeLinkCode();
  taken.add(code);
  return code;
}

/** Is this email / mobile free? Lets the signup stepper flag a taken one before the last step. */
authRouter.post("/check", authLimiter, async (req, res) => {
  const { contact } = z.object({ contact: ContactField }).parse(req.body);
  if (await findByContact(contact)) throw new HttpError(409, takenMessage(contact), "conflict", { contact: [takenMessage(contact)] });
  res.json({ available: true });
});

authRouter.post("/signup", authLimiter, async (req, res) => {
  const body = SignupBody.parse(req.body);
  const { contact } = body;
  if (await findByContact(contact)) throw new HttpError(409, takenMessage(contact), "conflict", { contact: [takenMessage(contact)] });

  const isStudent = body.role === "STUDENT";
  const kids = body.role === "PARENT" ? body.children : [];
  const codes = new Set<string>();
  const linkCode = await freshLinkCode(codes);
  const kidCodes = await Promise.all(kids.map(() => freshLinkCode(codes)));
  // Kids added by a parent never sign in with a password: the parent switches into their profile.
  const kidHash = kids.length ? await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10) : "";

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: body.name,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        passwordHash: await bcrypt.hash(body.password, 12),
        role: body.role,
        grade: isStudent ? body.grade : null,
        birthdate: body.birthdate ?? null,
        motivation: body.motivation ?? null,
        language: body.language,
        linkCode,
        dailyTutorLimit: env.DEFAULT_DAILY_TUTOR_LIMIT,
      },
    });
    for (const [i, kid] of kids.entries()) {
      const child = await tx.user.create({
        data: {
          name: kid.name,
          passwordHash: kidHash,
          role: "STUDENT",
          grade: kid.grade,
          birthdate: kid.birthdate ?? null,
          language: body.language,
          // the parent who added them is their guardian; saves filling it in twice
          profile: { guardianName: body.name, ...(contact.phone && { guardianPhone: contact.phone }) },
          linkCode: kidCodes[i],
          dailyTutorLimit: env.DEFAULT_DAILY_TUTOR_LIMIT,
        },
      });
      await tx.guardianLink.create({ data: { guardianId: created.id, studentId: child.id } });
    }
    return created;
  });

  setSessionCookie(res, AUTH_COOKIE, signToken({ id: user.id, role: user.role as Role }));
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const { contact, password } = LoginBody.parse(req.body);
  const parsed = parseContact(contact);
  const user = parsed ? await findByContact(parsed) : null;
  // Same message for unknown account and wrong password (no account enumeration).
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw unauthorized("Email, mobile or password is incorrect");
  res.clearCookie(GUARDIAN_COOKIE, { path: "/" });
  setSessionCookie(res, AUTH_COOKIE, signToken({ id: user.id, role: user.role as Role }));
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.clearCookie(GUARDIAN_COOKIE, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: authed(req).id } });
  if (!user) throw unauthorized();
  // A parent switched into this kid's profile: say who to switch back to.
  const parked = verifyToken(req.cookies?.[GUARDIAN_COOKIE]);
  const guardian = parked ? await prisma.user.findUnique({ where: { id: parked.id }, select: { name: true } }) : null;
  res.json({ user: { ...publicUser(user), switchedFrom: guardian ? { name: guardian.name } : null } });
});

/** Back from a kid's profile to the parent who opened it on this device. */
authRouter.post("/switch-back", requireAuth, async (req, res) => {
  const parked = verifyToken(req.cookies?.[GUARDIAN_COOKIE]);
  const kidId = authed(req).id;
  const link = parked && (await prisma.guardianLink.findUnique({ where: { guardianId_studentId: { guardianId: parked.id, studentId: kidId } } }));
  res.clearCookie(GUARDIAN_COOKIE, { path: "/" });
  if (!parked || !link) throw unauthorized("Please log in to your parent account");
  const guardian = await prisma.user.findUniqueOrThrow({ where: { id: parked.id } });
  setSessionCookie(res, AUTH_COOKIE, signToken({ id: guardian.id, role: guardian.role as Role }));
  res.json({ user: publicUser(guardian) });
});

const PasswordBody = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) });

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const body = PasswordBody.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: authed(req).id } });
  if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw badRequest("Current password is incorrect");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(body.newPassword, 12) } });
  res.json({ ok: true });
});
