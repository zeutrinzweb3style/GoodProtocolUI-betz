# Vercel environment variables — GoodProtocolUI (gooddapp.org UI)

Everything below is read at **build time** and baked into the bundle, so after a
change you must **redeploy**, not just restart.

Why the Vercel dashboard and not a `.env` file: `vite.config.ts` inlines the real
`process.env` object (`define: { 'process.env': process.env }`), while
`loadEnv(mode, cwd)` filters `.env` files by the default `VITE_` prefix. A
committed `.env.production` with `REACT_APP_*` keys would therefore be ignored.

---

## 1. Required

| Key                 | Value             | Notes                                                                                                                                                                                             |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REACT_APP_NETWORK` | `production-celo` | Defaults to `fuse` in code, which points at the wrong network/contracts. `production-celo` is what gooddapp.org ships.                                                                            |
| `REOWN_PROJECT_ID`  | _your own_        | WalletConnect / AppKit. No guard in code, but without it WalletConnect login cannot start (injected wallets still work). Get one free at <https://cloud.reown.com> → Create Project → Project ID. |

## 2. Recommended (public values, sane fallbacks exist)

| Key                               | Value                        |
| --------------------------------- | ---------------------------- |
| `REACT_APP_CELO_RPC`              | `https://forno.celo.org`     |
| `REACT_APP_FUSE_RPC`              | `https://rpc.fuse.io`        |
| `REACT_APP_XDC_RPC`               | `https://rpc.xinfin.network` |
| `REACT_APP_ENABLE_SERVICE_WORKER` | `1`                          |
| `REACT_APP_ENABLE_HTTPS_REDIRECT` | `1`                          |

Each RPC accepts a comma separated list for failover, e.g.
`https://forno.celo.org,https://rpc.ankr.com/celo`.

## 3. Optional — leave blank unless you have your own

| Key                                                 | Effect when blank                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `REACT_APP_MAINNET_RPC`                             | Falls back to a public Infura endpoint baked into the bundle                          |
| `REACT_APP_GRAPH_KEY`                               | Subgraph reads (portfolio, news, some claim data) may not load                        |
| `REACT_APP_POSTHOG_KEY` / `REACT_APP_POSTHOG_PROXY` | No analytics. Do **not** reuse someone else's key: events would land in their project |
| `REACT_APP_GOOGLE_ANALYTICS_ID`                     | No GA. A blank value only produces a Vite warning, never a failed build               |
| `REACT_APP_INDICATIVE_KEY`                          | Analytics enrichment off                                                              |
| `REACT_APP_ONRAMPER_KEY`                            | "Buy G$" on-ramp widget has no key                                                    |
| `REACT_APP_ETHERSCAN_KEY`                           | No Etherscan lookups                                                                  |
| `REACT_APP_DATASTUDIO_DASHBOARD_URL`                | Dashboard embed hidden                                                                |
| `REACT_APP_FEEDCONTEXT_PROD`                        | Feed context uses its default                                                         |
| `REACT_APP_CELO_PHASE_3`                            | Savings sections on Stake/Portfolio stay hidden                                       |
| `REACT_APP_UBIPOOL_ADDRESSES`                       | Pool figures on the claim page use the built-in list                                  |
| `REACT_APP_RPC_FALLBACK_CHAIN_IDS`                  | No extra RPC fallbacks                                                                |
| `REACT_APP_EXCLUDED_RPCS`                           | Nothing excluded                                                                      |
| `REACT_APP_GOODID_*_EXPLORER`                       | Default explorer links                                                                |

`REACT_APP_UBIPOOL_ADDRESSES` is a JSON string of public contract addresses:

```bash
REACT_APP_UBIPOOL_ADDRESSES='{"ALT":"0xa6d77aa130e729886c90a48e0ee539d6c6795df7","NG":"0xDd1c12f197E6D1E2FBA15487AaAE500eF6e07BCA","CO":"0x0d43131f1577310D6349bAF9D6Da4fC1Cd39764C"}'
```

