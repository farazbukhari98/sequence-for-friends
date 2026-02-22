import { useMemo } from 'react';
import type { BoardChips, CardCode, SequenceLine, TeamColor } from '../../../../shared/types';
import {
  BOARD_LAYOUT,
  isCorner,
  getSuitSymbol,
  getRankDisplay,
  parseCard,
  getTeamColorHex,
} from '../../../../shared/types';
import './Board.css';

interface BoardProps {
  boardChips: BoardChips;
  highlightedCells: Set<string>;
  previewCell: [number, number] | null;
  previewTeamColor: TeamColor | null;
  previewIsRemoval: boolean;
  lockedCells: string[][];
  completedSequences: SequenceLine[];
  teamColors: TeamColor[];
  onCellClick: (row: number, col: number) => void;
}

export function Board({
  boardChips,
  highlightedCells,
  previewCell,
  previewTeamColor,
  previewIsRemoval,
  lockedCells,
  completedSequences,
  teamColors,
  onCellClick,
}: BoardProps) {
  const lockedCellSet = useMemo(() => {
    const set = new Set<string>();
    lockedCells.forEach((cells) => {
      cells.forEach((cell) => set.add(cell));
    });
    return set;
  }, [lockedCells]);

  const cellSequenceTeam = useMemo(() => {
    const map = new Map<string, number>();
    completedSequences.forEach((seq) => {
      seq.cells.forEach(([row, col]) => {
        map.set(`${row},${col}`, seq.teamIndex);
      });
    });
    return map;
  }, [completedSequences]);

  const getClassicColorHex = (color: string) => {
    switch(color) {
      case 'blue': return '#2980b9';
      case 'green': return '#27ae60';
      case 'red': return '#c0392b';
      default: return getTeamColorHex(color as 'blue'|'green'|'red');
    }
  }

  return (
    <div className="board">
      {BOARD_LAYOUT.map((row, rowIndex) => (
        <div key={rowIndex} className="board-row">
          {row.map((cell, colIndex) => {
            const isCornerCell = isCorner(rowIndex, colIndex);
            const chip = boardChips[rowIndex][colIndex];
            const cellKey = `${rowIndex},${colIndex}`;
            const isHighlighted = highlightedCells.has(cellKey);
            const isPreview = previewCell?.[0] === rowIndex && previewCell?.[1] === colIndex;
            const isLocked = lockedCellSet.has(cellKey);
            const sequenceTeam = cellSequenceTeam.get(cellKey);

            return (
              <BoardCell
                key={cellKey}
                cardCode={cell}
                isCorner={isCornerCell}
                chip={chip}
                teamColors={teamColors}
                isHighlighted={isHighlighted}
                isPreview={isPreview}
                previewTeamColor={previewTeamColor}
                previewIsRemoval={previewIsRemoval}
                isLocked={isLocked}
                sequenceTeam={sequenceTeam}
                onClick={() => onCellClick(rowIndex, colIndex)}
                getClassicColorHex={getClassicColorHex}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface BoardCellProps {
  cardCode: string;
  isCorner: boolean;
  chip: number | null;
  teamColors: TeamColor[];
  isHighlighted: boolean;
  isPreview: boolean;
  previewTeamColor: TeamColor | null;
  previewIsRemoval: boolean;
  isLocked: boolean;
  sequenceTeam: number | undefined;
  onClick: () => void;
  getClassicColorHex: (color: string) => string;
}

function BoardCell({
  cardCode,
  isCorner,
  chip,
  teamColors,
  isHighlighted,
  isPreview,
  previewTeamColor,
  previewIsRemoval,
  isLocked,
  sequenceTeam,
  onClick,
  getClassicColorHex,
}: BoardCellProps) {
  const isWild = cardCode === 'W';

  let rankDisplay = '';
  let suitSymbol = '';
  let isRed = false;

  if (!isWild) {
    const { rank, suit } = parseCard(cardCode as CardCode);
    rankDisplay = getRankDisplay(rank);
    suitSymbol = getSuitSymbol(suit);
    isRed = suit === 'H' || suit === 'D';
  }

  const chipColor = chip !== null ? teamColors[chip] : null;
  const showPreviewChip = isPreview && previewTeamColor && !previewIsRemoval;
  const showRemovalPreview = isPreview && previewIsRemoval;

  return (
    <div
      className={`board-cell ${isCorner ? 'corner' : ''} ${isHighlighted ? 'highlighted' : ''} ${isLocked ? 'locked' : ''} ${sequenceTeam !== undefined ? 'in-sequence' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={isHighlighted ? 0 : -1}
      aria-label={isWild ? 'Wild corner' : `${rankDisplay} of ${suitSymbol}`}
    >
      {isWild ? (
        <div className="wild-corner">
          <span className="wild-star">★</span>
        </div>
      ) : (
        <div className={`card-face ${isRed ? 'red' : 'black'}`}>
          <span className="card-rank">{rankDisplay}</span>
          <span className="card-suit">{suitSymbol}</span>
        </div>
      )}

      {chipColor && !showRemovalPreview && (
        <div
          className={`chip ${isLocked ? 'locked' : ''}`}
          style={{ backgroundColor: getClassicColorHex(chipColor) }}
        >
          <span className="chip-rank">{rankDisplay}</span>
          <span className="chip-suit" style={{ color: isRed ? '#ffcccc' : '#e0e0e0' }}>
            {suitSymbol}
          </span>
        </div>
      )}

      {showPreviewChip && previewTeamColor && (
        <div
          className="chip preview"
          style={{ backgroundColor: getClassicColorHex(previewTeamColor) }}
        >
          <span className="chip-rank">{rankDisplay}</span>
          <span className="chip-suit" style={{ color: isRed ? '#ffcccc' : '#e0e0e0' }}>
            {suitSymbol}
          </span>
        </div>
      )}

      {showRemovalPreview && chipColor && (
        <div
          className="chip removing"
          style={{ backgroundColor: getClassicColorHex(chipColor) }}
        >
          <span className="chip-rank">{rankDisplay}</span>
          <span className="chip-suit" style={{ color: isRed ? '#ffcccc' : '#e0e0e0' }}>
            {suitSymbol}
          </span>
          <span className="remove-x">✕</span>
        </div>
      )}

      {isHighlighted && <div className="highlight-overlay" />}

      {sequenceTeam !== undefined && (
        <div
          className="sequence-glow"
          style={{
            boxShadow: `
              0 0 10px 3px ${getClassicColorHex(teamColors[sequenceTeam])},
              inset 0 0 8px ${getClassicColorHex(teamColors[sequenceTeam])}80
            `,
            border: `3px solid ${getClassicColorHex(teamColors[sequenceTeam])}`,
            backgroundColor: `${getClassicColorHex(teamColors[sequenceTeam])}30`
          }}
        />
      )}
    </div>
  );
}
