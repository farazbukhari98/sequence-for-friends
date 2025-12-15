import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'error';
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast ${type}`} onClick={onClose}>
      {message}
    </div>
  );
}
