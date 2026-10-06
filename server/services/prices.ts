import { db } from "../utils/db";
import { CoinGeckoProvider } from "./providers";
let refresh: Promise<void> | undefined;
let nextAttempt = 0;
export async function refreshPrices() {
  if (Date.now() < nextAttempt) return;
  if (refresh) return refresh;
  nextAttempt = Date.now() + 60000;
  refresh = (async () => {
    const assets = await db.asset.findMany({
      where: { enabled: true, priceTrackingEnabled: true },
    });
    if (!assets.length) return;
    const fresh = await db.price.count({
      where: {
        assetId: { in: assets.map((a) => a.id) },
        currency: "USD",
        fetchedAt: { gte: new Date(Date.now() - 60000) },
      },
    });
    if (fresh === assets.length) return;
    try {
      const prices = await new CoinGeckoProvider().fetch(
        assets.map((a) => a.symbol),
      );
      await db.$transaction(
        assets
          .filter((a) => prices[a.symbol])
          .map((a) => {
            const p = prices[a.symbol]!;
            const data = {
              value: String(p.price),
              change24h: p.change24h === null ? null : String(p.change24h),
              source: "CoinGecko",
              fetchedAt: new Date(),
            };
            return db.price.upsert({
              where: { assetId_currency: { assetId: a.id, currency: "USD" } },
              create: { assetId: a.id, ...data },
              update: data,
            });
          }),
      );
    } catch {
      console.warn(
        JSON.stringify({
          event: "price_refresh_failed",
          provider: "CoinGecko",
        }),
      );
    }
  })().finally(() => {
    refresh = undefined;
  });
  return refresh;
}
