// ============================================
// CARD TYPES
// ============================================

export type Suit = 'S' | 'H' | 'D' | 'C'; // Spades, Hearts, Diamonds, Clubs
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

// Card code format: "9D" = 9 of Diamonds, "AS" = Ace of Spades, "TH" = 10 of Hearts
export type CardCode = `${Rank}${Suit}`;

// Special board cell for wild corners
export type BoardCell = CardCode | 'W';

// Jack types for special abilities
export type JackType = 'two-eyed' | 'one-eyed';

// Two-eyed jacks (wild - place anywhere): J♦ (JD), J♣ (JC)
// One-eyed jacks (remove opponent chip): J♥ (JH), J♠ (JS)
export const TWO_EYED_JACKS: CardCode[] = ['JD', 'JC'];
export const ONE_EYED_JACKS: CardCode[] = ['JH', 'JS'];

export function getJackType(card: CardCode): JackType | null {
  if (TWO_EYED_JACKS.includes(card)) return 'two-eyed';
  if (ONE_EYED_JACKS.includes(card)) return 'one-eyed';
  return null;
}

export function isJack(card: CardCode): boolean {
  return card.startsWith('J');
}

// ============================================
// BOARD LAYOUT (10x10)
// ============================================

// Official Sequence board layout
// "W" = Wild corner (counts for all teams)
// Card codes: rank + suit (e.g., "9D", "AS", "TH")
export const BOARD_LAYOUT: BoardCell[][] = [
  ['W',  '2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S', 'W' ],
  ['6C', '5C', '4C', '3C', '2C', 'AH', 'KH', 'QH', 'TH', 'TS'],
  ['7C', 'AS', '2D', '3D', '4D', '5D', '6D', '7D', '9H', 'QS'],
  ['8C', 'KS', '6C', '5C', '4C', '3C', '2C', '8D', '8H', 'KS'],
  ['9C', 'QS', '7C', '6H', '5H', '4H', 'AH', '9D', '7H', 'AS'],
  ['TC', 'TS', '8C', '7H', '2H', '3H', 'KH', 'TD', '6H', '2D'],
  ['QC', '9S', '9C', '8H', '9H', 'TH', 'QH', 'QD', '5H', '3D'],
  ['KC', '8S', 'TC', 'QC', 'KC', 'AC', 'AD', 'KD', '4H', '4D'],
  ['AC', '7S', '6S', '5S', '4S', '3S', '2S', '2H', '3H', '5D'],
  ['W',  'AD', 'KD', 'QD', 'TD', '9D', '8D', '7D', '6D', 'W' ],
];

// Corner positions (wild cells)
export const CORNER_POSITIONS: [number, number][] = [
  [0, 0], [0, 9], [9, 0], [9, 9]
];

export function isCorner(row: number, col: number): boolean {
  return CORNER_POSITIONS.some(([r, c]) => r === row && c === col);
}

// Find all positions where a card appears on the board
export function findCardPositions(card: CardCode): [number, number][] {
  const positions: [number, number][] = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      if (BOARD_LAYOUT[row][col] === card) {
        positions.push([row, col]);
      }
    }
  }
  return positions;
}

// ============================================
// BOT TYPES
// ============================================

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'impossible';

// Bot names are defined in server/src/bot.ts to avoid stale compiled JS issues

// ============================================
// TEAM & PLAYER TYPES
// ============================================

export type TeamColor = 'blue' | 'green' | 'red';

export const TEAM_COLORS_2: TeamColor[] = ['blue', 'green'];
export const TEAM_COLORS_3: TeamColor[] = ['blue', 'green', 'red'];

export interface Player {
  id: string;
  name: string;
  token: string; // For reconnection
  userId?: string; // Authenticated user ID (from D1)
  seatIndex: number;
  teamIndex: number;
  teamColor: TeamColor;
  connected: boolean;
  ready: boolean; // Ready to start the game
  hand: CardCode[]; // Only visible to this player on client
  discardPile: CardCode[]; // Top card visible to all
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
}

