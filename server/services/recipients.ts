import type { Prisma } from "@prisma/client";
import { createError } from "h3";

// Use the administrator's asset/address/network mapping, never an address-prefix
// guess. Only EVM hex addresses are case-insensitive; TRON and virtual IDs are not.
export async function resolveRecipient(
  tx: Prisma.TransactionClient,
  actorId: string,
  assetId: string,
  address: string,
) {
  const value = address.trim();
  const matches = await tx.walletAddress.findMany({
    where: {
      assetId,
      OR: [
        { address: value },
        ...(/^0x[0-9a-fA-F]{40}$/.test(value)
          ? [
              {
                address: { equals: value, mode: "insensitive" as const },
                network: { networkType: "EVM" },
              },
            ]
          : []),
      ],
    },
    include: { user: true, asset: true, network: true },
    take: 2,
  });
  if (!matches.length)
    throw createError({ statusCode: 400, statusMessage: "ADDRESS_NOT_FOUND" });
  // Even disabled duplicate mappings make ownership/network resolution unsafe.
  if (matches.length !== 1)
    throw createError({ statusCode: 409, statusMessage: "ADDRESS_AMBIGUOUS" });
  const wallet = matches[0]!;
  if (wallet.status !== "ACTIVE")
    throw createError({ statusCode: 400, statusMessage: "ADDRESS_DISABLED" });
  if (!wallet.asset.enabled)
    throw createError({ statusCode: 400, statusMessage: "ASSET_DISABLED" });
  const mapping = await tx.assetNetwork.findUnique({
    where: { assetId_networkId: { assetId, networkId: wallet.networkId } },
  });
  if (!wallet.network.enabled || !mapping)
    throw createError({ statusCode: 400, statusMessage: "NETWORK_DISABLED" });
  if (wallet.user.status !== "ACTIVE")
    throw createError({ statusCode: 400, statusMessage: "USER_DISABLED" });
  if (wallet.userId === actorId)
    throw createError({ statusCode: 400, statusMessage: "INVALID_RECIPIENT" });
  return wallet;
}
