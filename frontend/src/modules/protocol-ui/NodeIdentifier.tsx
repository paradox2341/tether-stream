'use client';

import React from 'react';
import { Cpu, LogOut, RefreshCw, Zap, Radio } from 'lucide-react';

interface NodeIdentifierProps {
  address: string;
  balance: number;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefreshBalance: () => void;
  onRegisterToken: () => void;
  onDispenseFaucet: () => void;
}

export const NodeIdentifier: React.FC<NodeIdentifierProps> = ({
  address,
  balance,
  connecting,
  onConnect,
  onDisconnect,
  onRefreshBalance,
  onRegisterToken,
  onDispenseFaucet,
}) => {
  return (
    <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-ts-surface border-b border-ts-border px-6 py-4 gap-4">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 bg-ts-void border border-ts-cyan rounded-none shadow-ts-glow-cyan">
          <Cpu size={18} className="text-ts-cyan" />
        </div>
        <div>
          <h1 className="text-lg font-mono font-bold text-ts-cyan tracking-widest uppercase">
            TetherStream
          </h1>
          <p className="text-[10px] font-mono text-ts-text-muted uppercase tracking-[0.2em]">
            Stellar · Soroban Protocol
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {address ? (
          <>
            {/* Connected Address Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-ts-void border border-ts-border font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-ts-success animate-ts-pulse-cyan shadow-[0_0_6px_rgba(0,200,150,0.8)]" />
              <span className="text-ts-text-dim">
                {address.slice(0, 6)}···{address.slice(-6)}
              </span>
            </div>

            {/* TTH Balance */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-ts-void border border-ts-border font-mono text-xs">
              <span className="text-ts-text-muted uppercase tracking-wider text-[9px]">TTH</span>
              <span className="text-ts-cyan font-bold tabular-nums">
                {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
              <button
                onClick={onRefreshBalance}
                className="text-ts-text-muted hover:text-ts-cyan transition-colors ml-1"
                title="Refresh TTH balance"
              >
                <RefreshCw size={11} />
              </button>
            </div>

            {/* Register Token */}
            <button
              onClick={onRegisterToken}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-ts-border bg-ts-void text-ts-text-dim font-mono text-[10px] uppercase tracking-widest hover:border-ts-cyan hover:text-ts-cyan transition-all"
            >
              <Zap size={11} />
              Add TTH
            </button>

            {/* Faucet */}
            <button
              onClick={onDispenseFaucet}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-ts-border bg-ts-void text-ts-text-dim font-mono text-[10px] uppercase tracking-widest hover:border-ts-purple hover:text-ts-purple transition-all"
            >
              <Radio size={11} />
              Faucet 1000
            </button>

            {/* Disconnect */}
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-ts-border bg-ts-void text-ts-text-muted font-mono text-[10px] uppercase tracking-widest hover:border-ts-error hover:text-ts-error transition-all"
            >
              <LogOut size={11} />
              Eject
            </button>
          </>
        ) : (
          <button
            id="connect-wallet-btn"
            onClick={onConnect}
            disabled={connecting}
            className="flex items-center gap-2 px-5 py-2 border border-ts-cyan bg-ts-void text-ts-cyan font-mono text-xs uppercase tracking-widest hover:bg-ts-cyan hover:text-ts-void shadow-ts-glow-cyan transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {connecting ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                Initialising Node...
              </>
            ) : (
              <>
                <Cpu size={12} />
                Connect Node
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
};
