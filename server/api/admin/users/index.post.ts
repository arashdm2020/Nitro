import { z } from "zod";
import { requireUser } from "../../../utils/auth";
import { body, username, password } from "../../../utils/validation";
import { provisionUser } from "../../../services/users";
import { Prisma } from "@prisma/client";
export default defineEventHandler(async (event) => {
  const actor = await requireUser(event, true);
  const input = await body(
    event,
    z.object({
      username,
      password,
      displayName: z.string().max(80).optional(),
      status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).default("ACTIVE"),
    }),
  );
  try {
    return await provisionUser(actor.id, input);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw createError({ statusCode: 409, statusMessage: "USERNAME_EXISTS" });
    throw error;
  }
});
