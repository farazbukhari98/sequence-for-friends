import { useState } from 'react';
import { useProfile } from '../../hooks/useProfile';
import { StatsSummary } from './StatsSummary';
import { AvatarPicker } from './AvatarPicker';
import { getAvatarEmoji } from '../../lib/avatars';
import { api } from '../../lib/api';
import type { UserProfile } from '../../../../shared/types';
import './ProfileScreen.css';

interface ProfileScreenProps {
  user: UserProfile;
  onBack: () => void;
  onSignOut: () => void;
  onUpdateUser: (updates: Partial<UserProfile>) => void;
}

export function ProfileScreen({ user, onBack, onSignOut, onUpdateUser }: ProfileScreenProps) {
  const { stats, loading, error } = useProfile();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(user.displayName);
  const [editAvatarId, setEditAvatarId] = useState(user.avatarId);
  const [editAvatarColor, setEditAvatarColor] = useState(user.avatarColor);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editName.trim()) {
      setSaveError('Display name cannot be empty');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateProfile({
        displayName: editName.trim(),
        avatarId: editAvatarId,
        avatarColor: editAvatarColor,
      });
      onUpdateUser({
        displayName: editName.trim(),
        avatarId: editAvatarId,
        avatarColor: editAvatarColor,
      });
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-screen">
      <div className="profile-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        {!editing && (
          <button className="edit-button" onClick={() => setEditing(true)}>Edit</button>
        )}
      </div>

      <div className="profile-content">
        {editing ? (
          <div className="profile-edit animate-fade-in">
            <AvatarPicker
              selectedIcon={editAvatarId}
              selectedColor={editAvatarColor}
              onSelectIcon={setEditAvatarId}
              onSelectColor={setEditAvatarColor}
            />
            <div className="form-group mt-md">
              <label>Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={30}
              />
            </div>
            {saveError && <div className="form-error p-md">{saveError}</div>}
            <div className="profile-edit-actions">
              <button className="btn btn-secondary" onClick={() => { setEditing(false); setSaveError(null); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="profile-avatar" style={{ backgroundColor: user.avatarColor }}>
              <span className="profile-avatar-emoji">{getAvatarEmoji(user.avatarId)}</span>
            </div>
            <h2 className="profile-name">{user.displayName}</h2>
            <p className="profile-username">@{user.username}</p>
          </>
        )}

        {!editing && (
          <>
            {loading && <p className="text-center text-muted">Loading stats...</p>}
            {error && <p className="text-center" style={{ color: '#ef4444' }}>{error}</p>}
            {stats && <StatsSummary stats={stats} />}
          </>
        )}

        {!editing && (
          <button className="btn-sign-out" onClick={onSignOut}>
            Sign Out
          </button>
        )}
      </div>
    </div>
  );
}