// Public player info (what others can see)
export interface PublicPlayer {
  id: string;
  name: string;
  seatIndex: number;
  teamIndex: number;
  teamColor: TeamColor;
  connected: boolean;
  ready: boolean;
  handCount: number;
  topDiscard: CardCode | null;
  discardCount: number;
  isBot?: boolean;
}

// ============================================
// GAME STATE TYPES
// ============================================

// Chip on board: team index or null (empty)
export type ChipState = number | null;

// Board chips: 10x10 grid of team indices
export type BoardChips = ChipState[][];

// Locked cells per team (cells that are part of completed sequences)
export type LockedCells = Set<string>; // "row,col" format

export interface SequenceLine {
  cells: [number, number][];
  teamIndex: number;
}

export type GameVariant = 'classic' | 'king-of-the-board';

export const DEFAULT_GAME_VARIANT: GameVariant = 'classic';
export const KING_OF_THE_BOARD_SCORE_TO_WIN = 3;

export interface KingZone {
  id: string;
  center: [number, number];
  cells: [number, number][];
}

export type GamePhase = 'lobby' | 'cutting' | 'playing' | 'finished';

// ============================================
// TURN TIME LIMIT
// ============================================

export type TurnTimeLimit = 0 | 15 | 20 | 30 | 45 | 60 | 90 | 120; // 0 = no limit, values in seconds

export const TURN_TIME_OPTIONS: { value: TurnTimeLimit; label: string }[] = [
  { value: 0, label: 'None' },
  { value: 15, label: '15s' },
  { value: 20, label: '20s' },
  { value: 30, label: '30s' },
  { value: 45, label: '45s' },
  { value: 60, label: '60s' },
  { value: 90, label: '90s' },
  { value: 120, label: '2min' },
];

// ============================================
// SEQUENCES TO WIN
// ============================================

export type SequencesToWin = 1 | 2 | 3 | 4;

export const SEQUENCES_TO_WIN_OPTIONS: { value: SequencesToWin; label: string }[] = [
  { value: 1, label: '1 sequence' },
  { value: 2, label: '2 sequences' },
  { value: 3, label: '3 sequences' },
  { value: 4, label: '4 sequences' },
];

export const DEFAULT_SEQUENCES_TO_WIN: SequencesToWin = 2;

// ============================================
// SEQUENCE LENGTH (BLITZ MODE)
// ============================================

export type SequenceLength = 4 | 5;

export const SEQUENCE_LENGTH_OPTIONS: { value: SequenceLength; label: string }[] = [
  { value: 5, label: 'Standard (5 in a row)' },
  { value: 4, label: 'Blitz (4 in a row)' },
];

export const DEFAULT_SEQUENCE_LENGTH: SequenceLength = 5;

// ============================================
// SERIES MODE (Best of 3, 5, etc.)
// ============================================

export type SeriesLength = 0 | 3 | 5 | 7; // 0 = single game, 3 = best of 3, etc.

export const SERIES_LENGTH_OPTIONS: { value: SeriesLength; label: string }[] = [
  { value: 0, label: 'Single Game' },
  { value: 3, label: 'Best of 3' },
  { value: 5, label: 'Best of 5' },
  { value: 7, label: 'Best of 7' },
];

export const DEFAULT_SERIES_LENGTH: SeriesLength = 0;

export interface SeriesState {
  seriesLength: SeriesLength; // 3 = best of 3
  seriesId: string;
  gamesPlayed: number;
  teamWins: number[]; // Wins per team index
  seriesWinnerTeamIndex: number | null;
  seriesStatsPersisted?: boolean;
}

// ============================================
// GAME EVENTS (ACTIVITY LOG)
// ============================================

export type GameEventType = 'play' | 'remove' | 'sequence' | 'dead_card' | 'timeout' | 'win' | 'card-replaced' | 'chip-removed' | 'chip-placed' | 'sequence-completed';

