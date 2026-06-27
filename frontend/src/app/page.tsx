'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { NodeIdentifier } from '../modules/protocol-ui/NodeIdentifier';
import { ChannelInitiator } from '../modules/protocol-ui/ChannelInitiator';
import { ChannelBoard } from '../modules/protocol-ui/ChannelBoard';
import { EventLedger, LedgerEvent } from '../modules/protocol-ui/EventLedger';
import {
  connectNodeIdentity,
  disconnectNodeIdentity,
  getTokenBalance,
  enumerateChannelsForParty,
  fetchChannelRecord,
  allocateAssetStream,
  releaseMatureCapital,
  terminateActiveChannel,
  registerTTHInWallet,
  dispenseTTHFromFaucet,
  ChannelRecord,
} from '../core/chain-adapter/stellar';
import { Cpu, AlertTriangle, Info, ShieldAlert, CheckCircle2, Network } from 'lucide-react';

// ── Error Parsing ─────────────────────────────────────────────────────────────

type NoticeType = 'error' | 'warning' | 'info' | 'success';

interface ProtocolNotice {
  message: string;
  type: NoticeType;
}

function classifyError(err: unknown): ProtocolNotice {
  let msg = '';
  if (err instanceof Error) {
    msg = err.message;
  } else if (err && typeof err === 'object') {
    try { msg = JSON.stringify(err); } catch { msg = String(err); }
  } else {
    msg = String(err);
  }

  if (!msg || msg === '{}' || msg === '[object Object]') {
    msg = 'An unknown wallet or network error occurred.';
  }

  console.error('[TetherStream] Error:', msg);

  // Error class 1 — Wallet Not Found
  if (
    (msg.toLowerCase().includes('freighter') && msg.toLowerCase().includes('not found')) ||
    msg.toLowerCase().includes('wallet not found') ||
    msg.toLowerCase().includes('not installed')
  ) {
    return {
      message:
        'Freighter extension not detected. Install Freighter from freighter.app to connect your node identity.',
      type: 'warning',
    };
  }

  // Error class 2 — Signature Rejected
  if (
    msg.toLowerCase().includes('user reject') ||
    msg.toLowerCase().includes('cancel') ||
    msg.toLowerCase().includes('declined') ||
    msg.toLowerCase().includes('closed') ||
    msg.toLowerCase().includes('denied')
  ) {
    return {
      message: 'Transaction signature rejected. No on-chain state was modified.',
      type: 'info',
    };
  }

  // Error class 3 — Insufficient Balance
  if (
    msg.toLowerCase().includes('insufficient') ||
    msg.toLowerCase().includes('balance') ||
    msg.toLowerCase().includes('funds')
  ) {
    return {
      message:
        'Insufficient TTH balance to complete this operation. Use the faucet to acquire testnet TTH.',
      type: 'error',
    };
  }

  return {
    message: msg || 'Protocol transaction failed. Please retry.',
    type: 'error',
  };
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TetherStreamPage() {
  const [nodeAddress, setNodeAddress] = useState('');
  const [tthBalance, setTthBalance] = useState(0);
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([]);

  const [connectingNode, setConnectingNode] = useState(false);
  const [allocatingChannel, setAllocatingChannel] = useState(false);
  const [loadingReleaseId, setLoadingReleaseId] = useState<number | null>(null);
  const [loadingTerminateId, setLoadingTerminateId] = useState<number | null>(null);

  const [notice, setNotice] = useState<ProtocolNotice | null>(null);
  const [syncing, setSyncing] = useState(false);

  const clearNotice = () => setNotice(null);

  // ── Blockchain Data Loader ─────────────────────────────────────────────────
  const syncProtocolState = useCallback(async (address: string) => {
    if (!address) return;
    setSyncing(true);
    try {
      const balance = await getTokenBalance(address);
      setTthBalance(balance);

      const channelIds = await enumerateChannelsForParty(address);
      const records: ChannelRecord[] = [];
      for (const id of channelIds) {
        const record = await fetchChannelRecord(id);
        if (record) records.push(record);
      }
      setChannels(records);
    } catch (err) {
      setNotice(classifyError(err));
    } finally {
      setSyncing(false);
    }
  }, []);

  // ── Wallet Handlers ────────────────────────────────────────────────────────
  const handleConnectNode = async () => {
    setConnectingNode(true);
    clearNotice();
    try {
      const address = await connectNodeIdentity();
      setNodeAddress(address);
      await syncProtocolState(address);
    } catch (err) {
      setNotice(classifyError(err));
    } finally {
      setConnectingNode(false);
    }
  };

  const handleDisconnectNode = async () => {
    await disconnectNodeIdentity();
    setNodeAddress('');
    setTthBalance(0);
    setChannels([]);
    setNotice({ message: 'Node identity disconnected successfully.', type: 'info' });
  };

  const handleRegisterToken = async () => {
    clearNotice();
    setNotice({ message: 'Requesting TTH registration in Freighter…', type: 'info' });
    try {
      await registerTTHInWallet();
      setNotice({ message: 'TTH token registered in your Freighter wallet.', type: 'success' });
    } catch (err) {
      setNotice(classifyError(err));
    }
  };

  const handleDispenseFaucet = async () => {
    if (!nodeAddress) return;
    clearNotice();
    setNotice({ message: 'Dispensing 1,000 TTH from the testnet faucet…', type: 'info' });
    try {
      const txHash = await dispenseTTHFromFaucet(nodeAddress, 1000);
      setNotice({
        message: `Dispensed 1,000 TTH successfully. Tx: ${txHash.slice(0, 16)}…`,
        type: 'success',
      });
      await syncProtocolState(nodeAddress);
    } catch (err) {
      setNotice(classifyError(err));
    }
  };

  // ── Channel Handlers ───────────────────────────────────────────────────────
  const handleAllocateChannel = async (
    beneficiary: string,
    lockedCapital: number,
    channelDuration: number
  ) => {
    setAllocatingChannel(true);
    clearNotice();
    try {
      const txHash = await allocateAssetStream(
        nodeAddress,
        beneficiary,
        lockedCapital,
        channelDuration
      );

      const ev: LedgerEvent = {
        id: Math.random().toString(36).slice(2),
        type: 'channel_allocated',
        channelId: channels.length + 1,
        amount: lockedCapital,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      };
      setLedgerEvents((prev) => [ev, ...prev]);

      setNotice({
        message: `Capital channel allocated — ${lockedCapital} TTH locked. Tx: ${txHash.slice(0, 16)}…`,
        type: 'success',
      });

      await syncProtocolState(nodeAddress);
    } catch (err) {
      setNotice(classifyError(err));
    } finally {
      setAllocatingChannel(false);
    }
  };

  const handleReleaseMatureCapital = async (channelId: number) => {
    setLoadingReleaseId(channelId);
    clearNotice();
    try {
      const txHash = await releaseMatureCapital(nodeAddress, channelId);
      const target = channels.find((c) => c.id === channelId);
      const ev: LedgerEvent = {
        id: Math.random().toString(36).slice(2),
        type: 'capital_released',
        channelId,
        amount: target ? target.lockedCapital - target.capitalReleased : 0,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      };
      setLedgerEvents((prev) => [ev, ...prev]);
      setNotice({ message: `Capital released. Tx: ${txHash.slice(0, 16)}…`, type: 'success' });
      await syncProtocolState(nodeAddress);
    } catch (err) {
      setNotice(classifyError(err));
    } finally {
      setLoadingReleaseId(null);
    }
  };

  const handleTerminateChannel = async (channelId: number) => {
    setLoadingTerminateId(channelId);
    clearNotice();
    try {
      const txHash = await terminateActiveChannel(nodeAddress, channelId);
      const ev: LedgerEvent = {
        id: Math.random().toString(36).slice(2),
        type: 'channel_terminated',
        channelId,
        amount: 0,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      };
      setLedgerEvents((prev) => [ev, ...prev]);
      setNotice({ message: `Channel terminated. Tx: ${txHash.slice(0, 16)}…`, type: 'success' });
      await syncProtocolState(nodeAddress);
    } catch (err) {
      setNotice(classifyError(err));
    } finally {
      setLoadingTerminateId(null);
    }
  };

  // ── Periodic Sync (8s) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!nodeAddress) return;
    const interval = setInterval(() => syncProtocolState(nodeAddress), 8000);
    return () => clearInterval(interval);
  }, [nodeAddress, syncProtocolState]);

  // ── Notice Icon Map ────────────────────────────────────────────────────────
  const noticeIcon: Record<NoticeType, React.ReactNode> = {
    error: <ShieldAlert size={13} className="shrink-0" />,
    warning: <AlertTriangle size={13} className="shrink-0" />,
    info: <Info size={13} className="shrink-0" />,
    success: <CheckCircle2 size={13} className="shrink-0" />,
  };
  const noticeColors: Record<NoticeType, string> = {
    error: 'border-ts-error text-ts-error bg-ts-void',
    warning: 'border-ts-warn text-ts-warn bg-ts-void',
    info: 'border-ts-purple text-ts-purple bg-ts-void',
    success: 'border-ts-success text-ts-success bg-ts-void',
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-ts-base ts-grid-bg flex flex-col pb-16">
      {/* Node Identity Bar */}
      <NodeIdentifier
        address={nodeAddress}
        balance={tthBalance}
        connecting={connectingNode}
        onConnect={handleConnectNode}
        onDisconnect={handleDisconnectNode}
        onRefreshBalance={() => syncProtocolState(nodeAddress)}
        onRegisterToken={handleRegisterToken}
        onDispenseFaucet={handleDispenseFaucet}
      />

      <div className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 mt-6 space-y-5">
        {/* Protocol Notice */}
        {notice && (
          <div
            id="protocol-notice"
            className={`flex items-center justify-between gap-3 px-4 py-3 border font-mono text-xs ${noticeColors[notice.type]}`}
          >
            <div className="flex items-center gap-2">
              {noticeIcon[notice.type]}
              <span className="font-bold uppercase tracking-widest text-[10px] mr-1">
                [{notice.type.toUpperCase()}]
              </span>
              <span>{notice.message}</span>
            </div>
            <button
              onClick={clearNotice}
              className="shrink-0 text-[10px] font-bold uppercase tracking-widest hover:opacity-70 transition-opacity border border-current px-2 py-0.5"
            >
              Dismiss
            </button>
          </div>
        )}

        {nodeAddress ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* Left Column: Channel Initiator + Event Ledger */}
            <div className="lg:col-span-1 space-y-5">
              <ChannelInitiator
                balance={tthBalance}
                onSubmit={handleAllocateChannel}
                loading={allocatingChannel}
              />
              <EventLedger events={ledgerEvents} />
            </div>

            {/* Right Column: Channel Board */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-ts-border pb-3">
                <h2 className="text-xs font-mono font-bold text-ts-text uppercase tracking-widest flex items-center gap-2">
                  <Network size={14} className="text-ts-cyan" />
                  Active Protocol Channels
                </h2>
                {syncing && (
                  <span className="font-mono text-[9px] text-ts-text-muted uppercase tracking-widest animate-pulse">
                    ◉ Syncing...
                  </span>
                )}
              </div>
              <ChannelBoard
                channels={channels}
                currentUserAddress={nodeAddress}
                onRelease={handleReleaseMatureCapital}
                onTerminate={handleTerminateChannel}
                loadingReleaseId={loadingReleaseId}
                loadingTerminateId={loadingTerminateId}
                syncing={syncing}
              />
            </div>
          </div>
        ) : (
          /* Connect Landing State */
          <div className="flex flex-col items-center justify-center py-24 border border-ts-border bg-ts-surface shadow-ts-card max-w-lg mx-auto text-center p-10">
            <div className="w-14 h-14 flex items-center justify-center border border-ts-cyan bg-ts-void shadow-ts-glow-cyan mb-6">
              <Cpu size={28} className="text-ts-cyan" />
            </div>
            <h2 className="text-base font-mono font-bold text-ts-text uppercase tracking-widest mb-3">
              Initialise Node Identity
            </h2>
            <p className="text-[11px] font-mono text-ts-text-muted max-w-sm mb-8 leading-relaxed">
              Connect your Freighter browser wallet to allocate capital channels,
              monitor real-time vesting, and claim unlocked TTH on Stellar Testnet.
            </p>
            <button
              id="landing-connect-btn"
              onClick={handleConnectNode}
              disabled={connectingNode}
              className="flex items-center gap-2 px-8 py-3 border border-ts-cyan bg-ts-void text-ts-cyan font-mono text-xs uppercase tracking-widest hover:bg-ts-cyan hover:text-ts-void shadow-ts-glow-cyan transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {connectingNode ? (
                <>
                  <span className="animate-pulse">◉</span> Connecting...
                </>
              ) : (
                <>
                  <Cpu size={13} /> Connect Node
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
