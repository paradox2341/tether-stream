'use client';

import React, { useState } from 'react';
import { ChannelRecord } from '../../core/chain-adapter/stellar';
import { ChannelPanel } from './ChannelPanel';
import { Network, ArrowUpRight, ArrowDownLeft, LayoutGrid } from 'lucide-react';

interface ChannelBoardProps {
  channels: ChannelRecord[];
  currentUserAddress: string;
  onRelease: (channelId: number) => Promise<void>;
  onTerminate: (channelId: number) => Promise<void>;
  loadingReleaseId: number | null;
  loadingTerminateId: number | null;
  syncing: boolean;
}

type TabMode = 'all' | 'originated' | 'receiving';

export const ChannelBoard: React.FC<ChannelBoardProps> = ({
  channels,
  currentUserAddress,
  onRelease,
  onTerminate,
  loadingReleaseId,
  loadingTerminateId,
  syncing,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('all');

  const originatedChannels = channels.filter(
    (c) => c.originator.toLowerCase() === currentUserAddress.toLowerCase()
  );
  const receivingChannels = channels.filter(
    (c) => c.beneficiary.toLowerCase() === currentUserAddress.toLowerCase()
  );

  const displayedChannels =
    activeTab === 'originated'
      ? originatedChannels
      : activeTab === 'receiving'
      ? receivingChannels
      : channels;

  const tabClass = (tab: TabMode) =>
    `flex items-center justify-center gap-1.5 flex-grow py-2 px-3 font-mono text-[10px] uppercase tracking-widest transition-all ${
      activeTab === tab
        ? 'bg-ts-cyan text-ts-void font-bold shadow-ts-glow-cyan'
        : 'text-ts-text-muted hover:text-ts-text border-r border-ts-border last:border-r-0'
    }`;

  return (
    <div id="channel-board" className="space-y-4">
      {/* Tab Bar */}
      <div className="flex border border-ts-border bg-ts-void overflow-hidden">
        <button
          id="tab-all-channels"
          onClick={() => setActiveTab('all')}
          className={tabClass('all')}
        >
          <LayoutGrid size={11} />
          All ({channels.length})
        </button>
        <button
          id="tab-originated-channels"
          onClick={() => setActiveTab('originated')}
          className={tabClass('originated')}
        >
          <ArrowUpRight size={11} />
          Originated ({originatedChannels.length})
        </button>
        <button
          id="tab-receiving-channels"
          onClick={() => setActiveTab('receiving')}
          className={tabClass('receiving')}
        >
          <ArrowDownLeft size={11} />
          Receiving ({receivingChannels.length})
        </button>
      </div>

      {/* Content */}
      {syncing && channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-ts-border bg-ts-void">
          <Network size={20} className="text-ts-cyan animate-pulse mb-3" />
          <p className="font-mono text-[10px] text-ts-text-muted uppercase tracking-widest animate-pulse">
            Syncing Protocol State...
          </p>
        </div>
      ) : displayedChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-ts-border bg-ts-void">
          <Network size={20} className="text-ts-border mb-3" />
          <p className="font-mono text-xs text-ts-text uppercase tracking-wider font-bold mb-1">
            No Channels Found
          </p>
          <p className="font-mono text-[10px] text-ts-text-muted text-center max-w-xs">
            {activeTab === 'all'
              ? 'No capital channels active. Open one using the panel on the left.'
              : activeTab === 'originated'
              ? 'You have not originated any capital channels yet.'
              : 'You are not a beneficiary on any active channel.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedChannels.map((channel) => (
            <ChannelPanel
              key={channel.id}
              channel={channel}
              currentUserAddress={currentUserAddress}
              onRelease={onRelease}
              onTerminate={onTerminate}
              loadingRelease={loadingReleaseId === channel.id}
              loadingTerminate={loadingTerminateId === channel.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};
