import { createError } from "h3";
import { db } from "../utils/db";
import { hashPassword, publicUser } from "../utils/auth";
export async function provisionUser(
  actorId: string,
  input: {
    username: string;
    password: string;
    displayName?: string;
    status: "ACTIVE" | "SUSPENDED" | "DISABLED";
  },
) {
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor || actor.role !== "ADMIN" || actor.status !== "ACTIVE")
      throw createError({ statusCode: 403, statusMessage: "FORBIDDEN" });
    const user = await tx.user.create({
      data: {
        username: input.username,
        passwordHash,
        displayName: input.displayName,
        status: input.status,
      },
    });
    const assets = await tx.asset.findMany();
    await tx.account.createMany({
      data: assets.map((asset) => ({ userId: user.id, assetId: asset.id })),
    });
    await tx.auditLog.create({
      data: {
        actorId,
        targetType: "User",
        targetId: user.id,
        action: "USER_CREATED",
        metadata: { username: user.username, status: user.status },
      },
    });
    return publicUser(user);
  });
}
