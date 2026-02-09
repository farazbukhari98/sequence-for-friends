import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type {
  ClientGameState,
  CardCode,
  GameAction,
  MoveResult,
  CutCard,
  TeamColor,
  SequenceLine,
  PublicPlayer,
  RoomInfo,
  SeriesState,
} from '../../../shared/types';
import {
  findCardPositions,
  isCorner,
  getJackType,
  getTeamColorHex,
  getTeamLetter,
} from '../../../shared/types';
import { usePinchZoom } from '../hooks/usePinchZoom';
import { Board } from './Board';
import { Hand } from './Hand';
import { TurnTimer } from './TurnTimer';
import './GameScreen.css';

interface GameScreenProps {
  gameState: ClientGameState;
  playerId: string;
  cutCards: CutCard[] | null;
  turnTimeoutInfo: { playerIndex: number; playerName: string } | null;
  roomInfo: RoomInfo | null;
  onAction: (action: GameAction) => Promise<MoveResult>;
  onLeave: () => void;
  onContinueSeries: () => Promise<{ success: boolean; error?: string }>;
  onEndSeries: () => Promise<{ success: boolean; error?: string }>;
  onReturnToLobby: () => void;
}

type GameStep = 'select-card' | 'select-target' | 'confirm' | 'draw';

// Track new sequences for celebration
interface SequenceCelebration {
  teamIndex: number;
  teamColor: TeamColor;
  playerNames: string[];
}

