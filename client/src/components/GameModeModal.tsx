import './GameModeModal.css';
import type { GameVariant } from '../../../shared/types';

export type GameModeType = 'blitz' | 'speed-sequence' | 'series' | 'king-of-the-board' | 'custom';

interface GameModeInfo {
  title: string;
  icon: string;
  description: string;
  howToPlay: string[];
  tips: string[];
}

const GAME_MODE_INFO: Record<GameModeType, GameModeInfo> = {
  'blitz': {
    title: 'Blitz Mode',
    icon: '⚡',
    description: 'A faster-paced variant where you only need 4 chips in a row instead of 5!',
    howToPlay: [
      'Form a sequence of 4 chips in a row (horizontal, vertical, or diagonal)',
      'Wild corners still count toward your sequences',
      'All other rules remain the same as standard Sequence',
    ],
    tips: [
      'Games finish faster - be aggressive!',
      'Blocking is even more important in Blitz',
      'Corner positions become more valuable',
    ],
  },
  'speed-sequence': {
    title: 'Speed Sequence',
    icon: '🏎️',
    description: 'The ultimate fast-paced experience: Blitz mode with a 15-second turn timer!',
    howToPlay: [
      'Only 15 seconds per turn - think fast!',
      'Form sequences of 4 chips in a row',
      'If time runs out, your turn is skipped',
    ],
    tips: [
      'Plan your next move while opponents play',
      'Keep your phone/tablet awake during play',
      'Trust your instincts - no time for overthinking!',
    ],
  },
  'series': {
    title: 'Series Mode',
    icon: '🏆',
    description: 'Play multiple games to determine the ultimate champion!',
    howToPlay: [
      'Win multiple games to win the series',
      'Best of 3: First to 2 wins',
      'Best of 5: First to 3 wins',
      'Best of 7: First to 4 wins',
    ],
    tips: [
      'Pace yourself - it\'s a marathon, not a sprint',
      'Learn from each game to adapt your strategy',
      'Team composition stays the same throughout',
    ],
  },
  'king-of-the-board': {
    title: 'King of the Board',
    icon: '👑',
    description: 'Normal Sequence rules, but one shared 3x3 king zone turns certain sequences into 2-point swings.',
    howToPlay: [
      'The highlighted 3x3 king zone is the shared hotspot on the board',
      'Normal sequences score 1 point, zone-touching sequences score 2 points',
      'First team to 3 points wins, and the zone moves after every scoring move',
    ],
    tips: [
      'Fight for the hotspot, but don\'t ignore easy 1-point lines elsewhere',
      'One-eyed jacks are brutal when a team is building inside the zone',
      'A double sequence can create a huge score swing in one move',
    ],
  },
  'custom': {
    title: 'Custom Game Mode',
    icon: '⚙️',
    description: 'This game has custom settings that differ from the standard rules.',
    howToPlay: [
      'Check the game settings in the lobby for details',
      'Timer, sequence length, and win conditions may vary',
    ],
    tips: [
      'Make sure everyone understands the settings before starting',
      'Ask the host if you have questions about the rules',
    ],
  },
};

interface GameModeModalProps {
  modes: GameModeType[];
  onAcknowledge: () => void;
  hostName: string;
}

export function GameModeModal({ modes, onAcknowledge, hostName }: GameModeModalProps) {
  // Prioritize showing the most significant mode
  const primaryMode = modes.includes('king-of-the-board')
    ? 'king-of-the-board'
    : modes.includes('speed-sequence')
    ? 'speed-sequence'
    : modes.includes('blitz')
      ? 'blitz'
      : modes.includes('series')
        ? 'series'
        : 'custom';

  const modeInfo = GAME_MODE_INFO[primaryMode];
  const additionalModes = modes.filter(m => m !== primaryMode && m !== 'custom');

  return (
    <div className="game-mode-modal-overlay">
      <div className="game-mode-modal">
        <div className="game-mode-header">
          <span className="game-mode-icon">{modeInfo.icon}</span>
          <h2>{modeInfo.title}</h2>
        </div>

        <div className="game-mode-alert">
          <span className="alert-icon">ℹ️</span>
          <span>{hostName} has selected a special game mode</span>
        </div>

        <p className="game-mode-description">{modeInfo.description}</p>

        <div className="game-mode-section">
          <h3>📋 How to Play</h3>
          <ul>
            {modeInfo.howToPlay.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="game-mode-section">
          <h3>💡 Tips</h3>
          <ul>
            {modeInfo.tips.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Show additional modes if applicable */}
        {additionalModes.length > 0 && (
          <div className="additional-modes">
            <h4>Also enabled:</h4>
            <div className="mode-badges">
              {additionalModes.map(mode => (
                <span key={mode} className="mode-badge">
                  {GAME_MODE_INFO[mode].icon} {GAME_MODE_INFO[mode].title}
                </span>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-primary btn-lg acknowledge-btn" onClick={onAcknowledge}>
          Got it, let's play!
        </button>
      </div>
    </div>
  );
}

// Helper function to determine which modes are active based on settings
export function getActiveModes(settings: {
  sequenceLength: number;
  turnTimeLimit: number;
  seriesLength: number;
  gameVariant: GameVariant;
}): GameModeType[] {
  const modes: GameModeType[] = [];

  if (settings.gameVariant === 'king-of-the-board') {
    modes.push('king-of-the-board');
  } else if (settings.sequenceLength === 4 && settings.turnTimeLimit === 15) {
    modes.push('speed-sequence');
  } else if (settings.sequenceLength === 4) {
    modes.push('blitz');
  }

  if (settings.seriesLength > 0) {
    modes.push('series');
  }

  return modes;
}

// Check if any special modes are active
export function hasSpecialModes(settings: {
  sequenceLength: number;
  turnTimeLimit: number;
  seriesLength: number;
  gameVariant: GameVariant;
}): boolean {
  return settings.gameVariant === 'king-of-the-board' || settings.sequenceLength === 4 || settings.seriesLength > 0;
}
