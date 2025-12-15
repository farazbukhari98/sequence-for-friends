import { useState, useMemo, useCallback, useEffect } from 'react';
import type {
  ClientGameState,
  CardCode,
  GameAction,
  MoveResult,
  CutCard,
  TeamColor,
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
import './GameScreen.css';

interface GameScreenProps {
  gameState: ClientGameState;
  playerId: string;
  cutCards: CutCard[] | null;
  onAction: (action: GameAction) => Promise<MoveResult>;
  onLeave: () => void;
}

type GameStep = 'select-card' | 'select-target' | 'confirm' | 'draw';

export function GameScreen({
  gameState,
  playerId,
  cutCards,
  onAction,
  onLeave,
}: GameScreenProps) {
  const [selectedCard, setSelectedCard] = useState<CardCode | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCutCards, setShowCutCards] = useState(!!cutCards);

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

      {/* Cut Cards Modal */}
      {showCutCards && cutCards && (
        <CutCardsModal
          cutCards={cutCards}
          dealerIndex={gameState.dealerIndex}
          players={gameState.players}
          onDismiss={() => setShowCutCards(false)}
        />
      )}

      {/* Winner Modal */}
      {gameState.winnerTeamIndex !== null && (
        <WinnerModal
          winnerTeamIndex={gameState.winnerTeamIndex}
          teamColors={gameState.config.teamColors}
          myTeamIndex={myPlayer?.teamIndex ?? -1}
          onLeave={onLeave}
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

// Winner Modal
interface WinnerModalProps {
  winnerTeamIndex: number;
  teamColors: TeamColor[];
  myTeamIndex: number;
  onLeave: () => void;
}

function WinnerModal({ winnerTeamIndex, teamColors, myTeamIndex, onLeave }: WinnerModalProps) {
  const isWinner = winnerTeamIndex === myTeamIndex;
  const winnerColor = teamColors[winnerTeamIndex];

  return (
    <div className="modal-overlay">
      <div className="modal-content winner-modal">
        <div
          className="winner-icon"
          style={{ backgroundColor: getTeamColorHex(winnerColor) }}
        >
          {isWinner ? '🏆' : getTeamLetter(winnerColor)}
        </div>
        <h2>{isWinner ? 'You Win!' : `Team ${winnerColor.toUpperCase()} Wins!`}</h2>
        <p>{isWinner ? 'Congratulations!' : 'Better luck next time!'}</p>
        <button className="btn btn-primary btn-lg" onClick={onLeave}>
          Back to Home
        </button>
      </div>
    </div>
  );
}
