import { z } from "zod";
import { requireUser, rateLimit } from "../../utils/auth";
import { body, id, walletAddress } from "../../utils/validation";
import { db } from "../../utils/db";
import {
  resolveRecipient,
  resolveExternalRecipient,
} from "../../services/recipients";

export default defineEventHandler(async (event) => {
  const actor = await requireUser(event);
  await rateLimit(event, "recipient", 60, 60, actor.id);
  const input = await body(
    event,
    z.object({
      assetId: id,
      recipientAddress: walletAddress,
      recipientNetworkId: id.optional(),
    }),
  );
  const wallet = await resolveRecipient(
    db,
    actor.id,
    input.assetId,
    input.recipientAddress,
  );
  if (!wallet)
    return resolveExternalRecipient(
      db,
      input.assetId,
      input.recipientAddress,
      input.recipientNetworkId,
    );
  if (input.recipientNetworkId && wallet.networkId !== input.recipientNetworkId)
    throw createError({ statusCode: 409, statusMessage: "RECIPIENT_CHANGED" });
  return {
    kind: "INTERNAL" as const,
    canSend: true as const,
    walletId: wallet.id,
    address: wallet.address,
    assetId: wallet.assetId,
    network: { id: wallet.network.id, name: wallet.network.name },
  };
});
