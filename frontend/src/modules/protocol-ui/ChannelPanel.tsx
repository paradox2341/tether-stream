'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  XCircle,
  DownloadCloud,
  ShieldOff,
} from 'lucide-react';
import { ChannelRecord } from '../../core/chain-adapter/stellar';
import { computeUnlocked, vestProgressPct } from '../../core/vesting';

interface ChannelPanelProps {
  channel: ChannelRecord;
  currentUserAddress: string;
  onRelease: (channelId: number) => Promise<void>;
  onTerminate: (channelId: number) => Promise<void>;
  loadingRelease: boolean;
  loadingTerminate: boolean;
}

export const ChannelPanel: React.FC<ChannelPanelProps> = ({
  channel,
  currentUserAddress,
  onRelease,
  onTerminate,
  loadingRelease,
  loadingTerminate,
}) => {
  const isOriginator =
    currentUserAddress.toLowerCase() === channel.originator.toLowerCase();
  const isBeneficiary =
    currentUserAddress.toLowerCase() === channel.beneficiary.toLowerCase();

  // ── Live Capital Ticker (100ms precision) ────────────────────────────────
  const [liveUnlocked, setLiveUnlocked] = useState(0);
  const [vestProgress, setVestProgress] = useState(0);

  useEffect(() => {
    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      setLiveUnlocked(
        computeUnlocked(
          channel.lockedCapital,
          channel.epochStart,
          channel.channelDuration,
          nowSec
        )
      );
      setVestProgress(
        vestProgressPct(channel.epochStart, channel.channelDuration, nowSec)
      );
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [channel]);

  const claimable = Math.max(0, liveUnlocked - channel.capitalReleased);
  const isFullyVested = vestProgress >= 100;
  const isSettled = channel.capitalReleased >= channel.lockedCapital;

  // Progress colour: cyan → purple when nearly done
  const progressColor =
    vestProgress < 33
      ? 'bg-ts-cyan shadow-[0_0_6px_rgba(0,245,212,0.6)]'
      : vestProgress < 66
      ? 'bg-ts-purple shadow-[0_0_6px_rgba(123,97,255,0.5)]'
      : 'bg-ts-success shadow-[0_0_6px_rgba(0,200,150,0.6)]';

  return (
    <div
      id={`channel-panel-${channel.id}`}
      className="flex flex-col bg-ts-surface border border-ts-border shadow-ts-card overflow-hidden"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-ts-void border-b border-ts-border">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-ts-void border border-ts-cyan text-ts-cyan font-mono text-[9px] font-bold uppercase tracking-widest shadow-ts-glow-cyan">
            CH-{String(channel.id).padStart(4, '0')}
          </span>
          <span className="text-[10px] font-mono text-ts-text-muted uppercase tracking-wider">
            {isOriginator && !isBeneficiary
              ? 'Originated'
              : isBeneficiary && !isOriginator
              ? 'Incoming'
              : 'Self-Channel'}
          </span>
        </div>
        {isOriginator ? (
          <ArrowUpRight size={14} className="text-ts-error" />
        ) : (
          <ArrowDownLeft size={14} className="text-ts-success" />
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="p-4 space-y-4 flex-grow">
        {/* Address routing */}
        <div className="space-y-1 p-3 bg-ts-void border border-ts-border font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-ts-text-muted uppercase tracking-wider">Origin</span>
            <span className="text-ts-text-dim">
              {channel.originator.slice(0, 8)}···{channel.originator.slice(-8)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ts-text-muted uppercase tracking-wider">Target</span>
            <span className="text-ts-text-dim">
              {channel.beneficiary.slice(0, 8)}···{channel.beneficiary.slice(-8)}
            </span>
          </div>
        </div>

        {/* ── Live Capital Ticker (Visual Centrepiece) ─────────────────────── */}
        <div className="relative py-4 px-3 border border-ts-border bg-ts-void text-center overflow-hidden">
          {/* Scan-line decorative overlay */}
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              background:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,245,212,1) 2px, rgba(0,245,212,1) 3px)',
              backgroundSize: '100% 6px',
            }}
          />
          <p className="text-[9px] font-mono text-ts-text-muted uppercase tracking-[0.25em] mb-1 relative z-10">
            Unlocked Capital
          </p>
          <div className="flex items-baseline justify-center gap-1.5 relative z-10">
            <span className="text-4xl font-mono font-bold text-ts-cyan tabular-nums leading-none tracking-tight drop-shadow-[0_0_8px_rgba(0,245,212,0.7)]">
              {liveUnlocked.toFixed(6)}
            </span>
          </div>
          <p className="text-[10px] font-mono text-ts-text-muted mt-1 relative z-10">
            / <span className="text-ts-text">{channel.lockedCapital.toFixed(4)}</span> TTH locked
          </p>
        </div>

        {/* Progress Rail */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-[9px] uppercase">
            <span className="text-ts-text-muted tracking-widest">Vest Progress</span>
            <span className="text-ts-text tabular-nums">{vestProgress.toFixed(2)}%</span>
          </div>
          <div className="h-2 w-full bg-ts-void border border-ts-border overflow-hidden">
            <div
              className={`h-full ${progressColor} transition-all duration-100 ease-linear`}
              style={{ width: `${vestProgress}%` }}
            />
          </div>
        </div>

        {/* Capital breakdown */}
        <div className="p-3 border border-ts-border bg-ts-void font-mono text-[10px] space-y-1.5">
          <div className="flex justify-between">
            <span className="text-ts-text-muted uppercase">Released</span>
            <span className="text-ts-text tabular-nums">
              {channel.capitalReleased.toFixed(4)} TTH
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ts-text-muted uppercase">Claimable Now</span>
            <span
              className={`tabular-nums font-bold ${
                claimable > 0 ? 'text-ts-cyan' : 'text-ts-text-muted'
              }`}
            >
              {claimable.toFixed(6)} TTH
            </span>
          </div>
        </div>
      </div>

      {/* ── Action Footer ───────────────────────────────────────────────────── */}
      <div className="flex gap-2 p-4 border-t border-ts-border bg-ts-void">
        {isBeneficiary ? (
          <button
            id={`release-btn-${channel.id}`}
            onClick={() => onRelease(channel.id)}
            disabled={loadingRelease || claimable <= 0 || isSettled}
            className="flex-grow flex items-center justify-center gap-1.5 py-2 border border-ts-cyan bg-ts-void text-ts-cyan font-mono text-[10px] uppercase tracking-widest hover:bg-ts-cyan hover:text-ts-void shadow-ts-glow-cyan transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loadingRelease ? (
              <>
                <span className="animate-pulse">···</span>
                Releasing
              </>
            ) : isSettled ? (
              <>
                <ShieldOff size={11} />
                Settled
              </>
            ) : (
              <>
                <DownloadCloud size={11} />
                Claim {claimable.toFixed(4)} TTH
              </>
            )}
          </button>
        ) : (
          <div className="flex-grow flex items-center justify-center gap-1.5 py-2 border border-dashed border-ts-border font-mono text-[10px] text-ts-text-muted uppercase tracking-widest">
            <ShieldOff size={11} />
            Beneficiary Only
          </div>
        )}

        {isOriginator && !isFullyVested && !isSettled && (
          <button
            id={`terminate-btn-${channel.id}`}
            onClick={() => onTerminate(channel.id)}
            disabled={loadingTerminate}
            title="Terminate channel early"
            className="p-2 border border-ts-border bg-ts-void text-ts-text-muted hover:border-ts-error hover:text-ts-error transition-all disabled:opacity-30 shadow-none hover:shadow-ts-glow-error"
          >
            <XCircle size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