export interface GameEvent {
  id: string;
  timestamp: number;
  type: GameEventType;
  playerId?: string;
  playerName?: string;
  teamIndex?: number;
  teamColor?: TeamColor;
  card?: CardCode;
  position?: [number, number];
  targetTeamIndex?: number;
  sequenceCount?: number;
  pointsAwarded?: number;
  totalScore?: number;
  usedKingZone?: boolean;
}

// ============================================
// STALEMATE DETECTION
// ============================================

export interface StalemateResult {
  isStalemate: boolean;
  winnerTeamIndex?: number;
  reason?: 'highest_count' | 'first_to_reach';
  scoreCounts?: number[];
}

export interface GameConfig {
  playerCount: number;
  teamCount: number; // 2 or 3
  teamColors: TeamColor[];
  gameVariant: GameVariant;
  sequencesToWin: number; // configurable: 2, 3, or 4
  scoreToWin: number;
  sequenceLength: SequenceLength; // 4 for Blitz, 5 for standard
  handSize: number;
}

// Cards per player based on player count
export const HAND_SIZES: Record<number, number> = {
  2: 7,
  3: 6,
  4: 6,
  6: 5,
  8: 4,
  9: 4,
  10: 3,
  12: 3,
};

export const VALID_PLAYER_COUNTS = [2, 3, 4, 6, 8, 9, 10, 12];

export function getTeamCount(playerCount: number): number {
  // Up to 3 can play individually, more than 3 must be in teams
  if (playerCount <= 3) return playerCount;
  // Must be divisible by 2 or 3, prefer 2 teams
  if (playerCount % 2 === 0) return 2;
  if (playerCount % 3 === 0) return 3;
  return 2; // Fallback
}

export interface CutCard {
  playerId: string;
  card: CardCode;
  rank: number; // Numeric rank for comparison (Ace = 14)
}

export interface GameState {
  phase: GamePhase;
  config: GameConfig;

  // Players
  players: Player[];
  dealerIndex: number;
  currentPlayerIndex: number;

  // Deck
  deck: CardCode[];

  // Board state
  boardChips: BoardChips;
  lockedCells: Map<number, Set<string>>; // teamIndex -> set of "row,col"
  sequencesCompleted: Map<number, number>; // teamIndex -> count
  teamScores: Map<number, number>; // teamIndex -> points
  completedSequences: SequenceLine[]; // All completed sequences
  kingZone: KingZone | null;

  // Turn state
  deadCardReplacedThisTurn: boolean;
  pendingDraw: boolean;
  lastRemovedCell: [number, number] | null; // Can't place here this turn

  // Cut phase
  cutCards: CutCard[];

  // Winner
  winnerTeamIndex: number | null;

  // Last move for display
  lastMove: MoveResult | null;

  // Turn timer
  turnTimeLimit: TurnTimeLimit;
  turnStartedAt: number | null; // Timestamp when current turn started

  // Sequence timestamps for stalemate tie-breaker
  sequenceTimestamps: Map<number, number[]>; // teamIndex -> [timestamp for seq 1, seq 2, ...]
  scoreTimestamps: Map<number, number[]>; // teamIndex -> [timestamp for point 1, point 2, ...]

  // Activity log
  eventLog: GameEvent[];

  // Track who went first (for stats)
  firstPlayerId: string | null;
}

// ============================================
// ROOM TYPES
// ============================================

export type RoomPhase = 'waiting' | 'in-game';

export interface Room {
  code: string;
  name: string; // Room name displayed to players
  hostId: string;
  phase: RoomPhase;
  players: Player[];
  maxPlayers: number;
  teamCount: number;
  gameVariant: GameVariant;
  turnTimeLimit: TurnTimeLimit;
  sequencesToWin: SequencesToWin; // configurable: 2, 3, or 4
  sequenceLength: SequenceLength; // 4 for Blitz, 5 for standard
  seriesLength: SeriesLength; // 0 = single game, 3 = best of 3, etc.
  seriesState: SeriesState | null; // Tracks series progress
  gameState: GameState | null;
  createdAt: number;
  lastActivityAt: number; // Track last player activity for auto-cleanup
}

