# Passport UI

Next.js front end for the Solana Passport registry (proof-of-personhood). Admin, enroll, verify and
explorer tabs, using a Phantom wallet on devnet.

## Demo Video

- **Video Walkthrough & Presentation:** [https://youtu.be/6Q3gaBr8Qc4](https://youtu.be/6Q3gaBr8Qc4)

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

## Flow (what a user sees)

**Get verified** tab, four steps, with automatic status detection:
1. Connect your wallet.
2. Get a pass: a **demo pass** (instant, for trying the app) or **your Civic Pass**. If you have no Civic Pass the
   page walks you through getting one (link to Civic, your wallet address to copy, "check again", auto-checks every 8 s).
3. Join the registry (one pass, one spot).
4. Try it in a demo app, then try again to see the replay get blocked.

**Admin** tab: **Quick setup** (one click: creates the registry if needed and trusts Civic + the demo pass on the devnet
test network and the Uniqueness network), registry freeze, freeze one identity, advanced issuer management.
**Explorer** tab: public on-chain data.

> On devnet the app trusts Civic's **devnet test network** (`tgnuXX...`). The Uniqueness network is mainnet-only, so a
> devnet wallet can never hold that pass.

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

Runs the same module the UI uses (23 checks): quick setup, status detection, enroll, verify, replay blocked, duplicate
enroll, wrong wallet, missing Civic pass, unregistered network, Civic pass parsing against real devnet accounts.
`ADMIN_KEYPAIR` must be the registry admin (or the registry must not exist yet).

## Browser test (real UI, mock wallet)

Drives the actual pages in headless Chromium with an injected Phantom-compatible wallet that signs in Node.

```bash
npm i --no-save playwright tweetnacl
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899 npm run dev -- -p 3200      # in one terminal; local validator running
APP_URL=http://localhost:3200 node scripts/ui-e2e.js                   # admin Quick setup, then a user: join, verify, replay blocked
```
Screenshots go to `scripts/ui-shots/`.

## Honest limits

Pseudonymous, not anonymous: no zero-knowledge proofs yet. The wallet-to-commitment link is on-chain.
