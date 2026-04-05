import { RoomDO } from './room-do.js';
import { handleApiRequest } from './api.js';
import { verifySessionToken } from './auth.js';

export { RoomDO };

export interface Env {
  ROOM: DurableObjectNamespace;
  PLAYER_TOKENS: KVNamespace;
  APPLE_JWKS: KVNamespace;
  DB: D1Database;
  AUTH_SECRET: string;
  APNS_KEY: string;
  APNS_KEY_ID: string;
  APNS_TEAM_ID: string;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[bytes[i] % chars.length];
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

    // Invite deep link — redirect to /join/:code (AASA declares /invite/*)
    const inviteMatch = path.match(/^\/invite\/([A-Za-z0-9]+)$/);
    if (inviteMatch) {
      const code = inviteMatch[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
      return Response.redirect(`${url.origin}/join/${code}`, 302);
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
<p><strong>Last updated:</strong> February 27, 2026</p>

<h2>Overview</h2>
<p>Sequence for Friends ("the App") is a multiplayer board game. We are committed to protecting your privacy. This policy explains what data we collect and how we use it.</p>

<h2>Authentication</h2>
<p>The App uses <strong>Sign in with Apple</strong> for account creation and login. We receive and store only:</p>
<ul>
<li>Your Apple user identifier (a unique, anonymous ID specific to our app)</li>
<li>Your first name (only if you choose to share it during sign-in)</li>
</ul>
<p>We do <strong>not</strong> receive or store your email address, Apple ID, or password. Apple's privacy relay ensures we cannot track you across apps.</p>

<h2>Account Data</h2>
<p>When you create an account, we store:</p>
<ul>
<li><strong>Username</strong> &ndash; A unique handle you choose (visible to other players)</li>
<li><strong>Display name</strong> &ndash; The name shown during games</li>
<li><strong>Avatar</strong> &ndash; Your chosen icon and color</li>
</ul>

<h2>Gameplay Data</h2>
<p>We store aggregate game statistics tied to your account, including games played, win/loss records, streaks, and card usage. Individual game history (room code, duration, participants, outcome) is also retained so you can review past matches.</p>
<p>Active game state (room codes, player hands, board positions) is held in temporary Durable Object storage and automatically deleted when the game room expires.</p>

<h2>Friends &amp; Invites</h2>
<p>The App includes a friend system. We store friend relationships (who you are connected with) and game invite records. Friend requests are visible only to the sender and recipient.</p>

<h2>Push Notifications</h2>
<p>If you grant permission, we store your device push notification token to deliver game invites. You can disable push notifications at any time via iOS Settings. Your device token is deleted when you sign out.</p>

<h2>Data Storage &amp; Security</h2>
<p>All data is stored on <strong>Cloudflare</strong> infrastructure (Workers, D1 database, KV). Data is encrypted in transit (TLS) and at rest. Authentication tokens are signed with HMAC-SHA256 and expire after 30 days.</p>

<h2>Third-Party Services</h2>
<ul>
<li><strong>Apple</strong> &ndash; Authentication via Sign in with Apple</li>
<li><strong>Cloudflare</strong> &ndash; Hosting, database, and content delivery</li>
<li><strong>Apple Push Notification service (APNs)</strong> &ndash; Delivering push notifications</li>
</ul>
<p>We do <strong>not</strong> use analytics, advertising, or tracking services. No data is sold to third parties.</p>

<h2>Data Retention &amp; Deletion</h2>
<p>Your account data is retained as long as your account exists. You may request account deletion by contacting us at the email below. Upon deletion, all associated data (profile, stats, friends, game history) will be permanently removed.</p>

<h2>Children's Privacy</h2>
<p>The App does not knowingly collect personal information from children under 13. If you believe a child has created an account, please contact us so we can delete it.</p>

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

    // ========== API ROUTES ==========
    if (path.startsWith('/api/')) {
      return handleApiRequest(request, env, path);
    }

    // ========== WEBSOCKET ROUTES ==========

    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Not found', { status: 404 });
    }

    // Extract authenticated user from WebSocket URL query param
    const authToken = url.searchParams.get('auth');
    let authenticatedUserId: string | null = null;
    if (authToken && env.AUTH_SECRET) {
      try {
        const payload = await verifySessionToken(authToken, env.AUTH_SECRET);
        authenticatedUserId = payload.sub;
      } catch (err) {
        console.warn('[AUTH] WebSocket auth failed:', err instanceof Error ? err.message : err);
      }
    }

    // WS /ws/create -> generate room code, forward to new DO
    if (path === '/ws/create') {
      // Rate limit: 5 per minute per IP
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const rlKey = `rl:ws-create:${ip}`;
      const current = parseInt(await env.PLAYER_TOKENS.get(rlKey) || '0');
      if (current >= 5) {
        return new Response('Too many requests', { status: 429 });
      }
      await env.PLAYER_TOKENS.put(rlKey, String(current + 1), { expirationTtl: 60 });

      const roomCode = generateRoomCode();
      const doId = env.ROOM.idFromName(roomCode);
      const stub = env.ROOM.get(doId);
      // Pass room code and env bindings via headers
      const newHeaders = new Headers(request.headers);
      newHeaders.set('X-Room-Code', roomCode);
      newHeaders.set('X-Action', 'create');
      if (authenticatedUserId) newHeaders.set('X-User-Id', authenticatedUserId);
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
      if (authenticatedUserId) newHeaders.set('X-User-Id', authenticatedUserId);
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
      if (authenticatedUserId) newHeaders.set('X-User-Id', authenticatedUserId);
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
