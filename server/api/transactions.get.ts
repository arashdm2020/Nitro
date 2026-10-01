import { requireUser } from "../utils/auth";
import { db } from "../utils/db";
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const query = getQuery(event);
  const direction = query.direction;
  const where =
    direction === "sent"
      ? { senderId: user.id }
      : direction === "received"
        ? { recipientId: user.id }
        : { OR: [{ senderId: user.id }, { recipientId: user.id }] };
  const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  const [items, total] = await Promise.all([
    db.transaction.findMany({
      where,
      include: {
        asset: true,
        sender: { select: { username: true } },
        recipient: { select: { username: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 20,
      take: 20,
    }),
    db.transaction.count({ where }),
  ]);
  return { items, total, page };
});
