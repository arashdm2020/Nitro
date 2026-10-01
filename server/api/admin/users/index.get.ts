import { requireUser, publicUser } from "../../../utils/auth";
import { db } from "../../../utils/db";
import { z } from "zod";
export default defineEventHandler(async (event) => {
  await requireUser(event, true);
  const q = getQuery(event),
    page = Math.max(1, Math.min(10000, Number(q.page) || 1));
  const status = z
    .enum(["ACTIVE", "SUSPENDED", "DISABLED"])
    .safeParse(q.status);
  const where = {
    ...(q.search
      ? {
          username: {
            contains: String(q.search).slice(0, 100),
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(status.success ? { status: status.data } : {}),
  };
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip: (page - 1) * 20,
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
    db.user.count({ where }),
  ]);
  return {
    items: users.map((u) => ({ ...publicUser(u), createdAt: u.createdAt })),
    total,
    page,
  };
});
