import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("6yH5EwvxmJbKoVgYPni6NMaLwNChgen23CkF9omvYbDE");
export const MOCK_CONSUMER_ID = new PublicKey("7ZBun553WhQd3iruZoxvDPj46uDjY4bsZZGqa2Aw7i68");

const find = (seeds: (Buffer | Uint8Array)[], programId = PROGRAM_ID) =>
  PublicKey.findProgramAddressSync(seeds, programId)[0];

export const pdas = {
  registry: () => find([Buffer.from("registry")]),
  verifierConfig: (k: PublicKey) => find([Buffer.from("verifier_config"), k.toBuffer()]),
  enrollment: (c: Uint8Array) => find([Buffer.from("enrollment"), Buffer.from(c)]),
  nullifier: (consumer: PublicKey, c: Uint8Array) =>
    find([Buffer.from("nullifier"), consumer.toBuffer(), Buffer.from(c)]),
};
