'use client';

import React from 'react';
import { Terminal, CheckCircle2, GitBranch, XCircle, ExternalLink } from 'lucide-react';

export interface LedgerEvent {
  id: string;
  type: 'channel_allocated' | 'capital_released' | 'channel_terminated';
  channelId: number;
  amount: number;
  timestamp: number;
  txHash: string;
}

interface EventLedgerProps {
  events: LedgerEvent[];
}

const EVENT_META: Record<
  LedgerEvent['type'],
  { label: string; icon: React.ReactNode; color: string; borderColor: string }
> = {
  channel_allocated: {
    label: 'CHANNEL_ALLOCATED',
    icon: <GitBranch size={11} />,
    color: 'text-ts-purple',
    borderColor: 'border-ts-purple',
  },
  capital_released: {
    label: 'CAPITAL_RELEASED',
    icon: <CheckCircle2 size={11} />,
    color: 'text-ts-success',
    borderColor: 'border-ts-success',
  },
  channel_terminated: {
    label: 'CHANNEL_TERMINATED',
    icon: <XCircle size={11} />,
    color: 'text-ts-error',
    borderColor: 'border-ts-error',
  },
};

export const EventLedger: React.FC<EventLedgerProps> = ({ events }) => {
  return (
    <div
      id="event-ledger"
      className="bg-ts-surface border border-ts-border p-5 shadow-ts-card"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-ts-border">
        <Terminal size={14} className="text-ts-cyan" />
        <h2 className="text-[10px] font-mono font-bold text-ts-cyan uppercase tracking-widest">
          Protocol Event Log
        </h2>
      </div>

      {events.length === 0 ? (
        <div className="py-8 text-center">
          <p className="font-mono text-[10px] text-ts-text-muted uppercase tracking-widest">
            {'> '}Awaiting protocol events...
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-ts-void scrollbar-thumb-ts-border">
          {events.map((event) => {
            const meta = EVENT_META[event.type];
            const timeStr = new Date(event.timestamp * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={event.id}
                className={`flex items-start gap-3 p-3 bg-ts-void border-l-2 ${meta.borderColor} border-y border-r border-ts-border`}
              >
                <div className={`mt-0.5 ${meta.color}`}>{meta.icon}</div>

                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className={`font-mono text-[9px] font-bold uppercase ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className="font-mono text-[9px] text-ts-text-muted ml-2 shrink-0">
                      {timeStr}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-ts-text-dim">
                    CH-{String(event.channelId).padStart(4, '0')}
                    {event.amount > 0 && (
                      <span className="text-ts-cyan ml-1">
                        · {event.amount.toFixed(4)} TTH
                      </span>
                    )}
                  </p>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[9px] text-ts-text-muted hover:text-ts-cyan transition-colors mt-0.5"
                  >
                    <ExternalLink size={9} />
                    {event.txHash.slice(0, 10)}···
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
