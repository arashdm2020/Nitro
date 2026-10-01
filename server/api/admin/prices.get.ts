import { requireUser } from "../../utils/auth";
import { db } from "../../utils/db";
import { refreshPrices } from "../../services/prices";
export default defineEventHandler(async (event) => {
  await requireUser(event, true);
  await refreshPrices();
  return db.asset.findMany({
    include: { prices: true },
    orderBy: { displayOrder: "asc" },
  });
});
