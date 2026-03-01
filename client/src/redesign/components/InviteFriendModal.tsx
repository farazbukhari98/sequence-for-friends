import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { getAvatarEmoji } from '../../lib/avatars';
import type { FriendInfo } from '../../../../shared/types';
import './InviteFriendModal.css';

interface InviteFriendModalProps {
  roomCode: string;
  onClose: () => void;
}

export function InviteFriendModal({ roomCode, onClose }: InviteFriendModalProps) {
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.getFriends();
        setFriends(result.friends);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load friends');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleInvite = async (friendId: string) => {
    setInviting(friendId);
    setError(null);
    try {
      await api.inviteFriend(friendId, roomCode);
      setInvited(prev => new Set(prev).add(friendId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviting(null);
    }
  };

  return (
    <div className="invite-modal-overlay" onClick={onClose}>
      <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
        <div className="invite-modal-header">
          <h3>Invite Friend</h3>
          <button className="invite-modal-close" onClick={onClose}>&#10005;</button>
        </div>

        <div className="invite-modal-body">
          {error && <p className="text-center" style={{ color: '#ef4444', fontSize: '0.875rem', padding: '8px 0' }}>{error}</p>}
          {loading && <p className="text-center text-muted">Loading friends...</p>}

          {!loading && !error && friends.length === 0 && (
            <p className="text-center text-muted" style={{ padding: '24px 0' }}>
              No friends to invite. Add friends from your profile!
            </p>
          )}

          {friends.map(friend => (
            <div key={friend.userId} className="invite-friend-row">
              <div className="friend-avatar" style={{ backgroundColor: friend.avatarColor }}>
                {getAvatarEmoji(friend.avatarId)}
              </div>
              <div className="friend-info">
                <span className="friend-name">{friend.displayName}</span>
              </div>
              {invited.has(friend.userId) ? (
                <span className="invite-sent">Sent!</span>
              ) : (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleInvite(friend.userId)}
                  disabled={inviting === friend.userId}
                >
                  {inviting === friend.userId ? '...' : 'Invite'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
