import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assets: vi.fn(),
  count: vi.fn(),
  upsert: vi.fn(),
  transaction: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("../server/utils/db", () => ({
  db: {
    asset: { findMany: mocks.assets },
    price: { count: mocks.count, upsert: mocks.upsert },
    $transaction: mocks.transaction,
  },
}));
vi.mock("../server/services/providers", () => ({
  CoinGeckoProvider: class {
    fetch = mocks.fetch;
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.assets.mockResolvedValue([
    { id: "trx", symbol: "TRX" },
    { id: "btc", symbol: "BTC" },
  ]);
  mocks.fetch.mockResolvedValue({
    TRX: { price: 0.34, change24h: 0 },
    BTC: { price: 86000, change24h: 1 },
  });
  mocks.transaction.mockResolvedValue([]);
});

it("refreshes missing/stale quotes even when another asset has a fresh quote", async () => {
  mocks.count.mockResolvedValue(1);
  const { refreshPrices } = await import("../server/services/prices");
  await refreshPrices();
  expect(mocks.fetch).toHaveBeenCalledWith(["TRX", "BTC"]);
  expect(mocks.upsert).toHaveBeenCalledTimes(2);
  expect(mocks.upsert.mock.calls[0]![0].update.change24h).toBe("0");
  await refreshPrices();
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});

it("avoids a provider request when every tracked USD quote is fresh", async () => {
  mocks.count.mockResolvedValue(2);
  const { refreshPrices } = await import("../server/services/prices");
  await refreshPrices();
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("retains saved quotes when the provider fails", async () => {
  mocks.count.mockResolvedValue(0);
  mocks.fetch.mockRejectedValue(new Error("offline"));
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const { refreshPrices } = await import("../server/services/prices");
    await expect(refreshPrices()).resolves.toBeUndefined();
    expect(mocks.upsert).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
  }
});
