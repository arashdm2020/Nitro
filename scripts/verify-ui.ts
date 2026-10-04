import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { chromium } from "@playwright/test";
import chromiumBinary from "@sparticuz/chromium";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, appendFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer as createHttpsServer } from "node:https";
import { request as httpRequest } from "node:http";
const execAsync = promisify(execFile),
  password = randomBytes(20).toString("base64url");
const pg = new PGlite();
await pg.waitReady;
for (const migration of readdirSync("prisma/migrations")
  .filter((m) => !m.endsWith(".toml"))
  .sort())
  await pg.exec(
    readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
  );
const socket = new PGLiteSocketServer({
  db: pg,
  host: "127.0.0.1",
  port: 55440,
  maxConnections: 10,
});
await socket.start();
const databaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:55440/postgres?connection_limit=1&pgbouncer=true&statement_cache_size=0";
await execAsync("node", ["--import", "tsx", "prisma/seed.ts"], {
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: password,
    DEV_SEED: "true",
    DEV_USER_PASSWORD: password,
    NODE_ENV: "test",
  },
});
await pg.exec("DEALLOCATE ALL");
const server = spawn("node", [".output/server/index.mjs"], {
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    NODE_ENV: "test",
    NITRO_PORT: "3200",
    NITRO_HOST: "127.0.0.1",
  },
  stdio: "pipe",
});
server.stdout?.on("data", (chunk) => appendFileSync(".qa/server.log", chunk));
server.stderr?.on("data", (chunk) => {
  if (chunk.toString().includes("route_auth_failed"))
    appendFileSync(".qa/server.log", chunk);
});
mkdirSync(".qa", { recursive: true });
await execAsync("openssl", [
  "req",
  "-x509",
  "-newkey",
  "rsa:2048",
  "-keyout",
  ".qa/test-key.pem",
  "-out",
  ".qa/test-cert.pem",
  "-nodes",
  "-days",
  "1",
  "-subj",
  "/CN=localhost",
  "-addext",
  "subjectAltName=IP:127.0.0.1,DNS:localhost",
]);
const proxy = createHttpsServer(
  {
    key: readFileSync(".qa/test-key.pem"),
    cert: readFileSync(".qa/test-cert.pem"),
  },
  (req, res) => {
    const upstream = httpRequest(
      {
        host: "127.0.0.1",
        port: 3200,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, "x-forwarded-proto": "https" },
      },
      (response) => {
        res.writeHead(response.statusCode ?? 500, response.headers);
        response.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  },
);
await new Promise<void>((resolve) => proxy.listen(3199, "127.0.0.1", resolve));
const origin = "https://127.0.0.1:3199";
for (let i = 0; i < 100; i++) {
  try {
    await fetch("http://127.0.0.1:3200/login");
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
const browser = await chromium.launch({
  headless: true,
  executablePath: await chromiumBinary.executablePath(),
  args: chromiumBinary.args.filter(
    (arg) => arg !== "--disable-web-security" && arg !== "--single-process",
  ),
});
mkdirSync(".qa", { recursive: true });
try {
  const admin = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      ignoreHTTPSErrors: true,
    }),
    page = await admin.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/admin/login");
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill(password);
  const loginResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/auth/login"),
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const loginResult = await loginResponse;
  assert.equal(loginResult.status(), 200);
  await page.waitForURL("**/admin/dashboard").catch(async (error) => {
    await page.screenshot({ path: ".qa/login-failure.png" });
    console.log("Browser errors", errors);
    console.log("Current screen", await page.locator("body").innerText());
    throw error;
  });
  await page.getByRole("link", { name: "Create user", exact: true }).click();
  await page.getByLabel(/^Username/).fill("charlie");
  await page.getByLabel("Initial password").fill(password);
  await page.getByLabel("Display name").fill("Charlie Rivera");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/admin\/users\/[a-f0-9-]+$/);
  await page.getByRole("heading", { name: "Charlie Rivera" }).waitFor();
  await page.screenshot({ path: ".qa/user-manager.png", fullPage: true });
  assert.deepEqual(errors, []);
  const asset = await pg.query<{ id: string }>(
    'SELECT "id" FROM "Asset" WHERE "symbol"=$1',
    ["USDT"],
  );
  const adjustmentForm = page.locator("form").filter({
    has: page.getByRole("heading", {
      name: "Balance adjustment",
      exact: true,
    }),
  });
  await adjustmentForm.getByLabel(/^Asset/).selectOption(asset.rows[0]!.id);
  await adjustmentForm.getByLabel("Amount", { exact: true }).fill("2500");
  await adjustmentForm
    .getByLabel("Reason", { exact: true })
    .fill("UI acceptance test allocation");
  await adjustmentForm
    .getByRole("button", { name: "Review adjustment" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm adjustment", exact: true })
    .click();
  await page.getByText("Changes saved.", { exact: true }).waitFor();
  await page.goto(origin + "/admin/dashboard");
  await page.getByRole("heading", { name: "Workspace overview" }).waitFor();
  await page.screenshot({ path: ".qa/admin-1440.png", fullPage: true });
  for (const route of [
    "users",
    "balances",
    "transactions",
    "assets",
    "networks",
    "prices",
    "audit",
    "settings",
  ]) {
    await page.goto(`${origin}/admin/${route}`);
    await page.locator("main h1").first().waitFor();
    assert.equal(new URL(page.url()).pathname, `/admin/${route}`);
    assert.equal(await page.locator("main").count(), 1);
  }
  const bobUser = await pg.query<{ id: string }>(
    'SELECT "id" FROM "User" WHERE "username"=$1',
    ["bob"],
  );
  const assignedNetworks = await pg.query<{ id: string; slug: string }>(
    'SELECT "id", "slug" FROM "Network" WHERE "slug" IN ($1, $2)',
    ["tron", "ethereum"],
  );
  const bobAddress = "TNitroAssignedBobAddress1234567890";
  const bobEvmAddress = "0x" + "ab".repeat(20);
  for (const network of assignedNetworks.rows) {
    const assigned = await page.request.put(origin + "/api/admin/wallets", {
      headers: { origin },
      data: {
        userId: bobUser.rows[0]!.id,
        assetId: asset.rows[0]!.id,
        networkId: network.id,
        address: network.slug === "tron" ? bobAddress : bobEvmAddress,
      },
    });
    assert.equal(assigned.status(), 200);
  }
  const wallet = await browser.newContext({
      viewport: { width: 390, height: 844 },
      ignoreHTTPSErrors: true,
      isMobile: true,
      deviceScaleFactor: 1,
    }),
    userPage = await wallet.newPage();
  userPage.on("pageerror", (e) => errors.push(e.message));
  userPage.on("console", (msg) => {
    if (msg.text().includes("route_auth_failed")) console.log(msg.text());
  });
  await userPage.goto(origin + "/login");
  await userPage.getByLabel("Username", { exact: true }).fill("charlie");
  await userPage.getByLabel("Password", { exact: true }).fill(password);
  await userPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await userPage.waitForURL(origin + "/");
  await userPage.getByText("Your assets", { exact: true }).waitFor();
  for (const width of [375, 390, 430, 768, 1440]) {
    await userPage.setViewportSize({ width, height: 900 });
    await userPage.screenshot({
      path: `.qa/wallet-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await userPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      `Wallet overflows at ${width}px`,
    );
  }
  await userPage.setViewportSize({ width: 390, height: 844 });
  await userPage.getByRole("link", { name: "Send", exact: true }).click();
  await userPage.getByLabel(/^Asset/).selectOption(asset.rows[0]!.id);
  await userPage.getByLabel(/^Recipient address/).fill("unknown-address");
  await userPage.getByLabel(/^Amount/).fill("125.25");
  await userPage.getByRole("button", { name: "Review transfer" }).click();
  await userPage
    .getByRole("alert")
    .filter({ hasText: "Enter a valid wallet address" })
    .waitFor();
  await userPage
    .getByLabel(/^Recipient address/)
    .fill("41" + "00".repeat(20));
  await userPage.getByRole("button", { name: "Review transfer" }).click();
  await userPage.getByText("Awaiting processing", { exact: true }).waitFor();
  await userPage.getByText("External wallet", { exact: true }).waitFor();
  assert.equal(
    await userPage
      .getByRole("button", { name: "Confirm request" })
      .isDisabled(),
    false,
  );
  await userPage.screenshot({
    path: ".qa/pending-request-review-390.png",
    fullPage: true,
  });
  await userPage.getByRole("button", { name: "Confirm request" }).click();
  await userPage
    .getByRole("heading", { name: "Awaiting processing" })
    .waitFor();
  const pendingReference = new URL(userPage.url()).pathname.split("/").pop()!;
  assert.match(pendingReference, /^req_/);
  await userPage.reload();
  await userPage
    .getByRole("heading", { name: "Awaiting processing" })
    .waitFor();
  await userPage
    .getByText("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb", { exact: true })
    .waitFor();
  assert.equal(
    await userPage.getByText("Transfer complete", { exact: true }).count(),
    0,
  );
  assert.equal(await userPage.getByText(/sandbox|\btest\b/i).count(), 0);
  assert.equal(
    await userPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await userPage.screenshot({
    path: ".qa/pending-request-receipt-390.png",
    fullPage: true,
  });
  const pendingRow = await pg.query<{
    status: string;
    completedAt: string | null;
    balance: string;
    reservedBalance: string;
  }>(
    'SELECT t."status", t."completedAt", a."balance", a."reservedBalance" FROM "Transaction" t JOIN "Account" a ON a."userId" = t."senderId" AND a."assetId" = t."assetId" WHERE t."reference" = $1',
    [pendingReference],
  );
  assert.equal(pendingRow.rows[0]!.status, "PENDING");
  assert.equal(pendingRow.rows[0]!.completedAt, null);
  assert.equal(Number(pendingRow.rows[0]!.balance), 2500);
  assert.equal(Number(pendingRow.rows[0]!.reservedBalance), 125.25);
  await page.goto(origin + "/admin/transactions");
  await page.getByLabel("Search transactions").fill(pendingReference);
  await page.getByText("Awaiting processing", { exact: true }).last().waitFor();
  await admin.close();
  const cancellationResponse = userPage.waitForResponse((response) =>
    response.url().endsWith(`/api/transactions/${pendingReference}/cancel`),
  );
  await userPage.getByRole("button", { name: "Cancel request" }).click();
  const cancellationResult = await cancellationResponse;
  assert.equal(
    cancellationResult.status(),
    200,
    await cancellationResult.text(),
  );
  await userPage.getByRole("heading", { name: "Request cancelled" }).waitFor();
  await userPage.goto(origin + "/send?asset=USDT");
  await userPage.getByLabel(/^Recipient address/).fill(bobAddress);
  await userPage.getByLabel(/^Amount/).fill("125.25");
  await userPage.getByRole("button", { name: "Review transfer" }).click();
  await userPage.getByText(bobAddress, { exact: true }).waitFor();
  await userPage.getByText("TRON", { exact: true }).waitFor();
  assert.equal(
    await userPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Transfer review overflows",
  );
  await userPage.screenshot({
    path: ".qa/transfer-review-390.png",
    fullPage: true,
  });
  await userPage.getByRole("button", { name: "Confirm & send" }).click();
  await userPage.getByRole("heading", { name: "Transfer complete" }).waitFor();
  await userPage.screenshot({ path: ".qa/transfer-390.png", fullPage: true });
  for (const route of [
    "/assets",
    "/assets/USDT",
    "/receive",
    "/transactions",
    "/profile",
  ]) {
    await userPage.goto(origin + route);
    await userPage.locator("main h1").first().waitFor();
    assert.equal(new URL(userPage.url()).pathname, route);
    assert.equal(
      await userPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      `${route} overflows`,
    );
  }
  await wallet.close();
  const bob = await browser.newContext({
      viewport: { width: 390, height: 844 },
      ignoreHTTPSErrors: true,
    }),
    bobPage = await bob.newPage();
  await bobPage.goto(origin + "/login");
  await bobPage.getByLabel("Username", { exact: true }).fill("bob");
  await bobPage.getByLabel("Password", { exact: true }).fill(password);
  await bobPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await bobPage.waitForURL(origin + "/");
  await bobPage
    .getByRole("link", { name: /Tether/ })
    .getByText("125.25 USDT")
    .waitFor();
  await bobPage.goto(origin + "/receive?asset=USDT");
  await bobPage.getByText(bobAddress, { exact: true }).waitFor();
  await bobPage.getByText(bobEvmAddress, { exact: true }).waitFor();
  await bobPage.locator(".qr-card img").nth(1).waitFor();
  assert.equal(
    await bobPage.locator("main select").count(),
    1,
    "Receive should only have an asset selector",
  );
  assert.equal(await bobPage.locator(".qr-card img").count(), 2);
  assert.equal(
    await bobPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Receive overflows",
  );
  await bobPage.screenshot({
    path: ".qa/receive-networks-390.png",
    fullPage: true,
  });
  const btc = await pg.query<{ id: string }>(
    'SELECT "id" FROM "Asset" WHERE "symbol"=$1',
    ["BTC"],
  );
  await bobPage.getByLabel(/^Asset/).selectOption(btc.rows[0]!.id);
  await bobPage.getByText("No address assigned", { exact: true }).waitFor();
  assert.equal(await bobPage.locator(".qr-card img").count(), 0);
  await bobPage.goto(origin + "/transactions");
  await bobPage.screenshot({ path: ".qa/bob-activity.png", fullPage: true });
  await bobPage
    .getByText(/Received from\s*charlie/)
    .waitFor()
    .catch(async (e) => {
      console.log(
        "Recipient activity",
        await bobPage.locator("body").innerText(),
      );
      console.log("Browser errors", errors);
      throw e;
    });
  assert.deepEqual(errors, []);
  console.log(
    "UI verified: pending external request, receipt persistence, reservation, admin visibility, cancellation, internal transfer, automatic receive networks, no browser errors, widths 375/390/430/768/1440.",
  );
} finally {
  await browser.close();
  server.kill();
  proxy.closeAllConnections();
  await new Promise<void>((resolve) => proxy.close(() => resolve()));
  await socket.stop();
  await pg.close();
}
