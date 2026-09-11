import crypto from 'crypto';

function base64UrlEncode(strOrBuffer: string | Buffer): string {
  const buf = typeof strOrBuffer === 'string' ? Buffer.from(strOrBuffer, 'utf8') : strOrBuffer;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export interface JwtClaims {
  sub?: string;
  email?: string;
  aud?: string;
  role?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

export function signJwt(
  payload: Record<string, any>,
  secret: string,
  expiresInSeconds: number = 7 * 86400
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtClaims = {
    sub: payload.sub || '',
    aud: 'authenticated',
    role: 'authenticated',
    iat: now,
    exp: now + expiresInSeconds,
    ...payload,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signatureInput);
  const encodedSignature = base64UrlEncode(hmac.digest());

  return `${signatureInput}.${encodedSignature}`;
}

export function verifyJwt(
  token: string,
  secret: string
): { valid: boolean; payload?: JwtClaims; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Empty token' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed token structure' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signatureInput);
  const expectedSignature = base64UrlEncode(hmac.digest());

  // Constant-time signature comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Invalid token signature' };
  }

  try {
    const payloadJson = base64UrlDecode(encodedPayload);
    const payload: JwtClaims = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: 'Failed to decode payload' };
  }
}

