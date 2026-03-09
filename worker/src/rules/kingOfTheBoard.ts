import {
  KingZone,
  SequenceLine,
  cellKey,
} from '../../../shared/types.js';

const KING_ZONE_CENTERS: [number, number][] = [
  [2, 2], [2, 5], [2, 7],
  [5, 2], [5, 5], [5, 7],
  [7, 2], [7, 5], [7, 7],
];

function createKingZone(center: [number, number]): KingZone {
  const [centerRow, centerCol] = center;
  const cells: [number, number][] = [];

  for (let row = centerRow - 1; row <= centerRow + 1; row++) {
    for (let col = centerCol - 1; col <= centerCol + 1; col++) {
      cells.push([row, col]);
    }
  }

  return {
    id: `center-${centerRow}-${centerCol}`,
    center,
    cells,
  };
}

export const KING_ZONE_PRESETS: KingZone[] = KING_ZONE_CENTERS.map(createKingZone);

function pickRandomZone(zones: KingZone[]): KingZone {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return zones[random[0] % zones.length];
}

export function getInitialKingZone(): KingZone {
  return pickRandomZone(KING_ZONE_PRESETS);
}

export function getNextKingZone(currentZoneId: string | null): KingZone {
  const candidates = KING_ZONE_PRESETS.filter(zone => zone.id !== currentZoneId);
  return pickRandomZone(candidates.length > 0 ? candidates : KING_ZONE_PRESETS);
}

export function sequenceTouchesKingZone(sequence: SequenceLine, kingZone: KingZone | null): boolean {
  if (!kingZone) return false;

  const kingZoneCells = new Set(kingZone.cells.map(([row, col]) => cellKey(row, col)));
  return sequence.cells.some(([row, col]) => kingZoneCells.has(cellKey(row, col)));
}

export function getSequenceScore(sequence: SequenceLine, kingZone: KingZone | null): {
  points: number;
  usedKingZone: boolean;
} {
  const usedKingZone = sequenceTouchesKingZone(sequence, kingZone);
  return {
    points: usedKingZone ? 2 : 1,
    usedKingZone,
  };
}
