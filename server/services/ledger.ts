import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { createHash, randomBytes } from "node:crypto";
import { createError } from "h3";
import { db } from "../utils/db";
Decimal.set({ precision: 60 });
export type Movement = {
  actorId: string;
  assetId: string;
  amount: string;
  idempotencyKey: string;
  recipient?: string;
  userId?: string;
  operation?: "CREDIT" | "DEBIT";
  reason?: string;
};
function fail(code: string, status = 400): never {
  throw createError({ statusCode: status, statusMessage: code });
}
export function validAmount(value: string, decimals: number) {
  if (!/^(0|[1-9]\d{0,19})(\.\d{1,18})?$/.test(value))
    return fail("INVALID_AMOUNT");
  const number = new Decimal(value);
  if (!number.gt(0) || number.decimalPlaces() > decimals)
    return fail("INVALID_AMOUNT");
  return number;
}
export async function move(input: Movement) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const replay = await tx.transaction.findUnique({
            where: {
              actorId_idempotencyKey: {
                actorId: input.actorId,
                idempotencyKey: input.idempotencyKey,
              },
            },
          });
          if (replay) {
            if (replay.requestHash !== fingerprint)
              fail("IDEMPOTENCY_CONFLICT", 409);
            return replay;
          }
          const actor = await tx.user.findUnique({
            where: { id: input.actorId },
          });
          if (!actor || actor.status !== "ACTIVE" || actor.mustResetPassword)
            fail("UNAUTHORIZED", 401);
          const adjustment = !!input.operation;
          if (adjustment && actor.role !== "ADMIN") fail("FORBIDDEN", 403);
          const asset = await tx.asset.findUnique({
            where: { id: input.assetId },
          });
          if (!asset?.enabled) return fail("ASSET_DISABLED");
          const quantity = validAmount(input.amount, asset.decimals);
          const recipient = adjustment
            ? await tx.user.findUnique({ where: { id: input.userId } })
            : await tx.user.findUnique({
                where: { username: input.recipient },
              });
          if (!recipient) return fail("USER_NOT_FOUND");
          if (!adjustment && recipient.status !== "ACTIVE")
            fail("USER_DISABLED");
          if (!adjustment && recipient.id === actor.id)
            fail("INVALID_RECIPIENT");
          const target = await tx.account.findUnique({
            where: {
              userId_assetId: { userId: recipient.id, assetId: asset.id },
            },
          });
          if (!target) return fail("ACCOUNT_NOT_FOUND");
          const feeRule = await tx.systemSetting.findUnique({
            where: { key: "internalFeeBps" },
          });
          const bps = new Decimal(feeRule?.value ?? "0");
          const fee = adjustment
            ? new Decimal(0)
            : quantity
                .mul(bps)
                .div(10000)
                .toDecimalPlaces(asset.decimals, Decimal.ROUND_UP);
          const other = adjustment
            ? await tx.account.findUnique({
                where: { systemKey: `treasury:${asset.symbol}` },
              })
            : await tx.account.findUnique({
                where: {
                  userId_assetId: { userId: actor.id, assetId: asset.id },
                },
              });
          if (!other) return fail("ACCOUNT_NOT_FOUND");
          const credit = adjustment && input.operation === "CREDIT";
          const sender = credit ? other : adjustment ? target : other;
          const receiver = credit ? target : adjustment ? other : target;
          const total = quantity.add(fee);
          // Atomic conditional debit is the overspend guard. Serializable retries handle competing writers.
          const debited = sender.userId
            ? await tx.account.updateMany({
                where: { id: sender.id, balance: { gte: total.toString() } },
                data: { balance: { decrement: total.toString() } },
              })
            : await tx.account.updateMany({
                where: { id: sender.id },
                data: { balance: { decrement: total.toString() } },
              });
          if (debited.count !== 1) fail("INSUFFICIENT_BALANCE");
          await tx.account.update({
            where: { id: receiver.id },
            data: { balance: { increment: quantity.toString() } },
          });
          const transaction = await tx.transaction.create({
            data: {
              actorId: actor.id,
              idempotencyKey: input.idempotencyKey,
              requestHash: fingerprint,
              reference: `0x${randomBytes(32).toString("hex")}`,
              assetId: asset.id,
              senderId: sender.userId,
              recipientId: receiver.userId,
              amount: quantity.toString(),
              fee: fee.toString(),
              type: adjustment ? "ADMIN_ADJUSTMENT" : "INTERNAL",
              reason: input.reason,
              completedAt: new Date(),
            },
          });
          await tx.ledgerEntry.createMany({
            data: [
              {
                accountId: sender.id,
                transactionId: transaction.id,
                amount: total.negated().toString(),
              },
              {
                accountId: receiver.id,
                transactionId: transaction.id,
                amount: quantity.toString(),
              },
            ],
          });
          if (fee.gt(0)) {
            const revenue = await tx.account.findUnique({
              where: { systemKey: `fees:${asset.symbol}` },
            });
            if (!revenue) fail("ACCOUNT_NOT_FOUND");
            await tx.account.update({
              where: { id: revenue.id },
              data: { balance: { increment: fee.toString() } },
            });
            await tx.ledgerEntry.create({
              data: {
                accountId: revenue.id,
                transactionId: transaction.id,
                amount: fee.toString(),
              },
            });
          }
          if (adjustment)
            await tx.auditLog.create({
              data: {
                actorId: actor.id,
                targetType: "Account",
                targetId: target.id,
                action: "BALANCE_ADJUSTED",
                metadata: {
                  operation: input.operation,
                  amount: quantity.toString(),
                  asset: asset.symbol,
                  reason: input.reason ?? "",
                  reference: transaction.reference,
                },
              },
            });
          return transaction;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code) &&
        attempt < 4
      )
        continue;
      throw error;
    }
  }
  return fail("CONCURRENT_REQUEST", 409);
}
