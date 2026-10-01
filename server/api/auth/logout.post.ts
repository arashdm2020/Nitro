import { db } from "../../utils/db";
import { hashToken } from "../../utils/auth";
export default defineEventHandler(async (event) => {
  const token = getCookie(event, "nitro_session");
  if (token)
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  deleteCookie(event, "nitro_session", { path: "/" });
  return { ok: true };
});
