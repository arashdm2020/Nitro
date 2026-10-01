import { requireUser, publicUser } from "../utils/auth";
import { db } from "../utils/db";
import { refreshPrices } from "../services/prices";
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  await refreshPrices();
  const [accounts, wallets, settings] = await Promise.all([
    db.account.findMany({
      where: { userId: user.id },
      include: {
        asset: {
          include: { prices: true, networks: { include: { network: true } } },
        },
      },
      orderBy: { asset: { displayOrder: "asc" } },
    }),
    db.walletAddress.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      select: {
        id: true,
        assetId: true,
        networkId: true,
        address: true,
        label: true,
        isPrimary: true,
        network: { select: { name: true, enabled: true } },
      },
    }),
    db.systemSetting.findUnique({ where: { key: "internalFeeBps" } }),
  ]);
  return {
    user: publicUser(user),
    accounts: accounts.map((a) => ({
      ...a,
      balance: a.balance.toString(),
      asset: {
        ...a.asset,
        prices: a.asset.prices.map((p) => ({
          ...p,
          value: p.value.toString(),
          change24h: p.change24h?.toString() ?? null,
          stale: Date.now() - p.fetchedAt.getTime() > 300000,
        })),
      },
    })),
    wallets,
    feeBps: settings?.value ?? "0",
  };
});