export interface RoomInfo {
  code: string;
  name: string; // Room name displayed to players
  hostId: string;
  phase: RoomPhase;
  players: PublicPlayer[];
  maxPlayers: number;
  teamCount: number;
  gameVariant: GameVariant;
  turnTimeLimit: TurnTimeLimit;
  sequencesToWin: SequencesToWin; // configurable: 2, 3, or 4
  sequenceLength: SequenceLength; // 4 for Blitz, 5 for standard
  seriesLength: SeriesLength; // 0 = single game, 3 = best of 3, etc.
  seriesState: SeriesState | null; // Tracks series progress
}

// ============================================
// ACTION TYPES
// ============================================

export type ActionType =
  | 'play-normal'      // Play a normal card, place chip
  | 'play-two-eyed'    // Play two-eyed jack, place anywhere
  | 'play-one-eyed'    // Play one-eyed jack, remove chip
  | 'replace-dead'     // Replace dead card
  | 'draw';            // Draw card to end turn

export interface PlayAction {
  type: 'play-normal' | 'play-two-eyed' | 'play-one-eyed';
  card: CardCode;
  targetRow: number;
  targetCol: number;
}

export interface ReplaceDeadAction {
  type: 'replace-dead';
  card: CardCode;
}

export interface DrawAction {
  type: 'draw';
}

export type GameAction = PlayAction | ReplaceDeadAction | DrawAction;

export interface MoveResult {
  success: boolean;
  error?: string;
  action?: GameAction;
  playerId?: string;
  newSequences?: SequenceLine[];
  scoring?: {
    pointsAwarded: number;
    totalScore: number;
    usedKingZone: boolean;
    sequenceCount: number;
  };
  gameOver?: boolean;
  winnerTeamIndex?: number;
  stalemate?: StalemateResult; // Added for stalemate detection
}

// ============================================
// SOCKET EVENT TYPES
// ============================================

// Team switch request
export interface TeamSwitchRequest {
  playerId: string;
  playerName: string;
  fromTeamIndex: number;
  toTeamIndex: number;
}

// ============================================
// EMOTES & QUICK MESSAGES
// ============================================

export type EmoteType = 'thumbs-up' | 'clap' | 'fire' | 'thinking' | 'laugh' | 'cry' | 'angry' | 'heart';

export type QuickMessageType = 'good-game' | 'nice-move' | 'oops' | 'hurry-up' | 'well-played' | 'rematch';

export interface EmoteData {
  playerId: string;
  playerName: string;
  emote: EmoteType;
}

export interface QuickMessageData {
  playerId: string;
  playerName: string;
  message: QuickMessageType;
}

