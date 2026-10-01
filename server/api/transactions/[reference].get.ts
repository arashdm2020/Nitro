import { requireUser } from "../../utils/auth";
import { db } from "../../utils/db";
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const item = await db.transaction.findFirst({
    where: {
      reference: getRouterParam(event, "reference"),
      ...(user.role === "ADMIN"
        ? {}
        : { OR: [{ senderId: user.id }, { recipientId: user.id }] }),
    },
    include: {
      asset: true,
      sender: { select: { username: true } },
      recipient: { select: { username: true } },
    },
  });
  if (!item)
    throw createError({
      statusCode: 404,
      statusMessage: "TRANSACTION_NOT_FOUND",
    });
  return item;
});
