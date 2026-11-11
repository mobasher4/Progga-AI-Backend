import { Router, type Request } from "express";
import multer from "multer";
import { z } from "zod";
import { MobileField } from "../../lib/contact";
import { badRequest, forbidden, HttpError, notFound } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { authed, requireAuth, requireRole } from "../../middleware/auth";
import { getDailyQuests } from "../gamification/service";
import { lessonCard } from "../lessons/presenter";
import { listSessions } from "../tutor/service";
import { publicUser } from "./presenter";
import { Birthdate, mergeProfile, PROFILE_REWARD_COINS, profileStatus, ProfilePatch, readProfile } from "./profile";

export const usersRouter = Router();
usersRouter.use(requireAuth);

const orClear = <T extends z.ZodType>(field: T) => z.union([z.literal(""), field]).optional();

const UpdateBody = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  language: z.enum(["en", "bn"]).optional(),
  grade: z.coerce.number().int().min(3).max(12).optional(), // Class 3 to HSC
  birthdate: orClear(Birthdate),
  email: orClear(z.email().toLowerCase()),
  phone: orClear(MobileField),
  profile: ProfilePatch.optional(),
});

const taken = (field: "email" | "phone", message: string) => new HttpError(409, message, "conflict", { [field]: [message] });

usersRouter.patch("/", async (req, res) => {
  const me = authed(req);
  const { profile: patch, birthdate, email, phone, ...body } = UpdateBody.parse(req.body);
  if (me.role !== "STUDENT") delete body.grade;
  const current = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });

  // Sign-in details: unique, and an account that signs in must keep at least one.
  const nextEmail = email === undefined ? current.email : email || null;
  const nextPhone = phone === undefined ? current.phone : phone || null;
  if ((current.email || current.phone) && !nextEmail && !nextPhone) throw badRequest("Keep an email or a mobile number to sign in with");
  if (nextEmail && nextEmail !== current.email && (await prisma.user.findUnique({ where: { email: nextEmail } })))
    throw taken("email", "That email already has an account");
  if (nextPhone && nextPhone !== current.phone && (await prisma.user.findUnique({ where: { phone: nextPhone } })))
    throw taken("phone", "That mobile number already has an account");

  const profile = patch ? mergeProfile(readProfile(current), patch) : readProfile(current);
  let user = await prisma.user.update({
    where: { id: me.id },
    data: {
      ...body,
      email: nextEmail,
      phone: nextPhone,
      ...(birthdate !== undefined && { birthdate: birthdate || null }),
      ...(patch && { profile }),
    },
  });

  // First time a student's profile hits 100%: a one-off coin reward.
  let reward: { coins: number } | null = null;
  if (user.role === "STUDENT" && !profile.rewardedAt && profileStatus(user).percent === 100) {
    user = await prisma.user.update({
      where: { id: me.id },
      data: { coins: { increment: PROFILE_REWARD_COINS }, profile: { ...profile, rewardedAt: new Date().toISOString() } },
    });
    reward = { coins: PROFILE_REWARD_COINS };
  }
  res.json({ user: publicUser(user), reward });
});

// ── Profile photo ────────────────────────────────────────
// The app crops and shrinks the picture before upload, so these stay tiny.

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, PHOTO_TYPES.includes(file.mimetype)),
});

usersRouter.put("/photo", photoUpload.single("photo"), async (req, res) => {
  const me = authed(req);
  if (!req.file) throw badRequest("Choose a JPG, PNG or WebP picture under 1 MB");
  const photo = { mime: req.file.mimetype, data: new Uint8Array(req.file.buffer) };
  const [, user] = await prisma.$transaction([
    prisma.profilePhoto.upsert({ where: { userId: me.id }, create: { userId: me.id, ...photo }, update: photo }),
    prisma.user.update({ where: { id: me.id }, data: { photoUpdatedAt: new Date() } }),
  ]);
  res.json({ user: publicUser(user) });
});

usersRouter.delete("/photo", async (req, res) => {
  const me = authed(req);
  const [, user] = await prisma.$transaction([
    prisma.profilePhoto.deleteMany({ where: { userId: me.id } }),
    prisma.user.update({ where: { id: me.id }, data: { photoUpdatedAt: null } }),
  ]);
  res.json({ user: publicUser(user) });
});

/** Serves profile photos to the person themself, their linked parents/teachers (and back), and admins. */
export const photosRouter = Router();
photosRouter.use(requireAuth);

async function canSeePhoto(req: Request, ownerId: string) {
  const me = authed(req);
  if (me.id === ownerId || me.role === "ADMIN") return true;
  const link = await prisma.guardianLink.findFirst({
    where: { OR: [{ guardianId: me.id, studentId: ownerId }, { guardianId: ownerId, studentId: me.id }] },
    select: { id: true },
  });
  return !!link;
}

photosRouter.get("/:userId", async (req, res) => {
  const ownerId = req.params.userId as string;
  if (!(await canSeePhoto(req, ownerId))) throw forbidden();
  const photo = await prisma.profilePhoto.findUnique({ where: { userId: ownerId } });
  if (!photo) throw notFound("No photo");
  // URLs carry a version, so a changed photo gets a new URL
  res.set({ "Content-Type": photo.mime, "Cache-Control": "private, max-age=604800, immutable" });
  res.send(Buffer.from(photo.data));
});

/** Everything the student home screen needs in one round trip. */
usersRouter.get("/dashboard", requireRole("STUDENT"), async (req, res) => {
  const id = authed(req).id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  const grade = user.grade ?? 6;

  const [quests, sessions, inProgress, badgeCount, subjects] = await Promise.all([
    getDailyQuests(id),
    listSessions(id, 5),
    prisma.lessonProgress.findMany({
      where: { userId: id, completed: false, watchedSec: { gt: 0 } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: { lesson: { include: { subject: true } } },
    }),
    prisma.userBadge.count({ where: { userId: id } }),
    prisma.subject.findMany({ where: { minGrade: { lte: grade }, maxGrade: { gte: grade } }, orderBy: { order: "asc" } }),
  ]);

  const recommended = await prisma.lesson.findMany({
    where: { grade: { in: [grade - 1, grade, grade + 1] }, progress: { none: { userId: id } } },
    include: { subject: true },
    orderBy: [{ grade: "desc" }, { order: "asc" }],
    take: 4,
  });

  res.json({
    user: publicUser(user),
    quests,
    recentSessions: sessions,
    continueLessons: inProgress.map((p) => ({
      ...lessonCard(p.lesson),
      progress: Math.min(1, p.watchedSec / p.lesson.durationSec),
    })),
    recommendedLessons: recommended.map(lessonCard),
    badgeCount,
    subjects,
  });
});
