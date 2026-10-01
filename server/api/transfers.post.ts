import { z } from "zod";
import { requireUser, rateLimit } from "../utils/auth";
import { body, amount, id, username } from "../utils/validation";
import { move } from "../services/ledger";
export default defineEventHandler(async (event) => {
  const actor = await requireUser(event);
  await rateLimit(event, "transfer", 30, 60, actor.id);
  const input = await body(
    event,
    z.object({
      assetId: id,
      recipient: username,
      amount,
      idempotencyKey: z.uuid(),
    }),
  );
  return move({ ...input, actorId: actor.id });
});
