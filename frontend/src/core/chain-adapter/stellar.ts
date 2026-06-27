/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  rpc,
  Address,
  scValToNative,
  nativeToScVal,
  TransactionBuilder,
  Networks as StellarNetworks,
  Operation,
  Transaction,
  Account,
  Keypair,
} from '@stellar/stellar-sdk';

// ── Network Configuration ────────────────────────────────────────────────────
const networkPassphrase = StellarNetworks.TESTNET;
const rpcUrl =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org:443';

export const tetherTokenAddress =
  process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || '';
export const channelContractAddress =
  process.env.NEXT_PUBLIC_STREAM_CONTRACT_ADDRESS || '';

export const server = new rpc.Server(rpcUrl);

// ── Wallet Kit (lazy-loaded, browser-only) ───────────────────────────────────
let kitBootstrapped = false;
let kitModule: any = null;

async function resolveWalletKit() {
  if (typeof window === 'undefined') return null;
  if (!kitModule) {
    try {
      const kit = await import('@creit.tech/stellar-wallets-kit');
      const utils = await import('@creit.tech/stellar-wallets-kit/modules/utils');
      const types = await import('@creit.tech/stellar-wallets-kit/types');
      kitModule = {
        StellarWalletsKit: kit.StellarWalletsKit,
        defaultModules: utils.defaultModules,
        Networks: types.Networks,
      };
    } catch (err) {
      console.error('[TetherStream] Failed to load stellar-wallets-kit:', err);
    }
  }
  return kitModule;
}

export async function bootstrapWalletKit(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!kitBootstrapped) {
    const mod = await resolveWalletKit();
    if (mod) {
      mod.StellarWalletsKit.init({
        modules: mod.defaultModules(),
        network: mod.Networks.TESTNET,
      });
      kitBootstrapped = true;
    }
  }
}

// ── Wallet Operations ─────────────────────────────────────────────────────────

/** Opens the multi-wallet selection modal and returns the connected address. */
export async function connectNodeIdentity(): Promise<string> {
  await bootstrapWalletKit();
  const mod = await resolveWalletKit();
  if (!mod) throw new Error('Wallet kit unavailable in this environment');
  try {
    const { address } = await mod.StellarWalletsKit.authModal();
    return address;
  } catch (error) {
    console.error('[TetherStream] Wallet connection rejected:', error);
    throw error;
  }
}

/** Returns the currently connected wallet address, or empty string if none. */
export async function resolveConnectedIdentity(): Promise<string> {
  await bootstrapWalletKit();
  const mod = await resolveWalletKit();
  if (!mod) return '';
  try {
    const { address } = await mod.StellarWalletsKit.getAddress();
    return address;
  } catch {
    return '';
  }
}

/** Disconnects the active wallet session. */
export async function disconnectNodeIdentity(): Promise<void> {
  await bootstrapWalletKit();
  const mod = await resolveWalletKit();
  if (!mod) return;
  try {
    await mod.StellarWalletsKit.disconnect();
  } catch (error) {
    console.error('[TetherStream] Disconnect error:', error);
  }
}

// ── Token Operations ──────────────────────────────────────────────────────────

