import { RoomDO } from './room-do.js';

export { RoomDO };

export interface Env {
  ROOM: DurableObjectNamespace;
  PLAYER_TOKENS: KVNamespace;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // ========== HTTP ROUTES ==========

    // Apple App Site Association
    if (path === '/.well-known/apple-app-site-association') {
      return jsonResponse({
        applinks: {
          apps: [],
          details: [
            {
              appID: '469Q8Z675Y.com.farazbukhari.sequence',
              paths: ['/join/*', '/invite/*'],
            },
          ],
        },
      });
    }

    // Deep link join page
    const joinMatch = path.match(/^\/join\/([A-Za-z0-9]+)$/);
    if (joinMatch) {
      const roomCode = joinMatch[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
      return htmlResponse(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Join Sequence Game</title>
<style>
  body { background: #0a0a0a; color: #fff; font-family: -apple-system, system-ui, sans-serif;
    display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
  .container { padding: 24px; }
  h1 { font-size: 1.5rem; margin-bottom: 8px; }
  p { color: #888; margin-bottom: 24px; }
  .btn { display: inline-block; background: #6366f1; color: #fff; padding: 14px 32px;
    border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 1rem; margin-bottom: 12px; }
  .store-link { display: inline-block; color: #6366f1; font-size: 0.9rem; }
</style>
</head><body>
<div class="container">
  <h1>Sequence for Friends</h1>
  <p>You've been invited to join a game!</p>
  <a class="btn" id="openApp" href="sequencegame://join/${roomCode}">Open in App</a>
  <br>
  <a class="store-link" href="https://apps.apple.com/app/sequence-for-friends/id6744899989">Don't have the app? Download from the App Store</a>
</div>
<script>
  window.location.href = 'sequencegame://join/${roomCode}';
</script>
</body></html>`);
    }

    // Privacy Policy
    if (path === '/privacy') {
      return htmlResponse(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Privacy Policy - Sequence for Friends</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #e0e0e0; background: #1a1a2e; }
  h1 { color: #fff; } h2 { color: #ccc; margin-top: 1.5em; }
  a { color: #6c9bff; }
</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p><strong>Last updated:</strong> February 19, 2026</p>

<h2>Overview</h2>
<p>Sequence for Friends ("the App") is a multiplayer board game. We are committed to protecting your privacy. This policy explains what data we collect and how we use it.</p>

<h2>Data We Collect</h2>
<p>The App does <strong>not</strong> collect, store, or share any personal information. Specifically:</p>
<ul>
<li>No account registration or login is required</li>
<li>No names, email addresses, or phone numbers are collected</li>
<li>No analytics or tracking services are used</li>
<li>No cookies are used for tracking purposes</li>
<li>No data is sold to third parties</li>
</ul>

<h2>Gameplay Data</h2>
<p>When you play, temporary game data (room codes, player display names, and game state) is held in Durable Object storage for the duration of your session. This data is automatically deleted when the game room expires.</p>

<h2>Third-Party Services</h2>
<p>The App does not integrate with any third-party analytics, advertising, or data collection services.</p>

<h2>Children's Privacy</h2>
<p>The App does not knowingly collect any personal information from children or any other users.</p>

<h2>Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated date.</p>

<h2>Contact</h2>
<p>If you have questions about this Privacy Policy, please contact us at <a href="mailto:farazbukhari98@gmail.com">farazbukhari98@gmail.com</a>.</p>
</body>
</html>`);
    }

    // Root redirect
    if (path === '/') {
      return Response.redirect('https://apps.apple.com/app/sequence-for-friends/id6744899989', 302);
    }

    // ========== WEBSOCKET ROUTES ==========

    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Not found', { status: 404 });
    }

    // WS /ws/create -> generate room code, forward to new DO
    if (path === '/ws/create') {
      const roomCode = generateRoomCode();
      const doId = env.ROOM.idFromName(roomCode);
      const stub = env.ROOM.get(doId);
      // Pass room code and env bindings via headers
      const newHeaders = new Headers(request.headers);
      newHeaders.set('X-Room-Code', roomCode);
      newHeaders.set('X-Action', 'create');
      const newRequest = new Request(request.url, {
        headers: newHeaders,
        body: request.body,
        method: request.method,
      });
      return stub.fetch(newRequest);
    }

    // WS /ws/room/:roomCode -> forward to existing DO
    const roomMatch = path.match(/^\/ws\/room\/([A-Za-z0-9]+)$/);
    if (roomMatch) {
      const roomCode = roomMatch[1].toUpperCase();
      const doId = env.ROOM.idFromName(roomCode);
      const stub = env.ROOM.get(doId);
      const newHeaders = new Headers(request.headers);
      newHeaders.set('X-Room-Code', roomCode);
      newHeaders.set('X-Action', 'join');
      const newRequest = new Request(request.url, {
        headers: newHeaders,
        body: request.body,
        method: request.method,
      });
      return stub.fetch(newRequest);
    }

    // WS /ws/reconnect?token=xxx -> lookup KV, forward to DO
    if (path === '/ws/reconnect') {
      const token = url.searchParams.get('token');
      if (!token) {
        return new Response('Missing token', { status: 400 });
      }

      const tokenData = await env.PLAYER_TOKENS.get(token);
      if (!tokenData) {
        return new Response('Invalid token', { status: 404 });
      }

      const { roomCode, playerId } = JSON.parse(tokenData) as { roomCode: string; playerId: string };
      const doId = env.ROOM.idFromName(roomCode);
      const stub = env.ROOM.get(doId);
      const newHeaders = new Headers(request.headers);
      newHeaders.set('X-Room-Code', roomCode);
      newHeaders.set('X-Action', 'reconnect');
      newHeaders.set('X-Player-Id', playerId);
      newHeaders.set('X-Player-Token', token);
      const newRequest = new Request(request.url, {
        headers: newHeaders,
        body: request.body,
        method: request.method,
      });
      return stub.fetch(newRequest);
    }

    return new Response('Not found', { status: 404 });
  },
};
