import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createError } from "h3";
import { db } from "../utils/db";
import { BalanceDecimal } from "./balances";

export async function reserveRequest(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    assetId: string;
    amount: string;
    idempotencyKey: string;
    requestHash: string;
    recipientAddress: string;
    networkId: string;
    networkName: string;
  },
) {
  const account = await tx.account.findUnique({
    where: {
      userId_assetId: { userId: input.actorId, assetId: input.assetId },
    },
  });
  if (!account)
    throw createError({ statusCode: 400, statusMessage: "ACCOUNT_NOT_FOUND" });
  const reserved = await tx.account.updateMany({
    where: {
      id: account.id,
      reservedBalance: account.reservedBalance,
      balance: {
        gte: new BalanceDecimal(account.reservedBalance.toString())
          .add(input.amount)
          .toString(),
      },
    },
    data: { reservedBalance: { increment: input.amount } },
  });
  if (reserved.count !== 1)
    throw createError({
      statusCode: 400,
      statusMessage: "INSUFFICIENT_BALANCE",
    });
  return tx.transaction.create({
    data: {
      ...input,
      senderId: input.actorId,
      reference: `req_${randomUUID()}`,
      type: "BLOCKCHAIN",
      status: "PENDING",
      completedAt: null,
      fee: "0",
    },
  });
}

export async function cancelRequest(
  reference: string,
  actorId: string,
  isAdmin: boolean,
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const request = await tx.transaction.findFirst({
            where: { reference, ...(isAdmin ? {} : { senderId: actorId }) },
          });
          if (
            !request ||
            request.type !== "BLOCKCHAIN" ||
            !request.recipientAddress ||
            !request.senderId
          )
            throw createError({
              statusCode: 404,
              statusMessage: "TRANSACTION_NOT_FOUND",
            });
          if (request.status === "CANCELLED") return request;
          if (request.status !== "PENDING")
            throw createError({
              statusCode: 409,
              statusMessage: "REQUEST_NOT_PENDING",
            });
          const amount = new BalanceDecimal(request.amount.toString())
            .add(request.fee.toString())
            .toString();
          const released = await tx.account.updateMany({
            where: {
              userId: request.senderId,
              assetId: request.assetId,
              reservedBalance: { gte: amount },
            },
            data: { reservedBalance: { decrement: amount } },
          });
          if (released.count !== 1)
            throw createError({
              statusCode: 409,
              statusMessage: "REQUEST_NOT_PENDING",
            });
          const cancelled = await tx.transaction.update({
            where: { id: request.id },
            data: { status: "CANCELLED" },
          });
          await tx.auditLog.create({
            data: {
              actorId,
              targetType: "Transaction",
              targetId: request.id,
              action: "REQUEST_CANCELLED",
              metadata: { reference, amount: amount.toString() },
            },
          });
          return cancelled;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 4
      )
        continue;
      throw error;
    }
  }
  throw createError({ statusCode: 409, statusMessage: "CONCURRENT_REQUEST" });
}