/** Fetches the TTH holding balance for a wallet address (denominated, 7 decimals). */
export async function getTokenBalance(userAddress: string): Promise<number> {
  if (!userAddress || !tetherTokenAddress) return 0;
  try {
    const op = Operation.invokeContractFunction({
      contract: tetherTokenAddress,
      function: 'balance',
      args: [new Address(userAddress).toScVal()],
    });

    const tx = new TransactionBuilder(new Account(userAddress, '0'), {
      networkPassphrase,
      fee: '100',
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
      return Number(scValToNative(sim.result.retval)) / 10_000_000;
    }
    return 0;
  } catch (error) {
    console.error('[TetherStream] Balance fetch error:', error);
    return 0;
  }
}

/** Requests the Freighter extension to register the TTH token. */
export async function registerTTHInWallet(): Promise<void> {
  if (typeof window === 'undefined') return;
  const { addToken, getNetwork } = await import('@stellar/freighter-api');
  const networkDetails = await getNetwork();
  if (networkDetails.network !== 'TESTNET') {
    throw new Error(
      'Freighter is not set to TESTNET. Please switch your Freighter wallet to Testnet first.'
    );
  }
  await addToken({
    contractId: tetherTokenAddress,
    networkPassphrase,
  });
}

/** Mints `amount` TTH to `recipient` via the admin keypair (testnet faucet). */
export async function dispenseTTHFromFaucet(
  recipient: string,
  amount: number
): Promise<string> {
  const adminSecret =
    process.env.NEXT_PUBLIC_DEPLOYER_SECRET ||
    'SACHTEYLV64OD2RPCVQ2VIKKGMFVJ7S5UY45TV23DZKXYPG5CCGYPOP4';
  const adminKeypair = Keypair.fromSecret(adminSecret);
  const adminAddress = adminKeypair.publicKey();

  const op = Operation.invokeContractFunction({
    contract: tetherTokenAddress,
    function: 'mint',
    args: [
      new Address(recipient).toScVal(),
      nativeToScVal(BigInt(Math.floor(amount * 10_000_000)), { type: 'i128' }),
    ],
  });

  const sourceAccount = await server.getAccount(adminAddress);
  let tx = new TransactionBuilder(sourceAccount, {
    networkPassphrase,
    fee: '500',
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  tx = await server.prepareTransaction(tx);
  tx.sign(adminKeypair);

  const submitResult = await server.sendTransaction(tx);
  if (submitResult.status === 'ERROR') {
    throw new Error(
      (submitResult as any).errorResultXdr || 'TTH mint transaction failed'
    );
  }

  return pollTransactionStatus(submitResult.hash);
}

// ── Channel (Stream) DTO ─────────────────────────────────────────────────────

/** Strongly-typed representation of an on-chain capital channel. */
export interface ChannelRecord {
  id: number;
  originator: string;
  beneficiary: string;
  lockedCapital: number;
  epochStart: number;
  channelDuration: number;
  capitalReleased: number;
  token: string;
}

// ── Channel Read Operations ────────────────────────────────────────────────────

/** Returns on-chain state for a specific channel ID. */
export async function fetchChannelRecord(
  channelId: number
): Promise<ChannelRecord | null> {
  if (!channelContractAddress) return null;
  const dummyAccount =
    'GAVAX3CT3G2XGKNXLMAP6R6IGRVQJHP6CBVOKNJVEWXONO2ZPQYPBXCM';
  try {
    const op = Operation.invokeContractFunction({
      contract: channelContractAddress,
      function: 'fetch_channel_state',
      args: [nativeToScVal(BigInt(channelId), { type: 'u64' })],
    });

    const tx = new TransactionBuilder(new Account(dummyAccount, '0'), {
      networkPassphrase,
      fee: '100',
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
      const raw = scValToNative(sim.result.retval);
      return {
        id: channelId,
        originator: raw.originator,
        beneficiary: raw.beneficiary,
        lockedCapital: Number(raw.locked_capital) / 10_000_000,
        epochStart: Number(raw.epoch_start),
        channelDuration: Number(raw.channel_duration),
        capitalReleased: Number(raw.capital_released) / 10_000_000,
        token: raw.token,
      };
    }
    return null;
  } catch (error) {
    console.error(`[TetherStream] fetchChannelRecord(${channelId}) error:`, error);
    return null;
  }
}

/** Simulates compute_unlocked_capital for a channel ID without signing. */
export async function computeUnlockedCapital(channelId: number): Promise<number> {
  if (!channelContractAddress) return 0;
  const dummyAccount =
    'GAVAX3CT3G2XGKNXLMAP6R6IGRVQJHP6CBVOKNJVEWXONO2ZPQYPBXCM';
  try {
    const op = Operation.invokeContractFunction({
      contract: channelContractAddress,
      function: 'compute_unlocked_capital',
      args: [nativeToScVal(BigInt(channelId), { type: 'u64' })],
    });

    const tx = new TransactionBuilder(new Account(dummyAccount, '0'), {
      networkPassphrase,
      fee: '100',
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
      return Number(scValToNative(sim.result.retval)) / 10_000_000;
    }
    return 0;
  } catch (error) {
    console.error(`[TetherStream] computeUnlockedCapital(${channelId}) error:`, error);
    return 0;
  }
}

/** Returns all channel IDs where the given address is originator or beneficiary. */
export async function enumerateChannelsForParty(
  userAddress: string
): Promise<number[]> {
  if (!userAddress || !channelContractAddress) return [];
  try {
    const op = Operation.invokeContractFunction({
      contract: channelContractAddress,
      function: 'enumerate_channels_by_party',
      args: [new Address(userAddress).toScVal()],
    });

    const tx = new TransactionBuilder(new Account(userAddress, '0'), {
      networkPassphrase,
      fee: '100',
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
      const list = scValToNative(sim.result.retval);
      if (Array.isArray(list)) return list.map((item) => Number(item));
    }
    return [];
  } catch (error) {
    console.error('[TetherStream] enumerateChannelsForParty error:', error);
    return [];
  }
}

// ── Channel Write Operations ─────────────────────────────────────────────────

/** Prepares, signs, submits, and polls a write transaction. Returns tx hash on success. */
async function executeSignedTransaction(
  userAddress: string,
  operation: any
): Promise<string> {
  await bootstrapWalletKit();
  const mod = await resolveWalletKit();
  if (!mod) throw new Error('Wallet kit unavailable');

  const sourceAccount = await server.getAccount(userAddress);
  let tx = new TransactionBuilder(sourceAccount, {
    networkPassphrase,
    fee: '100',
  })
    .addOperation(operation)
    .setTimeout(60)
    .build();

  tx = await server.prepareTransaction(tx);

  const { signedTxXdr } = await mod.StellarWalletsKit.signTransaction(
    tx.toXDR(),
    { networkPassphrase, address: userAddress }
  );

  const signedTx = TransactionBuilder.fromXDR(
    signedTxXdr,
    networkPassphrase
  ) as Transaction;

  const submitResult = await server.sendTransaction(signedTx);

  if (submitResult.status === 'ERROR') {
    throw new Error(
      (submitResult as any).errorResultXdr ||
        (submitResult as any).errorResult?.result?.switch?.name ||
        'Transaction rejected by network'
    );
  }

  return pollTransactionStatus(submitResult.hash);
}

/** Polls the RPC until a transaction reaches SUCCESS or FAILED status. */
async function pollTransactionStatus(txHash: string): Promise<string> {
  let status: string = 'PENDING';
  while (status === 'PENDING') {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const txStatus = await server.getTransaction(txHash);
    status = txStatus.status;
    if (status === 'SUCCESS') return txHash;
    if (status === 'FAILED') {
      throw new Error('Transaction execution failed on-chain');
    }
  }
  return txHash;
}

/**
 * Allocates a new capital channel (on-chain vesting stream).
 * Triggers inter-contract call to lock TTH in the channel contract.
 */
export async function allocateAssetStream(
  originator: string,
  beneficiary: string,
  lockedCapital: number,
  channelDuration: number
): Promise<string> {
  const op = Operation.invokeContractFunction({
    contract: channelContractAddress,
    function: 'allocate_asset_stream',
    args: [
      new Address(originator).toScVal(),
      new Address(beneficiary).toScVal(),
      new Address(tetherTokenAddress).toScVal(),
      nativeToScVal(BigInt(Math.floor(lockedCapital * 10_000_000)), {
        type: 'i128',
      }),
      nativeToScVal(BigInt(channelDuration), { type: 'u64' }),
    ],
  });

  return executeSignedTransaction(originator, op);
}

/**
 * Claims all matured (vested) capital from a channel.
 * Triggers inter-contract call from channel contract → TTH token contract.
 */
export async function releaseMatureCapital(
  beneficiary: string,
  channelId: number
): Promise<string> {
  const op = Operation.invokeContractFunction({
    contract: channelContractAddress,
    function: 'release_matured_capital',
    args: [nativeToScVal(BigInt(channelId), { type: 'u64' })],
  });

  return executeSignedTransaction(beneficiary, op);
}

/**
 * Terminates an active channel early.
 * Vested portion → beneficiary; remainder → originator via inter-contract calls.
 */
export async function terminateActiveChannel(
  originator: string,
  channelId: number
): Promise<string> {
  const op = Operation.invokeContractFunction({
    contract: channelContractAddress,
    function: 'terminate_active_channel',
    args: [nativeToScVal(BigInt(channelId), { type: 'u64' })],
  });

  return executeSignedTransaction(originator, op);
}
