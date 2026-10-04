import { requireUser, rateLimit } from "../../../utils/auth";
import { cancelRequest } from "../../../services/requests";

export default defineEventHandler(async (event) => {
  const actor = await requireUser(event);
  await rateLimit(event, "cancel-request", 30, 60, actor.id);
  return cancelRequest(
    getRouterParam(event, "reference") ?? "",
    actor.id,
    actor.role === "ADMIN",
  );
});