## 4. Support chat (after the on-chain widget is merged)

| Key                                   | Value                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `REACT_APP_SUPPORT_CHAT_CONTRACT`     | contract address printed by `scripts/deploy-support-chat.js` — **blank hides the widget** |
| `REACT_APP_SUPPORT_CHAT_DEPLOY_BLOCK` | block number printed by the same script (optional, speeds up the first load)              |
| `REACT_APP_SUPPORT_TG_URL`            | `https://t.me/GoodDollarX`                                                                |

---

## Copy-paste block for Vercel (complete)

Every variable the app reads, in one block. Values that work out of the box are
filled in; the rest are blank because blank means "feature off / use the built-in
default".

```
# ---- REQUIRED ------------------------------------------------------------
REACT_APP_NETWORK=production-celo
REOWN_PROJECT_ID=

# ---- RECOMMENDED (public endpoints, sane defaults exist) ------------------
REACT_APP_CELO_RPC=https://forno.celo.org
REACT_APP_FUSE_RPC=https://rpc.fuse.io
REACT_APP_XDC_RPC=https://rpc.xinfin.network
REACT_APP_MAINNET_RPC=https://eth.llamarpc.com
REACT_APP_ENABLE_SERVICE_WORKER=1
REACT_APP_ENABLE_HTTPS_REDIRECT=1

# ---- OPTIONAL (blank = default / off) ------------------------------------
REACT_APP_RPC_FALLBACK_CHAIN_IDS=1,122,42220,50
REACT_APP_EXCLUDED_RPCS=
REACT_APP_CELO_PHASE_3=
REACT_APP_UBIPOOL_ADDRESSES=
REACT_APP_GOODID_CELO_EXPLORER=
REACT_APP_GOODID_FUSE_EXPLORER=
REACT_APP_GOODID_XDC_EXPLORER=
REACT_APP_GOODID_MAINNET_EXPLORER=
REACT_APP_GRAPH_KEY=
REACT_APP_POSTHOG_KEY=
REACT_APP_POSTHOG_PROXY=
REACT_APP_GOOGLE_ANALYTICS_ID=
REACT_APP_INDICATIVE_KEY=
REACT_APP_ONRAMPER_KEY=
REACT_APP_ETHERSCAN_KEY=
REACT_APP_DATASTUDIO_DASHBOARD_URL=
REACT_APP_FEEDCONTEXT_PROD=

# ---- ON-CHAIN SUPPORT CHAT (blank contract = widget hidden) --------------
REACT_APP_SUPPORT_CHAT_CONTRACT=
REACT_APP_SUPPORT_CHAT_DEPLOY_BLOCK=
REACT_APP_SUPPORT_TG_URL=https://t.me/GoodDollarX
```

Notes on the optional ones:

-   `REACT_APP_RPC_FALLBACK_CHAIN_IDS` defaults to all four supported chains
    (`1,122,42220,50`); the fallback list is fetched from `chainlist.org` with
    built-in per-chain defaults.
-   `REACT_APP_UBIPOOL_ADDRESSES` blank makes the claim wizard use the pool
    addresses it ships with. Only set it to override them (JSON string).
-   `REACT_APP_GOODID_CELO_EXPLORER` blank builds a Celo Etherscan URL that
    **needs `REACT_APP_ETHERSCAN_KEY`**. Set both, or set the explorer URL
    yourself (`https://api.celoscan.io/api?`).
-   `REACT_APP_ETHERSCAN_KEY` is only used for that explorer URL.
-   `REACT_APP_POSTHOG_KEY` / `REACT_APP_GOOGLE_ANALYTICS_ID` / `REACT_APP_INDICATIVE_KEY`
    are analytics. Use your **own** project: reusing another deployment's key
    sends your visitors' events into their account.
