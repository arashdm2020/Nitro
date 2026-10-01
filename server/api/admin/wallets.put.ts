import { z } from "zod";
import { requireUser } from "../../utils/auth";
import { body, id } from "../../utils/validation";
import { db } from "../../utils/db";
export default defineEventHandler(async (event) => {
  const actor = await requireUser(event, true);
  const input = await body(
    event,
    z.object({
      userId: id,
      assetId: id,
      networkId: id,
      address: z.string().trim().min(8).max(256),
      label: z.string().max(80).optional(),
    }),
  );
  await db.$transaction(async (tx) => {
    const relation = await tx.assetNetwork.findUnique({
      where: {
        assetId_networkId: {
          assetId: input.assetId,
          networkId: input.networkId,
        },
      },
      include: { asset: true, network: true },
    });
    if (!relation?.asset.enabled || !relation.network.enabled)
      throw createError({ statusCode: 400, statusMessage: "NETWORK_DISABLED" });
    const key = {
      userId: input.userId,
      assetId: input.assetId,
      networkId: input.networkId,
    };
    const old = await tx.walletAddress.findUnique({
      where: { userId_assetId_networkId: key },
    });
    const wallet = await tx.walletAddress.upsert({
      where: { userId_assetId_networkId: key },
      create: input,
      update: { address: input.address, label: input.label },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        targetType: "WalletAddress",
        targetId: wallet.id,
        action: "WALLET_ADDRESS_CHANGED",
        metadata: {
          previousAddress: old?.address ?? null,
          address: input.address,
          userId: input.userId,
        },
      },
    });
  });
  return { ok: true };
});
