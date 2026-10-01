import { z } from "zod";
import { requireUser } from "../../utils/auth";
import { body } from "../../utils/validation";
import { db } from "../../utils/db";
export default defineEventHandler(async (event) => {
  const actor = await requireUser(event, true),
    input = await body(
      event,
      z.object({ feeBps: z.number().int().min(0).max(1000) }),
    );
  await db.$transaction(async (tx) => {
    await tx.systemSetting.upsert({
      where: { key: "internalFeeBps" },
      create: { key: "internalFeeBps", value: String(input.feeBps) },
      update: { value: String(input.feeBps) },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        targetType: "SystemSetting",
        targetId: "internalFeeBps",
        action: "SETTING_UPDATED",
        metadata: input,
      },
    });
  });
  return { ok: true };
});
