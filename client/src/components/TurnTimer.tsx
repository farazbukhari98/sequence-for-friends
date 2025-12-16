import { useState, useEffect } from 'react';
import type { TurnTimeLimit } from '../../../shared/types';
import './TurnTimer.css';

interface TurnTimerProps {
  turnTimeLimit: TurnTimeLimit;
  turnStartedAt: number | null;
  isMyTurn: boolean;
}

export function TurnTimer({ turnTimeLimit, turnStartedAt, isMyTurn }: TurnTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    // No timer if limit is 0 or no start time
    if (turnTimeLimit === 0 || !turnStartedAt) {
      setTimeLeft(null);
      return;
    }

    // Calculate initial time left
    const calculateTimeLeft = () => {
      const elapsed = (Date.now() - turnStartedAt) / 1000;
      const remaining = Math.max(0, turnTimeLimit - elapsed);
      return Math.ceil(remaining);
    };

    setTimeLeft(calculateTimeLeft());

    // Update every 100ms for smooth countdown
    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [turnTimeLimit, turnStartedAt]);

  // Don't render if no timer
  if (timeLeft === null || turnTimeLimit === 0) {
    return null;
  }

  const isLow = timeLeft <= 5;
  const isCritical = timeLeft <= 3;
  const percentage = (timeLeft / turnTimeLimit) * 100;

  return (
    <div className={`turn-timer ${isMyTurn ? 'my-turn' : ''} ${isLow ? 'low' : ''} ${isCritical ? 'critical' : ''}`}>
      <div className="timer-bar">
        <div
          className="timer-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="timer-text">
        {timeLeft}s
      </div>
    </div>
  );
}
