# Passport UI

Next.js front end for the Solana Passport registry (proof-of-personhood). Admin, enroll, verify and
explorer tabs, using a Phantom wallet on devnet.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
```

Optional env (`.env.local`):

| Variable | Default | Use |
|---|---|---|
| `NEXT_PUBLIC_RPC_URL` | public devnet | set a dedicated RPC (Helius/QuickNode); the public one rate-limits |
| `NEXT_PUBLIC_PROGRAM_ID` | `6yH5Ew...` | registry program (also update `src/idl/*.json` if you redeploy under a new id) |
| `NEXT_PUBLIC_MOCK_CONSUMER_ID` | `7ZBun5...` | demo dApp / demo pass issuer |

## Flow

1. **Admin** tab: initialize the registry, then register a verifier **and the Civic network it may
   issue** (presets for the Civic gateway and the demo issuer). The network is part of the config
   address, so trusting a network is an explicit admin act.
2. **Enroll** tab: use a demo pass (written by the demo issuer in Civic's exact layout) or your real
   Civic Pass. The registry checks owner, network, active state, expiry and that the pass is yours.
3. **Verify** tab: the demo dApp calls `verify_personhood` by CPI. Repeating it fails (nullifier).

## Architecture

- `src/lib/passportClient.ts`: all chain logic (enroll, verify, register, tree rebuild, error text),
  free of React so it can run in Node.
- `src/hooks/usePassport.ts`: thin React wrapper around it.
- `src/lib/merkle.ts`, `src/lib/pdas.ts`: sparse Merkle tree and PDA helpers matching the program.
- The tree is rebuilt from the byte prefix common to every account layout version, so enrollments
  written by older program versions still count.

## End-to-end check without a browser

```bash
RPC_URL=http://127.0.0.1:8899 ADMIN_KEYPAIR=~/.config/solana/id.json npm run e2e
```

Runs the same module the UI uses: register verifier, enroll, verify, replay blocked, duplicate enroll,
wrong wallet, missing Civic pass, unregistered network. `ADMIN_KEYPAIR` must be the registry admin.

## Honest limits

Pseudonymous, not anonymous: no zero-knowledge proofs yet. The wallet-to-commitment link is on-chain.
