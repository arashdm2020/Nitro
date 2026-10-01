import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
const execAsync = promisify(execFile);
const origin = "http://127.0.0.1:3198";
const password = randomBytes(20).toString("base64url");
let pg: PGlite | undefined,
  socket: PGLiteSocketServer | undefined,
  server: ChildProcess,
  db: PrismaClient;
let adminCookie = "",
  aliceCookie = "",
  bobCookie = "",
  aliceId = "",
  bobId = "",
  assetId = "",
  reference = "";
async function api(path: string, method = "GET", body?: object, cookie = "") {
  const response = await fetch(origin + path, {
    method,
    headers: { origin, "content-type": "application/json", cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    data = { text };
  }
  return {
    status: response.status,
    data,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
const adjust = (
  amount: string,
  operation = "CREDIT",
  userId = aliceId,
  key = randomUUID(),
) =>
  api(
    "/api/admin/adjustments",
    "POST",
    {
      assetId,
      userId,
      amount,
      operation,
      reason: "Integration test allocation",
      idempotencyKey: key,
    },
    adminCookie,
  );
const transfer = (amount: string, key = randomUUID(), recipient = "bob") =>
  api(
    "/api/transfers",
    "POST",
    { assetId, amount, recipient, idempotencyKey: key },
    aliceCookie,
  );
async function balance(userId: string) {
  return (
    await db.account.findUniqueOrThrow({
      where: { userId_assetId: { userId, assetId } },
    })
  ).balance.toString();
}
beforeAll(async () => {
  let databaseUrl = process.env.TEST_DATABASE_URL;
  if (databaseUrl) {
    if (!new URL(databaseUrl).pathname.endsWith("/nitro_test"))
      throw Error("TEST_DATABASE_URL must use a dedicated nitro_test database");
  } else {
    pg = new PGlite();
    await pg.waitReady;
    socket = new PGLiteSocketServer({
      db: pg,
      host: "127.0.0.1",
      port: 55439,
      maxConnections: 10,
    });
    await socket.start();
    databaseUrl =
      "postgresql://postgres:postgres@127.0.0.1:55439/postgres?connection_limit=1&pgbouncer=true&statement_cache_size=0";
  }
  process.env.DATABASE_URL = databaseUrl;
  db = new PrismaClient();
  const migrations = readdirSync("prisma/migrations")
    .filter((f) => !f.endsWith(".toml"))
    .sort();
  if (pg) {
    for (const m of migrations)
      await pg.exec(
        readFileSync(`prisma/migrations/${m}/migration.sql`, "utf8"),
      );
  } else
    await execAsync("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "LedgerEntry", "Transaction", "WalletAddress", "EncryptedSecret", "Account", "Session", "AuditLog", "Price", "AssetNetwork", "Network", "Asset", "User", "RateLimit", "SystemSetting" CASCADE',
  );
  await execAsync("node", ["--import", "tsx", "prisma/seed.ts"], {
    env: {
      ...process.env,
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: password,
      DEV_SEED: "false",
      NODE_ENV: "test",
    },
  });
  assetId = (await db.asset.findUniqueOrThrow({ where: { symbol: "USDT" } }))
    .id;
  server = spawn("node", [".output/server/index.mjs"], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      NODE_ENV: "test",
      NITRO_PORT: "3198",
      NITRO_HOST: "127.0.0.1",
    },
  });
  let serverErrors = "";
  server.stderr?.on("data", (chunk) => (serverErrors += chunk.toString()));
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(origin + "/login");
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const login = await api("/api/auth/login", "POST", {
    username: "admin",
    password,
    admin: true,
  });
  if (login.status !== 200)
    throw Error(
      `Server login failed ${JSON.stringify(login.data)} ${serverErrors}`,
    );
  adminCookie = login.cookie;
}, 120000);
afterAll(async () => {
  server?.kill();
  await db?.$disconnect();
  await socket?.stop();
  await pg?.close();
});
describe.sequential(
  "Nitro end-to-end financial and authorization invariants",
  () => {
    it("exposes no public registration API", async () => {
      for (const path of [
        "/api/register",
        "/api/signup",
        "/api/auth/register",
        "/api/create-account",
      ])
        expect(
          (await api(path, "POST", { username: "mallory", password })).status,
        ).toBe(404);
      expect(await db.user.count()).toBe(1);
    });
    it("provisions users only through the administrator, hashes credentials and creates zero accounts", async () => {
      for (const username of ["alice", "bob"]) {
        const result = await api(
          "/api/admin/users",
          "POST",
          { username, password, status: "ACTIVE" },
          adminCookie,
        );
        expect(result.status).toBe(200);
        expect(result.data).not.toHaveProperty("passwordHash");
      }
      const alice = await db.user.findUniqueOrThrow({
          where: { username: "alice" },
        }),
        bob = await db.user.findUniqueOrThrow({ where: { username: "bob" } });
      aliceId = alice.id;
      bobId = bob.id;
      expect(alice.passwordHash).toContain("$argon2id$");
      expect(await argon2.verify(alice.passwordHash, password)).toBe(true);
      expect(await db.account.count({ where: { userId: aliceId } })).toBe(5);
      expect(await balance(aliceId)).toBe("0");
      aliceCookie = (
        await api("/api/auth/login", "POST", { username: "alice", password })
      ).cookie;
      bobCookie = (
        await api("/api/auth/login", "POST", { username: "bob", password })
      ).cookie;
      expect(
        await db.auditLog.count({ where: { action: "USER_CREATED" } }),
      ).toBe(2);
    });
    it("rejects normal users on every administrator API", async () => {
      for (const path of [
        "/api/admin/users",
        "/api/admin/catalog",
        "/api/admin/balances",
        "/api/admin/overview",
        "/api/admin/transactions",
        "/api/admin/audit",
        "/api/admin/settings",
        "/api/admin/prices",
        `/api/admin/users/${bobId}`,
      ])
        expect((await api(path, "GET", undefined, aliceCookie)).status).toBe(
          403,
        );
      expect(
        (
          await api(
            "/api/admin/users",
            "POST",
            { username: "mallory", password },
            aliceCookie,
          )
        ).status,
      ).toBe(403);
      expect(
        (await api("/api/admin/adjustments", "POST", {}, aliceCookie)).status,
      ).toBe(403);
      expect(
        (await api("/api/admin/wallets", "PUT", {}, aliceCookie)).status,
      ).toBe(403);
      expect(
        (await api("/api/admin/networks", "POST", {}, aliceCookie)).status,
      ).toBe(403);
      expect(
        (await api(`/api/admin/assets/${assetId}`, "PATCH", {}, aliceCookie))
          .status,
      ).toBe(403);
    });
    it("requires same-origin mutations", async () => {
      const response = await fetch(origin + "/api/admin/users", {
        method: "POST",
        headers: {
          origin: "https://attacker.example",
          "content-type": "application/json",
          cookie: adminCookie,
        },
        body: JSON.stringify({ username: "mallory", password }),
      });
      expect(response.status).toBe(403);
    });
    it("credits through balanced ledger entries and audited adjustments", async () => {
      expect((await adjust("100")).status).toBe(200);
      expect(await balance(aliceId)).toBe("100");
      const tx = await db.transaction.findFirstOrThrow({
        where: { type: "ADMIN_ADJUSTMENT" },
        include: { entries: true },
      });
      expect(tx.entries).toHaveLength(2);
      expect(tx.entries.reduce((s, e) => s + Number(e.amount), 0)).toBe(0);
      expect(
        await db.auditLog.count({ where: { action: "BALANCE_ADJUSTED" } }),
      ).toBe(1);
    });
    it("rejects negative balance debits atomically", async () => {
      const before = await db.transaction.count();
      expect((await adjust("101", "DEBIT")).data.statusMessage).toBe(
        "INSUFFICIENT_BALANCE",
      );
      expect(await balance(aliceId)).toBe("100");
      expect(await db.transaction.count()).toBe(before);
    });
    it("transfers atomically to the recipient and records both sides", async () => {
      const result = await transfer("25");
      expect(result.status).toBe(200);
      reference = String(result.data.reference);
      expect(reference).toMatch(/^0x[0-9a-f]{64}$/);
      expect(await balance(aliceId)).toBe("75");
      expect(await balance(bobId)).toBe("25");
      const tx = await db.transaction.findUniqueOrThrow({
        where: { reference },
        include: { entries: true },
      });
      expect(tx.entries).toHaveLength(2);
      expect(tx.type).toBe("INTERNAL");
    });
    it("shows transaction history and details to both participants", async () => {
      for (const cookie of [aliceCookie, bobCookie]) {
        expect(
          (await api("/api/transactions", "GET", undefined, cookie)).status,
        ).toBe(200);
        expect(
          (
            await api(
              `/api/transactions/${reference}`,
              "GET",
              undefined,
              cookie,
            )
          ).data.reference,
        ).toBe(reference);
      }
    });
    it("rejects insufficient balance and self-transfers without side effects", async () => {
      expect((await transfer("76")).data.statusMessage).toBe(
        "INSUFFICIENT_BALANCE",
      );
      expect(
        (await transfer("1", randomUUID(), "alice")).data.statusMessage,
      ).toBe("INVALID_RECIPIENT");
      expect(await balance(aliceId)).toBe("75");
      expect(await balance(bobId)).toBe("25");
    });
    it("replays an identical idempotent transfer only once and rejects key reuse", async () => {
      const key = randomUUID(),
        first = await transfer("5", key),
        second = await transfer("5", key);
      expect(first.status).toBe(200);
      expect(second.data.reference).toBe(first.data.reference);
      expect(await balance(aliceId)).toBe("70");
      expect(await balance(bobId)).toBe("30");
      expect((await transfer("6", key)).status).toBe(409);
    });
    it("prevents overspending under simultaneous requests", async () => {
      const results = await Promise.all([transfer("50"), transfer("50")]);
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(await balance(aliceId)).toBe("20");
      expect(await balance(bobId)).toBe("80");
    });
    it("rejects invalid amount precision", async () => {
      expect((await transfer("0.0000001")).data.statusMessage).toBe(
        "INVALID_AMOUNT",
      );
      expect((await transfer("0")).data.statusMessage).toBe("INVALID_AMOUNT");
    });
    it("suspends a recipient, revokes sessions and prevents login and receipt", async () => {
      expect(
        (
          await api(
            `/api/admin/users/${bobId}`,
            "PATCH",
            { status: "DISABLED" },
            adminCookie,
          )
        ).status,
      ).toBe(200);
      expect((await transfer("1")).data.statusMessage).toBe("USER_DISABLED");
      expect(
        (await api("/api/auth/login", "POST", { username: "bob", password }))
          .status,
      ).toBe(401);
      expect(
        (await api("/api/auth/me", "GET", undefined, bobCookie)).status,
      ).toBe(401);
      await api(
        `/api/admin/users/${bobId}`,
        "PATCH",
        { status: "ACTIVE" },
        adminCookie,
      );
    });
    it("stores configurable fees as a third balanced ledger leg", async () => {
      await api("/api/admin/settings", "PUT", { feeBps: 100 }, adminCookie);
      const result = await transfer("10");
      expect(result.status).toBe(200);
      expect(result.data.fee).toBe("0.1");
      expect(await balance(aliceId)).toBe("9.9");
      const tx = await db.transaction.findUniqueOrThrow({
        where: { reference: String(result.data.reference) },
        include: { entries: true },
      });
      expect(tx.entries).toHaveLength(3);
      expect(
        tx.entries.reduce((sum, e) => sum + Number(e.amount), 0),
      ).toBeCloseTo(0);
    });
    it("audits administrator address assignment and exposes no secrets", async () => {
      const network = await db.network.findUniqueOrThrow({
        where: { slug: "tron" },
      });
      expect(
        (
          await api(
            "/api/admin/wallets",
            "PUT",
            {
              userId: aliceId,
              assetId,
              networkId: network.id,
              address: "virtual-admin-managed-alice-address",
            },
            adminCookie,
          )
        ).status,
      ).toBe(200);
      const result = await api("/api/wallet", "GET", undefined, aliceCookie);
      expect(result.status).toBe(200);
      expect(JSON.stringify(result.data)).not.toContain("passwordHash");
      expect(JSON.stringify(result.data)).not.toContain("secretId");
      expect(
        await db.auditLog.count({
          where: { action: "WALLET_ADDRESS_CHANGED" },
        }),
      ).toBe(1);
    });
    it("database rejects raw balance updates and immutable ledger edits", async () => {
      await expect(
        db.account.update({
          where: { userId_assetId: { userId: aliceId, assetId } },
          data: { balance: "1000" },
        }),
      ).rejects.toThrow();
      await db.$disconnect();
      const entry = await db.ledgerEntry.findFirstOrThrow();
      await expect(
        db.ledgerEntry.update({
          where: { id: entry.id },
          data: { amount: "1" },
        }),
      ).rejects.toThrow();
      await db.$disconnect();
      expect(await balance(aliceId)).toBe("9.9");
    });
    it("reconciles every cached balance against the immutable ledger", async () => {
      const accounts = await db.account.findMany({
        include: { entries: true },
      });
      for (const a of accounts) {
        const sum = a.entries.reduce(
          (value, e) => value.add(e.amount),
          new (await import("@prisma/client")).Prisma.Decimal(0),
        );
        expect(a.balance.equals(sum)).toBe(true);
      }
    });
    it("forces password change after administrative reset", async () => {
      const replacement = randomBytes(20).toString("base64url");
      await api(
        `/api/admin/users/${aliceId}`,
        "PATCH",
        { password: replacement, mustResetPassword: true },
        adminCookie,
      );
      expect(
        (await api("/api/auth/me", "GET", undefined, aliceCookie)).status,
      ).toBe(401);
      const login = await api("/api/auth/login", "POST", {
        username: "alice",
        password: replacement,
      });
      expect(login.status).toBe(200);
      expect(login.data.mustResetPassword).toBe(true);
      expect(
        (await api("/api/wallet", "GET", undefined, login.cookie)).data
          .statusMessage,
      ).toBe("PASSWORD_RESET_REQUIRED");
      expect(
        (
          await api(
            "/api/auth/password",
            "POST",
            { currentPassword: replacement, password },
            login.cookie,
          )
        ).status,
      ).toBe(200);
      expect(
        (await api("/api/auth/me", "GET", undefined, login.cookie)).status,
      ).toBe(401);
    });
  },
);