// Client -> Server events
export interface ClientToServerEvents {
  'create-bot-game': (data: { playerName: string; difficulty: BotDifficulty; sequenceLength?: SequenceLength; sequencesToWin?: SequencesToWin; seriesLength?: SeriesLength }, callback: (response: CreateRoomResponse) => void) => void;
  'add-bot': (data: { difficulty: BotDifficulty }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'remove-bot': (data: { botPlayerId: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'create-room': (data: { roomName: string; playerName: string; maxPlayers: number; teamCount: number; turnTimeLimit?: TurnTimeLimit; sequencesToWin?: SequencesToWin; sequenceLength?: SequenceLength; seriesLength?: SeriesLength }, callback: (response: CreateRoomResponse) => void) => void;
  'join-room': (data: { roomCode: string; playerName: string; token?: string }, callback: (response: JoinRoomResponse) => void) => void;
  'leave-room': (data?: { intent?: 'leave' | 'end' }) => void;
  'start-game': (callback: (response: StartGameResponse) => void) => void;
  'kick-player': (playerId: string) => void;
  'game-action': (action: GameAction, callback: (response: MoveResult) => void) => void;
  'reconnect-to-room': (data: { roomCode: string; token: string }, callback: (response: ReconnectResponse) => void) => void;
  'update-room-settings': (data: { turnTimeLimit?: TurnTimeLimit; sequencesToWin?: SequencesToWin; sequenceLength?: SequenceLength; seriesLength?: SeriesLength; gameVariant?: GameVariant }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'toggle-ready': (callback: (response: { success: boolean; error?: string }) => void) => void;
  'request-team-switch': (toTeamIndex: number, callback: (response: { success: boolean; error?: string }) => void) => void;
  'respond-team-switch': (data: { playerId: string; approved: boolean }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'continue-series': (callback: (response: { success: boolean; error?: string; seriesComplete?: boolean; roomInfo?: RoomInfo }) => void) => void; // Continue to next game in series
  'end-series': (callback: (response: { success: boolean; error?: string }) => void) => void; // End series early, return to lobby
  'send-emote': (emote: EmoteType) => void;
  'send-quick-message': (message: QuickMessageType) => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  'room-updated': (roomInfo: RoomInfo) => void;
  'game-started': (state: ClientGameState) => void;
  'game-state-updated': (state: ClientGameState) => void;
  'player-joined': (player: PublicPlayer) => void;
  'player-left': (playerId: string) => void;
  'player-reconnected': (playerId: string) => void;
  'player-disconnected': (playerId: string) => void;
  'error': (message: string) => void;
  'cut-result': (cutCards: CutCard[], dealerIndex: number) => void;
  'game-over': (winnerTeamIndex: number, stalemate?: StalemateResult) => void;
  'turn-timeout': (data: { playerIndex: number; playerName: string }) => void;
  'team-switch-request': (request: TeamSwitchRequest) => void;
  'team-switch-response': (data: { playerId: string; approved: boolean; playerName: string }) => void;
  'game-mode-changed': (data: { modes: string[]; changedBy: string; settings: { sequenceLength: number; turnTimeLimit: number; seriesLength: number; gameVariant: GameVariant } }) => void;
  'emote-received': (data: EmoteData) => void;
  'quick-message-received': (data: QuickMessageData) => void;
  'room-closed': (reason: string) => void;
}

// Response types
export interface CreateRoomResponse {
  success: boolean;
  roomCode?: string;
  playerId?: string;
  token?: string;
  error?: string;
}

export interface JoinRoomResponse {
  success: boolean;
  roomInfo?: RoomInfo;
  playerId?: string;
  token?: string;
  error?: string;
}

export interface StartGameResponse {
  success: boolean;
  error?: string;
}

export type ReconnectErrorCode = 'INVALID_TOKEN' | 'ROOM_EXPIRED';

export interface ReconnectResponse {
  success: boolean;
  roomInfo?: RoomInfo;
  gameState?: ClientGameState;
  playerId?: string;
  error?: string;
  errorCode?: ReconnectErrorCode;
}

// Client-side game state (with player's own hand)
export interface ClientGameState {
  phase: GamePhase;
  config: GameConfig;
  players: PublicPlayer[];
  dealerIndex: number;
  currentPlayerIndex: number;
  deckCount: number;
  boardChips: BoardChips;
  lockedCells: string[][]; // Per team, array of "row,col" strings
  sequencesCompleted: number[]; // Per team
  teamScores: number[]; // Per team
  completedSequences: SequenceLine[];
  kingZone: KingZone | null;
  myHand: CardCode[];
  myPlayerId: string;
  deadCardReplacedThisTurn: boolean;
  pendingDraw: boolean;
  lastRemovedCell: [number, number] | null;
  winnerTeamIndex: number | null;
  lastMove: MoveResult | null;
  cutCards?: CutCard[];
  // Turn timer
  turnTimeLimit: TurnTimeLimit;
  turnStartedAt: number | null;
  // Activity log
  eventLog: GameEvent[];
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get rank value for comparison (Ace high = 14)
export function getRankValue(card: CardCode): number {
  const rank = card[0] as Rank;
  const values: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  return values[rank];
}

// Get suit symbol for display
export function getSuitSymbol(suit: Suit): string {
  const symbols: Record<Suit, string> = {
    'S': '♠', 'H': '♥', 'D': '♦', 'C': '♣'
  };
  return symbols[suit];
}

// Get rank display (T -> 10)
export function getRankDisplay(rank: Rank): string {
  return rank === 'T' ? '10' : rank;
}

// Parse card code
export function parseCard(card: CardCode): { rank: Rank; suit: Suit } {
  return {
    rank: card[0] as Rank,
    suit: card[1] as Suit
  };
}

// Get card display name
export function getCardDisplayName(card: CardCode): string {
  const { rank, suit } = parseCard(card);
  return `${getRankDisplay(rank)}${getSuitSymbol(suit)}`;
}

// Team color display
export function getTeamColorHex(color: TeamColor): string {
  const colors: Record<TeamColor, string> = {
    'blue': '#4ecdc4',
    'green': '#45b649',
    'red': '#e94560'
  };
  return colors[color];
}

// Team letter for colorblind accessibility
export function getTeamLetter(color: TeamColor): string {
  return color[0].toUpperCase(); // B, G, R
}

// Cell key for Set storage
export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function parseCell(key: string): [number, number] {
  const [row, col] = key.split(',').map(Number);
  return [row, col];
}

// ============================================
// USER PROFILE & AUTH TYPES
// ============================================

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarId: string;
  avatarColor: string;
  createdAt?: number;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
  sequencesCompleted: number;
  currentWinStreak: number;
  longestWinStreak: number;
  gamesByTeamColor: Record<string, number>;
  cardsPlayed: number;
  twoEyedJacksUsed: number;
  oneEyedJacksUsed: number;
  deadCardsReplaced: number;
  totalTurnsTaken: number;
  firstMoveGames: number;
  firstMoveWins: number;
  seriesPlayed: number;
  seriesWon: number;
  seriesLost: number;
  totalPlayTimeMs: number;
  fastestWinMs: number | null;
  impossibleBotWins: number;
  hasBeatImpossibleBot: boolean;
}

export interface FriendInfo {
  userId: string;
  username: string;
  displayName: string;
  avatarId: string;
  avatarColor: string;
  since?: number;
  hasBeatImpossibleBot?: boolean;
}

export interface FriendRequest {
  userId: string;
  username: string;
  displayName: string;
  avatarId: string;
  avatarColor: string;
  sentAt: number;
}

// ============================================
// DETAILED STATS TYPES
// ============================================

export interface ModeBreakdown {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  avgDurationMs: number | null;
  fastestWinMs: number | null;
  totalSequences: number;
}

export interface DetailedStats {
  overall: UserStats;
  byMode: {
    botEasy: ModeBreakdown | null;
    botMedium: ModeBreakdown | null;
    botHard: ModeBreakdown | null;
    botImpossible: ModeBreakdown | null;
    multiplayer: ModeBreakdown | null;
  };
  byVariant: {
    classic: ModeBreakdown | null;
    kingOfTheBoard: ModeBreakdown | null;
  };
  byFormat: {
    standard: ModeBreakdown | null;
    blitz: ModeBreakdown | null;
  };
  insights: {
    avgGameDurationMs: number | null;
    favoriteTeamColor: string | null;
    jackUsageRate: number;
    firstMoveWinRate: number | null;
    avgTurnsPerGame: number | null;
    avgSequencesPerGame: number | null;
    totalPlayTimeFormatted: string;
  };
  series: { played: number; won: number; lost: number; winRate: number };
  memberSince: number;
}

export interface HeadToHeadStats {
  gamesPlayed: number;
  myWins: number;
  theirWins: number;
  myWinRate: number;
  sameTeamGames: number;
  sameTeamWins: number;
  oppositeTeamGames: number;
  oppositeTeamMyWins: number;
  recentGames: GameHistorySummary[];
}

export interface GameHistorySummary {
  id: string;
  endedAt: number;
  durationMs: number;
  gameVariant: string;
  botDifficulty: string | null;
  wasStalemate: boolean;
  myWon: boolean;
  myTeamColor: string;
  playerCount: number;
}
