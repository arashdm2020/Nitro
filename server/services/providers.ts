export interface ExchangeProvider {
  getBalances(): Promise<Record<string, string>>;
  getTicker(symbol: string): Promise<{ price: string; currency: string }>;
  withdraw(request: {
    asset: string;
    network: string;
    address: string;
    amount: string;
    idempotencyKey: string;
  }): Promise<{ reference: string }>;
  getWithdrawalStatus(reference: string): Promise<string>;
  getDepositAddress(asset: string, network: string): Promise<string>;
}
export interface PriceProvider {
  fetch(
    symbols: string[],
  ): Promise<Record<string, { price: number; change24h: number | null }>>;
}
export class CoinGeckoProvider implements PriceProvider {
  async fetch(symbols: string[]) {
    const ids: Record<string, string> = {
      BTC: "bitcoin",
      ETH: "ethereum",
      USDT: "tether",
      TRX: "tron",
      BNB: "binancecoin",
    };
    const selected = symbols.filter((s) => ids[s]);
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${selected.map((s) => ids[s]).join(",")}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) throw new Error("PRICE_PROVIDER_UNAVAILABLE");
    const data = (await response.json()) as Record<
      string,
      { usd?: number; usd_24h_change?: number }
    >;
    const prices: Record<string, { price: number; change24h: number | null }> =
      {};
    for (const symbol of selected) {
      const item = data[ids[symbol]!];
      if (
        item &&
        typeof item.usd === "number" &&
        Number.isFinite(item.usd) &&
        item.usd > 0
      )
        prices[symbol] = {
          price: item.usd,
          change24h: Number.isFinite(item.usd_24h_change)
            ? item.usd_24h_change!
            : null,
        };
    }
    return prices;
  }
}
