import { requireUser } from "../../utils/auth";
import { db } from "../../utils/db";
export default defineEventHandler(async (event) => {
  await requireUser(event, true);
  const q = getQuery(event),
    page = Math.max(1, Math.min(10000, Number(q.page) || 1)),
    target = q.target ? String(q.target) : undefined;
  const accounts = target
    ? await db.account.findMany({
        where: { userId: target },
        select: { id: true },
      })
    : [];
  const wallets = target
    ? await db.walletAddress.findMany({
        where: { userId: target },
        select: { id: true },
      })
    : [];
  const where = target
    ? {
        targetId: {
          in: [
            target,
            ...accounts.map((a) => a.id),
            ...wallets.map((w) => w.id),
          ],
        },
      }
    : {};
  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      take: 20,
      skip: (page - 1) * 20,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { username: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return { items, total, page };
});
