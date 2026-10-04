import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

export const BalanceDecimal = Decimal.clone({ precision: 60 });

export function availableAccount<
  T extends { balance: Prisma.Decimal; reservedBalance: Prisma.Decimal },
>(account: T) {
  return {
    ...account,
    balance: new BalanceDecimal(account.balance.toString())
      .sub(account.reservedBalance.toString())
      .toString(),
    totalBalance: account.balance.toString(),
    reservedBalance: account.reservedBalance.toString(),
  };
}
