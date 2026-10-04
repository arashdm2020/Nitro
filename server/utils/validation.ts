import { z } from "zod";
import type { H3Event } from "h3";
export const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_.-]{2,31}$/);
export const password = z.string().min(12).max(128);
export const amount = z.string().regex(/^(0|[1-9]\d{0,19})(\.\d{1,18})?$/);
export const id = z.uuid();
export const walletAddress = z.string().trim().min(8).max(256).regex(/^\S+$/);
export async function body<T>(
  event: H3Event,
  schema: z.ZodType<T>,
): Promise<T> {
  const result = schema.safeParse(await readBody(event));
  if (!result.success)
    throw createError({
      statusCode: 400,
      statusMessage: "INVALID_INPUT",
      data: { fields: result.error.flatten().fieldErrors },
    });
  return result.data;
}
