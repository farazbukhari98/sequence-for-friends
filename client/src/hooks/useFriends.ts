import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { FriendInfo, FriendRequest } from '../../../shared/types';

interface UseFriendsReturn {
  friends: FriendInfo[];
  requests: FriendRequest[];
  searchResults: FriendInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  search: (query: string) => Promise<void>;
  sendRequest: (username: string) => Promise<{ success: boolean; error?: string; autoAccepted?: boolean }>;
  acceptRequest: (userId: string) => Promise<{ success: boolean; error?: string }>;
  rejectRequest: (userId: string) => Promise<{ success: boolean; error?: string }>;
  removeFriend: (userId: string) => Promise<{ success: boolean; error?: string }>;
  clearSearch: () => void;
}

export function useFriends(): UseFriendsReturn {
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<FriendInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [friendsResult, requestsResult] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
      ]);
      setFriends(friendsResult.friends);
      setRequests(requestsResult.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const result = await api.searchProfiles(query);
      setSearchResults(result.results.map(u => ({
        userId: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarId: u.avatarId,
        avatarColor: u.avatarColor,
      })));
    } catch {
      setSearchResults([]);
    }
  }, []);

  const sendRequest = useCallback(async (username: string) => {
    try {
      const result = await api.sendFriendRequest(username);
      if (result.autoAccepted) {
        await refresh();
      }
      return { success: true, autoAccepted: result.autoAccepted };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to send request' };
    }
  }, [refresh]);

  const acceptRequest = useCallback(async (userId: string) => {
    try {
      await api.acceptFriend(userId);
      await refresh();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to accept' };
    }
  }, [refresh]);

  const rejectRequest = useCallback(async (userId: string) => {
    try {
      await api.rejectFriend(userId);
      setRequests(prev => prev.filter(r => r.userId !== userId));
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to reject' };
    }
  }, []);

  const removeFriendFn = useCallback(async (userId: string) => {
    try {
      await api.removeFriend(userId);
      setFriends(prev => prev.filter(f => f.userId !== userId));
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to remove' };
    }
  }, []);

  const clearSearch = useCallback(() => setSearchResults([]), []);

  useEffect(() => {
    refresh();
    // Periodically refresh to pick up new friend requests
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    friends, requests, searchResults, loading, error,
    refresh, search, sendRequest, acceptRequest, rejectRequest,
    removeFriend: removeFriendFn, clearSearch,
  };
}
