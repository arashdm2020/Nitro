import { z } from "zod";
import { requireUser } from "../../../utils/auth";
import { body, id } from "../../../utils/validation";
import { db } from "../../../utils/db";
export default defineEventHandler(async (event) => {
  const actor = await requireUser(event, true),
    target = id.parse(getRouterParam(event, "id"));
  const input = await body(
    event,
    z.object({
      name: z.string().min(1).max(80).optional(),
      enabled: z.boolean().optional(),
      displayOrder: z.number().int().min(0).max(1000).optional(),
      priceTrackingEnabled: z.boolean().optional(),
    }),
  );
  await db.$transaction(async (tx) => {
    await tx.asset.update({ where: { id: target }, data: input });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        targetType: "Asset",
        targetId: target,
        action: "ASSET_UPDATED",
        metadata: input,
      },
    });
  });
  return { ok: true };
});
