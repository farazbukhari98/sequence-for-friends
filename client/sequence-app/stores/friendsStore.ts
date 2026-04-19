import { create } from 'zustand';
import { api } from '@/services/api';
import type { FriendInfo, FriendRequest, SearchResult, FriendProfileResponse, DetailedStatsResponse, HeadToHeadResponse, GameHistoryGame } from '@/types/game';

interface FriendsStoreState {
  friends: FriendInfo[];
  friendRequests: FriendRequest[];
  searchResults: SearchResult[];
  searchQuery: string;
  isSearching: boolean;

  // Viewing a friend's profile
  viewingProfile: FriendProfileResponse | null;
  viewingDetailedStats: DetailedStatsResponse | null;
  headToHead: HeadToHeadResponse | null;

  // Game history
  gameHistoryList: GameHistoryGame[];
  gameHistoryHasMore: boolean;
  gameHistoryOffset: number;
  isLoadingHistory: boolean;

  // Loading states
  isLoadingFriends: boolean;
  isLoadingRequests: boolean;
  isLoadingProfile: boolean;
  errorMessage: string | null;

  // Actions
  loadFriends: (token: string) => Promise<void>;
  loadFriendRequests: (token: string) => Promise<void>;
  searchProfiles: (token: string, query: string) => Promise<void>;
  clearSearch: () => void;
  sendFriendRequest: (token: string, username: string) => Promise<boolean>;
  acceptFriendRequest: (token: string, userId: string) => Promise<boolean>;
  rejectFriendRequest: (token: string, userId: string) => Promise<boolean>;
  removeFriend: (token: string, userId: string) => Promise<boolean>;
  loadFriendProfile: (token: string, username: string) => Promise<void>;
  loadDetailedStats: (token: string, username?: string) => Promise<void>;
  loadHeadToHead: (token: string, userId: string) => Promise<void>;
  loadGameHistory: (token: string, append?: boolean) => Promise<void>;
  inviteFriend: (token: string, friendId: string, roomCode: string) => Promise<boolean>;
  clearProfile: () => void;
  clearError: () => void;
}

export const useFriendsStore = create<FriendsStoreState>((set, get) => ({
  friends: [],
  friendRequests: [],
  searchResults: [],
  searchQuery: '',
  isSearching: false,
  viewingProfile: null,
  viewingDetailedStats: null,
  headToHead: null,
  gameHistoryList: [],
  gameHistoryHasMore: true,
  gameHistoryOffset: 0,
  isLoadingHistory: false,
  isLoadingFriends: false,
  isLoadingRequests: false,
  isLoadingProfile: false,
  errorMessage: null,

  loadFriends: async (token) => {
    set({ isLoadingFriends: true });
    try {
      const response = await api.getFriends(token);
      set({ friends: response.friends, isLoadingFriends: false });
    } catch (error: any) {
      set({ errorMessage: error.message, isLoadingFriends: false });
    }
  },

  loadFriendRequests: async (token) => {
    set({ isLoadingRequests: true });
    try {
      const response = await api.getFriendRequests(token);
      set({ friendRequests: response.requests, isLoadingRequests: false });
    } catch (error: any) {
      set({ errorMessage: error.message, isLoadingRequests: false });
    }
  },

  searchProfiles: async (token, query) => {
    if (!query.trim()) {
      set({ searchResults: [], searchQuery: query, isSearching: false });
      return;
    }
    set({ searchQuery: query, isSearching: true });
    try {
      const response = await api.searchProfiles(token, query);
      set({ searchResults: response.results, isSearching: false });
    } catch (error: any) {
      set({ errorMessage: error.message, isSearching: false });
    }
  },

  clearSearch: () => set({ searchResults: [], searchQuery: '', isSearching: false }),

  sendFriendRequest: async (token, username) => {
    try {
      await api.sendFriendRequest(token, username);
      // Refresh friend requests
      await get().loadFriendRequests(token);
      return true;
    } catch {
      return false;
    }
  },

  acceptFriendRequest: async (token, userId) => {
    try {
      await api.acceptFriendRequest(token, userId);
      // Refresh both lists
      await Promise.all([get().loadFriends(token), get().loadFriendRequests(token)]);
      return true;
    } catch {
      return false;
    }
  },

  rejectFriendRequest: async (token, userId) => {
    try {
      await api.rejectFriendRequest(token, userId);
      await get().loadFriendRequests(token);
      return true;
    } catch {
      return false;
    }
  },

  removeFriend: async (token, userId) => {
    try {
      await api.removeFriend(token, userId);
      await get().loadFriends(token);
      return true;
    } catch {
      return false;
    }
  },

  loadFriendProfile: async (token, username) => {
    set({ isLoadingProfile: true });
    try {
      const response = await api.getFriendProfile(token, username);
      set({ viewingProfile: response, isLoadingProfile: false });
    } catch (error: any) {
      set({ errorMessage: error.message, isLoadingProfile: false });
    }
  },

  loadDetailedStats: async (token, username) => {
    try {
      const response = await api.getDetailedStats(token, username);
      set({ viewingDetailedStats: response });
    } catch (error: any) {
      set({ errorMessage: error.message });
    }
  },

  loadHeadToHead: async (token, userId) => {
    try {
      const response = await api.getHeadToHead(token, userId);
      set({ headToHead: response });
    } catch (error: any) {
      set({ errorMessage: error.message });
    }
  },

  loadGameHistory: async (token, append = false) => {
    const { gameHistoryOffset, isLoadingHistory } = get();
    if (isLoadingHistory) return;
    set({ isLoadingHistory: true });
    try {
      const response = await api.getGameHistory(token, { limit: 20, offset: append ? gameHistoryOffset : 0 });
      set({
        gameHistoryList: append ? [...get().gameHistoryList, ...response.games] : response.games,
        gameHistoryHasMore: response.games.length === 20,
        gameHistoryOffset: append ? gameHistoryOffset + response.games.length : response.games.length,
        isLoadingHistory: false,
      });
    } catch (error: any) {
      set({ errorMessage: error.message, isLoadingHistory: false });
    }
  },

  inviteFriend: async (token, friendId, roomCode) => {
    try {
      const response = await api.inviteFriend(token, friendId, roomCode);
      return response.success;
    } catch {
      return false;
    }
  },

  clearProfile: () => set({ viewingProfile: null, viewingDetailedStats: null, headToHead: null }),
  clearError: () => set({ errorMessage: null }),
}));