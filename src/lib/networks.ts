import { PublicKey } from "@solana/web3.js";

/** Civic's devnet test network (CAPTCHA pass). Passes on it exist on devnet; mainnet networks do not. */
export const DEVNET_TEST_NETWORK = "tgnuXXNMDLK8dy7Xm1TdeGyc95MDym4bvAQCwcW21Bf";
/** Civic Uniqueness Pass network (mainnet; key taken from Civic's repo, confirm in Civic's dashboard). */
export const UNIQUENESS_NETWORK = "uniqobk8oGh4XBLMqM68K8M2zNu3CdYX7q5go7whQiv";

export const NETWORK_PRESETS = [
  { key: DEVNET_TEST_NETWORK, label: "Civic CAPTCHA (devnet test network)", note: "Use this on devnet." },
  { key: UNIQUENESS_NETWORK, label: "Civic Uniqueness Pass (mainnet)", note: "Real one-person-one-pass. Mainnet only." },
];

/** On devnet/localnet we default to the devnet test network; a mainnet RPC defaults to Uniqueness. */
export const DEFAULT_NETWORK = new PublicKey(
  (process.env.NEXT_PUBLIC_RPC_URL ?? "").includes("mainnet") ? UNIQUENESS_NETWORK : DEVNET_TEST_NETWORK
);

/** Where a person gets a Civic Pass. */
export const CIVIC_PASS_URL = "https://getpass.civic.com/";