-   `REACT_APP_CELO_PHASE_3` shows the Savings sections on Stake/Portfolio.
-   `REACT_APP_DATASTUDIO_DASHBOARD_URL` is the dashboard embed; blank hides it.
-   `REACT_APP_FEEDCONTEXT_PROD` is the news-feed context; blank uses the default.
-   `REACT_APP_EXCLUDED_RPCS` is a comma separated deny-list of RPC URLs.

## Project settings

| Setting          | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| Framework preset | Vite                                                      |
| Build command    | `yarn build` (already in `vercel.json`)                   |
| Output directory | `dist`                                                    |
| Install command  | `yarn install` (yarn 3.6.1 is pinned in `.yarn/releases`) |
| Node.js version  | 26.x (Vercel discontinued 20.x)                           |

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

## Build memory (why `yarn build` OOMs on Vercel)

This app compiles ~14,700 modules and needs **about 7 GB of RSS** to build. That
is why the original `NODE_OPTIONS=--max-old-space-size=8096` was fatal on
Vercel: the Basic machine has 2 vCPU and **8 GB total**, so letting V8 grow to
8 GB means the container kills the process first (exit 129, "Out of Memory"
detected in the build report) — usually while "rendering chunks".

Measured here against the real dependency tree:

| heap cap | result                                   |
| -------- | ---------------------------------------- |
| 6144 MB  | V8 heap OOM (peak 6.9 GB RSS)            |
| 7168 MB  | **succeeds**, peak 6.9-7.2 GB RSS, 2m22s |
| 8192 MB  | succeeds, peak 6.8 GB RSS                |

`package.json` therefore builds with `--max-old-space-size=7168` and pins
`engines.node` to `26.x`. Vercel discontinued Node 20, so anything lower fails
before the install step with `Node.js Version "20.x" is discontinued`. Measured on
Node 26.13.1 (the version Vercel runs): peak 6.9 GB RSS.
node-gyp native steps for `bigint-buffer` and `dtrace-provider`).
`vite.config.ts` additionally sets `reportCompressedSize: false` and
`rollupOptions.maxParallelFileOps: 2`.

7.2 GB of an 8 GB machine is tight. If a Vercel build is still killed:

1. Deploy a prebuilt output instead of building on Vercel:

    ```bash
    vercel pull --yes --environment=production
    vercel build --prod
    vercel deploy --prebuilt --prod
    ```

2. Or move the project to a Pro plan, where Enhanced/Turbo build machines
   offer more than the 8 GB of the Basic machine that Hobby is limited to.

Do not raise the heap cap back to 8096 on a Basic machine — it makes the crash
look like a random container kill instead of a clear V8 heap error.

## How to deploy: GitHub Actions builds, Vercel only serves

Vercel's Hobby build machine is **2 vCPU / 8 GB** and cannot be upgraded. This
app's build peaks at ~7 GB, and the container is killed during "rendering
chunks" every time — with the heap cap raised the kill comes from the container,
with the cap lowered V8 itself runs out. There is no cap that satisfies both.

A **public** repository gets a **4 vCPU / 16 GB** GitHub-hosted runner for free,
so the bundle is built there and only the prebuilt output is uploaded:

`.github/workflows/deploy-vercel.yml` runs on every push to `master`:

```bash
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

`vercel.json` therefore sets `git.deploymentEnabled: false`, so Vercel stops
attempting (and failing) its own build on every push.

### One-time setup (three repository secrets)

1. Create a token at https://vercel.com/account/tokens -> **`VERCEL_TOKEN`**
2. Run `vercel link` once in the repository, then read `.vercel/project.json`:
    - `projectId` -> **`VERCEL_PROJECT_ID`**
    - `orgId` -> **`VERCEL_ORG_ID`**
3. Add all three under **Settings -> Secrets and variables -> Actions**.

Environment variables are **not** duplicated in GitHub: `vercel pull` downloads
them from the Vercel project, so the dashboard stays the single source of truth.

### Manual fallback from your own machine

```bash
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

If you later move to a Pro plan with an Enhanced/Turbo build machine, delete the
workflow and set `git.deploymentEnabled` back to `true` to let Vercel build again.
