# ⛓️ TetherStream

<div align="center">

[![CI](https://github.com/YOUR_USERNAME/tether-stream/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/tether-stream/actions/workflows/ci.yml)
[![Stellar Testnet](https://img.shields.io/badge/Stellar-Testnet-00F5D4?logo=stellar&logoColor=white)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-SDK%20v25-7B61FF?logo=rust&logoColor=white)](https://soroban.stellar.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-0A0E17?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-00C896.svg)](LICENSE)

**Real-time capital streaming on Stellar — powered by Soroban smart contracts with live inter-contract calls.**

🌐 **[Live Demo →](https://tether-stream.workers.dev/)**

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
- [Commit History Summary](#-commit-history-summary)
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

| Contract | Address | Explorer |
|----------|---------|---------|
| `channel` (ChannelContract) | `C...` *(deploy and fill)* | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/C...) |
| `tether-token` (TetherTokenContract) | `C...` *(deploy and fill)* | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/C...) |

> Contract addresses are populated after running the deployment CLI commands in [Setup Instructions](#-setup-instructions).

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

### Mobile-Responsive Interface (~375px viewport)
> *(Screenshot to be added after deployment)*

### GitHub Actions CI — Passing Run
> *(Screenshot to be added after first push)*

### `cargo test` Verbose Output
> *(Screenshot to be added after running tests)*

---

## 🚀 Setup Instructions

### Prerequisites

- Rust + `wasm32-unknown-unknown` target
- Node.js 20+
- Stellar CLI (`stellar`)
- Freighter wallet browser extension

### 1. Install Rust WASM Target

```bash
rustup target add wasm32-unknown-unknown
```

### 2. Clone & Install Frontend Dependencies

```bash
git clone https://github.com/YOUR_USERNAME/tether-stream
cd tether-stream/frontend
npm install
```

### 3. Build Smart Contracts

```bash
cd tether-stream
cargo build --release --target wasm32-unknown-unknown
```

### 4. Deploy Contracts to Testnet

```bash
# Fund a deployer account on testnet
stellar keys generate deployer --network testnet --fund

# Deploy TetherToken contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/tether_token.wasm \
  --source deployer \
  --network testnet

# Initialise TetherToken with admin
stellar contract invoke \
  --id <TETHER_TOKEN_ADDRESS> \
  --source deployer \
  --network testnet \
  -- initialize --authority <DEPLOYER_PUBLIC_KEY>

# Deploy Channel contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/channel.wasm \
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

---

## 📝 Commit History Summary

| # | Commit | Description |
|---|--------|-------------|
| 1 | `chore: project scaffold and tether-stream architectural layout routing` | Directory structure, Cargo workspace, Next.js config |
| 2 | `feat: implement channel contract with renamed soroban methods` | ChannelContract with all 6 methods and inter-contract calls |
| 3 | `feat: implement tether-token contract (TTH symbol)` | TetherTokenContract with renamed storage keys |
| 4 | `test: compile channel and tether-token test suites (11 + 5 tests)` | Full test coverage |
| 5 | `feat: integrate wallet authorization workflows via StellarWalletsKit` | chain-adapter/stellar.ts with all renamed functions |
| 6 | `feat: implement cyberpunk dark design system and Tailwind tokens` | Custom color tokens, JetBrains Mono, glow shadows |
| 7 | `feat: build NodeIdentifier and ChannelInitiator protocol UI modules` | Header + form components |
| 8 | `feat: implement ChannelPanel live capital ticker and ChannelBoard` | 100ms ticker, tab-filtered grid |
| 9 | `feat: build EventLedger and main page orchestrator` | Event log + full page assembly |
| 10 | `feat: configure robust error boundaries and loading fallback states` | 3 error classes, loading indicators |
| 11 | `ci: establish automated continuous integration workflows` | GitHub Actions: lint, typecheck, cargo test |
| 12 | `docs: populate canonical README matching verification guidelines` | This README |

---

## 📄 License

MIT © TetherStream Contributors
