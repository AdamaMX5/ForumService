// Client-side JWT payload decoding only - NEVER trust this for authorization decisions, it is
// purely for reading `sub`/`roles`/`exp` to drive UI state (e.g. "am I logged in", "when to
// refresh"). Signature verification happens exclusively on the backend against the AuthService
// RS256 public key.

export interface JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
  permissions?: Record<string, unknown>;
  exp: number; // seconds since epoch
  iat?: number;
}

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
  // atob is available in both browser and jsdom test environments.
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = base64UrlDecode(parts[1]);
    const payload = JSON.parse(json) as JwtPayload;
    if (typeof payload.exp !== 'number' || typeof payload.sub !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

export function isExpired(payload: JwtPayload, skewSeconds = 0): boolean {
  return Date.now() >= (payload.exp - skewSeconds) * 1000;
}

/** Milliseconds until the token should be proactively refreshed (exp - 60s), floored at 0. */
export function msUntilRefresh(payload: JwtPayload, leadSeconds = 60): number {
  const refreshAt = (payload.exp - leadSeconds) * 1000;
  return Math.max(0, refreshAt - Date.now());
}
