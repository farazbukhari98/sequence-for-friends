// ============================================
// CARD TYPES
// ============================================

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type CardCode = `${Rank}${Suit}`;
export type BoardCell = CardCode | 'W';
export type TeamColor = 'blue' | 'green' | 'red';
export type GameVariant = 'classic';
export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'impossible';
export type ConnectionPhase = 'idle' | 'connecting' | 'attached' | 'recovering' | 'offline' | 'terminalFailure';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarId: string;
  avatarColor: string;
  createdAt?: number | null;
}

export interface AuthAppleResponse {
  needsUsername: boolean;
  sessionToken?: string;
  tempToken?: string;
  suggestedName?: string;
  user?: UserProfile;
}

export interface AuthCompleteResponse {
  sessionToken: string;
  user: UserProfile;
}

export interface ProfileResponse {
  user: UserProfile;
  stats: UserStats;
}

export interface SuccessResponse {
  success: boolean;
  autoAccepted?: boolean;
  inviteId?: string;
}

export interface UsernameAvailabilityResponse {
  available: boolean;
  error?: string;
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

export const emptyStats: UserStats = {
  gamesPlayed: 0, gamesWon: 0, gamesLost: 0, winRate: 0,
  sequencesCompleted: 0, currentWinStreak: 0, longestWinStreak: 0,
  gamesByTeamColor: {}, cardsPlayed: 0, twoEyedJacksUsed: 0,
  oneEyedJacksUsed: 0, deadCardsReplaced: 0, totalTurnsTaken: 0,
  firstMoveGames: 0, firstMoveWins: 0, seriesPlayed: 0,
  seriesWon: 0, seriesLost: 0, totalPlayTimeMs: 0,
  fastestWinMs: null, impossibleBotWins: 0, hasBeatImpossibleBot: false,
};

export interface FriendInfo {
  userId: string;
  username: string;
  displayName: string;
  avatarId: string;
  avatarColor: string;
  since: number | null;
  hasBeatImpossibleBot: boolean | null;
}

export interface FriendRequest {
  userId: string;
  username: string;
  displayName: string;
  avatarId: string;
  avatarColor: string;
  sentAt: number;
}

export interface SearchResult {
  id: string;
  username: string;
  displayName: string;
  avatarId: string;
  avatarColor: string;
  friendStatus: string;
}

export interface SearchProfilesResponse {
  results: SearchResult[];
}

export interface FriendsResponse {
  friends: FriendInfo[];
}

export interface FriendRequestsResponse {
  requests: FriendRequest[];
}

export interface FriendProfileResponse {
  user: UserProfile;
  stats: UserStats;
  friendStatus: string;
  friendCount: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  seatIndex: number;
  teamIndex: number;
  teamColor: TeamColor;
  connected: boolean;
  ready: boolean;
  handCount: number;
  topDiscard: string | null;
  discardCount: number;
  isBot?: boolean;
}

export interface SeriesState {
  seriesLength: number;
  gamesPlayed: number;
  teamWins: number[];
  seriesWinnerTeamIndex: number | null;
}

export interface RoomInfo {
  code: string;
  name: string;
  hostId: string;
  phase: string;
  players: PublicPlayer[];
  maxPlayers: number;
  teamCount: number;
  gameVariant: GameVariant;
  turnTimeLimit: number;
  sequencesToWin: number;
  sequenceLength: number;
  seriesLength: number;
  seriesState: SeriesState | null;
}

export interface GameConfig {
  playerCount: number;
  teamCount: number;
  teamColors: TeamColor[];
  gameVariant: GameVariant;
  sequencesToWin: number;
  scoreToWin: number;
  sequenceLength: number;
  handSize: number;
}

export interface SequenceLine {
  cells: number[][];
  teamIndex: number;
}

export interface GameEvent {
  id: string;
  timestamp: number;
  type: string;
  playerId?: string;
  playerName?: string;
  teamIndex?: number;
  teamColor?: TeamColor;
  card?: string;
  position?: number[];
  sequenceCount?: number;
  pointsAwarded?: number;
  totalScore?: number;
  usedKingZone?: boolean;
}

export interface MoveScoringSummary {
  pointsAwarded: number;
  totalScore: number;
  usedKingZone: boolean;
  sequenceCount: number;
}

export interface MoveResult {
  success: boolean;
  error?: string;
  playerId?: string;
  scoring?: MoveScoringSummary;
  winnerTeamIndex?: number;
  gameOver?: boolean;
}

export interface CutCard {
  playerId: string;
  card: string;
  rank: number;
}

export interface ClientGameState {
  phase: string;
  config: GameConfig;
  players: PublicPlayer[];
  dealerIndex: number;
  currentPlayerIndex: number;
  deckCount: number;
  boardChips: (number | null)[][];
  lockedCells: string[][];
  sequencesCompleted: number[];
  teamScores: number[];
  completedSequences: SequenceLine[];
  myHand: string[];
  myPlayerId: string;
  deadCardReplacedThisTurn: boolean;
  pendingDraw: boolean;
  lastRemovedCell: number[] | null;
  winnerTeamIndex: number | null;
  lastMove: MoveResult | null;
  cutCards: CutCard[] | null;
  turnTimeLimit: number;
  turnStartedAt: number | null;
  eventLog: GameEvent[];
}

export interface GameAction {
  type: string;
  card?: string;
  targetRow?: number;
  targetCol?: number;
}

export interface CreateRoomPayload {
  roomName: string;
  playerName: string;
  maxPlayers: number;
  teamCount: number;
  turnTimeLimit: number;
  sequencesToWin: number;
}

export interface CreateBotGamePayload {
  playerName: string;
  difficulty: string;
  sequenceLength: number;
  sequencesToWin: number;
  seriesLength: number;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
  token?: string;
}

export interface UpdateRoomSettingsPayload {
  turnTimeLimit?: number;
  sequencesToWin?: number;
  sequenceLength?: number;
  seriesLength?: number;
  gameVariant?: GameVariant;
}

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

export interface ReconnectResponse {
  success: boolean;
  roomInfo?: RoomInfo;
  gameState?: ClientGameState;
  playerId?: string;
  error?: string;
  errorCode?: string;
}

export interface RoomSession {
  roomCode: string;
  token: string;
  playerId: string;
}

// Detailed Stats
export interface ModeBreakdown {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  avgDurationMs: number | null;
  fastestWinMs: number | null;
  totalSequences: number;
}

export interface ModeBreakdowns {
  botEasy: ModeBreakdown | null;
  botMedium: ModeBreakdown | null;
  botHard: ModeBreakdown | null;
  botImpossible: ModeBreakdown | null;
  multiplayer: ModeBreakdown | null;
}

export interface VariantBreakdowns {
  classic: ModeBreakdown | null;
  kingOfTheBoard: ModeBreakdown | null;
}

export interface FormatBreakdowns {
  standard: ModeBreakdown | null;
  blitz: ModeBreakdown | null;
}

export interface StatsInsights {
  avgGameDurationMs: number | null;
  favoriteTeamColor: string | null;
  jackUsageRate: number;
  firstMoveWinRate: number | null;
  avgTurnsPerGame: number | null;
  avgSequencesPerGame: number | null;
  totalPlayTimeFormatted: string;
}

export interface DetailedStatsResponse {
  overall: UserStats;
  byMode: ModeBreakdowns;
  byVariant: VariantBreakdowns;
  byFormat: FormatBreakdowns;
  insights: StatsInsights;
  series: SeriesStatsInfo;
  memberSince: number;
}

export interface SeriesStatsInfo {
  played: number;
  won: number;
  lost: number;
  winRate: number;
}

export interface HeadToHeadResponse {
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

export interface GameHistoryGame {
  id: string;
  ended_at: number;
  duration_ms: number;
  player_count: number;
  game_variant: string;
  bot_difficulty: string | null;
  was_stalemate: number;
  participants: GameHistoryParticipant[];
}

export interface GameHistoryParticipant {
  user_id: string;
  won: number;
  team_color: string;
}

export interface GameHistoryResponse {
  games: GameHistoryGame[];
}

export interface ConnectionStatus {
  phase: ConnectionPhase;
  message: string | null;
  attempt: number;
  canRetry: boolean;
}

export const connectionIdle: ConnectionStatus = { phase: 'idle', message: null, attempt: 0, canRetry: false };
export const connectionConnecting = (msg: string): ConnectionStatus => ({ phase: 'connecting', message: msg, attempt: 0, canRetry: false });
export const connectionAttached = (msg?: string): ConnectionStatus => ({ phase: 'attached', message: msg ?? null, attempt: 0, canRetry: false });
export const connectionRecovering = (msg: string, attempt: number): ConnectionStatus => ({ phase: 'recovering', message: msg, attempt, canRetry: false });
export const connectionOffline = (msg: string): ConnectionStatus => ({ phase: 'offline', message: msg, attempt: 0, canRetry: true });
export const connectionTerminalFailure = (msg: string, canRetry: boolean): ConnectionStatus => ({ phase: 'terminalFailure', message: msg, attempt: 0, canRetry: canRetry });

// Push permission state
export type PushPermissionState = 'unknown' | 'notDetermined' | 'denied' | 'authorized';

// Card display helper
export interface CardDisplay {
  rank: string;
  suit: string;
  suitColorHex: string;
}

export function getCardDisplay(card: string): CardDisplay {
  if (card === 'W') return { rank: '★', suit: '', suitColorHex: '#facc15' };
  if (card.length !== 2) return { rank: card, suit: '', suitColorHex: '#f8fafc' };
  const ranks: Record<string, string> = { 'A':'A','K':'K','Q':'Q','J':'J','T':'10','9':'9','8':'8','7':'7','6':'6','5':'5','4':'4','3':'3','2':'2' };
  const suits: Record<string, [string, string]> = { 'S': ['♠','#f8fafc'], 'C': ['♣','#f8fafc'], 'H': ['♥','#ef4444'], 'D': ['♦','#ef4444'] };
  const rank = ranks[card[0]] ?? card[0];
  const [suit, color] = suits[card[1]] ?? ['', '#f8fafc'];
  return { rank, suit, suitColorHex: color };
}

export function getCardFullName(card: string): string {
  if (card === 'W') return 'Wild Corner';
  if (card.length !== 2) return card;
  const ranks: Record<string, string> = { 'A':'Ace','K':'King','Q':'Queen','J':'Jack','T':'10','9':'9','8':'8','7':'7','6':'6','5':'5','4':'4','3':'3','2':'2' };
  const suits: Record<string, string> = { 'S':'Spades','H':'Hearts','D':'Diamonds','C':'Clubs' };
  const rank = ranks[card[0]] ?? card[0];
  const suit = suits[card[1]] ?? card[1];
  return `${rank} of ${suit}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatMemberSince(timestamp: number): string {
  const date = new Date(timestamp / 1000);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function formatGameDate(timestamp: number): string {
  const date = new Date(timestamp / 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}