import type {
  AuthAppleResponse, AuthCompleteResponse, ProfileResponse,
  SuccessResponse, UsernameAvailabilityResponse, SearchProfilesResponse,
  FriendsResponse, FriendRequestsResponse, FriendProfileResponse,
  DetailedStatsResponse, HeadToHeadResponse, GameHistoryResponse,
} from '@/types/game';
import { API_BASE_URL } from '@/constants/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(
    path: string,
    method: string = 'GET',
    token?: string | null,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.error || errorBody.message || errorMessage;
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Auth
  async authApple(identityToken: string, fullName?: { givenName?: string; familyName?: string }): Promise<AuthAppleResponse> {
    return this.request<AuthAppleResponse>('/api/auth/apple', 'POST', null, { identityToken, fullName });
  }

  async authComplete(tempToken: string, username: string, displayName: string, avatarId: string, avatarColor: string): Promise<AuthCompleteResponse> {
    return this.request<AuthCompleteResponse>('/api/auth/complete', 'POST', tempToken, { username, displayName, avatarId, avatarColor });
  }

  async checkUsername(username: string): Promise<UsernameAvailabilityResponse> {
    return this.request<UsernameAvailabilityResponse>(`/api/auth/check-username?username=${encodeURIComponent(username)}`, 'GET');
  }

  // Profile
  async getProfile(token: string): Promise<ProfileResponse> {
    return this.request<ProfileResponse>('/api/profile', 'GET', token);
  }

  async updateProfile(token: string, data: { displayName?: string; avatarId?: string; avatarColor?: string }): Promise<SuccessResponse> {
    return this.request<SuccessResponse>('/api/profile', 'PUT', token, data);
  }

  // Search
  async searchProfiles(token: string, query: string): Promise<SearchProfilesResponse> {
    return this.request<SearchProfilesResponse>(`/api/friends/search?query=${encodeURIComponent(query)}`, 'GET', token);
  }

  // Friends
  async getFriends(token: string): Promise<FriendsResponse> {
    return this.request<FriendsResponse>('/api/friends', 'GET', token);
  }

  async getFriendRequests(token: string): Promise<FriendRequestsResponse> {
    return this.request<FriendRequestsResponse>('/api/friends/requests', 'GET', token);
  }

  async sendFriendRequest(token: string, username: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>('/api/friends/request', 'POST', token, { username });
  }

  async acceptFriendRequest(token: string, userId: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(`/api/friends/accept/${userId}`, 'POST', token);
  }

  async rejectFriendRequest(token: string, userId: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(`/api/friends/reject/${userId}`, 'POST', token);
  }

  async removeFriend(token: string, userId: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(`/api/friends/${userId}`, 'DELETE', token);
  }

  async getFriendProfile(token: string, username: string): Promise<FriendProfileResponse> {
    return this.request<FriendProfileResponse>(`/api/friends/profile/${username}`, 'GET', token);
  }

  // Invite
  async inviteFriend(token: string, friendId: string, roomCode: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>('/api/invite', 'POST', token, { friendId, roomCode });
  }

  // Stats
  async getDetailedStats(token: string, username?: string): Promise<DetailedStatsResponse> {
    const query = username ? `?username=${encodeURIComponent(username)}` : '';
    return this.request<DetailedStatsResponse>(`/api/stats/detailed${query}`, 'GET', token);
  }

  async getHeadToHead(token: string, userId: string): Promise<HeadToHeadResponse> {
    return this.request<HeadToHeadResponse>(`/api/stats/head-to-head/${userId}`, 'GET', token);
  }

  // Game History
  async getGameHistory(token: string, params?: { limit?: number; offset?: number; mode?: string; difficulty?: string; variant?: string; result?: string }): Promise<GameHistoryResponse> {
    const queryParts: string[] = [];
    if (params) {
      if (params.limit) queryParts.push(`limit=${params.limit}`);
      if (params.offset) queryParts.push(`offset=${params.offset}`);
      if (params.mode) queryParts.push(`mode=${params.mode}`);
      if (params.difficulty) queryParts.push(`difficulty=${params.difficulty}`);
      if (params.variant) queryParts.push(`variant=${params.variant}`);
      if (params.result) queryParts.push(`result=${params.result}`);
    }
    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return this.request<GameHistoryResponse>(`/api/game-history${query}`, 'GET', token);
  }

  // Push
  async registerPushToken(token: string, pushToken: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>('/api/push/register', 'POST', token, { pushToken });
  }
}

export const api = new ApiClient(API_BASE_URL);