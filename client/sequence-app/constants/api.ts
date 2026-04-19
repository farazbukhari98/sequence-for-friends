// API configuration constants

export const API_BASE_URL = 'https://sequence-for-friends.farazbukhari98.workers.dev';
export const WS_BASE_URL = 'wss://sequence-for-friends.farazbukhari98.workers.dev';
export const DEEP_LINK_SCHEME = 'sequencegame';

// Reconnection settings
export const RECONNECT_RETRY_DELAYS = [0, 500, 1500, 3000];
export const MAX_RECONNECT_ATTEMPTS = 4;
export const HEARTBEAT_INTERVAL = 20000; // 20 seconds
export const HEARTBEAT_TIMEOUT = 10000; // 10 seconds

// Game defaults
export const DEFAULT_TURN_TIME_LIMIT = 30; // seconds
export const DEFAULT_SEQUENCES_TO_WIN = 2;
export const DEFAULT_SEQUENCE_LENGTH = 5;
export const DEFAULT_SERIES_LENGTH = 1;
export const DEFAULT_TEAM_COUNT = 2;
export const DEFAULT_MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

// Board
export const BOARD_SIZE = 10;
export const HAND_SIZE_CLASSIC = 6;

// Deep link paths
export const DEEP_LINK_PATHS = {
  JOIN: '/join',
  INVITE: '/invite',
} as const;