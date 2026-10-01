import { requireUser } from "../../utils/auth";
import { db } from "../../utils/db";
export default defineEventHandler(async (event) => {
  await requireUser(event, true);
  const q = getQuery(event),
    page = Math.max(1, Math.min(10000, Number(q.page) || 1));
  const where = {
    userId: { not: null },
    ...(q.search
      ? { user: { username: { contains: String(q.search).slice(0, 80) } } }
      : {}),
    ...(q.asset ? { asset: { symbol: String(q.asset) } } : {}),
  };
  const [items, total] = await Promise.all([
    db.account.findMany({
      where,
      include: { user: { select: { id: true, username: true } }, asset: true },
      orderBy: { id: "asc" },
      take: 20,
      skip: (page - 1) * 20,
    }),
    db.account.count({ where }),
  ]);
  return { items, total, page };
});
