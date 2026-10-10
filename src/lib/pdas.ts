import { PublicKey } from "@solana/web3.js";

// Defaults are the devnet deployment; override with NEXT_PUBLIC_* env vars (e.g. for localnet).
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "6yH5EwvxmJbKoVgYPni6NMaLwNChgen23CkF9omvYbDE"
);
export const MOCK_CONSUMER_ID = new PublicKey(
  process.env.NEXT_PUBLIC_MOCK_CONSUMER_ID ?? "7ZBun553WhQd3iruZoxvDPj46uDjY4bsZZGqa2Aw7i68"
);

/** Civic's gateway program: owns every Civic Pass account (same id on devnet and mainnet). */
export const CIVIC_GATEWAY_ID = new PublicKey("gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs");
export { UNIQUENESS_NETWORK } from "./networks";

const find = (seeds: (Buffer | Uint8Array)[], programId = PROGRAM_ID) =>
  PublicKey.findProgramAddressSync(seeds, programId)[0];

export const pdas = {
  registry: () => find([Buffer.from("registry")]),
  /** One config per (verifier program, issuing network) pair. */
  verifierConfig: (verifier: PublicKey, network: PublicKey) =>
    find([Buffer.from("verifier_config"), verifier.toBuffer(), network.toBuffer()]),
  enrollment: (c: Uint8Array) => find([Buffer.from("enrollment"), Buffer.from(c)]),
  nullifier: (consumer: PublicKey, c: Uint8Array) =>
    find([Buffer.from("nullifier"), consumer.toBuffer(), Buffer.from(c)]),
  /** Pass written by the demo issuer (mock_consumer.issue_demo_pass), Civic-layout. */
  demoPass: (wallet: PublicKey, network: PublicKey) =>
    find([Buffer.from("demo_pass"), wallet.toBuffer(), network.toBuffer()], MOCK_CONSUMER_ID),
  /** A real Civic Pass: [wallet, "gateway", 8 zero bytes (no extra seed), network]. */
  civicPass: (wallet: PublicKey, network: PublicKey) =>
    find([wallet.toBuffer(), Buffer.from("gateway"), Buffer.alloc(8), network.toBuffer()], CIVIC_GATEWAY_ID),
};
