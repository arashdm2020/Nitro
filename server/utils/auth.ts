import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { H3Event } from "h3";
import { db } from "./db";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const publicUser = (u: {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  status: string;
  mustResetPassword: boolean;
}) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  role: u.role,
  status: u.status,
  mustResetPassword: u.mustResetPassword,
});
export async function requireUser(
  event: H3Event,
  admin = false,
  allowReset = false,
) {
  const token = getCookie(event, "nitro_session");
  if (!token)
    throw createError({ statusCode: 401, statusMessage: "UNAUTHORIZED" });
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (
    !session ||
    session.expiresAt < new Date() ||
    session.user.status !== "ACTIVE"
  )
    throw createError({ statusCode: 401, statusMessage: "UNAUTHORIZED" });
  if (admin && session.user.role !== "ADMIN")
    throw createError({ statusCode: 403, statusMessage: "FORBIDDEN" });
  if (session.user.mustResetPassword && !allowReset)
    throw createError({
      statusCode: 403,
      statusMessage: "PASSWORD_RESET_REQUIRED",
    });
  return session.user;
}
export async function createSession(event: H3Event, userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 12 * 3600000),
    },
  });
  setCookie(event, "nitro_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 12 * 3600,
  });
}
export const hashPassword = (password: string) =>
  argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
export async function rateLimit(
  event: H3Event,
  scope: string,
  limit: number,
  seconds: number,
  actor = "",
) {
  const key = hashToken(
    `${scope}:${actor || getRequestIP(event) || "unknown"}`,
  );
  const rows = await db.$queryRaw<
    Array<{ count: number }>
  >`INSERT INTO "RateLimit" ("key","count","resetsAt") VALUES (${key},1,NOW()+${seconds}*INTERVAL '1 second') ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."resetsAt" < NOW() THEN 1 ELSE "RateLimit"."count"+1 END,"resetsAt"=CASE WHEN "RateLimit"."resetsAt" < NOW() THEN NOW()+${seconds}*INTERVAL '1 second' ELSE "RateLimit"."resetsAt" END RETURNING "count"`;
  if ((rows[0]?.count ?? 0) > limit)
    throw createError({ statusCode: 429, statusMessage: "RATE_LIMITED" });
}
