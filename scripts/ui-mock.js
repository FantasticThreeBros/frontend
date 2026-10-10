// Drives the REAL UI in headless Chromium with a mock Phantom that signs in Node.
const { chromium } = require("playwright");
const { Keypair, Connection, SystemProgram, Transaction } = require("@solana/web3.js");
const nacl = require("tweetnacl");
const fs = require("fs"), os = require("os");

// Drives the REAL UI in headless Chromium with a mock Phantom wallet that signs in Node.
// Usage: see README "Browser test".
const URL = process.env.APP_URL || "http://localhost:3200";
const RPC = process.env.RPC_URL || "http://127.0.0.1:8899";
const SHOTS = process.env.SHOTS_DIR || (__dirname + "/ui-shots"); fs.mkdirSync(SHOTS, { recursive: true });
const adminKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync((process.env.ADMIN_KEYPAIR || "~/.config/solana/id.json").replace("~", os.homedir())))));
const conn = new Connection(RPC, "confirmed");

let fails = 0;
const ok = (name, cond, extra = "") => { console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); if (!cond) fails++; };

async function newPage(browser, kp) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message.slice(0, 200)));
  await page.exposeFunction("__signMsg", (b64) => Array.from(nacl.sign.detached(Buffer.from(b64, "base64"), kp.secretKey)));
  await page.addInitScript((addr) => {
    const bytes = (() => { const bs58 = {}; return null; })();
    const listeners = {};
    const pk = { toString: () => addr, toBase58: () => addr, toJSON: () => addr, equals: (o) => o && o.toString() === addr };
    const provider = {
      isPhantom: true, isConnected: false, publicKey: null,
      on: (e, f) => { (listeners[e] = listeners[e] || []).push(f); }, off: () => {}, removeListener: () => {}, removeAllListeners: () => {},
      connect: async () => { provider.isConnected = true; provider.publicKey = window.__PKOBJ(addr); (listeners.connect || []).forEach((f) => f(provider.publicKey)); return { publicKey: provider.publicKey }; },
      disconnect: async () => { provider.isConnected = false; provider.publicKey = null; },
      signTransaction: async (tx) => {
        const msg = tx.serializeMessage();
        const sig = await window.__signMsg(btoa(String.fromCharCode(...new Uint8Array(msg))));
        const i = tx.signatures.findIndex((s) => s.publicKey.toBase58() === addr);
        tx.signatures[i].signature = Uint8Array.from(sig);
        return tx;
      },
      signAllTransactions: async (txs) => Promise.all(txs.map((t) => provider.signTransaction(t))),
      signMessage: async (m) => ({ signature: Uint8Array.from(window.__signBytes ? [] : []) }),
    };
    window.phantom = { solana: provider }; window.solana = provider; window.isPhantomInstalled = true;
    window.__provider = provider;
  }, kp.publicKey.toBase58());
  return page;
}

async function connect(page, kp) {
  await page.goto(URL, { waitUntil: "networkidle" });
  // The adapter calls provider.connect() which needs a PublicKey-like with toBytes: provide from the page's own web3.js via a tiny shim
  await page.evaluate((b58) => {
    const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let n = 0n; for (const c of b58) n = n * 58n + BigInt(A.indexOf(c));
    const out = []; while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
    while (out.length < 32) out.unshift(0);
    const u8 = Uint8Array.from(out);
    window.__PKOBJ = (addr) => ({ toString: () => addr, toBase58: () => addr, toBytes: () => u8, toBuffer: () => u8, toJSON: () => addr, equals: (o) => o && o.toString() === addr });
  }, kp.publicKey.toBase58());
  await page.getByRole("button", { name: /select wallet/i }).first().click();
  await page.getByRole("button", { name: /phantom/i }).first().click();
  const connected = await page.waitForSelector("text=Get verified", { timeout: 8000 }).catch(() => null);
  if (!connected) {
    await page.locator("button.wallet-adapter-button", { hasText: /^\s*Connect\s*$/ }).first().click();
    await page.waitForSelector("text=Get verified", { timeout: 20000 });
  }
}
module.exports = { newPage, connect, ok, SHOTS, adminKp, conn, URL, fails: () => fails, chromium };
