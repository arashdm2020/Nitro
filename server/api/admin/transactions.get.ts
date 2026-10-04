import { z } from "zod";
import { requireUser } from "../../utils/auth";
import { db } from "../../utils/db";
export default defineEventHandler(async (event) => {
  await requireUser(event, true);
  const q = getQuery(event),
    page = Math.max(1, Math.min(10000, Number(q.page) || 1)),
    search = String(q.search ?? "").slice(0, 256);
  const type = z
    .enum(["INTERNAL", "ADMIN_ADJUSTMENT", "BLOCKCHAIN", "EXCHANGE"])
    .safeParse(q.type);
  const status = z
    .enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED"])
    .safeParse(q.status);
  const since = z.iso.date().safeParse(q.since),
    until = z.iso.date().safeParse(q.until);
  const wallets = search
    ? await db.walletAddress.findMany({
        where: { address: { contains: search } },
        select: { userId: true },
        take: 100,
      })
    : [];
  const userId = z.uuid().safeParse(q.userId);
  const where = {
    ...(userId.success
      ? {
          AND: [
            { OR: [{ senderId: userId.data }, { recipientId: userId.data }] },
          ],
        }
      : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search } },
            { recipientAddress: { contains: search } },
            { sender: { username: { contains: search } } },
            { recipient: { username: { contains: search } } },
            ...(wallets.length
              ? [
                  { senderId: { in: wallets.map((w) => w.userId) } },
                  { recipientId: { in: wallets.map((w) => w.userId) } },
                ]
              : []),
          ],
        }
      : {}),
    ...(type.success ? { type: type.data } : {}),
    ...(status.success ? { status: status.data } : {}),
    ...(q.asset ? { asset: { symbol: String(q.asset) } } : {}),
    ...(since.success || until.success
      ? {
          createdAt: {
            ...(since.success ? { gte: new Date(since.data) } : {}),
            ...(until.success
              ? { lt: new Date(new Date(until.data).getTime() + 86400000) }
              : {}),
          },
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.transaction.findMany({
      where,
      take: 20,
      skip: (page - 1) * 20,
      orderBy: { createdAt: "desc" },
      include: {
        asset: true,
        sender: { select: { username: true } },
        recipient: { select: { username: true } },
      },
    }),
    db.transaction.count({ where }),
  ]);
  return { items, total, page };
});
