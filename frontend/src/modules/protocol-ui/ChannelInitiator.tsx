'use client';

import React, { useState } from 'react';
import { GitBranch, Clock, Lock, RefreshCw, AlertTriangle } from 'lucide-react';
import { StrKey } from '@stellar/stellar-sdk';

interface ChannelInitiatorProps {
  balance: number;
  onSubmit: (beneficiary: string, lockedCapital: number, channelDuration: number) => Promise<void>;
  loading: boolean;
}

export const ChannelInitiator: React.FC<ChannelInitiatorProps> = ({
  balance,
  onSubmit,
  loading,
}) => {
  const [beneficiary, setBeneficiary] = useState('');
  const [lockedCapital, setLockedCapital] = useState('');
  const [channelDuration, setChannelDuration] = useState('120');
  const [validationError, setValidationError] = useState('');

  const unlockRate =
    lockedCapital && channelDuration && Number(channelDuration) > 0
      ? (Number(lockedCapital) / Number(channelDuration)).toFixed(6)
      : '0.000000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!beneficiary) {
      setValidationError('Beneficiary address is required.');
      return;
    }
    if (!StrKey.isValidEd25519PublicKey(beneficiary) && !beneficiary.startsWith('C')) {
      setValidationError('Invalid Stellar address. Must begin with G (ed25519) or C (contract).');
      return;
    }

    const capitalNum = Number(lockedCapital);
    if (!lockedCapital || isNaN(capitalNum) || capitalNum <= 0) {
      setValidationError('Capital lock amount must be a positive number.');
      return;
    }
    if (capitalNum > balance) {
      setValidationError(`Insufficient TTH. Available: ${balance.toFixed(4)} TTH`);
      return;
    }

    const durationNum = Number(channelDuration);
    if (!channelDuration || isNaN(durationNum) || durationNum <= 0) {
      setValidationError('Channel duration must be greater than 0 seconds.');
      return;
    }

    try {
      await onSubmit(beneficiary, capitalNum, durationNum);
      setBeneficiary('');
      setLockedCapital('');
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : 'Channel allocation failed.'
      );
    }
  };

  return (
    <div
      id="channel-initiator-panel"
      className="bg-ts-surface border border-ts-border p-5 shadow-ts-card"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-ts-border">
        <GitBranch size={16} className="text-ts-cyan" />
        <h2 className="text-xs font-mono font-bold text-ts-cyan uppercase tracking-widest">
          Open Capital Channel
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Validation Error */}
        {validationError && (
          <div className="flex items-start gap-2 p-3 border border-ts-error bg-ts-void font-mono text-xs text-ts-error">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Beneficiary */}
        <div>
          <label className="block text-[10px] font-mono text-ts-text-muted uppercase tracking-widest mb-1.5">
            Beneficiary Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-ts-text-muted pointer-events-none">
              <Lock size={13} />
            </div>
            <input
              id="beneficiary-input"
              type="text"
              placeholder="G… or C…"
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              disabled={loading}
              className="block w-full pl-9 pr-3 py-2.5 bg-ts-void border border-ts-border text-ts-text font-mono text-xs focus:border-ts-cyan focus:outline-none transition-colors placeholder:text-ts-text-muted disabled:opacity-50"
            />
          </div>
        </div>

        {/* Capital + Duration Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-mono text-ts-text-muted uppercase tracking-widest mb-1.5">
              Lock Amount (TTH)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-ts-text-muted pointer-events-none">
                <span className="text-[10px] font-mono font-bold">TTH</span>
              </div>
              <input
                id="capital-input"
                type="number"
                placeholder="0.00"
                min="0"
                step="any"
                value={lockedCapital}
                onChange={(e) => setLockedCapital(e.target.value)}
                disabled={loading}
                className="block w-full pl-10 pr-3 py-2.5 bg-ts-void border border-ts-border text-ts-text font-mono text-xs focus:border-ts-cyan focus:outline-none transition-colors placeholder:text-ts-text-muted disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-ts-text-muted uppercase tracking-widest mb-1.5">
              Duration (Seconds)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-ts-text-muted pointer-events-none">
                <Clock size={13} />
              </div>
              <input
                id="duration-input"
                type="number"
                placeholder="120"
                min="1"
                step="1"
                value={channelDuration}
                onChange={(e) => setChannelDuration(e.target.value)}
                disabled={loading}
                className="block w-full pl-9 pr-3 py-2.5 bg-ts-void border border-ts-border text-ts-text font-mono text-xs focus:border-ts-cyan focus:outline-none transition-colors placeholder:text-ts-text-muted disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Params Preview */}
        <div className="p-3 border border-ts-border bg-ts-void font-mono text-[10px] space-y-1.5">
          <div className="flex justify-between">
            <span className="text-ts-text-muted uppercase tracking-wider">Unlock Rate</span>
            <span className="text-ts-cyan font-bold tabular-nums">{unlockRate} TTH/sec</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ts-text-muted uppercase tracking-wider">Vesting Model</span>
            <span className="text-ts-purple font-bold uppercase">Linear · Continuous</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ts-text-muted uppercase tracking-wider">Available Balance</span>
            <span className="text-ts-text font-bold tabular-nums">{balance.toFixed(4)} TTH</span>
          </div>
        </div>

        {/* Submit */}
        <button
          id="allocate-channel-btn"
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 border border-ts-cyan bg-ts-void text-ts-cyan font-mono text-xs uppercase tracking-widest hover:bg-ts-cyan hover:text-ts-void shadow-ts-glow-cyan transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              Allocating Channel...
            </>
          ) : (
            <>
              <GitBranch size={12} />
              Allocate Capital Channel
            </>
          )}
        </button>
      </form>
    </div>
  );
};
