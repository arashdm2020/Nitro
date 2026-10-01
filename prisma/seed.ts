import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
const db = new PrismaClient();
async function seed() {
  const username = process.env.ADMIN_USERNAME,
    password = process.env.ADMIN_PASSWORD;
  if (
    !username ||
    !/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username) ||
    !password ||
    password.length < 12
  )
    throw new Error(
      "Set ADMIN_USERNAME and ADMIN_PASSWORD (at least 12 characters)",
    );
  const assets = [
    ["BTC", "Bitcoin", 8],
    ["ETH", "Ethereum", 18],
    ["USDT", "Tether", 6],
    ["TRX", "TRON", 6],
    ["BNB", "BNB", 18],
  ] as const;
  for (const [order, [symbol, name, decimals]] of assets.entries()) {
    const asset = await db.asset.upsert({
      where: { symbol },
      create: {
        symbol,
        name,
        decimals,
        icon: `/assets/${symbol.toLowerCase()}.svg`,
        displayOrder: order,
      },
      update: {},
    });
    for (const category of ["treasury", "fees"])
      await db.account.upsert({
        where: { systemKey: `${category}:${symbol}` },
        create: { assetId: asset.id, systemKey: `${category}:${symbol}` },
        update: {},
      });
  }
  const networks = [
    {
      name: "Bitcoin",
      slug: "bitcoin",
      nativeAsset: "BTC",
      networkType: "BITCOIN",
      explorerBaseUrl: "https://mempool.space/tx/",
      symbols: ["BTC"],
    },
    {
      name: "Ethereum",
      slug: "ethereum",
      nativeAsset: "ETH",
      chainId: 1,
      networkType: "EVM",
      explorerBaseUrl: "https://etherscan.io/tx/",
      symbols: ["ETH", "USDT"],
    },
    {
      name: "TRON",
      slug: "tron",
      nativeAsset: "TRX",
      networkType: "TRON",
      explorerBaseUrl: "https://tronscan.org/#/transaction/",
      symbols: ["TRX", "USDT"],
    },
    {
      name: "BNB Smart Chain",
      slug: "bsc",
      nativeAsset: "BNB",
      chainId: 56,
      networkType: "EVM",
      explorerBaseUrl: "https://bscscan.com/tx/",
      symbols: ["BNB", "USDT"],
    },
  ];
  for (const { symbols, ...data } of networks) {
    const network = await db.network.upsert({
      where: { slug: data.slug },
      create: data,
      update: {},
    });
    for (const symbol of symbols) {
      const asset = await db.asset.findUniqueOrThrow({ where: { symbol } });
      await db.assetNetwork.upsert({
        where: {
          assetId_networkId: { assetId: asset.id, networkId: network.id },
        },
        create: { assetId: asset.id, networkId: network.id },
        update: {},
      });
    }
  }
  const admin = await db.user.upsert({
    where: { username },
    create: {
      username,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: "ADMIN",
    },
    update: {},
  });
  if (process.env.DEV_SEED === "true") {
    if (process.env.NODE_ENV === "production")
      throw new Error("Development users are forbidden in production");
    const devPassword = process.env.DEV_USER_PASSWORD;
    if (!devPassword || devPassword.length < 12)
      throw new Error("Set DEV_USER_PASSWORD");
    for (const username of ["alice", "bob"]) {
      const existing = await db.user.findUnique({ where: { username } });
      if (existing) continue;
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username,
            passwordHash: await argon2.hash(devPassword, {
              type: argon2.argon2id,
            }),
            displayName: username === "alice" ? "Alice Morgan" : "Bob Chen",
          },
        });
        const assets = await tx.asset.findMany();
        await tx.account.createMany({
          data: assets.map((asset) => ({ userId: user.id, assetId: asset.id })),
        });
        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            targetType: "User",
            targetId: user.id,
            action: "USER_CREATED",
            metadata: { developmentSeed: true },
          },
        });
      });
    }
  }
  await db.systemSetting.upsert({
    where: { key: "internalFeeBps" },
    create: { key: "internalFeeBps", value: "0" },
    update: {},
  });
  console.log("Nitro assets, networks and administrator initialized");
}
seed().finally(() => db.$disconnect());
