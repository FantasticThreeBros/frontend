// Chain logic for the UI, kept free of React so it can be exercised from a plain Node script
// (scripts/e2e.ts) against a validator. The React hook is a thin wrapper around this.
import {
  Connection, PublicKey, Transaction, TransactionInstruction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { BN, utils } from "@anchor-lang/core";
import { pdas, MOCK_CONSUMER_ID, PROGRAM_ID, CIVIC_GATEWAY_ID } from "./pdas";
import { SparseTree, commitmentOf } from "./merkle";

export interface WalletLike {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>;
}
type Prog = any; // Anchor Program (typed loosely: IDL json is imported untyped)

const FAR_FUTURE = 4_102_444_800; // year 2100, for demo passes

/** Sign with the wallet, send, and wait for confirmation. Throws if the transaction fails. */
export async function sendTx(connection: Connection, wallet: WalletLike, ixs: TransactionInstruction[]): Promise<string> {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = wallet.publicKey;
  const latest = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  const res = await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  if (res.value.err) throw new Error(`Transaction failed: ${JSON.stringify(res.value.err)}`);
  return sig;
}

/**
 * Rebuild the off-chain tree from on-chain EnrollmentRecords. Reads only the byte prefix every
 * layout version shares ([discriminator 8][commitment 32][leaf_index u32 LE]) so records written
 * by older program versions still count.
 */
export async function buildTree(connection: Connection, passport: Prog): Promise<SparseTree> {
  const disc: number[] = passport.idl.accounts.find((a: any) => a.name.toLowerCase() === "enrollmentrecord").discriminator;
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: utils.bytes.bs58.encode(Buffer.from(disc)) } }],
    dataSlice: { offset: 0, length: 44 },
  });
  const leaves = accounts
    .map((a) => ({ index: Buffer.from(a.account.data).readUInt32LE(40), commitment: Buffer.from(a.account.data).subarray(8, 40) }))
    .sort((x, y) => x.index - y.index);
  const tree = new SparseTree();
  await tree.waitReady();
  for (const l of leaves) {
    if (l.index !== tree.count) throw new Error("Gap in leaf indices; cannot rebuild the tree");
    await tree.appendAsync(Buffer.from(l.commitment));
  }
  return tree;
}

export type PassMode = "demo" | "civic";

/** Which program issues passes in this mode. */
export const verifierFor = (mode: PassMode) => (mode === "civic" ? CIVIC_GATEWAY_ID : MOCK_CONSUMER_ID);

export type VerifierStatus = "active" | "inactive" | "missing";

/** Has the admin registered (and not deactivated) this verifier + network pair? */
export async function fetchVerifierStatus(passport: Prog, mode: PassMode, network: PublicKey): Promise<VerifierStatus> {
  const cfg = await passport.account.verifierConfig.fetchNullable(pdas.verifierConfig(verifierFor(mode), network));
  if (!cfg) return "missing";
  return cfg.isActive ? "active" : "inactive";
}

/**
 * Fetch every account of one type, skipping any that no longer decode. Accounts written by older
 * program versions can have a different size; `program.account.X.all()` throws on those and would
 * take the whole list down with it.
 */
export async function decodeAll(connection: Connection, passport: Prog, idlName: string): Promise<{ publicKey: PublicKey; account: any }[]> {
  const def = passport.idl.accounts.find((a: any) => a.name.toLowerCase() === idlName.toLowerCase());
  const raw = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: utils.bytes.bs58.encode(Buffer.from(def.discriminator)) } }],
  });
  const out: { publicKey: PublicKey; account: any }[] = [];
  for (const r of raw) {
    try { out.push({ publicKey: r.pubkey, account: passport.coder.accounts.decode(def.name, Buffer.from(r.account.data)) }); }
    catch { /* legacy layout: skip */ }
  }
  return out;
}

/** Which program owns the pass, and where it lives, for this wallet and network. */
export function passFor(mode: PassMode, wallet: PublicKey, network: PublicKey) {
  return mode === "civic"
    ? { verifier: CIVIC_GATEWAY_ID, credential: pdas.civicPass(wallet, network) }
    : { verifier: MOCK_CONSUMER_ID, credential: pdas.demoPass(wallet, network) };
}

