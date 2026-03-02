import { useState, useRef } from 'react';
import { useFriends } from '../../hooks/useFriends';
import { getAvatarEmoji } from '../../lib/avatars';
import './FriendsScreen.css';

interface FriendsScreenProps {
  onBack: () => void;
}

export function FriendsScreen({ onBack }: FriendsScreenProps) {
  const {
    friends, requests, searchResults, loading, error: friendsError,
    search, sendRequest, acceptRequest, rejectRequest, removeFriend, clearSearch,
  } = useFriends();

  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 2) {
      clearSearch();
      return;
    }
    searchTimer.current = setTimeout(() => search(query), 300);
  };

  const handleSendRequest = async (username: string) => {
    setActionLoading(username);
    const result = await sendRequest(username);
    if (result.autoAccepted) {
      setMessage(`You and ${username} are now friends!`);
    } else if (result.success) {
      setMessage(`Friend request sent to ${username}`);
    } else if (result.error) {
      setMessage(result.error);
    }
    setActionLoading(null);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAccept = async (userId: string) => {
    setActionLoading(userId);
    const result = await acceptRequest(userId);
    if (result.error) {
      setMessage(result.error);
      setTimeout(() => setMessage(null), 3000);
    }
    setActionLoading(null);
  };

  const handleReject = async (userId: string) => {
    setActionLoading(userId);
    const result = await rejectRequest(userId);
    if (result.error) {
      setMessage(result.error);
      setTimeout(() => setMessage(null), 3000);
    }
    setActionLoading(null);
  };

  const handleRemove = async (userId: string, displayName: string) => {
    if (!window.confirm(`Remove ${displayName} from your friends?`)) return;
    setActionLoading(userId);
    const result = await removeFriend(userId);
    if (result.error) {
      setMessage(result.error);
      setTimeout(() => setMessage(null), 3000);
    }
    setActionLoading(null);
  };

  return (
    <div className="friends-screen">
      <div className="friends-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h2>Friends</h2>
        <div style={{ width: 60 }} />
      </div>

      <div className="friends-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by username..."
          autoComplete="off"
          autoCapitalize="off"
        />
      </div>

      {friendsError && <div className="friends-message friends-error">{friendsError}</div>}
      {message && <div className="friends-message">{message}</div>}

      {searchQuery.length >= 2 && searchResults.length > 0 && (
        <div className="friends-search-results">
          {searchResults.filter(user =>
            !friends.some(f => f.userId === user.userId) &&
            !requests.some(r => r.userId === user.userId)
          ).map(user => (
            <div key={user.userId} className="friend-card">
              <div className="friend-avatar" style={{ backgroundColor: user.avatarColor }}>
                {getAvatarEmoji(user.avatarId)}
              </div>
              <div className="friend-info">
                <span className="friend-name">{user.displayName}</span>
                <span className="friend-username">@{user.username}</span>
              </div>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => handleSendRequest(user.username)}
                disabled={actionLoading === user.username}
              >
                {actionLoading === user.username ? '...' : 'Add'}
              </button>
            </div>
          ))}
        </div>
      )}

      {searchQuery.length >= 2 && searchResults.length === 0 && !loading && (
        <p className="friends-empty">No users found</p>
      )}

      {searchQuery.length < 2 && (
        <>
          <div className="friends-tabs">
            <button
              className={`friends-tab ${tab === 'friends' ? 'active' : ''}`}
              onClick={() => setTab('friends')}
            >
              Friends ({friends.length})
            </button>
            <button
              className={`friends-tab ${tab === 'requests' ? 'active' : ''}`}
              onClick={() => setTab('requests')}
            >
              Requests {requests.length > 0 ? `(${requests.length})` : ''}
            </button>
          </div>

          <div className="friends-list">
            {tab === 'friends' && (
              <>
                {friends.length === 0 && !loading && (
                  <p className="friends-empty">No friends yet. Search for players above!</p>
                )}
                {friends.map(friend => (
                  <div key={friend.userId} className="friend-card">
                    <div className="friend-avatar" style={{ backgroundColor: friend.avatarColor }}>
                      {getAvatarEmoji(friend.avatarId)}
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">
                        {friend.displayName}
                        {friend.hasBeatImpossibleBot && (
                          <span className="friend-trophy" title="Impossible Victor">&#x1F3C6;</span>
                        )}
                      </span>
                      <span className="friend-username">@{friend.username}</span>
                    </div>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemove(friend.userId, friend.displayName)}
                      disabled={actionLoading === friend.userId}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </>
            )}

            {tab === 'requests' && (
              <>
                {requests.length === 0 && !loading && (
                  <p className="friends-empty">No pending requests</p>
                )}
                {requests.map(req => (
                  <div key={req.userId} className="friend-card">
                    <div className="friend-avatar" style={{ backgroundColor: req.avatarColor }}>
                      {getAvatarEmoji(req.avatarId)}
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">{req.displayName}</span>
                      <span className="friend-username">@{req.username}</span>
                    </div>
                    <div className="friend-actions">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAccept(req.userId)}
                        disabled={actionLoading === req.userId}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleReject(req.userId)}
                        disabled={actionLoading === req.userId}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {loading && <p className="text-center text-muted">Loading...</p>}
    </div>
  );
}
