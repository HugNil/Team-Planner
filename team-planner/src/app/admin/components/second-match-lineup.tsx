'use client';

import { useState } from 'react';

type Props = {
  lineupId: string;
  slots: number[];
  players: { playerId: string; sortOrder: number; name: string }[];
  reserveLabels: string[];
  disabled: boolean;
  onChange: (slots: number[]) => void;
};

export default function SecondMatchLineup({ lineupId, slots, players, reserveLabels, disabled, onChange }: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  function move(playerId: string, target: number) {
    if (disabled) return;
    const player = players.find((item) => item.playerId === playerId);
    const source = player ? slots.indexOf(player.sortOrder) : -1;
    if (source < 0) return;
    setSelectedPlayer(null);
    if (source === target) return;
    const next = [...slots];
    [next[source], next[target]] = [next[target], next[source]];
    onChange(next);
  }

  function renderSlot(slot: number) {
    const player = players.find((item) => item.sortOrder === slots[slot]);
    const reserve = slot >= 8;
    const label = reserve ? reserveLabels[slot - 8] : `Plats ${slot + 1}`;
    return (
      <button type="button" disabled={disabled} draggable={Boolean(player) && !disabled}
        aria-label={`Match 2: ${label}${player ? `, ${player.name}` : ', tom'}`} aria-pressed={Boolean(player && selectedPlayer === player.playerId)}
        onDragStart={(event) => {
          if (player) event.dataTransfer.setData('application/x-second-match', JSON.stringify({ lineupId, playerId: player.playerId }));
          event.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(event) => {
          if (!disabled && event.dataTransfer.types.includes('application/x-second-match')) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          const raw = event.dataTransfer.getData('application/x-second-match');
          if (!raw) return;
          try {
            const source = JSON.parse(raw);
            if (source.lineupId === lineupId) move(source.playerId, slot);
          } catch { /* Ignore unrelated drag data. */ }
        }}
        onClick={() => selectedPlayer ? move(selectedPlayer, slot) : player && setSelectedPlayer(player.playerId)}
        className={`min-h-14 w-full min-w-0 rounded-md border px-2 py-2 text-left text-sm sm:px-3 disabled:opacity-50 ${player ? `border-white bg-white font-semibold shadow-sm ${reserve ? 'text-amber-950' : 'text-emerald-950'}` : `border-dashed ${reserve ? 'border-amber-300 text-amber-800' : 'border-emerald-200 text-emerald-700'}`} ${player && selectedPlayer === player.playerId ? 'ring-2 ring-emerald-500' : ''}`}>
        <span className="block truncate">{player?.name ?? label}</span>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Dra spelarna för att byta plats, eller tryck på en spelare och sedan på en annan plats.</p>
      {[0, 2, 4, 6].map((start) => (
        <div key={start} className="grid grid-cols-2 gap-2 rounded-md bg-emerald-50 p-2">
          {renderSlot(start)}{renderSlot(start + 1)}
        </div>
      ))}
      {reserveLabels.map((label, index) => (
        <div key={index} className="rounded-md border border-amber-200 bg-amber-50 p-2">
          <p className="mb-2 text-xs font-semibold uppercase text-amber-800">{label}</p>
          {renderSlot(8 + index)}
        </div>
      ))}
    </div>
  );
}
