import { requireUser, publicUser } from "../../utils/auth";
export default defineEventHandler(async (event) =>
  publicUser(await requireUser(event, false, true)),
);
