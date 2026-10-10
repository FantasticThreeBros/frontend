const { newPage, connect, ok, SHOTS, adminKp, conn, fails, chromium } = require("./ui-mock.js");
const { Keypair, SystemProgram, Transaction } = require("@solana/web3.js");
(async () => {
  const browser = await chromium.launch(process.env.CHROME_EXE ? { executablePath: process.env.CHROME_EXE } : {});
  // ---- Admin: Quick setup through the UI
  let page = await newPage(browser, adminKp);
  await connect(page, adminKp);
  ok("admin: connected, tabs visible", await page.getByRole("button", { name: /Admin/ }).isVisible());
  await page.getByRole("button", { name: /^Admin/ }).click();
  await page.screenshot({ path: SHOTS + "/1-admin-before.png" });
  await page.getByRole("button", { name: /Run Quick setup/ }).click();
  await page.waitForSelector("text=Trusted:", { timeout: 60000 }).catch(() => {});
  const trusted = await page.locator("li", { hasText: "Trusted:" }).count();
  ok("admin: Quick setup trusted 4 issuer/network pairs", trusted === 4, `(${trusted})`);
  await page.screenshot({ path: SHOTS + "/2-admin-after.png" });
  await page.context().close();

  // ---- User: guided flow
  const user = Keypair.generate();
  const sig = await conn.requestAirdrop(user.publicKey, 2e9); await conn.confirmTransaction(sig, "confirmed");
  page = await newPage(browser, user);
  await connect(page, user);
  await page.getByText("Prove you're one real person").first().waitFor();
  await page.screenshot({ path: SHOTS + "/3-user-start.png" });
  ok("user: sees demo pass option enabled", await page.getByRole("button", { name: /Use demo pass/ }).isEnabled());
  ok("user: Join is locked before choosing a pass", await page.getByRole("button", { name: /Join the registry/ }).count() === 0);
  // Civic path guidance
  await page.getByRole("button", { name: /I have \/ want a Civic Pass/ }).click();
  ok("user: Civic path explains how to get a pass", await page.getByText("No Civic Pass found for this wallet yet").isVisible());
  ok("user: Civic link present", (await page.locator("a[href*='getpass.civic.com']").count()) === 1);
  await page.screenshot({ path: SHOTS + "/4-user-civic-guide.png" });
  // demo path
  await page.getByRole("button", { name: /Use demo pass/ }).click();
  await page.getByRole("button", { name: /Join the registry/ }).click();
  await page.getByText(/You're in\. Your spot/).waitFor({ timeout: 60000 });
  ok("user: joined the registry", true);
  await page.screenshot({ path: SHOTS + "/5-user-joined.png" });
  await page.getByRole("button", { name: /Verify with the demo app/ }).click();
  await page.getByText(/Verified\. The demo app let you in/).waitFor({ timeout: 60000 });
  ok("user: verified by the demo app", true);
  await page.getByRole("button", { name: /Try again \(should be blocked\)/ }).click();
  await page.getByText(/Blocked as expected/).waitFor({ timeout: 60000 });
  const blocked = await page.getByText(/Blocked as expected/).innerText();
  ok("user: replay blocked with a clear message", /already verified/i.test(blocked), `-> ${blocked.slice(0, 90)}`);
  await page.screenshot({ path: SHOTS + "/6-user-done.png", fullPage: true });
  // explorer
  await page.getByRole("button", { name: /Explorer/ }).click();
  await page.waitForTimeout(1500);
  ok("explorer: shows the enrollment", await page.getByText(/Enrolled Identities \(1\)/).isVisible());
  await page.screenshot({ path: SHOTS + "/7-explorer.png" });
  await browser.close();
  console.log(fails() === 0 ? "\nUI flow: all checks passed" : `\nUI flow: ${fails()} FAILED`);
  process.exit(fails() === 0 ? 0 : 1);
})().catch((e) => { console.error("CRASH", e.message); process.exit(1); });
