import { requireUser, publicUser } from "../../../utils/auth";
import { db } from "../../../utils/db";
export default defineEventHandler(async (event) => {
  await requireUser(event, true);
  const user = await db.user.findUnique({
    where: { id: getRouterParam(event, "id") },
    include: {
      accounts: { include: { asset: true } },
      wallets: {
        select: {
          id: true,
          assetId: true,
          networkId: true,
          address: true,
          label: true,
          network: true,
          asset: true,
        },
      },
      audits: { take: 20, orderBy: { createdAt: "desc" } },
    },
  });
  if (!user)
    throw createError({ statusCode: 404, statusMessage: "USER_NOT_FOUND" });
  return {
    ...publicUser(user),
    accounts: user.accounts,
    wallets: user.wallets,
    createdAt: user.createdAt,
  };
});
