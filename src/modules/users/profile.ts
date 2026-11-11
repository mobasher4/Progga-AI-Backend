import type { User } from "@prisma/client";
import { z } from "zod";
import { MobileField } from "../../lib/contact";

// The "About me" side of an account: stored as one JSON column so new fields
// don't need a migration. Every field is optional; "" clears it.

export const RELATIONS = ["father", "mother", "brother", "sister", "uncle", "aunt", "grandparent", "other"] as const;

const text = (max: number) => z.string().trim().max(max);
const orClear = <T extends z.ZodType>(field: T) => z.union([z.literal(""), field]);

export const Birthdate = z.iso
  .date()
  .refine((d) => d >= "1920-01-01" && d <= new Date().toISOString().slice(0, 10), { message: "Check the birthdate" });

export const ProfilePatch = z
  .object({
    bio: text(300),
    dream: text(60), // students: "When I grow up I want to be…"
    schoolName: text(120), // students: their school · teachers: their institution
    district: text(40),
    // students
    fatherName: text(60),
    motherName: text(60),
    guardianName: text(60),
    guardianRelation: orClear(z.enum(RELATIONS)),
    guardianPhone: orClear(MobileField),
    // parents
    relation: orClear(z.enum(RELATIONS)),
    occupation: text(60),
    // teachers
    subjects: text(120),
  })
  .partial();

export type ProfilePatch = z.infer<typeof ProfilePatch>;
export type Profile = { [K in keyof ProfilePatch]?: string } & { rewardedAt?: string };

export const readProfile = (u: Pick<User, "profile">): Profile => (u.profile && typeof u.profile === "object" && !Array.isArray(u.profile) ? (u.profile as Profile) : {});

/** Applies a patch: "" removes a field, anything else replaces it. Server-only keys are kept. */
export function mergeProfile(current: Profile, patch: ProfilePatch): Profile {
  const next: Profile = { ...current };
  for (const [k, v] of Object.entries(patch) as [keyof ProfilePatch, string | undefined][]) {
    if (v === undefined) continue;
    if (v === "") delete next[k];
    else next[k] = v;
  }
  return next;
}

// ── Completion ───────────────────────────────────────────
// Each item is worth the same. Ids are shown by the app as a checklist.

const has = (v?: string | null) => !!v && v.trim().length > 0;

export function profileChecklist(u: User): { id: string; done: boolean }[] {
  const p = readProfile(u);
  const photo = !!u.photoUpdatedAt;
  if (u.role === "STUDENT") {
    return [
      { id: "name", done: has(u.name) },
      { id: "class", done: !!u.grade },
      { id: "photo", done: photo },
      { id: "birthdate", done: has(u.birthdate) },
      { id: "bio", done: has(p.bio) },
      { id: "school", done: has(p.schoolName) },
      { id: "district", done: has(p.district) },
      { id: "father", done: has(p.fatherName) },
      { id: "mother", done: has(p.motherName) },
      { id: "guardian", done: has(p.guardianName) && has(p.guardianRelation) && has(p.guardianPhone) },
    ];
  }
  const common = [
    { id: "name", done: has(u.name) },
    { id: "photo", done: photo },
    { id: "mobile", done: has(u.phone) },
    { id: "bio", done: has(p.bio) },
    { id: "district", done: has(p.district) },
  ];
  if (u.role === "TEACHER") return [...common, { id: "school", done: has(p.schoolName) }, { id: "subjects", done: has(p.subjects) }];
  return [...common, { id: "relation", done: has(p.relation) }, { id: "occupation", done: has(p.occupation) }];
}

export function profileStatus(u: User) {
  const list = profileChecklist(u);
  const done = list.filter((c) => c.done).length;
  return { percent: Math.round((done / list.length) * 100), missing: list.filter((c) => !c.done).map((c) => c.id) };
}

/** Kola coins a student earns, once, for reaching 100%. */
export const PROFILE_REWARD_COINS = 50;
