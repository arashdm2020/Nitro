import Decimal from "decimal.js";
import type { WalletData } from "~/types";
export const useWallet = () =>
  useFetch<WalletData>("/api/wallet", { key: "wallet" });
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
    USER_NOT_FOUND: "No account matches this username.",
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
