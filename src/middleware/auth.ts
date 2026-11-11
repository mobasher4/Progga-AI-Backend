import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { forbidden, unauthorized } from "../lib/errors";

export const AUTH_COOKIE = "progga_token";
/** Holds the parent's session while a kid's profile is open on the same device, so the parent can switch back. */
export const GUARDIAN_COOKIE = "progga_guardian";

export function setSessionCookie(res: Response, name: string, token: string) {
  res.cookie(name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

/** Verifies a token without touching the request (e.g. the parked guardian session). */
export function verifyToken(token: string | undefined): AuthUser | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    return { id: String(payload.sub), role: payload.role as Role };
  } catch {
    return null;
  }
}

export type Role = "STUDENT" | "PARENT" | "TEACHER" | "ADMIN";

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

function readToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[AUTH_COOKIE];
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    req.user = { id: String(payload.sub), role: payload.role as Role };
    next();
  } catch {
    next(unauthorized("Your session expired. Please log in again."));
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };

/** Narrowing helper for handlers mounted behind requireAuth */
export function authed(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
