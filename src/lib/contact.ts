import { z } from "zod";

// Bangladeshi mobile numbers: accepts 01712345678, +8801712345678, 8801712-345678…
const BD_MOBILE = /^(?:\+?88)?(01[3-9]\d{8})$/;

/** "01712 345678" → "+8801712345678", or null if it isn't a BD mobile number. */
export function normalizeMobile(raw: string): string | null {
  const m = raw.trim().replace(/[\s-]/g, "").match(BD_MOBILE);
  return m ? `+88${m[1]}` : null;
}

export type Contact = { email: string; phone?: undefined } | { phone: string; email?: undefined };

/** An email or a mobile number, told apart by the "@". */
export function parseContact(raw: string): Contact | null {
  const v = raw.trim();
  if (v.includes("@")) {
    const email = v.toLowerCase();
    return z.email().safeParse(email).success ? { email } : null;
  }
  const phone = normalizeMobile(v);
  return phone ? { phone } : null;
}

export const MOBILE_MESSAGE = "Enter a valid mobile number (01XXXXXXXXX)";

/** Zod field: a BD mobile number, stored normalised. */
export const MobileField = z.string().transform((v, ctx) => {
  const phone = normalizeMobile(v);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: MOBILE_MESSAGE });
    return z.NEVER;
  }
  return phone;
});
