import { z } from "zod";
import argon2 from "argon2";
import { body, username } from "../../utils/validation";
import { db } from "../../utils/db";
import {
  createSession,
  publicUser,
  rateLimit,
  hashPassword,
} from "../../utils/auth";
let dummyHash: Promise<string> | undefined;
export default defineEventHandler(async (event) => {
  await rateLimit(event, "login", 10, 300);
  const input = await body(
    event,
    z.object({
      username,
      password: z.string().max(128),
      admin: z.boolean().optional(),
    }),
  );
  const user = await db.user.findUnique({
    where: { username: input.username },
  });
  dummyHash ??= hashPassword("unusable-dummy-password-9B$");
  const valid = await argon2.verify(
    user?.passwordHash ?? (await dummyHash),
    input.password,
  );
  if (
    !valid ||
    !user ||
    user.status !== "ACTIVE" ||
    (input.admin && user.role !== "ADMIN")
  )
    throw createError({
      statusCode: 401,
      statusMessage: "INVALID_CREDENTIALS",
    });
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(event, user.id);
  return publicUser(user);
});
