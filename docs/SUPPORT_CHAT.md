# On-chain support chat

Status: implemented on this fork (`GoodProtocolUI-betz`). Ownerless contract,
no backend, no database, no bot token.

## What it does

A member with a connected wallet gets a **Support** launcher in the bottom-right
corner. Opening it shows:

- a permanent invitation to the **free Telegram support group** (`REACT_APP_SUPPORT_TG_URL`),
- the **live cost** of an on-chain message, priced with `eth_estimateGas` × `eth_gasPrice`,
- a warning plus the Telegram fallback when the wallet is low on CELO,
- the recent conversation, read straight from the chain.

Posting signs one Celo transaction from the member's own wallet. Nothing is
stored off-chain: the chain is the record.

The widget renders **only** when a wallet is connected **and**
`REACT_APP_SUPPORT_CHAT_CONTRACT` is a valid address. Blank contract = invisible,
which is also the kill switch.

## Contract

`contracts/SupportChat.sol` (solc 0.8.24, optimizer 200 runs, artifacts
committed so a deploy needs no toolchain).

| | |
| --- | --- |
| API | `post(string)` emits `MessagePosted(uint256 id, address author, string message, uint256 timestamp)` |
| Storage | `mapping(address => uint256) lastPostAt` + `nextId`; messages live in the event only |
| Guards | 15 s per-wallet cooldown, 1000-byte cap (both `constant`) |
| Owner / pause / delete / upgrade | **none** |
| Gas | 254,286 deploy · **52,519** per short message |

At 202.51 gwei one short message costs **0.0106 CELO** (≈ ₱0.04). A
maximum-length message is roughly 0.017 CELO.

No owner is deliberate: it makes the widget's "public and permanent" promise
true and leaves no key to protect. The trade-off is that spam cannot be deleted,
so the panel warns before the first post and points private details at Telegram.

## Wiring

| File | Role |
| --- | --- |
| `src/components/SupportChat/SupportChat.tsx` | UI: launcher, panel, composer, states |
| `src/components/SupportChat/useSupportChat.ts` | reads, cost estimate, chain switch, send |
| `src/components/SupportChat/supportChatUtils.ts` | pure helpers (byte count, cost maths, log decoding) |
| `src/components/SupportChat/supportChatUtils.test.ts` | jest unit tests |
| `src/components/SupportChat/supportChatAbi.json` | ABI used by the app |
| `src/pages/App.tsx` | mounts `<SupportChat />` where the retired hosted chat used to sit |
| `contracts/`, `scripts/` | contract, artifacts, compile + deploy scripts |
| `docs/VERCEL_ENV.md` | environment variables for Vercel |

Signing uses what this repo already ships: `useAppKitProvider('eip155')` for the
EIP-1193 provider plus **ethers 5** (`ethers.providers.Web3Provider`). No new
dependency was added.

Reads (head block, logs, gas price, balance) go through `REACT_APP_CELO_RPC`
(falling back to `https://forno.celo.org`), never through the wallet, so the
wallet is not prompted just to render the panel.

If the wallet is on another chain the send path first calls
`wallet_switchEthereumChain` (adding Celo on `4902`), then sends with an explicit
`gasLimit` (estimate + 40%) and `gasPrice` so no wallet has to look up the fee
itself.

## Deploy

```bash
# 1. compile (only when the contract changes)
node scripts/compile-support-chat.js

# 2. deploy once from a wallet holding a few centavos of CELO
SUPPORT_CHAT_DEPLOY_KEY=0x... node scripts/deploy-support-chat.js

# 3. paste the printed lines into Vercel, then redeploy
REACT_APP_SUPPORT_CHAT_CONTRACT=0x...
REACT_APP_SUPPORT_CHAT_DEPLOY_BLOCK=<block>
REACT_APP_SUPPORT_TG_URL=https://t.me/GoodDollarX
```

Never commit or share `SUPPORT_CHAT_DEPLOY_KEY`; the script only reads it from
the environment.

## Verification performed

- 16 unit assertions on the pure helpers (UTF-8 byte counting incl. astral
  emoji, sanitising, validation, cost maths with exact wei arithmetic, scan
  windowing, event decoding, relative time).
- The compiled bytecode was deployed and driven on an in-memory EVM: `post`
  emits the expected id/author/text/timestamp, the cooldown reverts for the same
  wallet and not for another, empty and over-long messages revert.
- The app's decoder was checked against a **real** ABI-encoded log produced by
  that EVM run, including unicode and a newline.
- `prettier --check` clean and `esbuild` parse clean on every touched file.
- `yarn test` / `yarn lint` were not run here because `node_modules` is not
  installed in the working environment.

## Limitations

1. Messages are public and permanent — there is no delete.
2. Spam cannot be removed; the cooldown and byte cap are the only defences.
3. The panel reads a bounded window of recent blocks (6000 blocks, at most 4
   `eth_getLogs` calls), not an archive. Older messages stay on Celoscan.
4. No replies inside the widget — answers happen in Telegram.
5. A member with 0 CELO cannot post; the panel detects this first and offers
   Telegram.

## Licence note

This repository is GPL-3.0. If a modified build is deployed publicly, the
corresponding source must be made available.
