// End-to-end check of the UI's chain logic (src/lib/passportClient.ts) without a browser.
//   RPC_URL=http://127.0.0.1:8899 ADMIN_KEYPAIR=~/.config/solana/id.json npm run e2e
// The admin keypair must be the registry admin. Uses the programs' deployed ids (see src/lib/pdas.ts).
import * as fs from "fs";
import * as os from "os";
import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import contractIdl from "../src/idl/contract.json";
import consumerIdl from "../src/idl/mock_consumer.json";
import { pdas, MOCK_CONSUMER_ID } from "../src/lib/pdas";
import { DEFAULT_NETWORK } from "../src/lib/networks";
import { parseCivicToken, passState } from "../src/lib/civic";
import { buildTree, enrollIdentity, verifyPersonhood, quickSetup, loadMyStatus, explainError, WalletLike } from "../src/lib/passportClient";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const adminPath = (process.env.ADMIN_KEYPAIR ?? "~/.config/solana/id.json").replace("~", os.homedir());
const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(adminPath, "utf8"))));

const connection = new Connection(RPC, "confirmed");
const provider = new AnchorProvider(connection, new Wallet(admin), { commitment: "confirmed" });
const passport = new Program(contractIdl as any, provider);
const consumer = new Program(consumerIdl as any, provider);

const asWallet = (kp: Keypair): WalletLike => ({
  publicKey: kp.publicKey,
  signTransaction: async (tx: any) => { tx.partialSign(kp); return tx; },
});

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failures++;
};
async function expectError(name: string, p: Promise<unknown>, needle: string) {
  try { await p; check(name, false, "expected an error"); }
  catch (e: any) { const msg = explainError(e); check(name, msg.toLowerCase().includes(needle.toLowerCase()), `-> "${msg}"`); }
}

async function newUser(): Promise<Keypair> {
  const kp = Keypair.generate();
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: kp.publicKey, lamports: 60_000_000 }));
  await provider.sendAndConfirm(tx, []);
  return kp;
}