/** Enroll the connected wallet. `demo` mode first issues a Civic-layout pass via the mock issuer. */
export async function enrollIdentity(opts: {
  connection: Connection; passport: Prog; consumer: Prog; wallet: WalletLike; mode: PassMode; network: PublicKey;
}) {
  const { connection, passport, consumer, wallet, mode, network } = opts;
  const { verifier, credential } = passFor(mode, wallet.publicKey, network);

  // Fail fast, before spending rent on issuing a pass that could never be enrolled.
  const status = await fetchVerifierStatus(passport, mode, network);
  if (status === "missing") {
    throw new Error(`This registry does not trust ${mode === "civic" ? "the Civic gateway" : "the demo issuer"} on network ${network.toBase58()} yet. Ask the registry admin to register it in the Admin tab.`);
  }
  if (status === "inactive") throw new Error("VerifierNotActive");

  const existing = await connection.getAccountInfo(credential);
  if (!existing) {
    if (mode === "civic") {
      throw new Error(`No Civic Pass found for this wallet on network ${network.toBase58()}. Get one from Civic first.`);
    }
    const issueIx = await consumer.methods
      .issueDemoPass(wallet.publicKey, network, 0, new BN(FAR_FUTURE))
      .accountsPartial({ payer: wallet.publicKey, pass: credential })
      .instruction();
    await sendTx(connection, wallet, [issueIx]);
  }

  const commitment = await commitmentOf(credential);
  const tree = await buildTree(connection, passport);
  const leafIndex = tree.count;
  const proof = await tree.proofAsync(leafIndex);

  const enrollIx = await passport.methods
    .enrollIdentity([...commitment], proof)
    .accountsPartial({
      wallet: wallet.publicKey,
      verifierConfig: pdas.verifierConfig(verifier, network),
      credentialAccount: credential,
      registry: pdas.registry(),
      enrollment: pdas.enrollment(commitment),
    })
    .instruction();
  const sig = await sendTx(connection, wallet, [enrollIx]);
  return { sig, credential: credential.toBase58(), commitment: commitment.toString("hex"), leafIndex };
}

/** Ask the demo dApp (mock_consumer) to gate an action behind verify_personhood via CPI. */
export async function verifyPersonhood(opts: {
  connection: Connection; passport: Prog; consumer: Prog; wallet: WalletLike; commitmentHex: string;
}) {
  const { connection, passport, consumer, wallet, commitmentHex } = opts;
  const commitment = Buffer.from(commitmentHex, "hex");
  if (commitment.length !== 32) throw new Error("Commitment must be 64 hex characters");

  const rec = await passport.account.enrollmentRecord.fetch(pdas.enrollment(commitment));
  const tree = await buildTree(connection, passport);
  const proof = await tree.proofAsync(rec.leafIndex);

  const ix = await consumer.methods
    .gatedAction([...commitment], proof)
    .accountsPartial({
      wallet: wallet.publicKey,
      registry: pdas.registry(),
      enrollment: pdas.enrollment(commitment),
      nullifier: pdas.nullifier(MOCK_CONSUMER_ID, commitment),
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      passportProgram: PROGRAM_ID,
    })
    .instruction();
  // The consumer takes `wallet` as an unchecked account, so mark the signer bit by hand.
  const k = ix.keys.find((k: any) => k.pubkey.equals(wallet.publicKey));
  if (k) k.isSigner = true;
  return sendTx(connection, wallet, [ix]);
}

export async function registerVerifier(opts: {
  connection: Connection; passport: Prog; wallet: WalletLike; verifier: PublicKey; network: PublicKey; isActive: boolean;
}) {
  const { connection, passport, wallet, verifier, network, isActive } = opts;
  const ix = await passport.methods
    .registerVerifier(verifier, network, isActive)
    .accountsPartial({
      admin: wallet.publicKey,
      registry: pdas.registry(),
      verifierConfig: pdas.verifierConfig(verifier, network),
    })
    .instruction();
  return sendTx(connection, wallet, [ix]);
}


const ERROR_HINTS: Record<string, string> = {
  AlreadyEnrolled: "This pass is already enrolled (one enrollment per pass).",
  NullifierAlreadyUsed: "This identity has already verified for this app (replay blocked).",
  InvalidCredentialOwner: "That pass is not owned by the trusted verifier program.",
  InvalidCredentialNetwork: "That pass was issued by a network this registry does not trust.",
  CredentialNotActive: "That pass is frozen or revoked.",
  CredentialExpired: "That pass has expired.",
  WalletMismatch: "That pass or enrollment belongs to a different wallet.",
  VerifierNotActive: "This verifier is deactivated.",
  RegistryFrozen: "The registry is frozen by the admin.",
  IdentityFrozen: "This identity is frozen by the admin.",
  InvalidMerkleProof: "Merkle proof is stale (someone enrolled meanwhile). Try again.",
  Unauthorized: "Only the registry admin can do this.",
  AccountNotInitialized: "Not registered yet: the admin must register this verifier and network (Admin tab).",
  "does not trust": "",
};

/** Turn a raw wallet/RPC/Anchor error into a sentence a person can act on. */
export function explainError(e: any): string {
  const text = [e?.message, e?.error?.errorMessage, ...(e?.logs ?? []), ...(e?.transactionLogs ?? [])].join("\n");
  if (text.includes("does not trust")) return e.message; // already a full sentence
  for (const [name, hint] of Object.entries(ERROR_HINTS)) if (hint && text.includes(name)) return hint;
  if (text.includes("signer privilege escalated")) return "The wallet did not sign the transaction.";
  if (text.includes("User rejected")) return "Request cancelled in the wallet.";
  if (text.includes("429")) return "RPC rate limit hit. Wait a moment, or set NEXT_PUBLIC_RPC_URL to a dedicated endpoint.";
  return e?.message ?? "Something went wrong";
}
