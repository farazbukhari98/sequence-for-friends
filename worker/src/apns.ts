import type { Env } from './index.js';

// ============================================
// APNs JWT (ES256 / P-256)
// ============================================

// Cache the JWT and its expiry
let cachedApnsJwt: string | null = null;
let cachedApnsJwtExpiry = 0;

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Import a .p8 APNs key (PEM-encoded PKCS#8) as a CryptoKey.
 */
async function importApnsKey(pemContents: string): Promise<CryptoKey> {
  // Strip PEM headers and whitespace
  const base64 = pemContents
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'pkcs8',
    bytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

/**
 * Create an APNs provider JWT (ES256-signed), valid for ~50 minutes.
 */
async function createApnsJwt(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached JWT if still fresh (< 50 min old)
  if (cachedApnsJwt && now < cachedApnsJwtExpiry) {
    return cachedApnsJwt;
  }

  const header = { alg: 'ES256', kid: env.APNS_KEY_ID };
  const payload = { iss: env.APNS_TEAM_ID, iat: now };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));

  const key = await importApnsKey(env.APNS_KEY);
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );

  // Convert DER-encoded signature to raw r||s format for JWT
  const rawSignature = derToRaw(new Uint8Array(signatureBuffer));
  const signatureB64 = base64UrlEncode(rawSignature);

  const jwt = `${headerB64}.${payloadB64}.${signatureB64}`;

  // Cache for 50 minutes
  cachedApnsJwt = jwt;
  cachedApnsJwtExpiry = now + 50 * 60;

  return jwt;
}

/**
 * Convert DER-encoded ECDSA signature to raw r||s format.
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  let offset = 2; // Skip 0x30 and total length

  // Read r
  if (der[offset] !== 0x02) throw new Error('Invalid DER signature');
  offset++;
  const rLen = der[offset++];
  let r = der.slice(offset, offset + rLen);
  offset += rLen;

  // Read s
  if (der[offset] !== 0x02) throw new Error('Invalid DER signature');
  offset++;
  const sLen = der[offset++];
  let s = der.slice(offset, offset + sLen);

  // Pad or trim to 32 bytes each
  const rPadded = padOrTrimTo32(r);
  const sPadded = padOrTrimTo32(s);

  const raw = new Uint8Array(64);
  raw.set(new Uint8Array(rPadded.buffer, rPadded.byteOffset, rPadded.byteLength), 0);
  raw.set(new Uint8Array(sPadded.buffer, sPadded.byteOffset, sPadded.byteLength), 32);
  return raw;
}

function padOrTrimTo32(buf: Uint8Array): Uint8Array {
  if (buf.length === 32) return buf;
  if (buf.length > 32) {
    // Remove leading zeros
    return buf.slice(buf.length - 32);
  }
  // Pad with leading zeros
  const padded = new Uint8Array(32);
  padded.set(buf, 32 - buf.length);
  return padded;
}

// ============================================
// SEND PUSH NOTIFICATION
// ============================================

export interface PushPayload {
  alert: {
    title: string;
    body: string;
  };
  sound?: string;
  badge?: number;
  data?: Record<string, string>;
}

export interface PushResult {
  success: boolean;
  staleToken: boolean;
}

export async function sendPushNotification(
  deviceToken: string,
  payload: PushPayload,
  env: Env
): Promise<PushResult> {
  try {
    const jwt = await createApnsJwt(env);

    const apnsHost = (env as any).APNS_SANDBOX === 'true'
      ? 'api.sandbox.push.apple.com'
      : 'api.push.apple.com';

    const apnsPayload: Record<string, unknown> = {
      aps: {
        alert: payload.alert,
        sound: payload.sound || 'default',
        ...(payload.badge !== undefined && { badge: payload.badge }),
      },
      ...(payload.data || {}),
    };

    const response = await fetch(
      `https://${apnsHost}/3/device/${deviceToken}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'apns-topic': 'com.farazbukhari.sequence',
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apnsPayload),
      }
    );

    if (response.status === 410) {
      return { success: false, staleToken: true };
    }

    return { success: response.status === 200, staleToken: false };
  } catch (err) {
    console.error('APNs push failed:', err);
    return { success: false, staleToken: false };
  }
}
