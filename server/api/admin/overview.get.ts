import { requireUser } from "../../utils/auth";
import { db } from "../../utils/db";
export default defineEventHandler(async (event) => {
  await requireUser(event, true);
  const [users, activeUsers, transfers, transactions, audit, distribution] =
    await Promise.all([
      db.user.count({ where: { role: "USER" } }),
      db.user.count({ where: { role: "USER", status: "ACTIVE" } }),
      db.transaction.count({ where: { type: "INTERNAL" } }),
      db.transaction.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          asset: true,
          sender: { select: { username: true } },
          recipient: { select: { username: true } },
        },
      }),
      db.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { username: true } } },
      }),
      db.account.groupBy({
        by: ["assetId"],
        where: { userId: { not: null } },
        _sum: { balance: true },
      }),
    ]);
  const assets = await db.asset.findMany();
  const volumes = await db.transaction.groupBy({
    by: ["assetId"],
    where: { type: "INTERNAL", status: "COMPLETED" },
    _sum: { amount: true },
  });
  return {
    users,
    activeUsers,
    transfers,
    transactions,
    audit,
    distribution: distribution.map((d) => ({
      ...d,
      symbol: assets.find((a) => a.id === d.assetId)?.symbol,
    })),
    volumes: volumes.map((v) => ({
      ...v,
      symbol: assets.find((a) => a.id === v.assetId)?.symbol,
    })),
  };
});
