// End-to-end check of the UI's chain logic (src/lib/passportClient.ts) without a browser.
//   RPC_URL=http://127.0.0.1:8899 ADMIN_KEYPAIR=~/.config/solana/id.json npm run e2e
// The admin keypair must be the registry admin. Uses the programs' deployed ids (see src/lib/pdas.ts).
import * as fs from "fs";
import * as os from "os";
import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import contractIdl from "../src/idl/contract.json";
import consumerIdl from "../src/idl/mock_consumer.json";
import { pdas, MOCK_CONSUMER_ID, CIVIC_GATEWAY_ID, UNIQUENESS_NETWORK } from "../src/lib/pdas";
import { buildTree, enrollIdentity, verifyPersonhood, registerVerifier, explainError, WalletLike } from "../src/lib/passportClient";

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
  const network = new PublicKey(UNIQUENESS_NETWORK);
  if (!(await connection.getAccountInfo(pdas.registry()))) {
    await (passport.methods as any).initializeRegistry().accountsPartial({ registry: pdas.registry() }).rpc();
    console.log("(initialized a fresh registry)");
  }
  const reg0 = await (passport.account as any).registryConfig.fetch(pdas.registry());
  check("registry exists and admin matches", reg0.admin.equals(admin.publicKey), `(next leaf ${reg0.nextLeafIndex})`);

  // admin: trust the demo issuer + Uniqueness network
  await registerVerifier({ connection, passport, wallet: asWallet(admin), verifier: MOCK_CONSUMER_ID, network, isActive: true });
  await registerVerifier({ connection, passport, wallet: asWallet(admin), verifier: CIVIC_GATEWAY_ID, network, isActive: true });
  check("admin registers the demo issuer and the Civic gateway", true);

  // user A: demo pass -> enroll -> verify -> replay blocked
  const a = await newUser();
  const enrolled = await enrollIdentity({ connection, passport, consumer, wallet: asWallet(a), mode: "demo", network });
  check("user A enrolls with a demo pass", enrolled.commitment.length === 64, `(leaf ${enrolled.leafIndex})`);

  const tree = await buildTree(connection, passport);
  const reg1 = await (passport.account as any).registryConfig.fetch(pdas.registry());
  check("rebuilt tree root equals on-chain root (incl. any legacy leaves)", Buffer.from(reg1.merkleRoot).equals(tree.root()));

  await verifyPersonhood({ connection, passport, consumer, wallet: asWallet(a), commitmentHex: enrolled.commitment });
  check("user A verifies via the dApp (CPI)", true);

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

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("E2E crashed:", e); process.exit(1); });
