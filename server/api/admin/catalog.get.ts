import { requireUser } from "../../utils/auth";
import { db } from "../../utils/db";
export default defineEventHandler(async (event) => {
  await requireUser(event, true);
  const [assets, networks] = await Promise.all([
    db.asset.findMany({
      orderBy: { displayOrder: "asc" },
      include: { networks: true },
    }),
    db.network.findMany({
      orderBy: { createdAt: "asc" },
      include: { assets: true },
    }),
  ]);
  return { assets, networks };
});
