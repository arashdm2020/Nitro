import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { availableAccount } from "../server/services/balances";

describe("available balance precision", () => {
  it("preserves all digits when a reservation leaves only the smallest unit", () => {
    expect(
      availableAccount({
        balance: new Prisma.Decimal("99999999999999999999.999999999999999999"),
        reservedBalance: new Prisma.Decimal(
          "99999999999999999999.999999999999999998",
        ),
      }),
    ).toEqual({
      balance: "1e-18",
      totalBalance: "99999999999999999999.999999999999999999",
      reservedBalance: "99999999999999999999.999999999999999998",
    });
  });
});
