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
  reference = "",
  bobWalletId = "";
const bobAddress = "TNitroAssignedBobAddress1234567890";
const aliceAddress = "TNitroAssignedAliceAddress12345678";
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
const transfer = (
  amount: string,
  key = randomUUID(),
  recipientAddress = bobAddress,
  recipientWalletId = bobWalletId,
) =>
  api(
    "/api/transfers",
    "POST",
    {
      assetId,
      amount,
      recipientAddress,
      recipientWalletId,
      idempotencyKey: key,
    },
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
    it("assigns addresses through the administrator and resolves their configured network", async () => {
      const network = await db.network.findUniqueOrThrow({
        where: { slug: "tron" },
      });
      for (const [userId, address] of [
        [aliceId, aliceAddress],
        [bobId, bobAddress],
      ]) {
        const result = await api(
          "/api/admin/wallets",
          "PUT",
          { userId, assetId, networkId: network.id, address },
          adminCookie,
        );
        expect(result.status).toBe(200);
      }
      const resolved = await api(
        "/api/transfers/resolve",
        "POST",
        { assetId, recipientAddress: `  ${bobAddress}  ` },
        aliceCookie,
      );
      expect(resolved.status).toBe(200);
      expect(resolved.data.address).toBe(bobAddress);
      expect(resolved.data.network).toEqual({ id: network.id, name: "TRON" });
      expect(resolved.data).not.toHaveProperty("user");
      bobWalletId = String(resolved.data.walletId);
    });
    it("rejects usernames, unknown addresses, wrong assets and changed destination IDs", async () => {
      const before = await db.transaction.count();
      expect(
        (await transfer("1", randomUUID(), "bob")).data.statusMessage,
      ).toBe("INVALID_INPUT");
      expect(
        (await transfer("1", randomUUID(), "unknown-address")).data
          .statusMessage,
      ).toBe("INVALID_RECIPIENT_ADDRESS");
      expect(
        (await transfer("1", randomUUID(), bobAddress.toLowerCase())).data
          .statusMessage,
      ).toBe("INVALID_RECIPIENT_ADDRESS");
      expect(
        (await transfer("1", randomUUID(), bobAddress, randomUUID())).data
          .statusMessage,
      ).toBe("RECIPIENT_CHANGED");
      const btc = await db.asset.findUniqueOrThrow({
        where: { symbol: "BTC" },
      });
      expect(
        (
          await api(
            "/api/transfers/resolve",
            "POST",
            { assetId: btc.id, recipientAddress: bobAddress },
            aliceCookie,
          )
        ).data.statusMessage,
      ).toBe("INVALID_RECIPIENT_ADDRESS");
      expect(await db.transaction.count()).toBe(before);
    });
    it("revalidates disabled addresses and networks before debiting", async () => {
      const wallet = await db.walletAddress.findUniqueOrThrow({
        where: { id: bobWalletId },
      });
      const before = await db.transaction.count();
      try {
        await db.walletAddress.update({
          where: { id: bobWalletId },
          data: { status: "DISABLED" },
        });
        expect((await transfer("1")).data.statusMessage).toBe(
          "ADDRESS_DISABLED",
        );
        const hidden = await api("/api/wallet", "GET", undefined, bobCookie);
        expect(hidden.data.wallets).toEqual([]);
        await db.walletAddress.update({
          where: { id: bobWalletId },
          data: { status: "ACTIVE" },
        });
        await db.network.update({
          where: { id: wallet.networkId },
          data: { enabled: false },
        });
        expect((await transfer("1")).data.statusMessage).toBe(
          "NETWORK_DISABLED",
        );
        expect(
          (await api("/api/wallet", "GET", undefined, bobCookie)).data.wallets,
        ).toEqual([]);
      } finally {
        await db.walletAddress.update({
          where: { id: bobWalletId },
          data: { status: "ACTIVE" },
        });
        await db.network.update({
          where: { id: wallet.networkId },
          data: { enabled: true },
        });
      }
      expect(await db.transaction.count()).toBe(before);
      expect(await balance(aliceId)).toBe("0");
      expect(await balance(bobId)).toBe("0");
    });
    it("rejects ambiguous network mappings and resolves EVM case without changing TRON case", async () => {
      const network = await db.network.findUniqueOrThrow({
        where: { slug: "ethereum" },
      });
      const extra = await db.walletAddress.create({
        data: {
          userId: bobId,
          assetId,
          networkId: network.id,
          address: bobAddress,
        },
      });
      try {
        expect((await transfer("1")).data.statusMessage).toBe(
          "ADDRESS_AMBIGUOUS",
        );
        const evmAddress = "0x" + "aB".repeat(20);
        await db.walletAddress.update({
          where: { id: extra.id },
          data: { address: evmAddress },
        });
        const resolved = await api(
          "/api/transfers/resolve",
          "POST",
          { assetId, recipientAddress: evmAddress.toLowerCase() },
          aliceCookie,
        );
        expect(resolved.status).toBe(200);
        expect(resolved.data.address).toBe(evmAddress);
        expect(resolved.data.network).toEqual({
          id: network.id,
          name: "Ethereum",
        });
        const received = await api("/api/wallet", "GET", undefined, bobCookie);
        expect(
          (received.data.wallets as Array<{ address: string }>).map(
            (w) => w.address,
          ),
        ).toEqual(expect.arrayContaining([bobAddress, evmAddress]));
        await db.assetNetwork.delete({
          where: { assetId_networkId: { assetId, networkId: network.id } },
        });
        expect(
          (
            await api(
              "/api/transfers/resolve",
              "POST",
              { assetId, recipientAddress: evmAddress },
              aliceCookie,
            )
          ).data.statusMessage,
        ).toBe("NETWORK_DISABLED");
        expect(
          (await api("/api/wallet", "GET", undefined, bobCookie)).data.wallets,
        ).toHaveLength(1);
      } finally {
        await db.assetNetwork.upsert({
          where: { assetId_networkId: { assetId, networkId: network.id } },
          create: { assetId, networkId: network.id },
          update: {},
        });
        await db.walletAddress.delete({ where: { id: extra.id } });
      }
    });
    it("accepts external TRON addresses for TRX and USDT and requires available funds", async () => {
      const address = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
      const trx = await db.asset.findUniqueOrThrow({
        where: { symbol: "TRX" },
      });
      const before = await db.transaction.count();
      for (const selectedAsset of [assetId, trx.id]) {
        const result = await api(
          "/api/transfers/resolve",
          "POST",
          { assetId: selectedAsset, recipientAddress: address },
          aliceCookie,
        );
        expect(result.status).toBe(200);
        expect(result.data.kind).toBe("EXTERNAL");
        expect(result.data.canSend).toBe(true);
        expect(result.data.walletId).toBeNull();
        expect(result.data.network).toMatchObject({ name: "TRON" });
        expect(result.data).not.toHaveProperty("reference");
      }
      // Direct callers cannot reserve funds they do not have.
      const rejected = await api(
        "/api/transfers",
        "POST",
        {
          assetId,
          amount: "1",
          recipientAddress: address,
          idempotencyKey: randomUUID(),
        },
        aliceCookie,
      );
      expect(rejected.status).toBe(400);
      expect(rejected.data.statusMessage).toBe("INSUFFICIENT_BALANCE");
      expect(
        (await transfer("1", randomUUID(), address, bobWalletId)).data
          .statusMessage,
      ).toBe("RECIPIENT_CHANGED");
      expect(await db.transaction.count()).toBe(before);
      expect(await balance(aliceId)).toBe("0");
      expect(await balance(bobId)).toBe("0");
      const btc = await db.asset.findUniqueOrThrow({
        where: { symbol: "BTC" },
      });
      expect(
        (
          await api(
            "/api/transfers/resolve",
            "POST",
            { assetId: btc.id, recipientAddress: address },
            aliceCookie,
          )
        ).data.statusMessage,
      ).toBe("ADDRESS_NETWORK_MISMATCH");
    });
    it("recognizes a registered TRON destination when entered in hexadecimal", async () => {
      const address = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
      await db.walletAddress.update({
        where: { id: bobWalletId },
        data: { address },
      });
      try {
        const result = await api(
          "/api/transfers/resolve",
          "POST",
          { assetId, recipientAddress: "41" + "00".repeat(20) },
          aliceCookie,
        );
        expect(result.status).toBe(200);
        expect(result.data.kind).toBe("INTERNAL");
        expect(result.data.canSend).toBe(true);
        expect(result.data.walletId).toBe(bobWalletId);
        expect(result.data.address).toBe(address);
      } finally {
        await db.walletAddress.update({
          where: { id: bobWalletId },
          data: { address: bobAddress },
        });
      }
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
        (await transfer("1", randomUUID(), aliceAddress)).data.statusMessage,
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
      ).toBe(3);
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
    describe.sequential("pending external requests", () => {
      const address = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
      let cookie = "",
        userId = "",
        pendingReference = "";
      const request = (
        amount: string,
        key = randomUUID(),
        extra: object = {},
      ) =>
        api(
          "/api/transfers",
          "POST",
          {
            assetId,
            amount,
            recipientAddress: address,
            idempotencyKey: key,
            ...extra,
          },
          cookie,
        );
      const account = () =>
        db.account.findUniqueOrThrow({
          where: { userId_assetId: { userId, assetId } },
        });
      it("reserves once with a persistent address and network, without a completed transfer", async () => {
        const created = await api(
          "/api/admin/users",
          "POST",
          { username: "request_user", password, status: "ACTIVE" },
          adminCookie,
        );
        expect(created.status).toBe(200);
        userId = (
          await db.user.findUniqueOrThrow({
            where: { username: "request_user" },
          })
        ).id;
        cookie = (
          await api("/api/auth/login", "POST", {
            username: "request_user",
            password,
          })
        ).cookie;
        expect((await adjust("100", "CREDIT", userId)).status).toBe(200);
        const key = randomUUID();
        const first = await request("60", key);
        expect(first.status).toBe(200);
        expect(first.data).toMatchObject({
          type: "BLOCKCHAIN",
          status: "PENDING",
          recipientAddress: address,
          networkName: "TRON",
          completedAt: null,
          recipientId: null,
          fee: "0",
        });
        pendingReference = String(first.data.reference);
        expect(pendingReference).toMatch(/^req_[0-9a-f-]{36}$/);
        expect((await request("60", key)).data.reference).toBe(
          pendingReference,
        );
        expect((await request("61", key)).data.statusMessage).toBe(
          "IDEMPOTENCY_CONFLICT",
        );
        const held = await account();
        expect(held.balance.toString()).toBe("100");
        expect(held.reservedBalance.toString()).toBe("60");
        expect(
          await db.ledgerEntry.count({
            where: { transaction: { reference: pendingReference } },
          }),
        ).toBe(0);
        const wallet = await api("/api/wallet", "GET", undefined, cookie);
        expect(
          (wallet.data.accounts as { assetId: string }[]).find(
            (a) => a.assetId === assetId,
          ),
        ).toMatchObject({
          balance: "40",
          reservedBalance: "60",
          totalBalance: "100",
        });
      });
      it("rejects invalid, incompatible and ambiguous destinations without reserving funds", async () => {
        expect(
          (
            await request("1", randomUUID(), {
              recipientAddress: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwc",
            })
          ).data.statusMessage,
        ).toBe("INVALID_RECIPIENT_ADDRESS");
        expect((await request("0.0000001")).data.statusMessage).toBe(
          "INVALID_AMOUNT",
        );
        const btc = await db.asset.findUniqueOrThrow({
          where: { symbol: "BTC" },
        });
        expect(
          (await request("1", randomUUID(), { assetId: btc.id })).data
            .statusMessage,
        ).toBe("ADDRESS_NETWORK_MISMATCH");
        expect(
          (
            await request("1", randomUUID(), {
              recipientNetworkId: randomUUID(),
            })
          ).data.statusMessage,
        ).toBe("RECIPIENT_CHANGED");
        const extra = await db.network.create({
          data: {
            name: "Alternate TRON",
            slug: "alternate-tron",
            nativeAsset: "TRX",
            networkType: "TRON",
            assets: { create: { assetId } },
          },
        });
        try {
          const preview = await api(
            "/api/transfers/resolve",
            "POST",
            { assetId, recipientAddress: address },
            cookie,
          );
          expect(preview.data.canSend).toBe(false);
          expect((await request("1")).data.statusMessage).toBe(
            "ADDRESS_AMBIGUOUS",
          );
        } finally {
          await db.assetNetwork.delete({
            where: { assetId_networkId: { assetId, networkId: extra.id } },
          });
          await db.network.delete({ where: { id: extra.id } });
        }
        expect((await account()).reservedBalance.toString()).toBe("60");
      });
      it("protects reserved funds from internal transfers and admin debits", async () => {
        expect((await request("41")).data.statusMessage).toBe(
          "INSUFFICIENT_BALANCE",
        );
        const internal = await api(
          "/api/transfers",
          "POST",
          {
            assetId,
            amount: "41",
            recipientAddress: bobAddress,
            recipientWalletId: bobWalletId,
            idempotencyKey: randomUUID(),
          },
          cookie,
        );
        expect(internal.data.statusMessage).toBe("INSUFFICIENT_BALANCE");
        expect((await adjust("41", "DEBIT", userId)).data.statusMessage).toBe(
          "INSUFFICIENT_BALANCE",
        );
        expect((await account()).balance.toString()).toBe("100");
      });
      it("prevents concurrent reservations from overspending", async () => {
        const results = await Promise.all([request("30"), request("30")]);
        expect(results.filter((result) => result.status === 200)).toHaveLength(
          1,
        );
        expect((await account()).reservedBalance.toString()).toBe("90");
      });
      it("shows pending requests only to their owner and administrators", async () => {
        const bobLogin = await api("/api/auth/login", "POST", {
          username: "bob",
          password,
        });
        expect(bobLogin.status).toBe(200);
        bobCookie = bobLogin.cookie;
        expect(
          (
            await api(
              `/api/transactions/${pendingReference}`,
              "GET",
              undefined,
              cookie,
            )
          ).data.status,
        ).toBe("PENDING");
        expect(
          (
            await api(
              `/api/transactions/${pendingReference}`,
              "GET",
              undefined,
              bobCookie,
            )
          ).status,
        ).toBe(404);
        const history = await api(
          "/api/transactions",
          "GET",
          undefined,
          cookie,
        );
        expect(history.data.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              reference: pendingReference,
              status: "PENDING",
            }),
          ]),
        );
        const admin = await api(
          `/api/admin/transactions?type=BLOCKCHAIN&status=PENDING&search=${address}`,
          "GET",
          undefined,
          adminCookie,
        );
        expect(admin.data.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              reference: pendingReference,
              recipientAddress: address,
            }),
          ]),
        );
        expect(
          (
            await api(
              `/api/transactions/${pendingReference}/cancel`,
              "POST",
              {},
              bobCookie,
            )
          ).status,
        ).toBe(404);
        expect((await account()).reservedBalance.toString()).toBe("90");
      });
      it("cancels idempotently and releases funds, including simultaneous cancellation", async () => {
        const cancelled = await Promise.all([
          api(
            `/api/transactions/${pendingReference}/cancel`,
            "POST",
            {},
            cookie,
          ),
          api(
            `/api/transactions/${pendingReference}/cancel`,
            "POST",
            {},
            cookie,
          ),
        ]);
        for (const response of cancelled) {
          expect(response.status).toBe(200);
          expect(response.data.status).toBe("CANCELLED");
          expect(response.data.completedAt).toBeNull();
        }
        expect((await account()).reservedBalance.toString()).toBe("30");
        const remaining = await db.transaction.findFirstOrThrow({
          where: { senderId: userId, status: "PENDING" },
        });
        expect(
          (
            await api(
              `/api/transactions/${remaining.reference}/cancel`,
              "POST",
              {},
              adminCookie,
            )
          ).status,
        ).toBe(200);
        const released = await account();
        expect(released.balance.toString()).toBe("100");
        expect(released.reservedBalance.toString()).toBe("0");
      });
      it("accepts the full available balance, normalizes hex, and enforces database reservations", async () => {
        const created = await request("100", randomUUID(), {
          recipientAddress: "41" + "00".repeat(20),
        });
        expect(created.status).toBe(200);
        expect(created.data.recipientAddress).toBe(address);
        expect((await account()).reservedBalance.toString()).toBe("100");
        await expect(
          db.account.update({
            where: { userId_assetId: { userId, assetId } },
            data: { reservedBalance: "0" },
          }),
        ).rejects.toThrow();
        await db.$disconnect();
        expect((await account()).reservedBalance.toString()).toBe("100");
        expect(
          (
            await api(
              `/api/transactions/${created.data.reference}/cancel`,
              "POST",
              {},
              cookie,
            )
          ).status,
        ).toBe(200);
      });
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
