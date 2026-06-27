# ⛓️ TetherStream

<div align="center">

[![CI](https://github.com/paradox2341/tether-stream/actions/workflows/ci.yml/badge.svg)](https://github.com/paradox2341/tether-stream/actions/workflows/ci.yml)
[![Stellar Testnet](https://img.shields.io/badge/Stellar-Testnet-00F5D4?logo=stellar&logoColor=white)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-SDK%20v25-7B61FF?logo=rust&logoColor=white)](https://soroban.stellar.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-0A0E17?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-00C896.svg)](LICENSE)

**Real-time capital streaming on Stellar — powered by Soroban smart contracts with live inter-contract calls.**

🌐 **Live Demo:** **[tether-stream.quake-hamlet-radar.workers.dev](https://tether-stream.quake-hamlet-radar.workers.dev/)** _(Stellar Testnet · Cloudflare Workers)_

🎥 **Demo Video (1–2 min):** _To be added._ &nbsp;·&nbsp; A short screen recording of the live capital ticker is included at [`screenshots/demo.gif`](./screenshots/demo.gif).

</div>

---

## 📋 Table of Contents

- [Project Description](#-project-description)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Smart Contracts (Testnet)](#-smart-contracts-testnet)
- [Inter-Contract Calls](#-inter-contract-calls)
- [Wallet Connection (Connect & Disconnect)](#-wallet-connection-connect--disconnect)
- [Balance & Streaming Mechanics](#-balance--streaming-mechanics)
- [Error Handling](#-error-handling)
- [Screenshots](#-screenshots)
- [Setup Instructions](#-setup-instructions)
- [Testing](#-testing)
- [Commit History](#-commit-history)
- [License](#-license)

---

## 📖 Project Description

**TetherStream** is a production-grade Stellar Soroban dApp implementing real-time linear capital vesting. An originator locks custom `TTH` (Tether Token) into a smart contract channel. The capital unlocks continuously and linearly to the beneficiary over the channel duration. The beneficiary can claim at any time; the originator can terminate early.

**Key features:**
- 🔒 **Secure custody** — TTH locked in the channel contract until vested
- 📈 **Live capital ticker** — a smooth 100ms real-time counter shows unlocked capital per second
- 💸 **Anytime release** — beneficiaries claim any vested capital at any point
- ❌ **Early termination** — originators terminate channels; vested portion → beneficiary, unvested → originator
- ⛓️ **On-chain inter-contract calls** — token transfers executed as real Soroban-to-Soroban invocations

The centrepiece technical feature is the **on-chain inter-contract call** from the `channel` contract to the `tether-token` contract that moves TTH securely and verifiably on-chain during both channel allocation and capital release.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        User Browser                           │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │         Next.js 14 Frontend (TypeScript)              │  │
│   │                                                      │  │
│   │  NodeIdentifier │ ChannelInitiator │ ChannelPanel    │  │
│   │       ChannelBoard │ EventLedger                     │  │
│   └──────────┬───────────────────────┬────────────────────┘  │
│              │  Wallet Signing        │  Soroban RPC          │
│              ▼                        ▼                       │
│   ┌──────────────────┐    ┌──────────────────────────────┐   │
│   │  Freighter /     │    │  core/chain-adapter/         │   │
│   │  StellarWallets  │    │  stellar.ts                  │   │
│   │  Kit v2.4        │    │  TransactionBuilder + RPC    │   │
│   └──────────────────┘    └────────────┬─────────────────┘   │
└────────────────────────────────────────┼───────────────────┘
                                         │ HTTPS / RPC
                                         ▼
                              ┌─────────────────────┐
                              │   Stellar Testnet   │
                              │   (Soroban RPC)     │
                              └──────────┬──────────┘
                                         │
                           ┌─────────────┴──────────────┐
                           │                            │
                           ▼                            ▼
              ┌────────────────────────┐   ┌────────────────────────────┐
              │   Channel Contract     │   │   TetherToken Contract     │
              │   (channel)            │   │   (tether-token)           │
              │                        │   │                            │
              │  allocate_asset_stream │   │  transfer(from, to, amt)   │
              │    ──────────────────► │   │  balance(address)          │
              │  release_matured_      │──►│  mint(to, amount)          │
              │    capital             │   │  [authority only]          │
              │  terminate_active_     │   │                            │
              │    channel             │   │  Token: TTH                │
              │  compute_unlocked_     │   │  Decimals: 7               │
              │    capital             │   └────────────────────────────┘
              │  fetch_channel_state   │
              │  enumerate_channels_  │
              │    by_party            │
              └────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Smart Contracts** | Rust + Soroban SDK | v25 |
| **Frontend Core** | Next.js (App Router) + TypeScript | 14.x / 5.x |
| **Output Pipeline** | Static export (`output: 'export'`) | — |
| **Wallet Connector** | `@creit.tech/stellar-wallets-kit` | ^2.4.0 |
| **Styling Base** | Tailwind CSS + custom cyberpunk design tokens | ^3.4.1 |
| **Deployment Anchor** | Cloudflare Workers Static Assets (`wrangler.toml`) | — |
| **Continuous Integration** | GitHub Actions | — |

---

## 📜 Smart Contracts (Testnet)

Both contracts are deployed and live on **Stellar Testnet**:

| Contract | Address | Explorer |
|----------|---------|---------|
| `channel` (ChannelContract) | `CDXN6TY6PAG2WKZ4PVIEZXGYYPCS2HIFOXPUMVA6SGJKCX7OXK56J5XY` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDXN6TY6PAG2WKZ4PVIEZXGYYPCS2HIFOXPUMVA6SGJKCX7OXK56J5XY) |
| `tether-token` (TetherTokenContract) | `CCB2B3SNRQQ2PIU5HT6W4B4V5HYW6KAUNDESCKGNHSPFSQHIC3NT2E7L` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CCB2B3SNRQQ2PIU5HT6W4B4V5HYW6KAUNDESCKGNHSPFSQHIC3NT2E7L) |

**Deployment transactions** (Stellar Testnet, verifiable on Horizon/Stellar Expert):

| Action | Transaction Hash |
|--------|------------------|
| `tether-token` deploy | [`4b0a3a15592354d91188fcdcbb7a61ea0d5f66fe0f2988581e44ab28fd2e20cf`](https://stellar.expert/explorer/testnet/tx/4b0a3a15592354d91188fcdcbb7a61ea0d5f66fe0f2988581e44ab28fd2e20cf) |
| `channel` deploy | [`6d38251dcf197eb6ae2439ace2d63163e074a22193a9c66f06749860b3ce8b91`](https://stellar.expert/explorer/testnet/tx/6d38251dcf197eb6ae2439ace2d63163e074a22193a9c66f06749860b3ce8b91) |
| `initialize` (set TTH authority) | [`c905ed60513c8a28f609fdcf6f2de237d371c98418ee0eba69f85544a1a9b906`](https://stellar.expert/explorer/testnet/tx/c905ed60513c8a28f609fdcf6f2de237d371c98418ee0eba69f85544a1a9b906) |
| `mint` 5000 TTH | [`60d2c3e93995bf994c2704f96e3fe1a4c54526116423a393a6dbcd103ada9856`](https://stellar.expert/explorer/testnet/tx/60d2c3e93995bf994c2704f96e3fe1a4c54526116423a393a6dbcd103ada9856) |

> **Token authority (admin):** `GCIL2B2WUPOSGOOK7422RF63NBNHKTLQR2VRDJJ7OENHFBTKTJTLEK2H`

---

## ⛓️ Inter-Contract Calls

TetherStream implements **genuine Soroban-to-Soroban inter-contract invocations** — not simulated transfers.

### Mechanism

The `ChannelContract` uses `soroban_sdk::token::Client` to invoke the `TetherTokenContract` directly on-chain:

```rust
// In contracts/channel/src/lib.rs

// ── Inter-Contract Call: allocate_asset_stream ───────────────────────────────
// Triggered when: originator opens a new capital channel
// Calls: TetherTokenContract::transfer(originator → channel_contract, locked_capital)
let token_client = soroban_sdk::token::Client::new(&env, &token);
token_client.transfer(&originator, &env.current_contract_address(), &locked_capital);

// ── Inter-Contract Call: release_matured_capital ─────────────────────────────
// Triggered when: beneficiary claims vested capital
// Calls: TetherTokenContract::transfer(channel_contract → beneficiary, claimable)
let token_client = soroban_sdk::token::Client::new(&env, &channel.token);
token_client.transfer(&env.current_contract_address(), &channel.beneficiary, &claimable);

// ── Inter-Contract Call: terminate_active_channel ────────────────────────────
// Triggered when: originator terminates a channel early
// Calls: TetherTokenContract::transfer(channel_contract → beneficiary, vested_portion)
//        TetherTokenContract::transfer(channel_contract → originator, unvested_remainder)
```

### Target Function Signatures

```rust
// TetherTokenContract (tether-token)
pub fn transfer(env: Env, from: Address, to: Address, amount: i128)
pub fn balance(env: Env, id: Address) -> i128
pub fn mint(env: Env, recipient: Address, amount: i128)
```

### Modular Workflows That Trigger Cross-Contract Communication

| Channel Contract Method | Inter-Contract Target | Trigger Condition |
|---|---|---|
| `allocate_asset_stream` | `transfer(originator → channel)` | Every new channel creation |
| `release_matured_capital` | `transfer(channel → beneficiary)` | Every capital claim |
| `terminate_active_channel` | `transfer(channel → beneficiary)` + `transfer(channel → originator)` | Early termination |

### On-Chain Proof of Inter-Contract Calls

Both inter-contract directions were executed for real on Stellar Testnet. Each transaction below contains **two contract events in a single transaction** — the `tether-token` `transfer` event (the cross-contract invocation) and the `channel` contract's own lifecycle event — which is the on-chain signature of a genuine Soroban-to-Soroban call:

| Inter-Contract Call | Direction | Amount (raw, 7-dp) | Transaction Hash |
|---|---|---|---|
| `allocate_asset_stream` → `tether-token.transfer` | originator → channel | `10000000000` (1000 TTH) | [`a4467782f9080062e913687b55e3b93e8b696253e4c7ca3a097379392a7fcf14`](https://stellar.expert/explorer/testnet/tx/a4467782f9080062e913687b55e3b93e8b696253e4c7ca3a097379392a7fcf14) |
| `release_matured_capital` → `tether-token.transfer` | channel → beneficiary | `1833333333` (≈183.33 TTH vested) | [`6447ec5dec32044489ef48d200aeef7c30105f656e9478d0ecdaf19b6e6bc122`](https://stellar.expert/explorer/testnet/tx/6447ec5dec32044489ef48d200aeef7c30105f656e9478d0ecdaf19b6e6bc122) |

Open either transaction on Stellar Expert and inspect the **Events** tab: you will see the `transfer` event emitted by the `tether-token` contract (`CCB2B3SN…`) nested inside the call to the `channel` contract (`CDXN6TY6…`).

Events are emitted via the typed `#[contractevent]` macro (`ChannelAllocated`, `CapitalReleased`, `ChannelTerminated`, `Transfer`, `TthMinted`), so downstream indexers and the frontend can subscribe to them.

---

## 🔗 Wallet Connection (Connect & Disconnect)

TetherStream uses `@creit.tech/stellar-wallets-kit` v2.4+ to support a multi-wallet selection panel:

- **Connect**: Click **"Connect Node"** → StellarWalletsKit auth modal opens → select Freighter or any supported wallet → address loaded and TTH balance fetched
- **Disconnect**: Click **"Eject"** → wallet session cleared, UI resets to landing state
- **Balance**: Live TTH balance displayed in the header, refreshable manually or auto-synced every 8 seconds

---

## 💰 Balance & Streaming Mechanics

### Vesting Calculus (Linear)

$$\text{unlocked\_capital} = \text{locked\_capital} \times \frac{\min(\text{elapsed\_time}, \text{channel\_duration})}{\text{channel\_duration}}$$

- Implemented in `compute_unlocked_capital()` in the channel contract
- Client-side ticker runs at **100ms** precision using `setInterval` in `ChannelPanel.tsx`
- `claimable = unlocked_capital - capital_released` is displayed live

### Lifecycle States

| State | Description |
|---|---|
| **Active** | `elapsed < channel_duration`, capital unlocking |
| **Fully Vested** | `elapsed >= channel_duration`, full capital claimable |
| **Settled** | `capital_released >= locked_capital`, channel complete |
| **Terminated** | Originator ended early; split settled on-chain |

---

## ⚠️ Error Handling

TetherStream implements **three distinct, named error boundary classes**:

| Error Class | Trigger Condition | User Message |
|---|---|---|
| **Wallet Not Found** | Freighter extension missing or not installed | `"Freighter extension not detected. Install Freighter from freighter.app…"` |
| **Signature Rejected** | User cancels/declines the signing modal | `"Transaction signature rejected. No on-chain state was modified."` |
| **Insufficient Balance** | TTH balance too low for the requested operation | `"Insufficient TTH balance. Use the faucet to acquire testnet TTH."` |

All errors surface as colour-coded protocol notices (error/warning/info/success) with a dismiss control.

---

## 📸 Screenshots

### 💻 Desktop Homepage (Connected Node State)
![TetherStream Connected Homepage](./screenshots/home%20page.png)

### 📲 Mobile View (Responsive Layout)
![TetherStream Mobile Responsive Interface](./screenshots/mobile%20view.png)

### 🎬 Core Streaming Flow Demo (Real-Time Capital Ticker)
![TetherStream App Core Demo](./screenshots/demo.gif)

---

## 🚀 Setup Instructions

### Prerequisites

- Rust + `wasm32v1-none` target
- Node.js 20+
- Stellar CLI (`stellar`)
- Freighter wallet browser extension

### 1. Install the Rust WASM Target

Soroban with Rust 1.84+ uses the `wasm32v1-none` target (older `wasm32-unknown-unknown` is unsupported by the Soroban environment on recent toolchains):

```bash
rustup target add wasm32v1-none
```

### 2. Clone & Install Frontend Dependencies

```bash
git clone https://github.com/paradox2341/tether-stream
cd tether-stream/frontend
npm ci   # uses the committed package-lock.json
```

### 3. Build Smart Contracts

```bash
cd tether-stream
stellar contract build          # outputs to target/wasm32v1-none/release/*.wasm
```

### 4. Deploy Contracts to Testnet

```bash
# Fund a deployer account on testnet
stellar keys generate deployer --network testnet --fund

# Deploy TetherToken contract
stellar contract deploy \
  --wasm target/wasm32v1-none/release/tether_token.wasm \
  --source deployer \
  --network testnet

# Initialise TetherToken with the mint authority (must run before any mint)
stellar contract invoke \
  --id <TETHER_TOKEN_ADDRESS> \
  --source deployer \
  --network testnet \
  -- initialize --authority <DEPLOYER_PUBLIC_KEY>

# Deploy Channel contract
stellar contract deploy \
  --wasm target/wasm32v1-none/release/channel.wasm \
  --source deployer \
  --network testnet
```

### 5. Configure Environment

```bash
cd frontend
cp .env .env.local
# Edit .env.local:
# NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS=<TETHER_TOKEN_ADDRESS>
# NEXT_PUBLIC_STREAM_CONTRACT_ADDRESS=<CHANNEL_CONTRACT_ADDRESS>
# NEXT_PUBLIC_DEPLOYER_SECRET=<DEPLOYER_SECRET_KEY>
```

### 6. Run Development Server

```bash
cd frontend
npm run dev
# → http://localhost:3000
```

### 7. Deploy to Cloudflare Workers

```bash
cd tether-stream
npx wrangler deploy
```

---

## 🧪 Testing

### Run All Contract Tests

```bash
cargo test --verbose
```

### Run Individual Contract Tests

```bash
cargo test -p channel --verbose
cargo test -p tether-token --verbose
```

### Real Test Run Output

Captured from an actual `cargo test` run on this repo (16 tests, all passing):

```
   Running unittests src/lib.rs (deps/channel-…)
running 11 tests
test test::test_allocate_asset_stream_rejects_zero_duration - should panic ... ok
test test::test_allocate_asset_stream_rejects_zero_capital - should panic ... ok
test test::test_allocate_asset_stream_locks_capital ... ok
test test::test_self_channel_listed_once_for_same_party ... ok
test test::test_compute_unlocked_capital_linear_vesting ... ok
test test::test_terminate_active_channel_splits_capital_correctly ... ok
test test::test_release_matured_capital_transfers_correct_amount ... ok
test test::test_partial_release_tracks_cumulative_capital_correctly ... ok
test test::test_terminate_after_partial_release_settles_remainder ... ok
test test::test_release_matured_capital_requires_beneficiary_auth ... ok
test test::test_enumerate_channels_by_party_returns_correct_ids ... ok
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out

   Running unittests src/lib.rs (deps/tether_token-…)
running 5 tests
test test::test_tth_token_metadata_is_correct ... ok
test test::test_mint_panics_on_zero_amount - should panic ... ok
test test::test_transfer_panics_on_insufficient_balance - should panic ... ok
test test::test_authority_can_mint_tth ... ok
test test::test_transfer_moves_tth_between_holdings ... ok
test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

### Test Coverage (16 total assertions)

**Channel Contract (11 tests):**
| Test | Assertion |
|------|-----------|
| `test_allocate_asset_stream_locks_capital` | Capital locked, balances correct, state stored |
| `test_compute_unlocked_capital_linear_vesting` | 0%, 50%, 100%, past-100% calculations |
| `test_release_matured_capital_transfers_correct_amount` | Two-step claim to 100% |
| `test_release_matured_capital_requires_beneficiary_auth` | Auth enforced on beneficiary |
| `test_allocate_asset_stream_rejects_zero_capital` | Panics on 0 deposit |
| `test_allocate_asset_stream_rejects_zero_duration` | Panics on 0 duration |
| `test_terminate_active_channel_splits_capital_correctly` | 50/50 split at 50% vested |
| `test_enumerate_channels_by_party_returns_correct_ids` | Correct IDs for all three parties |
| `test_partial_release_tracks_cumulative_capital_correctly` | Incremental claims tracked |
| `test_terminate_after_partial_release_settles_remainder` | Post-claim termination correct |
| `test_self_channel_listed_once_for_same_party` | Deduplication on self-channel |

**TetherToken Contract (5 tests):**
| Test | Assertion |
|------|-----------|
| `test_tth_token_metadata_is_correct` | Name="Tether Token", Symbol="TTH", Decimals=7 |
| `test_authority_can_mint_tth` | Mint increases balance |
| `test_transfer_moves_tth_between_holdings` | Correct debit/credit |
| `test_transfer_panics_on_insufficient_balance` | Panics with correct message |
| `test_mint_panics_on_zero_amount` | Panics on 0 mint |

### Frontend Tests

The frontend's vesting math (`src/core/vesting.ts`) — the logic that drives the
live capital ticker and must agree with the on-chain `compute_unlocked_capital` —
is covered by a [Vitest](https://vitest.dev) suite (`src/core/vesting.test.ts`):

```bash
cd frontend
npm test          # vitest run — 12 tests
```

```
 ✓ src/core/vesting.test.ts (12 tests)

 Test Files  1 passed (1)
      Tests  12 passed (12)
```

These assert linear unlocking at 0% / 50% / 100% / past-duration, claimable =
unlocked − released (never negative), and divide-by-zero safety — matching the
contract's behaviour exactly. Both the contract tests and the frontend tests run
on every push via the CI pipeline.

---

## 📝 Commit History

The project was built incrementally in small, well-labelled commits (well above the
10-commit minimum). The work breaks down into these phases — see the full
[`git log`](https://github.com/paradox2341/tether-stream/commits/main) for the
complete history:

- **Scaffold** — Cargo workspace, Next.js app, project layout
- **Contracts** — `channel` (custody, linear vesting, inter-contract transfers) and
  `tether-token` (TTH) with their unit-test suites
- **Chain adapter** — `stellar.ts`: wallet connect/sign, contract reads/writes,
  source-account authorization for inter-contract calls
- **UI** — design system, header, channel form, live capital ticker, channel board,
  event ledger, error/loading states
- **CI/CD** — GitHub Actions pipeline (contracts + frontend)
- **Testnet & docs** — real deployment, on-chain evidence, and this README

---

## 📄 License

MIT © TetherStream Contributors