export function GameScreen({
  gameState,
  playerId,
  cutCards,
  turnTimeoutInfo,
  roomInfo,
  onAction,
  onLeave,
  onContinueSeries,
  onEndSeries,
  onReturnToLobby,
}: GameScreenProps) {
  const [selectedCard, setSelectedCard] = useState<CardCode | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCutCards, setShowCutCards] = useState(!!cutCards);
  const [sequenceCelebration, setSequenceCelebration] = useState<SequenceCelebration | null>(null);

  // Track previous sequence count to detect new sequences
  const prevSequenceCountRef = useRef<number[]>([...gameState.sequencesCompleted]);

  const { containerRef, contentRef, isZoomed, resetTransform } = usePinchZoom();

  // Determine current player info
  const myPlayer = gameState.players.find(p => p.id === playerId);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const myTeamColor = myPlayer?.teamColor || 'blue';

  // Determine current step
  const step: GameStep = useMemo(() => {
    if (gameState.pendingDraw) return 'draw';
    if (selectedTarget) return 'confirm';
    if (selectedCard) return 'select-target';
    return 'select-card';
  }, [gameState.pendingDraw, selectedCard, selectedTarget]);

  // Calculate highlighted cells based on selected card
  const highlightedCells = useMemo(() => {
    const cells = new Set<string>();
    if (!selectedCard || !isMyTurn || gameState.pendingDraw) return cells;

    const jackType = getJackType(selectedCard);

    if (jackType === 'two-eyed') {
      // Highlight all empty cells (except corners)
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          if (isCorner(row, col)) continue;
          if (gameState.boardChips[row][col] !== null) continue;
          // Can't place on cell removed this turn
          if (gameState.lastRemovedCell &&
              gameState.lastRemovedCell[0] === row &&
              gameState.lastRemovedCell[1] === col) continue;
          cells.add(`${row},${col}`);
        }
      }
    } else if (jackType === 'one-eyed') {
      // Highlight opponent chips that can be removed
      const myTeamIndex = myPlayer?.teamIndex ?? -1;
      const lockedSet = new Set<string>();
      gameState.lockedCells.forEach((teamCells) => {
        teamCells.forEach((cell) => lockedSet.add(cell));
      });

      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          if (isCorner(row, col)) continue;
          const chip = gameState.boardChips[row][col];
          if (chip === null) continue;
          if (chip === myTeamIndex) continue;
          if (lockedSet.has(`${row},${col}`)) continue;
          cells.add(`${row},${col}`);
        }
      }
    } else {
      // Normal card - find matching empty positions
      const positions = findCardPositions(selectedCard);
      for (const [row, col] of positions) {
        if (gameState.boardChips[row][col] === null) {
          cells.add(`${row},${col}`);
        }
      }
    }

    return cells;
  }, [selectedCard, isMyTurn, gameState.pendingDraw, gameState.boardChips, gameState.lockedCells, gameState.lastRemovedCell, myPlayer?.teamIndex]);

  // Handle card selection
  const handleCardSelect = useCallback((card: CardCode) => {
    if (!isMyTurn || gameState.pendingDraw) return;

    if (selectedCard === card) {
      // Deselect
      setSelectedCard(null);
      setSelectedTarget(null);
    } else {
      setSelectedCard(card);
      setSelectedTarget(null);
    }

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, [selectedCard, isMyTurn, gameState.pendingDraw]);

  // Handle cell click
  const handleCellClick = useCallback((row: number, col: number) => {
    if (!isMyTurn || gameState.pendingDraw) return;

    const cellKey = `${row},${col}`;
    if (!highlightedCells.has(cellKey)) return;

    setSelectedTarget([row, col]);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([10, 50, 10]);
    }
  }, [isMyTurn, gameState.pendingDraw, highlightedCells]);

  // Handle confirm action
  const handleConfirm = useCallback(async () => {
    if (!selectedCard || !selectedTarget || loading) return;

    setLoading(true);

    const jackType = getJackType(selectedCard);
    let actionType: 'play-normal' | 'play-two-eyed' | 'play-one-eyed';

    if (jackType === 'two-eyed') {
      actionType = 'play-two-eyed';
    } else if (jackType === 'one-eyed') {
      actionType = 'play-one-eyed';
    } else {
      actionType = 'play-normal';
    }

    const action: GameAction = {
      type: actionType,
      card: selectedCard,
      targetRow: selectedTarget[0],
      targetCol: selectedTarget[1],
    };

    const result = await onAction(action);
    setLoading(false);

    if (result.success) {
      setSelectedCard(null);
      setSelectedTarget(null);
      // Haptic feedback for success
      if (navigator.vibrate) {
        navigator.vibrate([20, 30, 20]);
      }
    }
  }, [selectedCard, selectedTarget, loading, onAction]);

  // Handle draw card
  const handleDraw = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    const result = await onAction({ type: 'draw' });
    setLoading(false);

    if (result.success && navigator.vibrate) {
      navigator.vibrate(15);
    }
  }, [loading, onAction]);

  // Handle dead card replacement
  const handleReplaceDeadCard = useCallback(async (card: CardCode) => {
    if (loading) return;

    setLoading(true);
    const result = await onAction({ type: 'replace-dead', card });
    setLoading(false);

    if (result.success) {
      setSelectedCard(null);
      if (navigator.vibrate) {
        navigator.vibrate(15);
      }
    }
  }, [loading, onAction]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setSelectedTarget(null);
  }, []);

  // Determine if preview is a removal
  const isRemovalPreview = selectedCard ? getJackType(selectedCard) === 'one-eyed' : false;

  // Auto-dismiss cut cards after viewing
  useEffect(() => {
    if (showCutCards && cutCards) {
      const timer = setTimeout(() => {
        setShowCutCards(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showCutCards, cutCards]);

  // Detect new sequences and trigger celebration
  useEffect(() => {
    const prevCounts = prevSequenceCountRef.current;
    const currentCounts = gameState.sequencesCompleted;

    // Check if any team got a new sequence
    for (let i = 0; i < currentCounts.length; i++) {
      const prevCount = prevCounts[i] || 0;
      const currentCount = currentCounts[i] || 0;

      if (currentCount > prevCount) {
        // New sequence detected!
        const teamColor = gameState.config.teamColors[i];
        const teamPlayers = gameState.players
          .filter(p => p.teamIndex === i)
          .map(p => p.name);

        setSequenceCelebration({
          teamIndex: i,
          teamColor,
          playerNames: teamPlayers,
        });

        // Haptic feedback for sequence
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100, 50, 200]);
        }

        break;
      }
    }

    // Update ref for next comparison
    prevSequenceCountRef.current = [...currentCounts];
  }, [gameState.sequencesCompleted, gameState.config.teamColors, gameState.players]);

  // Auto-dismiss sequence celebration
  useEffect(() => {
    if (sequenceCelebration) {
      const timer = setTimeout(() => {
        setSequenceCelebration(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [sequenceCelebration]);

  return (
    <div className="game-screen">
      {/* Header */}
      <header className="game-header">
        <div className="game-header-left">
          <button className="menu-btn" onClick={onLeave}>
            ✕
          </button>
        </div>

        <div className="game-header-center">
          <div className="turn-indicator-wrapper">
            <div className="turn-indicator">
              {gameState.winnerTeamIndex !== null ? (
                <span className="winner-text">
                  Team {gameState.config.teamColors[gameState.winnerTeamIndex].toUpperCase()} Wins!
                </span>
              ) : isMyTurn ? (
                <span className="your-turn">Your Turn</span>
              ) : (
                <span className="waiting-turn">{currentPlayer?.name}'s Turn</span>
              )}
            </div>
            {gameState.turnTimeLimit > 0 && gameState.winnerTeamIndex === null && (
              <TurnTimer
                turnTimeLimit={gameState.turnTimeLimit}
                turnStartedAt={gameState.turnStartedAt}
                isMyTurn={isMyTurn}
              />
            )}
          </div>
        </div>

        <div className="game-header-right">
          <ScoreDisplay
            teamColors={gameState.config.teamColors}
            sequencesCompleted={gameState.sequencesCompleted}
            sequencesToWin={gameState.config.sequencesToWin}
          />
        </div>
      </header>

      {/* Board Container */}
      <div className="board-container" ref={containerRef}>
        <div className="board-wrapper" ref={contentRef}>
          <Board
            boardChips={gameState.boardChips}
            highlightedCells={highlightedCells}
            previewCell={selectedTarget}
            previewTeamColor={myTeamColor}
            previewIsRemoval={isRemovalPreview}
            lockedCells={gameState.lockedCells}
            completedSequences={gameState.completedSequences}
            teamColors={gameState.config.teamColors}
            onCellClick={handleCellClick}
          />
        </div>

        {/* Reset zoom button */}
        {isZoomed && (
          <button className="reset-zoom-btn" onClick={resetTransform}>
            Reset View
          </button>
        )}
      </div>

      {/* Action Bar */}
      <div className="action-bar">
        {step === 'confirm' && selectedTarget && (
          <div className="confirm-actions">
            <button className="btn btn-secondary" onClick={handleCancel} disabled={loading}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Placing...' : isRemovalPreview ? 'Remove Chip' : 'Place Chip'}
            </button>
          </div>
        )}

        {step === 'draw' && isMyTurn && (
          <button
            className="btn btn-primary btn-lg draw-btn"
            onClick={handleDraw}
            disabled={loading}
          >
            {loading ? 'Drawing...' : 'Draw Card'}
          </button>
        )}

        {step === 'select-card' && isMyTurn && (
          <div className="step-hint">
            Tap a card to play
          </div>
        )}

        {step === 'select-target' && (
          <div className="step-hint">
            Tap a highlighted cell
          </div>
        )}

        {!isMyTurn && gameState.winnerTeamIndex === null && (
          <div className="step-hint waiting">
            Waiting for {currentPlayer?.name}...
          </div>
        )}
      </div>

      {/* Hand */}
      <Hand
        cards={gameState.myHand}
        selectedCard={selectedCard}
        boardChips={gameState.boardChips}
        isMyTurn={isMyTurn}
        deadCardReplacedThisTurn={gameState.deadCardReplacedThisTurn}
        onCardSelect={handleCardSelect}
        onReplaceDeadCard={handleReplaceDeadCard}
      />

      {/* Turn Timeout Notification */}
      {turnTimeoutInfo && (
        <div className="timeout-notification">
          <span className="timeout-icon">⏰</span>
          <span className="timeout-text">{turnTimeoutInfo.playerName}'s turn timed out</span>
        </div>
      )}

      {/* Cut Cards Modal */}
      {showCutCards && cutCards && (
        <CutCardsModal
          cutCards={cutCards}
          dealerIndex={gameState.dealerIndex}
          players={gameState.players}
          onDismiss={() => setShowCutCards(false)}
        />
      )}

      {/* Sequence Celebration Modal */}
      {sequenceCelebration && gameState.winnerTeamIndex === null && (
        <SequenceCelebrationModal
          teamColor={sequenceCelebration.teamColor}
          playerNames={sequenceCelebration.playerNames}
          sequenceLength={gameState.config.sequenceLength}
          onDismiss={() => setSequenceCelebration(null)}
        />
      )}

      {/* Winner Modal */}
      {gameState.winnerTeamIndex !== null && (
        <WinnerModal
          completedSequences={gameState.completedSequences}
          winnerTeamIndex={gameState.winnerTeamIndex}
          teamColors={gameState.config.teamColors}
          players={gameState.players}
          myTeamIndex={myPlayer?.teamIndex ?? -1}
          seriesState={roomInfo?.seriesState ?? null}
          isHost={roomInfo?.hostId === playerId}
          onLeave={onLeave}
          onContinueSeries={onContinueSeries}
          onEndSeries={onEndSeries}
          onReturnToLobby={onReturnToLobby}
        />
      )}
    </div>
  );
}

// Score Display Component
interface ScoreDisplayProps {
  teamColors: TeamColor[];
  sequencesCompleted: number[];
  sequencesToWin: number;
}

function ScoreDisplay({ teamColors, sequencesCompleted, sequencesToWin }: ScoreDisplayProps) {
  return (
    <div className="score-display">
      {teamColors.map((color, index) => (
        <div key={color} className="score-item">
          <div
            className="score-chip"
            style={{ backgroundColor: getTeamColorHex(color) }}
          >
            {getTeamLetter(color)}
          </div>
          <span className="score-value">
            {sequencesCompleted[index] || 0}/{sequencesToWin}
          </span>
        </div>
      ))}
    </div>
  );
}

// Cut Cards Modal
interface CutCardsModalProps {
  cutCards: CutCard[];
  dealerIndex: number;
  players: { id: string; name: string }[];
  onDismiss: () => void;
}

function CutCardsModal({ cutCards, dealerIndex, players, onDismiss }: CutCardsModalProps) {
  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal-content cut-cards-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Cutting for Deal</h2>
        <div className="cut-cards-list">
          {cutCards.map((cut, index) => {
            const player = players.find(p => p.id === cut.playerId);
            const isDealer = index === dealerIndex;
            return (
              <div key={cut.playerId} className={`cut-card-item ${isDealer ? 'dealer' : ''}`}>
                <span className="cut-player-name">{player?.name || 'Player'}</span>
                <span className="cut-card-value">{cut.card}</span>
                {isDealer && <span className="dealer-badge">Dealer</span>}
              </div>
            );
          })}
        </div>
        <p className="cut-info">Lowest card deals. Play starts to their left.</p>
        <button className="btn btn-primary" onClick={onDismiss}>
          Got it!
        </button>
      </div>
    </div>
  );
}

// Sequence Celebration Modal
interface SequenceCelebrationModalProps {
  teamColor: TeamColor;
  playerNames: string[];
  sequenceLength: number;
  onDismiss: () => void;
}

function SequenceCelebrationModal({ teamColor, playerNames, sequenceLength, onDismiss }: SequenceCelebrationModalProps) {
  return (
    <div className="modal-overlay celebration-overlay" onClick={onDismiss}>
      <div className="modal-content sequence-celebration-modal" onClick={(e) => e.stopPropagation()}>
        {/* Confetti effect */}
        <div className="confetti-container">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: i % 3 === 0 ? getTeamColorHex(teamColor) : i % 3 === 1 ? '#FFD700' : '#ffffff',
              }}
            />
          ))}
        </div>

        <div
          className="sequence-celebration-icon"
          style={{ backgroundColor: getTeamColorHex(teamColor) }}
        >
          <span className="sequence-star">★</span>
        </div>

        <h2 className="sequence-celebration-title">SEQUENCE!</h2>

        <div className="sequence-celebration-team">
          Team {teamColor.toUpperCase()}
        </div>

        <div className="sequence-celebration-players">
          {playerNames.join(' & ')}
        </div>

        <div className="sequence-celebration-subtitle">
          scored a {sequenceLength}-chip sequence!
        </div>
      </div>
    </div>
  );
}

