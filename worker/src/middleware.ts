import type { Env } from './index.js';
import { verifySessionToken } from './auth.js';

export interface AuthUser {
  userId: string;
  username: string;
}

/**
 * Extract and verify session token from Authorization header.
 * Returns the authenticated user or null if not authenticated.
 */
export async function authenticate(
  request: Request,
  env: Env
): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) {
    return null;
  }

  try {
    const payload = await verifySessionToken(token, env.AUTH_SECRET);
    return { userId: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}

/**
 * Require authentication. Returns AuthUser or a 401 Response.
 */
export async function requireAuth(
  request: Request,
  env: Env
): Promise<AuthUser | Response> {
  const user = await authenticate(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return user;
}
