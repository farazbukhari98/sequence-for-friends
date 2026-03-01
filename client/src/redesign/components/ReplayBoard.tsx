import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  GameEvent,
  BoardChips,
  SequenceLine,
  TeamColor,
} from '../../../../shared/types';
import {
  getTeamColorHex,
  getTeamLetter,
  getCardDisplayName,
  isCorner,
} from '../../../../shared/types';
import './ReplayBoard.css';

interface ReplayBoardProps {
  eventLog: GameEvent[];
  boardChips: BoardChips;
  completedSequences: SequenceLine[];
  winnerTeamIndex: number;
  teamColors: TeamColor[];
  onClose: () => void;
}

interface ReplayEvent {
  type: 'chip-placed' | 'chip-removed';
  position: [number, number];
  teamIndex: number;
  playerName: string;
  card: string;
}

export function ReplayBoard({
  eventLog,
  boardChips,
  completedSequences,
  winnerTeamIndex,
  teamColors,
  onClose,
}: ReplayBoardProps) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(true);

  // Extract the last 6-8 chip-placed/chip-removed events
  const replayEvents = useMemo(() => {
    const events: ReplayEvent[] = [];
    for (const event of eventLog) {
      if (
        (event.type === 'chip-placed' || event.type === 'chip-removed') &&
        event.position &&
        event.teamIndex !== undefined
      ) {
        events.push({
          type: event.type,
          position: event.position,
          teamIndex: event.teamIndex,
          playerName: event.playerName || 'Player',
          card: event.card || '',
        });
      }
    }
    return events.slice(-8);
  }, [eventLog]);

  // Build the starting board by rewinding events from final state
  const startingBoard = useMemo(() => {
    const board: BoardChips = boardChips.map(row => [...row]);
    // Rewind in reverse order
    for (let i = replayEvents.length - 1; i >= 0; i--) {
      const event = replayEvents[i];
      const [row, col] = event.position;
      if (event.type === 'chip-placed') {
        board[row][col] = null;
      } else if (event.type === 'chip-removed') {
        board[row][col] = event.teamIndex;
      }
    }
    return board;
  }, [boardChips, replayEvents]);

  // Build current display board by replaying events up to currentStep
  const displayBoard = useMemo(() => {
    const board: BoardChips = startingBoard.map(row => [...row]);
    for (let i = 0; i <= currentStep; i++) {
      if (i >= replayEvents.length) break;
      const event = replayEvents[i];
      const [row, col] = event.position;
      if (event.type === 'chip-placed') {
        board[row][col] = event.teamIndex;
      } else if (event.type === 'chip-removed') {
        board[row][col] = null;
      }
    }
    return board;
  }, [startingBoard, replayEvents, currentStep]);

  // The cell that was just affected (for pulse animation)
  const activeCell = useMemo(() => {
    if (currentStep < 0 || currentStep >= replayEvents.length) return null;
    return replayEvents[currentStep].position;
  }, [currentStep, replayEvents]);

  // Whether we're showing the final winning highlight
  const showWinHighlight = currentStep >= replayEvents.length;

  // Winning sequence cells
  const winningCells = useMemo(() => {
    const cells = new Set<string>();
    completedSequences
      .filter(seq => seq.teamIndex === winnerTeamIndex)
      .forEach(seq => {
        seq.cells.forEach(([r, c]) => cells.add(`${r},${c}`));
      });
    return cells;
  }, [completedSequences, winnerTeamIndex]);

  // Current move caption
  const caption = useMemo(() => {
    if (currentStep < 0) return 'Rewinding...';
    if (currentStep >= replayEvents.length) return 'Game Over!';
    const event = replayEvents[currentStep];
    const cardName = event.card ? getCardDisplayName(event.card as any) : '';
    if (event.type === 'chip-removed') {
      return `${event.playerName} removed chip${cardName ? ` with ${cardName}` : ''}`;
    }
    return `${event.playerName} played ${cardName}`;
  }, [currentStep, replayEvents]);

  // Auto-advance through steps
  useEffect(() => {
    if (!isPlaying) return;

    const totalSteps = replayEvents.length; // +1 for win highlight is handled by going past length
    if (currentStep > totalSteps) {
      setIsPlaying(false);
      return;
    }

    const delay = currentStep < 0 ? 800 : currentStep >= totalSteps ? 2000 : 1500;
    const timer = setTimeout(() => {
      setCurrentStep(s => s + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [currentStep, isPlaying, replayEvents.length]);

  const handleRestart = useCallback(() => {
    setCurrentStep(-1);
    setIsPlaying(true);
  }, []);

  const winnerColor = teamColors[winnerTeamIndex];

  if (replayEvents.length === 0) {
    return (
      <div className="replay-overlay" onClick={onClose}>
        <div className="replay-container" onClick={e => e.stopPropagation()}>
          <p className="replay-empty">No moves to replay</p>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="replay-overlay" onClick={onClose}>
      <div className="replay-container" onClick={e => e.stopPropagation()}>
        <div className="replay-header">
          <h3 className="replay-title">Play-by-Play Recap</h3>
          <button className="replay-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="replay-board">
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <div key={rowIndex} className="replay-row">
              {Array.from({ length: 10 }).map((_, colIndex) => {
                const cellKey = `${rowIndex},${colIndex}`;
                const chipTeam = displayBoard[rowIndex][colIndex];
                const isActive = activeCell && activeCell[0] === rowIndex && activeCell[1] === colIndex;
                const isWinCell = showWinHighlight && winningCells.has(cellKey);
                const isCornerCell = isCorner(rowIndex, colIndex);

                return (
                  <div
                    key={cellKey}
                    className={`replay-cell${isActive ? ' replay-cell-active' : ''}${isWinCell ? ' replay-cell-win' : ''}${isCornerCell ? ' replay-cell-corner' : ''}`}
                  >
                    {chipTeam !== null && chipTeam !== undefined && (
                      <div
                        className={`replay-chip${isActive ? ' replay-chip-pulse' : ''}${isWinCell ? ' replay-chip-glow' : ''}`}
                        style={{
                          backgroundColor: getTeamColorHex(teamColors[chipTeam]),
                          ...(isWinCell ? { boxShadow: `0 0 8px ${getTeamColorHex(teamColors[chipTeam])}, 0 0 16px ${getTeamColorHex(teamColors[chipTeam])}60` } : {}),
                        }}
                      >
                        {getTeamLetter(teamColors[chipTeam])}
                      </div>
                    )}
                    {isCornerCell && chipTeam === null && (
                      <span className="replay-corner-star">&#9733;</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="replay-caption">
          <span className="replay-caption-text">{caption}</span>
          {currentStep >= 0 && currentStep < replayEvents.length && (
            <span className="replay-step-indicator">
              {currentStep + 1} / {replayEvents.length}
            </span>
          )}
        </div>

        <div className="replay-progress">
          <div
            className="replay-progress-bar"
            style={{
              width: `${Math.min(100, ((currentStep + 1) / replayEvents.length) * 100)}%`,
              backgroundColor: getTeamColorHex(winnerColor),
            }}
          />
        </div>

        <div className="replay-controls">
          {!isPlaying && (
            <button className="btn btn-secondary replay-btn" onClick={handleRestart}>
              Replay
            </button>
          )}
          <button className="btn btn-primary replay-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
