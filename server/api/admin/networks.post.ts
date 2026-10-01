import { z } from "zod";
import { requireUser } from "../../utils/auth";
import { body, id } from "../../utils/validation";
import { db } from "../../utils/db";
export default defineEventHandler(async (event) => {
  const actor = await requireUser(event, true);
  const input = await body(
    event,
    z.object({
      id: id.optional(),
      name: z.string().min(2).max(80),
      slug: z.string().regex(/^[a-z0-9-]{2,50}$/),
      nativeAsset: z.string().min(2).max(10),
      chainId: z.number().int().positive().nullable().optional(),
      explorerBaseUrl: z.url().startsWith("https://").nullable().optional(),
      enabled: z.boolean(),
      networkType: z.enum(["VIRTUAL", "EVM", "BITCOIN", "TRON"]),
      assetIds: z.array(id).min(1).max(30),
    }),
  );
  await db.$transaction(async (tx) => {
    const { id: networkId, assetIds, ...data } = input;
    const network = networkId
      ? await tx.network.update({ where: { id: networkId }, data })
      : await tx.network.create({ data });
    const previous = await tx.assetNetwork.findMany({
      where: { networkId: network.id },
    });
    for (const relation of previous)
      if (!assetIds.includes(relation.assetId)) {
        if (
          await tx.walletAddress.count({
            where: { networkId: network.id, assetId: relation.assetId },
          })
        )
          throw createError({
            statusCode: 409,
            statusMessage: "NETWORK_HAS_WALLETS",
          });
        await tx.assetNetwork.delete({
          where: {
            assetId_networkId: {
              assetId: relation.assetId,
              networkId: network.id,
            },
          },
        });
      }
    for (const assetId of assetIds)
      await tx.assetNetwork.upsert({
        where: { assetId_networkId: { assetId, networkId: network.id } },
        create: { assetId, networkId: network.id },
        update: {},
      });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        targetType: "Network",
        targetId: network.id,
        action: networkId ? "NETWORK_UPDATED" : "NETWORK_CREATED",
        metadata: data,
      },
    });
  });
  return { ok: true };
});
