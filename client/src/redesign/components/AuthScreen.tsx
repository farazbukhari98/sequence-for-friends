import { useState } from 'react';
import './AuthScreen.css';

interface AuthScreenProps {
  onSignIn: () => Promise<{ needsUsername: boolean; tempToken?: string; suggestedName?: string; error?: string }>;
  onNeedsUsername: (tempToken: string, suggestedName?: string) => void;
}

export function AuthScreen({ onSignIn, onNeedsUsername }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);

    const result = await onSignIn();

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.needsUsername && result.tempToken) {
      onNeedsUsername(result.tempToken, result.suggestedName);
      setLoading(false);
      return;
    }

    // If !needsUsername and no error, signIn completed - parent will handle navigation
    setLoading(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-content animate-fade-in">
        <div className="auth-logo">
          <div className="logo-icon">
            <span className="logo-s">S</span>
            <div className="logo-chips">
              <span className="chip chip-blue"></span>
              <span className="chip chip-green"></span>
              <span className="chip chip-red"></span>
            </div>
          </div>
          <h1 className="auth-title">Sequence</h1>
          <p className="auth-subtitle">for Friends</p>
        </div>

        <div className="auth-actions">
          <button
            className="btn-apple-signin"
            onClick={handleSignIn}
            disabled={loading}
          >
            <svg className="apple-logo" viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Apple'}
          </button>

          {error && <p className="auth-error">{error}</p>}
        </div>

        <p className="auth-footer">
          Play the classic card-sequence board game with friends
        </p>
      </div>
    </div>
  );
}
