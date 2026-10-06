import Decimal from "decimal.js";
import type { Account, WalletData } from "~/types";
export const useWallet = () => {
  const wallet = useFetch<WalletData>("/api/wallet", { key: "wallet" });
  let timer: ReturnType<typeof setInterval> | undefined;
  const refreshVisible = async () => {
    if (
      document.visibilityState === "visible" &&
      navigator.onLine &&
      wallet.status.value !== "pending"
    ) {
      const previous = wallet.data.value;
      await wallet.refresh();
      if (wallet.error.value && previous) wallet.data.value = previous;
    }
  };
  onMounted(() => {
    timer = setInterval(refreshVisible, 15000);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("online", refreshVisible);
    window.addEventListener("focus", refreshVisible);
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", refreshVisible);
    window.removeEventListener("online", refreshVisible);
    window.removeEventListener("focus", refreshVisible);
  });
  return wallet;
};

const PortfolioDecimal = Decimal.clone({ precision: 60 });
export function sortWalletAccounts(accounts: Account[]) {
  const value = (a: Account) =>
    new PortfolioDecimal(a.balance).mul(a.asset.prices?.[0]?.value ?? "0");
  return [...accounts].sort((a, b) => {
    // Nonzero holdings stay above empty accounts even if a quote is unavailable.
    const held =
      Number(new PortfolioDecimal(b.balance).gt(0)) -
      Number(new PortfolioDecimal(a.balance).gt(0));
    return (
      held ||
      value(b).cmp(value(a)) ||
      a.asset.displayOrder - b.asset.displayOrder ||
      a.asset.symbol.localeCompare(b.asset.symbol)
    );
  });
}
export const money = (value: string | number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(Number(value));
export const units = (value: string | number) =>
  new Decimal(value).toFixed(Math.min(8, new Decimal(value).decimalPlaces()));
export const short = (value: string) =>
  value.length > 24 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
export const date = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export function errorMessage(error: unknown) {
  const err = error as { data?: { statusMessage?: string }; message?: string };
  const code = err.data?.statusMessage ?? "";
  const errors: Record<string, string> = {
    INSUFFICIENT_BALANCE: "Your available balance is insufficient.",
    INVALID_CREDENTIALS: "Username or password is incorrect.",
    USER_DISABLED: "This recipient is unavailable.",
    USER_NOT_FOUND: "The requested user account was not found.",
    ADDRESS_NOT_FOUND:
      "No Nitro wallet matches this address for the selected asset.",
    INVALID_RECIPIENT_ADDRESS:
      "Enter a valid wallet address. Check the address and its checksum.",
    ADDRESS_NETWORK_MISMATCH:
      "This address is not compatible with an enabled network for the selected asset.",
    REQUEST_NOT_PENDING:
      "This request is no longer awaiting processing. Reload to see its status.",
    TRANSACTION_NOT_FOUND: "This request could not be found.",
    ADDRESS_AMBIGUOUS:
      "This address matches multiple networks. Select the destination network and review again.",
    ADDRESS_DISABLED: "This wallet address is disabled.",
    NETWORK_DISABLED: "The assigned network is unavailable for this asset.",
    ASSET_DISABLED: "This asset is currently disabled.",
    ACCOUNT_NOT_FOUND:
      "An asset account is missing. Contact your administrator.",
    RECIPIENT_CHANGED:
      "The recipient address changed. Review the transfer again.",
    INVALID_ORIGIN:
      "The request origin could not be verified. Reload the app and try again.",
    UNAUTHORIZED: "Your session has expired. Sign in again.",
    INVALID_RECIPIENT: "Choose a recipient other than yourself.",
    INVALID_AMOUNT: "Enter a positive amount within the asset precision.",
    INVALID_INPUT: "Please check the form fields.",
    USERNAME_EXISTS: "This username is already in use.",
    IDEMPOTENCY_CONFLICT:
      "This request was already used with different details.",
    RATE_LIMITED: "Too many requests. Please try again shortly.",
    NETWORK_HAS_WALLETS: "This asset has assigned addresses on the network.",
    PASSWORD_RESET_REQUIRED: "Change your password before continuing.",
  };
  return errors[code] ?? "Unable to complete this request. Please try again.";
}
