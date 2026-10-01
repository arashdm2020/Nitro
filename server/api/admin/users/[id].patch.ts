import { z } from "zod";
import { requireUser, hashPassword } from "../../../utils/auth";
import { body, password, id } from "../../../utils/validation";
import { db } from "../../../utils/db";
export default defineEventHandler(async (event) => {
  const actor = await requireUser(event, true),
    target = id.parse(getRouterParam(event, "id"));
  const input = await body(
    event,
    z.object({
      displayName: z.string().max(80).optional(),
      status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
      password: password.optional(),
      mustResetPassword: z.boolean().optional(),
    }),
  );
  if (actor.id === target && input.status && input.status !== "ACTIVE")
    throw createError({
      statusCode: 400,
      statusMessage: "CANNOT_DISABLE_SELF",
    });
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : undefined;
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target },
      data: {
        displayName: input.displayName,
        status: input.status,
        ...(passwordHash
          ? { passwordHash, mustResetPassword: input.mustResetPassword ?? true }
          : {}),
      },
    });
    if (passwordHash || input.status)
      await tx.session.deleteMany({ where: { userId: target } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        targetType: "User",
        targetId: target,
        action: passwordHash ? "PASSWORD_RESET" : "USER_UPDATED",
        metadata: {
          status: input.status ?? null,
          displayName: input.displayName ?? null,
        },
      },
    });
  });
  return { ok: true };
});
