import type { Env } from './index.js';

// ============================================
// APPLE JWT VERIFICATION
// ============================================

interface AppleJWK {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

interface AppleJWKS {
  keys: AppleJWK[];
}

interface AppleTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  email?: string;
  email_verified?: string;
  nonce?: string;
}

function base64UrlDecode(str: string): Uint8Array {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function fetchAppleJWKS(env: Env): Promise<AppleJWKS> {
  // Check cache first
  const cached = await env.APPLE_JWKS.get('apple_jwks', 'json');
  if (cached) {
    return cached as AppleJWKS;
  }

  const response = await fetch('https://appleid.apple.com/auth/keys');
  if (!response.ok) {
    throw new Error('Failed to fetch Apple JWKS');
  }

  const jwks = await response.json() as AppleJWKS;

  // Cache for 24 hours
  await env.APPLE_JWKS.put('apple_jwks', JSON.stringify(jwks), {
    expirationTtl: 86400,
  });

  return jwks;
}

export async function verifyAppleIdentityToken(
  identityToken: string,
  env: Env
): Promise<AppleTokenPayload> {
  // Split JWT
  const parts = identityToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Decode header to get kid
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }

  // Fetch Apple's public keys
  const jwks = await fetchAppleJWKS(env);
  const key = jwks.keys.find(k => k.kid === header.kid);
  if (!key) {
    // Clear cache and retry once in case keys rotated
    await env.APPLE_JWKS.delete('apple_jwks');
    const freshJwks = await fetchAppleJWKS(env);
    const freshKey = freshJwks.keys.find(k => k.kid === header.kid);
    if (!freshKey) {
      throw new Error('Apple public key not found');
    }
    return verifyWithKey(freshKey, headerB64, payloadB64, signatureB64);
  }

  return verifyWithKey(key, headerB64, payloadB64, signatureB64);
}

async function verifyWithKey(
  key: AppleJWK,
  headerB64: string,
  payloadB64: string,
  signatureB64: string
): Promise<AppleTokenPayload> {
  // Import the RSA public key
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: key.kty,
      n: key.n,
      e: key.e,
      alg: 'RS256',
      use: 'sig',
    },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Verify signature
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signature,
    signedData
  );

  if (!valid) {
    throw new Error('Invalid signature');
  }

  // Decode and validate payload
  const payload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payloadB64))
  ) as AppleTokenPayload;

  // Validate claims
  if (payload.iss !== 'https://appleid.apple.com') {
    throw new Error('Invalid issuer');
  }

  if (payload.aud !== 'com.farazbukhari.sequence') {
    throw new Error('Invalid audience');
  }

  if (payload.exp * 1000 < Date.now()) {
    throw new Error('Token expired');
  }

  return payload;
}

// ============================================
// SESSION JWT (HMAC-SHA256)
// ============================================

interface SessionPayload {
  sub: string; // userId
  username: string;
  iat: number;
  exp: number;
}

export async function createSessionToken(
  userId: string,
  username: string,
  secret: string
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: userId,
    username,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 days
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<SessionPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecode(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );

  if (!valid) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payloadB64))
  ) as SessionPayload;

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}