(async () => {
  const network = DEFAULT_NETWORK;
  if (!(await connection.getAccountInfo(pdas.registry()))) {
    await (passport.methods as any).initializeRegistry().accountsPartial({ registry: pdas.registry() }).rpc();
    console.log("(initialized a fresh registry)");
  }
  const reg0 = await (passport.account as any).registryConfig.fetch(pdas.registry());
  check("registry exists and admin matches", reg0.admin.equals(admin.publicKey), `(next leaf ${reg0.nextLeafIndex})`);

  // before setup the app should report "demo not trusted" instead of failing mysteriously
  const preUser = await newUser();
  const pre = await loadMyStatus({ connection, passport, wallet: preUser.publicKey, network });
  check("status before setup says demo is not trusted", pre.trust.demo !== "active");

  // admin: one-click setup (also creates the registry if missing)
  const progress: string[] = [];
  const did = await quickSetup({ connection, passport, wallet: asWallet(admin), onProgress: (m) => progress.push(m) });
  check("quick setup trusts Civic + demo issuer on both networks", did.length === 0 || did.length === 4, `(${did.length} new)`);
  const again = await quickSetup({ connection, passport, wallet: asWallet(admin) });
  check("quick setup is idempotent (second run does nothing)", again.length === 0);

  // user A: demo pass -> enroll -> verify -> replay blocked
  const a = await newUser();
  const before = await loadMyStatus({ connection, passport, wallet: a.publicKey, network });
  check("status: ready to enroll (demo trusted, no enrollment yet)", before.registry === "ready" && before.trust.demo === "active" && !before.enrollment && !before.verified && before.civicPass === "none");
  const enrolled = await enrollIdentity({ connection, passport, consumer, wallet: asWallet(a), mode: "demo", network });
  const mid = await loadMyStatus({ connection, passport, wallet: a.publicKey, network });
  check("status after enroll: enrolled, not yet verified", !!mid.enrollment && mid.enrollment.commitment === enrolled.commitment && !mid.verified);
  check("user A enrolls with a demo pass", enrolled.commitment.length === 64, `(leaf ${enrolled.leafIndex})`);

  const tree = await buildTree(connection, passport);
  const reg1 = await (passport.account as any).registryConfig.fetch(pdas.registry());
  check("rebuilt tree root equals on-chain root (incl. any legacy leaves)", Buffer.from(reg1.merkleRoot).equals(tree.root()));

  await verifyPersonhood({ connection, passport, consumer, wallet: asWallet(a), commitmentHex: enrolled.commitment });
  check("user A verifies via the dApp (CPI)", true);
  const after = await loadMyStatus({ connection, passport, wallet: a.publicKey, network });
  check("status after verify: verified", after.verified === true);
  check("admin is detected as admin, user is not", (await loadMyStatus({ connection, passport, wallet: admin.publicKey, network })).isAdmin && !after.isAdmin);

  await expectError("replay is blocked", verifyPersonhood({ connection, passport, consumer, wallet: asWallet(a), commitmentHex: enrolled.commitment }), "replay");
  await expectError("enrolling the same pass again is rejected", enrollIdentity({ connection, passport, consumer, wallet: asWallet(a), mode: "demo", network }), "already enrolled");

  // user B: next leaf, then someone else cannot verify with B's commitment
  const b = await newUser();
  const enrolledB = await enrollIdentity({ connection, passport, consumer, wallet: asWallet(b), mode: "demo", network });
  check("user B enrolls at the next leaf", enrolledB.leafIndex === enrolled.leafIndex + 1);
  await expectError("a different wallet cannot use B's commitment", verifyPersonhood({ connection, passport, consumer, wallet: asWallet(a), commitmentHex: enrolledB.commitment }), "different wallet");

  // negative paths
  const c = await newUser();
  await expectError("real Civic mode without a pass says so", enrollIdentity({ connection, passport, consumer, wallet: asWallet(c), mode: "civic", network }), "No Civic Pass");
  const rogue = Keypair.generate().publicKey;
  await expectError("a network the admin never registered is rejected", enrollIdentity({ connection, passport, consumer, wallet: asWallet(c), mode: "demo", network: rogue }), "does not trust");
  check("...and no pass was issued (no rent wasted)", (await connection.getAccountInfo(pdas.demoPass(c.publicKey, rogue))) === null);

  // Civic parsing against two REAL gateway-token accounts read from devnet
  const hex = (h: string) => Buffer.from(h, "hex");
  const realActive = parseCivicToken(hex("02007d363742cf25d4cbf45c37bd05edc662904cc87e85b562fb0c1eacd3d7d2c7eb000d3d9d16c2282b3163c2dbbc7cff131ad6c2269926c41268dcd76929479c0642df1eaf6ffcf6cdc4de124d748e1e8cee11c46f215d00bd0afa78f8c138376333000101fd206200000000"))!;
  const realRevoked = parseCivicToken(hex("0000540c563db38804a6f652e5caa27162a6a23adfa0009784eacb9a7bf3abf694bb000d4c4d9715faa3d078c5b58dcf0752bebee422ee35342e7be124dd682e05d89d0d390358bcd4886b50e659313a0376d88f937923bac5a7079ed7dca756525284020183fe309800000000"))!;
  check("civic parser: real token decodes (owner, network)", realActive.owner.toBase58() === "9RmuqctYTbegNjXroB3FAsS1Q8ebV2wxLp286H4YuRhC" && realActive.network.toBase58() === "tgnuXXNMDLK8dy7Xm1TdeGyc95MDym4bvAQCwcW21Bf");
  check("pass state: expired real token", passState(realActive, true, realActive.owner, realActive.network) === "expired");
  check("pass state: revoked real token", passState(realRevoked, true, realRevoked.owner, realRevoked.network) === "revoked");
  check("pass state: someone else's token", passState(realActive, true, Keypair.generate().publicKey, realActive.network) === "other-wallet");
  check("pass state: no account", passState(null, false, admin.publicKey, realActive.network) === "none");

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("E2E crashed:", e); process.exit(1); });
