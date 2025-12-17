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
// TEAM & PLAYER TYPES
// ============================================

export type TeamColor = 'blue' | 'green' | 'red';

export const TEAM_COLORS_2: TeamColor[] = ['blue', 'green'];
export const TEAM_COLORS_3: TeamColor[] = ['blue', 'green', 'red'];

export interface Player {
  id: string;
  name: string;
  token: string; // For reconnection
  seatIndex: number;
  teamIndex: number;
  teamColor: TeamColor;
  connected: boolean;
  ready: boolean; // Ready to start the game
  hand: CardCode[]; // Only visible to this player on client
  discardPile: CardCode[]; // Top card visible to all
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

export type GamePhase = 'lobby' | 'cutting' | 'playing' | 'finished';

// ============================================
// TURN TIME LIMIT
// ============================================

export type TurnTimeLimit = 0 | 30 | 60 | 90 | 120; // 0 = no limit, values in seconds

export const TURN_TIME_OPTIONS: { value: TurnTimeLimit; label: string }[] = [
  { value: 0, label: 'No Limit' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 90, label: '90 seconds' },
  { value: 120, label: '2 minutes' },
];

// ============================================
// SEQUENCES TO WIN
// ============================================

export type SequencesToWin = 2 | 3 | 4;

export const SEQUENCES_TO_WIN_OPTIONS: { value: SequencesToWin; label: string }[] = [
  { value: 2, label: '2 sequences' },
  { value: 3, label: '3 sequences' },
  { value: 4, label: '4 sequences' },
];

export const DEFAULT_SEQUENCES_TO_WIN: SequencesToWin = 2;

// ============================================
// STALEMATE DETECTION
// ============================================

export interface StalemateResult {
  isStalemate: boolean;
  winnerTeamIndex?: number;
  reason?: 'highest_count' | 'first_to_reach';
  sequenceCounts?: number[];
}

export interface GameConfig {
  playerCount: number;
  teamCount: number; // 2 or 3
  teamColors: TeamColor[];
  sequencesToWin: number; // configurable: 2, 3, or 4
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
  completedSequences: SequenceLine[]; // All completed sequences

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
  turnTimeLimit: TurnTimeLimit;
  sequencesToWin: SequencesToWin; // configurable: 2, 3, or 4
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
  turnTimeLimit: TurnTimeLimit;
  sequencesToWin: SequencesToWin; // configurable: 2, 3, or 4
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

// Client -> Server events
export interface ClientToServerEvents {
  'create-room': (data: { roomName: string; playerName: string; maxPlayers: number; teamCount: number; turnTimeLimit?: TurnTimeLimit; sequencesToWin?: SequencesToWin }, callback: (response: CreateRoomResponse) => void) => void;
  'join-room': (data: { roomCode: string; playerName: string; token?: string }, callback: (response: JoinRoomResponse) => void) => void;
  'leave-room': () => void;
  'start-game': (callback: (response: StartGameResponse) => void) => void;
  'kick-player': (playerId: string) => void;
  'game-action': (action: GameAction, callback: (response: MoveResult) => void) => void;
  'reconnect-to-room': (data: { roomCode: string; token: string }, callback: (response: ReconnectResponse) => void) => void;
  'update-room-settings': (data: { turnTimeLimit?: TurnTimeLimit; sequencesToWin?: SequencesToWin }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'toggle-ready': (callback: (response: { success: boolean; error?: string }) => void) => void;
  'request-team-switch': (toTeamIndex: number, callback: (response: { success: boolean; error?: string }) => void) => void;
  'respond-team-switch': (data: { playerId: string; approved: boolean }, callback: (response: { success: boolean; error?: string }) => void) => void;
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

export interface ReconnectResponse {
  success: boolean;
  roomInfo?: RoomInfo;
  gameState?: ClientGameState;
  playerId?: string;
  error?: string;
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
  completedSequences: SequenceLine[];
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
