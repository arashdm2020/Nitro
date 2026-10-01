import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as typeof globalThis & { nitroDb?: PrismaClient };
export const db = globalDb.nitroDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.nitroDb = db;
