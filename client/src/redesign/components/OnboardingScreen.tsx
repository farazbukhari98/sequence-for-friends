import { useState, useRef, useCallback } from 'react';
import { AvatarPicker } from './AvatarPicker';
import { AVATAR_ICONS, AVATAR_COLORS } from '../../lib/avatars';
import { api } from '../../lib/api';
import './OnboardingScreen.css';

interface OnboardingScreenProps {
  suggestedName?: string;
  onComplete: (username: string, displayName: string, avatarId: string, avatarColor: string) => Promise<{ error?: string }>;
}

export function OnboardingScreen({ suggestedName, onComplete }: OnboardingScreenProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(suggestedName || '');
  const [avatarId, setAvatarId] = useState<string>(AVATAR_ICONS[0].id);
  const [avatarColor, setAvatarColor] = useState<string>(AVATAR_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const checkTimer = useRef<ReturnType<typeof setTimeout>>();

  const checkUsername = useCallback(async (name: string) => {
    if (name.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const result = await api.checkUsername(name);
      setUsernameStatus(result.available ? 'available' : 'taken');
    } catch {
      setUsernameStatus('idle'); // Allow submission — server validates
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  const handleUsernameChange = (value: string) => {
    // Only allow lowercase letters, numbers, underscores
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    setUsernameStatus('idle');
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (cleaned.length >= 3) {
      checkTimer.current = setTimeout(() => checkUsername(cleaned), 500);
    }
  };

  const handleSubmit = async () => {
    if (!username.trim() || username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (username.length > 20) {
      setError('Username must be 20 characters or less');
      return;
    }
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await onComplete(username, displayName.trim(), avatarId, avatarColor);
    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="onboarding-screen">
      <div className="onboarding-content animate-fade-in">
        <h1 className="onboarding-title">Create Your Profile</h1>
        <p className="onboarding-subtitle">Choose a username and avatar</p>

        <AvatarPicker
          selectedIcon={avatarId}
          selectedColor={avatarColor}
          onSelectIcon={setAvatarId}
          onSelectColor={setAvatarColor}
        />

        <div className="onboarding-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="e.g., coolplayer42"
              maxLength={20}
              autoComplete="off"
              autoCapitalize="off"
            />
            <p className="form-hint">
              {usernameStatus === 'checking' && 'Checking availability...'}
              {usernameStatus === 'available' && <span style={{ color: '#22c55e' }}>Username available</span>}
              {usernameStatus === 'taken' && <span style={{ color: '#ef4444' }}>Username already taken</span>}
              {usernameStatus === 'idle' && '3-20 characters, letters, numbers, underscores'}
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              maxLength={30}
              autoComplete="off"
            />
          </div>

          {error && <div className="form-error p-md">{error}</div>}

          <button
            className="btn btn-primary btn-lg w-full mt-md"
            onClick={handleSubmit}
            disabled={loading || usernameStatus === 'taken' || usernameStatus === 'checking'}
          >
            {loading ? 'Creating...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
