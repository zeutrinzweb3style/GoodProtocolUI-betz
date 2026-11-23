# Vercel environment variables — GoodProtocolUI (gooddapp.org UI)

Everything below is read at **build time** and baked into the bundle, so after a
change you must **redeploy**, not just restart.

Why the Vercel dashboard and not a `.env` file: `vite.config.ts` inlines the real
`process.env` object (`define: { 'process.env': process.env }`), while
`loadEnv(mode, cwd)` filters `.env` files by the default `VITE_` prefix. A
committed `.env.production` with `REACT_APP_*` keys would therefore be ignored.

---

## 1. Required

| Key | Value | Notes |
| --- | --- | --- |
| `REACT_APP_NETWORK` | `production-celo` | Defaults to `fuse` in code, which points at the wrong network/contracts. `production-celo` is what gooddapp.org ships. |
| `REOWN_PROJECT_ID` | *your own* | WalletConnect / AppKit. No guard in code, but without it WalletConnect login cannot start (injected wallets still work). Get one free at <https://cloud.reown.com> → Create Project → Project ID. |

## 2. Recommended (public values, sane fallbacks exist)

| Key | Value |
| --- | --- |
| `REACT_APP_CELO_RPC` | `https://forno.celo.org` |
| `REACT_APP_FUSE_RPC` | `https://rpc.fuse.io` |
| `REACT_APP_XDC_RPC` | `https://rpc.xinfin.network` |
| `REACT_APP_ENABLE_SERVICE_WORKER` | `1` |
| `REACT_APP_ENABLE_HTTPS_REDIRECT` | `1` |

Each RPC accepts a comma separated list for failover, e.g.
`https://forno.celo.org,https://rpc.ankr.com/celo`.

## 3. Optional — leave blank unless you have your own

| Key | Effect when blank |
| --- | --- |
| `REACT_APP_MAINNET_RPC` | Falls back to a public Infura endpoint baked into the bundle |
| `REACT_APP_GRAPH_KEY` | Subgraph reads (portfolio, news, some claim data) may not load |
| `REACT_APP_POSTHOG_KEY` / `REACT_APP_POSTHOG_PROXY` | No analytics. Do **not** reuse someone else's key: events would land in their project |
| `REACT_APP_GOOGLE_ANALYTICS_ID` | No GA. A blank value only produces a Vite warning, never a failed build |
| `REACT_APP_INDICATIVE_KEY` | Analytics enrichment off |
| `REACT_APP_ONRAMPER_KEY` | "Buy G$" on-ramp widget has no key |
| `REACT_APP_ETHERSCAN_KEY` | No Etherscan lookups |
| `REACT_APP_DATASTUDIO_DASHBOARD_URL` | Dashboard embed hidden |
| `REACT_APP_FEEDCONTEXT_PROD` | Feed context uses its default |
| `REACT_APP_CELO_PHASE_3` | Savings sections on Stake/Portfolio stay hidden |
| `REACT_APP_UBIPOOL_ADDRESSES` | Pool figures on the claim page use the built-in list |
| `REACT_APP_RPC_FALLBACK_CHAIN_IDS` | No extra RPC fallbacks |
| `REACT_APP_EXCLUDED_RPCS` | Nothing excluded |
| `REACT_APP_GOODID_*_EXPLORER` | Default explorer links |

`REACT_APP_UBIPOOL_ADDRESSES` is a JSON string of public contract addresses:

```bash
REACT_APP_UBIPOOL_ADDRESSES='{"ALT":"0xa6d77aa130e729886c90a48e0ee539d6c6795df7","NG":"0xDd1c12f197E6D1E2FBA15487AaAE500eF6e07BCA","CO":"0x0d43131f1577310D6349bAF9D6Da4fC1Cd39764C"}'
```

## 4. Support chat (after the on-chain widget is merged)

| Key | Value |
| --- | --- |
| `REACT_APP_SUPPORT_CHAT_CONTRACT` | contract address printed by `scripts/deploy-support-chat.js` — **blank hides the widget** |
| `REACT_APP_SUPPORT_CHAT_DEPLOY_BLOCK` | block number printed by the same script (optional, speeds up the first load) |
| `REACT_APP_SUPPORT_TG_URL` | `https://t.me/GoodDollarX` |

---

## Copy-paste block for Vercel

```
REACT_APP_NETWORK=production-celo
REOWN_PROJECT_ID=
REACT_APP_CELO_RPC=https://forno.celo.org
REACT_APP_FUSE_RPC=https://rpc.fuse.io
REACT_APP_XDC_RPC=https://rpc.xinfin.network
REACT_APP_ENABLE_SERVICE_WORKER=1
REACT_APP_ENABLE_HTTPS_REDIRECT=1
REACT_APP_SUPPORT_TG_URL=https://t.me/GoodDollarX
```

## Project settings

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `yarn build` (already in `vercel.json`) |
| Output directory | `dist` |
| Install command | `yarn install` (yarn 3.6.1 is pinned in `.yarn/releases`) |
| Node.js version | 20.x |

**`vercel.json` currently sets `"git": { "deploymentEnabled": false }`** — git
pushes will not deploy until that is changed to `true` (or removed) or you deploy
with `vercel --prod`.

## Local development

`.env` files are not picked up for `process.env`, so export them in the shell:

```bash
cp .env.example .env
set -a; source .env; set +a
yarn dev
```
