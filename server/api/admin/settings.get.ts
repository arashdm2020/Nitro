import { requireUser } from "../../utils/auth";
import { db } from "../../utils/db";
export default defineEventHandler(async (event) => {
  await requireUser(event, true);
  return {
    feeBps:
      (await db.systemSetting.findUnique({ where: { key: "internalFeeBps" } }))
        ?.value ?? "0",
  };
});
