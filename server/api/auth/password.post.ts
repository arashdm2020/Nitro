import { z } from "zod";
import argon2 from "argon2";
import { body, password } from "../../utils/validation";
import { requireUser, hashPassword, rateLimit } from "../../utils/auth";
import { db } from "../../utils/db";
export default defineEventHandler(async (event) => {
  const user = await requireUser(event, false, true);
  await rateLimit(event, "password-change", 5, 300, user.id);
  const input = await body(
    event,
    z.object({ currentPassword: z.string().max(128), password }),
  );
  if (!(await argon2.verify(user.passwordHash, input.currentPassword)))
    throw createError({
      statusCode: 400,
      statusMessage: "INVALID_CREDENTIALS",
    });
  const hashed = await hashPassword(input.password);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: hashed, mustResetPassword: false },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
  });
  deleteCookie(event, "nitro_session", { path: "/" });
  return { ok: true };
});
