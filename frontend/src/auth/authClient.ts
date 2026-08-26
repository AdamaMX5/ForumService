// Thin client for the AuthService endpoints ForumThread's standalone login/register/refresh
// flow needs (see .claude/MSArchitecture/AuthService.md). All calls use credentials: 'include'
// so the HttpOnly refresh_token / readable csrf_token cookies (scoped to /user/refresh on the
// AuthService origin) are sent automatically.

export interface LoginResult {
  id: string;
  email: string;
  roles: string[];
  access_token: string;
  status: 'login' | 'login_with_verify_email_send' | 'register';
  last_login?: string;
}

export interface RefreshResult {
  access_token: string;
}

function baseUrl(): string {
  const url = import.meta.env.VITE_AUTH_SERVICE_URL;
  if (!url) throw new Error('VITE_AUTH_SERVICE_URL is not configured');
  return url.replace(/\/$/, '');
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const message = (body && (body.message || body.error)) || `AuthService request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export async function checkEmail(email: string): Promise<{ status: 'login' | 'register' }> {
  const res = await fetch(`${baseUrl()}/user/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseJsonOrThrow(res);
}

export async function login(params: {
  email: string;
  password: string;
  device_name?: string;
}): Promise<LoginResult> {
  const res = await fetch(`${baseUrl()}/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ device_name: 'ForumThread Web', ...params }),
  });
  return parseJsonOrThrow(res);
}

export async function registerComplete(params: {
  email: string;
  password: string;
  repassword: string;
  device_name?: string;
}): Promise<LoginResult> {
  const res = await fetch(`${baseUrl()}/user/register-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ device_name: 'ForumThread Web', ...params }),
  });
  return parseJsonOrThrow(res);
}

/** Silent refresh using the refresh_token/csrf_token cookies. Rejects if no valid session exists. */
export async function refresh(): Promise<RefreshResult> {
  const csrfToken = readCookie('csrf_token');
  const res = await fetch(`${baseUrl()}/user/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
  });
  return parseJsonOrThrow(res);
}

export async function logout(): Promise<void> {
  await fetch(`${baseUrl()}/user/logout`, { method: 'POST', credentials: 'include' });
}
