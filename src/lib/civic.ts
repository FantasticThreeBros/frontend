import { PublicKey } from "@solana/web3.js";

export interface CivicToken { owner: PublicKey; network: PublicKey; state: number; expireTime: number | null }

/**
 * Parse a Civic gateway token (borsh, mirrors programs/contract/src/credential.rs). Option fields are
 * variable length and the account is zero-padded, so read field by field. Returns null if it doesn't parse.
 */
export function parseCivicToken(data: Uint8Array): CivicToken | null {
  try {
    const b = Buffer.from(data);
    let o = 1;                                  // version
    if (b[o++] === 1) o += 32;                  // parent_gateway_token (deprecated)
    const owner = new PublicKey(b.subarray(o, o + 32)); o += 32;
    if (b[o++] === 1) o += 32;                  // owner_identity (deprecated)
    const network = new PublicKey(b.subarray(o, o + 32)); o += 32;
    o += 32;                                    // issuing gatekeeper
    const state = b[o++];
    let expireTime: number | null = null;
    if (b[o++] === 1) expireTime = Number(b.readBigInt64LE(o));
    return { owner, network, state, expireTime };
  } catch { return null; }
}

export type PassState = "none" | "valid" | "expired" | "revoked" | "frozen" | "other-wallet" | "wrong-network" | "unreadable";

export function passState(token: CivicToken | null, exists: boolean, wallet: PublicKey, network: PublicKey, now = Date.now() / 1000): PassState {
  if (!exists) return "none";
  if (!token) return "unreadable";
  if (!token.owner.equals(wallet)) return "other-wallet";
  if (!token.network.equals(network)) return "wrong-network";
  if (token.state === 1) return "frozen";
  if (token.state === 2) return "revoked";
  if (token.expireTime !== null && now > token.expireTime) return "expired";
  return "valid";
}
