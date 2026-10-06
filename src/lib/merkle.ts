// Browser/Node-compatible sparse Merkle tree mirroring programs/contract/src/merkle.rs
// (sha256; empty leaf = 32 zero bytes; append-only). The chain stores only the root.
import { PublicKey } from "@solana/web3.js";

export const TREE_DEPTH = 20; // must match constants::TREE_DEPTH in the program

async function sha256Async(...bufs: Uint8Array[]): Promise<Buffer> {
  const combined = new Uint8Array(bufs.reduce((acc, b) => acc + b.length, 0));
  let offset = 0;
  for (const b of bufs) { combined.set(b, offset); offset += b.length; }
  const digest = await crypto.subtle.digest("SHA-256", combined);
  return Buffer.from(digest);
}

/** commitment = sha256(credential account pubkey), same derivation as the program. */
export async function commitmentOf(credentialPubkey: PublicKey): Promise<Buffer> {
  return sha256Async(credentialPubkey.toBuffer());
}

export class SparseTree {
  private zeros: Buffer[];
  private nodes = new Map<string, Buffer>();
  readonly depth: number;
  count = 0;
  private ready: Promise<void>;

  constructor(depth: number = TREE_DEPTH) {
    this.depth = depth;
    this.zeros = [Buffer.alloc(32)];
    this.ready = this.precompute();
  }

  private async precompute() {
    for (let i = 0; i < this.depth; i++) {
      this.zeros.push(await sha256Async(this.zeros[i], this.zeros[i]));
    }
  }

  async waitReady() { await this.ready; }

  private get(level: number, index: number): Buffer {
    return this.nodes.get(`${level}:${index}`) ?? this.zeros[level];
  }

  root(): Buffer { return this.get(this.depth, 0); }

  async appendAsync(leaf: Buffer): Promise<number> {
    await this.ready;
    const index = this.count++;
    let node = leaf;
    let idx = index;
    this.nodes.set(`0:${idx}`, node);
    for (let level = 0; level < this.depth; level++) {
      const sibling = this.get(level, idx ^ 1);
      node = await (idx & 1 ? sha256Async(sibling, node) : sha256Async(node, sibling));
      idx >>= 1;
      this.nodes.set(`${level + 1}:${idx}`, node);
    }
    return index;
  }

  /** Sibling hashes bottom-up for `index` (also valid for the next free slot). */
  async proofAsync(index: number): Promise<number[][]> {
    await this.ready;
    const out: number[][] = [];
    for (let level = 0; level < this.depth; level++)
      out.push([...this.get(level, (index >> level) ^ 1)]);
    return out;
  }
}
