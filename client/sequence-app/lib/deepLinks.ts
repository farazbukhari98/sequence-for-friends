const INVITE_HOSTS = new Set([
  'sequence.wf',
  'www.sequence.wf',
  'sequence-for-friends.farazbukhari98.workers.dev',
]);

export function normalizeRoomCode(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;

  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{5}$/.test(code) ? code : null;
}

export function parseInviteRoomCode(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);

    if (url.protocol === 'sequencegame:') {
      const parts = [url.hostname, ...url.pathname.split('/')].filter(Boolean);
      const action = parts[0]?.toLowerCase();
      if ((action === 'join' || action === 'invite') && parts[1]) {
        return normalizeRoomCode(parts[1]);
      }
      return null;
    }

    if (url.protocol === 'https:' && INVITE_HOSTS.has(url.hostname.toLowerCase())) {
      const [action, code] = url.pathname.split('/').filter(Boolean);
      if (action === 'join' || action === 'invite') {
        return normalizeRoomCode(code);
      }
    }
  } catch {
    return null;
  }

  return null;
}
