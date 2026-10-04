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
    USER_NOT_FOUND: "The requested user account was not found.",
    ADDRESS_NOT_FOUND:
      "No Nitro wallet matches this address for the selected asset.",
    INVALID_RECIPIENT_ADDRESS:
      "Enter a valid wallet address. Check the address and its checksum.",
    ADDRESS_NETWORK_MISMATCH:
      "This address is not compatible with an enabled network for the selected asset.",
    EXTERNAL_TRANSFERS_UNAVAILABLE:
      "External sending is not enabled. No funds have been sent or deducted.",
    ADDRESS_AMBIGUOUS:
      "This address has multiple network assignments. Ask your administrator to resolve them.",
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
