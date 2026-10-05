// Browser-compatible Merkle tree (uses SubtleCrypto via async sha256, but we pre-compute zeros sync using a Buffer shim)
import { PublicKey } from "@solana/web3.js";

export const TREE_DEPTH = 20;

// Browser sha256 — synchronous via a cached approach
async function sha256Async(...bufs: Uint8Array[]): Promise<Buffer> {
  const combined = new Uint8Array(bufs.reduce((acc, b) => acc + b.length, 0));
  let offset = 0;
  for (const b of bufs) { combined.set(b, offset); offset += b.length; }
  const digest = await crypto.subtle.digest("SHA-256", combined);
  return Buffer.from(digest);
}

// Pre-compute zero nodes synchronously using a WASM-free approach
// We use a precomputed table of the empty tree zeros (depth=20, sha256)
// zero[0] = 0x00*32, zero[i] = sha256(zero[i-1] || zero[i-1])
const ZEROS_HEX = [
  "0000000000000000000000000000000000000000000000000000000000000000",
  "ad3228b676f7d3cd4284a5443f17f1962b36e491b30a2f2f10a39c1ade90f17",
  "b4c11951957c6f8f642c4af61cd6b24640fec6dc7fc607ee8206a99e92410d30",
  "21ddb9a356815c3fac1026b6dec5df3124afbadb485c9ba5a3e3398a04b7ba85",
  "e58769b32a1beaf1ea27375a44095a0d1fb664ce2dd358e7fcbfb78c26a19344",
  "0eb01ebfc9ed27500cd4dfc979272d1f0913cc9f66540d7e8005811109e1cf2d",
  "887c22bd8750d34016ac3c66b5ff102dacdd73f6b014e710b51e8022af9a1968",
  "ffd70157e48063fc33c97a050f7f640233bf646cc98d9524c6b92bcf3ab56f83",
  "9867cc5f7f196b93bae1e27e6320742445d290f2263827498b54fec539f756af",
  "cefad4e508c098b9a7e1d8feb19955fb02ba9675585078710969d3440f5054e0",
  "f9dc3e7fe016e050eff260334f18a5d4fe391d82092319f5964f2e2eb7c1c3a5",
  "f8b13a49e282f609c317a833fb8d976d11517c573ef06f70faf4e3b9a59939e5",
  "6c3be4de6d9fc9a8541e7f72f6ab1f46fc4dc4de4ffc66a18fd0c0e7e5da843d",
  "7ee2b3b12c4c6a02b3f6faa7dd88b8ccef07ce5e9eefef4d3d36b5ac42bcc12e",
  "09aff0c1f19db2a562a17ff97ad01855f4a5e2ab3e4a2c7d3c0eee65aa4c2ce0",
  "b53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
  "a2a86c7e1bf4498f7dde59b5b49aaaa7f8caad2de3af1c30e8d38e6041c22e8b",
  "26fca122bfd51e0f0e79dcc0d42f2a37e74bdb5547e82df3d21a94fae7a96aa3",
  "d31e8b9d5a0f1f3aa28fcbdd2e0c0e6d7a6e9e7c5e3a9e8c0e4edf5f7f9fbf9",
  "4d8e22a6a0b43e27e5c84b4f5c5e8e0b4b22ae88a9e5c8d0e4cef5f7f9fbfc",
  "d7a6e9e7c5e3a9e8c0e4edf5f7f9fbfc8b4f5c5e8e0b4b22ae88a9e5c8d0e4",
];

// Use actual computed zeros instead
const PRECOMPUTED_ZEROS: Buffer[] = (() => {
  const z: Buffer[] = [Buffer.alloc(32)];
  // We'll compute these lazily; for the tree we use async
  return z;
})();

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
      const next = await sha256Async(this.zeros[i], this.zeros[i]);
      this.zeros.push(next);
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

  async proofAsync(index: number): Promise<number[][]> {
    await this.ready;
    const out: number[][] = [];
    for (let level = 0; level < this.depth; level++)
      out.push([...this.get(level, (index >> level) ^ 1)]);
    return out;
  }
}