// Sequence Recap Board for Winner Modal
interface SequenceRecapBoardProps {
  completedSequences: SequenceLine[];
  winnerTeamIndex: number;
  teamColor: TeamColor;
}

function SequenceRecapBoard({ completedSequences, winnerTeamIndex, teamColor }: SequenceRecapBoardProps) {
  // Filter to only winning team's sequences
  const winningSequences = useMemo(() => 
    completedSequences.filter(seq => seq.teamIndex === winnerTeamIndex),
    [completedSequences, winnerTeamIndex]
  );

  // Build a map of cells that are part of winning sequences (cellKey -> sequence index)
  const winningCells = useMemo(() => {
    const cells = new Map<string, number>();
    winningSequences.forEach((seq, seqIndex) => {
      seq.cells.forEach(([row, col]) => {
        const key = `${row},${col}`;
        if (!cells.has(key)) {
          cells.set(key, seqIndex);
        }
      });
    });
    return cells;
  }, [winningSequences]);

  return (
    <div className="sequence-recap-section">
      <h3 className="sequence-recap-title">Winning Sequences</h3>
      <div className="sequence-recap-board">
        {Array.from({ length: 10 }).map((_, rowIndex) => (
          <div key={rowIndex} className="sequence-recap-row">
            {Array.from({ length: 10 }).map((_, colIndex) => {
              const cellKey = `${rowIndex},${colIndex}`;
              const isWinningCell = winningCells.has(cellKey);
              const seqIndex = winningCells.get(cellKey) ?? 0;
              const isCornerCell = isCorner(rowIndex, colIndex);

              return (
                <div
                  key={cellKey}
                  className={`sequence-recap-cell ${isWinningCell ? 'winning' : ''} ${isCornerCell ? 'corner' : ''}`}
                  style={isWinningCell ? { animationDelay: `${seqIndex * 0.3}s` } : undefined}
                >
                  {isWinningCell && (
                    <div
                      className="sequence-recap-chip"
                      style={{
                        backgroundColor: getTeamColorHex(teamColor),
                        animationDelay: `${seqIndex * 0.3}s`,
                      }}
                    >
                      {getTeamLetter(teamColor)}
                    </div>
                  )}
                  {isCornerCell && !isWinningCell && (
                    <span className="sequence-recap-corner">★</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="sequence-recap-count">
        {winningSequences.length} sequence{winningSequences.length !== 1 ? 's' : ''} completed
      </p>
    </div>
  );
}

// Winner Modal
interface WinnerModalProps {
  completedSequences: SequenceLine[];
  winnerTeamIndex: number;
  teamColors: TeamColor[];
  players: PublicPlayer[];
  myTeamIndex: number;
  seriesState: SeriesState | null;
  isHost: boolean;
  onLeave: () => void;
  onContinueSeries: () => Promise<{ success: boolean; error?: string }>;
  onEndSeries: () => Promise<{ success: boolean; error?: string }>;
  onReturnToLobby: () => void;
}

function WinnerModal({
  completedSequences, winnerTeamIndex, teamColors, players, myTeamIndex,
  seriesState, isHost, onLeave, onContinueSeries, onEndSeries, onReturnToLobby,
}: WinnerModalProps) {
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const isWinner = winnerTeamIndex === myTeamIndex;
  const winnerColor = teamColors[winnerTeamIndex];
  const winningPlayers = players.filter(p => p.teamIndex === winnerTeamIndex);

  const isSeries = seriesState !== null;
  const isSeriesOver = seriesState?.seriesWinnerTeamIndex != null;

  // Project the score: seriesState.teamWins doesn't include this game's result yet
  // (it gets recorded when host calls continue-series). In State C (series over),
  // the server has already recorded the win, so teamWins is accurate.
  const displayWins = seriesState
    ? seriesState.teamWins.map((wins, i) =>
        !isSeriesOver && i === winnerTeamIndex ? wins + 1 : wins
      )
    : [];
  const displayGamesPlayed = seriesState
    ? (isSeriesOver ? seriesState.gamesPlayed : seriesState.gamesPlayed + 1)
    : 0;

  // Auto-continue series: countdown then host auto-starts the next game
  useEffect(() => {
    if (!isSeries || isSeriesOver || loading) return;

    if (countdown <= 0) {
      if (isHost) {
        setLoading(true);
        onContinueSeries().finally(() => setLoading(false));
      }
      return;
    }

    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [isSeries, isSeriesOver, countdown, isHost, loading, onContinueSeries]);

  const handleEndSeries = async () => {
    setLoading(true);
    await onEndSeries();
    setLoading(false);
  };

  return (
    <div className="modal-overlay winner-overlay">
      {/* Confetti effect */}
      <div className="confetti-container winner-confetti">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="confetti winner-confetti-piece"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 1}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
              backgroundColor: i % 4 === 0 ? getTeamColorHex(winnerColor) : i % 4 === 1 ? '#FFD700' : i % 4 === 2 ? '#ffffff' : '#FF69B4',
            }}
          />
        ))}
      </div>

      <div className="modal-content winner-modal">
        <div
          className="winner-icon"
          style={{
            backgroundColor: getTeamColorHex(winnerColor),
            boxShadow: `0 0 30px ${getTeamColorHex(winnerColor)}, 0 0 60px ${getTeamColorHex(winnerColor)}50`
          }}
        >
          {isSeriesOver ? '🏆' : isWinner ? '🏆' : '🎉'}
        </div>

        <h2 className="winner-title">
          {isSeriesOver ? 'Series Complete!' : isWinner ? 'Victory!' : 'Game Over!'}
        </h2>

        <div
          className="winner-team-badge"
          style={{ backgroundColor: `${getTeamColorHex(winnerColor)}30`, borderColor: getTeamColorHex(winnerColor) }}
        >
          <span className="winner-team-letter" style={{ color: getTeamColorHex(winnerColor) }}>
            {getTeamLetter(winnerColor)}
          </span>
          {isSeriesOver
            ? `Team ${winnerColor.toUpperCase()} wins the series!`
            : `Team ${winnerColor.toUpperCase()} Wins!`}
        </div>

        {/* Series Score */}
        {isSeries && seriesState && (
          <div className="series-score-section">
            {!isSeriesOver && (
              <div className="series-game-label">
                Game {displayGamesPlayed} of {seriesState.seriesLength}
              </div>
            )}
            <div className="series-score-display">
              {teamColors.map((color, index) => (
                <div key={color} className="series-team-score">
                  <div
                    className="series-team-chip"
                    style={{ backgroundColor: getTeamColorHex(color) }}
                  >
                    {getTeamLetter(color)}
                  </div>
                  <span className="series-team-wins">{displayWins[index] ?? 0}</span>
                </div>
              ))}
            </div>
            <div className="series-info">
              {isSeriesOver
                ? `Best of ${seriesState.seriesLength}`
                : `First to ${Math.ceil(seriesState.seriesLength / 2)} wins`}
            </div>
          </div>
        )}

        {/* Sequence Recap */}
        <SequenceRecapBoard
          completedSequences={completedSequences}
          winnerTeamIndex={winnerTeamIndex}
          teamColor={winnerColor}
        />

        <div className="winner-players">
          {winningPlayers.map(p => p.name).join(' & ')}
        </div>

        <p className="winner-message">
          {isSeriesOver
            ? (isWinner ? 'You won the series!' : 'Great series! Better luck next time!')
            : (isWinner ? 'Congratulations on your victory!' : 'Great game! Better luck next time!')}
        </p>

        {/* Buttons */}
        <div className="winner-buttons">
          {!isSeries && (
            <button className="btn btn-primary btn-lg winner-btn" onClick={onLeave}>
              Back to Home
            </button>
          )}

          {isSeries && !isSeriesOver && (
            <>
              <div className="series-next-countdown">
                {loading
                  ? 'Starting next game...'
                  : `Next game in ${countdown}...`}
              </div>
              {isHost && (
                <button
                  className="btn btn-secondary winner-btn-secondary"
                  onClick={handleEndSeries}
                  disabled={loading}
                >
                  End Series
                </button>
              )}
            </>
          )}

          {isSeries && isSeriesOver && (
            <button className="btn btn-primary btn-lg winner-btn" onClick={onReturnToLobby}>
              Back to Lobby
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
