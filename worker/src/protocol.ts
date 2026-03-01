import type {
  GameAction,
  TurnTimeLimit,
  SequencesToWin,
  SequenceLength,
  SeriesLength,
  BotDifficulty,
  EmoteType,
  QuickMessageType,
} from '../../shared/types.js';

// ============================================
// CLIENT -> SERVER MESSAGES
// ============================================

export interface CreateRoomMessage {
  type: 'create-room';
  id: string;
  data: {
    roomName: string;
    playerName: string;
    maxPlayers: number;
    teamCount: number;
    turnTimeLimit?: TurnTimeLimit;
    sequencesToWin?: SequencesToWin;
    sequenceLength?: SequenceLength;
    seriesLength?: SeriesLength;
  };
}

export interface CreateBotGameMessage {
  type: 'create-bot-game';
  id: string;
  data: {
    playerName: string;
    difficulty: BotDifficulty;
    sequenceLength?: SequenceLength;
    sequencesToWin?: SequencesToWin;
    seriesLength?: SeriesLength;
  };
}

export interface JoinRoomMessage {
  type: 'join-room';
  id: string;
  data: {
    roomCode: string;
    playerName: string;
    token?: string;
  };
}

export interface ReconnectToRoomMessage {
  type: 'reconnect-to-room';
  id: string;
  data: {
    roomCode: string;
    token: string;
  };
}

export interface LeaveRoomMessage {
  type: 'leave-room';
  id?: string;
}

export interface StartGameMessage {
  type: 'start-game';
  id: string;
}

export interface GameActionMessage {
  type: 'game-action';
  id: string;
  data: GameAction;
}

export interface KickPlayerMessage {
  type: 'kick-player';
  id?: string;
  data: { playerId: string };
}

export interface UpdateRoomSettingsMessage {
  type: 'update-room-settings';
  id: string;
  data: {
    turnTimeLimit?: TurnTimeLimit;
    sequencesToWin?: SequencesToWin;
    sequenceLength?: SequenceLength;
    seriesLength?: SeriesLength;
  };
}

export interface ToggleReadyMessage {
  type: 'toggle-ready';
  id: string;
}

export interface RequestTeamSwitchMessage {
  type: 'request-team-switch';
  id: string;
  data: { toTeamIndex: number };
}

export interface RespondTeamSwitchMessage {
  type: 'respond-team-switch';
  id: string;
  data: { playerId: string; approved: boolean };
}

export interface ContinueSeriesMessage {
  type: 'continue-series';
  id: string;
}

export interface EndSeriesMessage {
  type: 'end-series';
  id: string;
}

export interface AddBotMessage {
  type: 'add-bot';
  id: string;
  data: { difficulty: BotDifficulty };
}

export interface RemoveBotMessage {
  type: 'remove-bot';
  id: string;
  data: { botPlayerId: string };
}

export interface SendEmoteMessage {
  type: 'send-emote';
  data: { emote: EmoteType };
}

export interface SendQuickMessage {
  type: 'send-quick-message';
  data: { message: QuickMessageType };
}

export type ClientMessage =
  | CreateRoomMessage
  | CreateBotGameMessage
  | JoinRoomMessage
  | ReconnectToRoomMessage
  | LeaveRoomMessage
  | StartGameMessage
  | GameActionMessage
  | KickPlayerMessage
  | UpdateRoomSettingsMessage
  | ToggleReadyMessage
  | RequestTeamSwitchMessage
  | RespondTeamSwitchMessage
  | ContinueSeriesMessage
  | EndSeriesMessage
  | AddBotMessage
  | RemoveBotMessage
  | SendEmoteMessage
  | SendQuickMessage;

// ============================================
// SERVER -> CLIENT MESSAGES
// ============================================

export interface ResponseMessage {
  type: 'response';
  id: string;
  data: Record<string, unknown>;
}

export interface BroadcastMessage {
  type: string;
  data?: unknown;
}

export type ServerMessage = ResponseMessage | BroadcastMessage;
