import { requireUser, publicUser } from "../utils/auth";
import { db } from "../utils/db";
import { refreshPrices } from "../services/prices";
import { availableAccount } from "../services/balances";
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
      where: {
        userId: user.id,
        status: "ACTIVE",
        asset: { enabled: true },
        network: { enabled: true },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }, { id: "asc" }],
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
      ...availableAccount(a),
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
    wallets: wallets.filter((wallet) =>
      accounts.some(
        (account) =>
          account.assetId === wallet.assetId &&
          account.asset.networks.some(
            (mapping) => mapping.networkId === wallet.networkId,
          ),
      ),
    ),
    feeBps: settings?.value ?? "0",
  };
});
