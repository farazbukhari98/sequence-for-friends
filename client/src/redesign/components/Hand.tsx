import type { CardCode, BoardChips } from '../../../../shared/types';
import {
  getSuitSymbol,
  getRankDisplay,
  parseCard,
  isJack,
  getJackType,
  findCardPositions,
} from '../../../../shared/types';
import './Hand.css';

interface HandProps {
  cards: CardCode[];
  selectedCard: CardCode | null;
  boardChips: BoardChips;
  isMyTurn: boolean;
  deadCardReplacedThisTurn: boolean;
  onCardSelect: (card: CardCode) => void;
  onReplaceDeadCard: (card: CardCode) => void;
}

export function Hand({
  cards,
  selectedCard,
  boardChips,
  isMyTurn,
  deadCardReplacedThisTurn,
  onCardSelect,
  onReplaceDeadCard,
}: HandProps) {
  return (
    <div className="hand-container">
      <div className="hand-scroll">
        <div className="hand">
          {cards.map((card, index) => {
            const isDead = isDeadCard(card, boardChips);
            const isSelected = selectedCard === card;

            return (
              <HandCard
                key={`${card}-${index}`}
                card={card}
                isDead={isDead}
                isSelected={isSelected}
                isMyTurn={isMyTurn}
                canReplaceDead={isDead && isMyTurn && !deadCardReplacedThisTurn}
                onSelect={() => onCardSelect(card)}
                onReplaceDead={() => onReplaceDeadCard(card)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface HandCardProps {
  card: CardCode;
  isDead: boolean;
  isSelected: boolean;
  isMyTurn: boolean;
  canReplaceDead: boolean;
  onSelect: () => void;
  onReplaceDead: () => void;
}

function HandCard({
  card,
  isDead,
  isSelected,
  isMyTurn,
  canReplaceDead,
  onSelect,
  onReplaceDead,
}: HandCardProps) {
  const { rank, suit } = parseCard(card);
  const rankDisplay = getRankDisplay(rank);
  const suitSymbol = getSuitSymbol(suit);
  const isRed = suit === 'H' || suit === 'D';

  const jackType = getJackType(card);
  let jackLabel = '';
  if (jackType === 'two-eyed') {
    jackLabel = 'WILD';
  } else if (jackType === 'one-eyed') {
    jackLabel = 'REMOVE';
  }

  const handleClick = () => {
    if (!isMyTurn) return;
    if (isDead && canReplaceDead) {
      onSelect();
    } else {
      onSelect();
    }
  };

  const triggerHaptic = () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  return (
    <div
      className={`hand-card ${isRed ? 'red' : 'black'} ${isSelected ? 'selected' : ''} ${isDead ? 'dead' : ''} ${!isMyTurn ? 'disabled' : ''}`}
      onClick={() => {
        triggerHaptic();
        handleClick();
      }}
      role="button"
      tabIndex={isMyTurn ? 0 : -1}
      aria-label={`${rankDisplay} of ${suitSymbol}${isDead ? ' (dead card)' : ''}${jackLabel ? ` - ${jackLabel}` : ''}`}
      aria-pressed={isSelected}
    >
      <div className="card-top">
        <span className="card-rank">{rankDisplay}</span>
        <span className="card-suit">{suitSymbol}</span>
      </div>

      <div className="card-center">
        <span className="card-suit-large">{suitSymbol}</span>
      </div>

      <div className="card-bottom">
        <span className="card-rank">{rankDisplay}</span>
        <span className="card-suit">{suitSymbol}</span>
      </div>

      {jackLabel && (
        <div className={`jack-label ${jackType}`}>
          {jackLabel}
        </div>
      )}

      {isDead && (
        <div className="dead-badge">
          DEAD
          {canReplaceDead && (
            <button
              className="replace-btn"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic();
                onReplaceDead();
              }}
            >
              Replace
            </button>
          )}
        </div>
      )}

      {isSelected && <div className="selected-indicator">✓</div>}
    </div>
  );
}

function isDeadCard(card: CardCode, boardChips: BoardChips): boolean {
  if (isJack(card)) return false;
  const positions = findCardPositions(card);
  return positions.every(([row, col]) => boardChips[row][col] !== null);
}
