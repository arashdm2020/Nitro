import { z } from "zod";
import { requireUser, rateLimit } from "../../utils/auth";
import { body, amount, id } from "../../utils/validation";
import { move } from "../../services/ledger";
export default defineEventHandler(async (event) => {
  const actor = await requireUser(event, true);
  await rateLimit(event, "adjustment", 30, 60, actor.id);
  const input = await body(
    event,
    z.object({
      userId: id,
      assetId: id,
      amount,
      operation: z.enum(["CREDIT", "DEBIT"]),
      reason: z.string().trim().min(5).max(500),
      idempotencyKey: z.uuid(),
    }),
  );
  return move({ ...input, actorId: actor.id });
});
