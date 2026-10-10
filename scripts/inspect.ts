import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { Connection, Keypair } from "@solana/web3.js";
import contractIdl from "../src/idl/contract.json";
import { pdas } from "../src/lib/pdas";
(async () => {
  const conn = new Connection(process.env.RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  const p: any = new Program(contractIdl as any, new AnchorProvider(conn, new Wallet(Keypair.generate()), {}));
  const reg = await p.account.registryConfig.fetch(pdas.registry()).catch((e: any) => "ERR " + e.message);
  console.log("registry:", typeof reg === "string" ? reg : { admin: reg.admin.toBase58(), frozen: reg.isFrozen, next: reg.nextLeafIndex });
  const vs = await p.account.verifierConfig.all().catch((e: any) => { console.log("verifier .all ERR", e.message); return []; });
  for (const v of vs) console.log("verifier", v.account.verifierKey.toBase58(), "network", v.account.gatekeeperNetwork.toBase58(), "active", v.account.isActive);
  console.log("verifier configs:", vs.length);
  const en = await p.account.enrollmentRecord.all().catch((e: any) => { console.log("enroll .all ERR", e.message); return []; });
  console.log("new-layout enrollments:", en.length, en.map((e: any) => e.account.leafIndex));
  const nu = await p.account.nullifierRecord.all().catch((e: any) => { console.log("nullifier .all ERR", e.message); return []; });
  console.log("nullifiers:", nu.length);
})().catch((e) => console.error("ERR", e.message));
