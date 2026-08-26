import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumAuthProvider, useForumAuth } from './AuthContext';
import * as authClient from './authClient';
import { server } from '../mocks/server';

const FORUM_BASE_URL = 'http://localhost:3000';

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function makeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.sig`;
}

function internalWrapper({ children }: { children: ReactNode }) {
  return <ForumAuthProvider forumApiBaseUrl={FORUM_BASE_URL}>{children}</ForumAuthProvider>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ForumAuthProvider - internal login/refresh flow', () => {
  it('has no active session by default (mount refresh fails silently) but becomes ready', async () => {
    vi.spyOn(authClient, 'refresh').mockRejectedValue(new Error('no session'));

    const { result } = renderHook(() => useForumAuth(), { wrapper: internalWrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.accessToken).toBeNull();
    expect(result.current.isExternallyManaged).toBe(false);
  });

  it('schedules the proactive refresh at exp-60s rather than a fixed poll interval', async () => {
    vi.spyOn(authClient, 'refresh').mockRejectedValue(new Error('no session'));
    vi.spyOn(authClient, 'login').mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      roles: [],
      status: 'login',
      access_token: makeJwt({ sub: 'u1', exp: nowSeconds() + 300 }), // expires in 5 min
    });

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    const { result } = renderHook(() => useForumAuth(), { wrapper: internalWrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    setTimeoutSpy.mockClear();

    await act(async () => {
      await result.current.login('a@b.c', 'pw');
    });

    // exp(300s) - 60s lead = a ~240000ms timer, not some unrelated fixed poll value (e.g. 10 min).
    const delays = setTimeoutSpy.mock.calls.map((call) => call[1]);
    expect(delays).toContainEqual(expect.any(Number));
    const scheduled = delays.find((d) => typeof d === 'number' && d > 100000) as number;
    expect(scheduled).toBeGreaterThan(235000);
    expect(scheduled).toBeLessThan(245000);
  });

  it('schedules a different delay for a token with a different exp (proves it is computed, not constant)', async () => {
    vi.spyOn(authClient, 'refresh').mockRejectedValue(new Error('no session'));
    const loginSpy = vi.spyOn(authClient, 'login');

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const { result } = renderHook(() => useForumAuth(), { wrapper: internalWrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    loginSpy.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.c',
      roles: [],
      status: 'login',
      access_token: makeJwt({ sub: 'u1', exp: nowSeconds() + 300 }),
    });
    setTimeoutSpy.mockClear();
    await act(async () => {
      await result.current.login('a@b.c', 'pw');
    });
    const firstDelay = setTimeoutSpy.mock.calls
      .map((c) => c[1] as number)
      .find((d) => typeof d === 'number' && d > 100000)!;

    loginSpy.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@b.c',
      roles: [],
      status: 'login',
      access_token: makeJwt({ sub: 'u1', exp: nowSeconds() + 3600 }),
    });
    setTimeoutSpy.mockClear();
    await act(async () => {
      await result.current.login('a@b.c', 'pw');
    });
    const secondDelay = setTimeoutSpy.mock.calls
      .map((c) => c[1] as number)
      .find((d) => typeof d === 'number' && d > 100000)!;

    expect(firstDelay).not.toBe(secondDelay);
    expect(secondDelay).toBeGreaterThan(firstDelay);
  });

  async function setUpConcurrentMutexScenario() {
    vi.spyOn(authClient, 'refresh').mockRejectedValueOnce(new Error('no session')); // mount's auto-login attempt
    vi.spyOn(authClient, 'login').mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      roles: [],
      status: 'login',
      access_token: makeJwt({ sub: 'u1', exp: nowSeconds() + 900 }),
    });

    let aHits = 0;
    let bHits = 0;
    server.use(
      http.get(`${FORUM_BASE_URL}/nodes/mutex-a`, () => {
        aHits += 1;
        return aHits === 1
          ? HttpResponse.json({ error: 'expired' }, { status: 401 })
          : HttpResponse.json({ id: 'mutex-a' });
      }),
      http.get(`${FORUM_BASE_URL}/nodes/mutex-b`, () => {
        bHits += 1;
        return bHits === 1
          ? HttpResponse.json({ error: 'expired' }, { status: 401 })
          : HttpResponse.json({ id: 'mutex-b' });
      })
    );

    const { result } = renderHook(() => useForumAuth(), { wrapper: internalWrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    // Establish a real (soon-to-be-treated-as-stale-by-our-mock-endpoints) token first, so the
    // two calls below actually attach an Authorization header and hit the 401 branch at all.
    await act(async () => {
      await result.current.login('a@b.c', 'pw');
    });
    await waitFor(() => expect(result.current.accessToken).not.toBeNull());

    const refreshSpy = vi.spyOn(authClient, 'refresh').mockImplementation(async () => {
      await delay(20); // widen the race window so both callers are genuinely in flight together
      return { access_token: makeJwt({ sub: 'u1', exp: nowSeconds() + 900 }) };
    });
    refreshSpy.mockClear();

    let a: unknown;
    let b: unknown;
    await act(async () => {
      [a, b] = await Promise.all([
        result.current.api.getNode('mutex-a').catch((e) => e),
        result.current.api.getNode('mutex-b').catch((e) => e),
      ]);
    });

    return { a, b, refreshSpy };
  }

  it('mutex: serializes two concurrent 401-triggered refreshes so both requests still succeed', async () => {
    const { a, b } = await setUpConcurrentMutexScenario();

    expect(a).toEqual({ id: 'mutex-a' });
    expect(b).toEqual({ id: 'mutex-b' });
  });

  // ensureFreshTokenInternal shares one in-flight authClient.refresh() promise across
  // concurrent callers (via withRefreshLock's in-flight de-dup, see refreshLock.ts) instead of
  // each 401 starting its own refresh call - otherwise two callers racing the same rotating
  // refresh_token would burn it twice for a single burst.
  it('mutex: two concurrent 401-triggered refreshes should only hit AuthService once', async () => {
    const { refreshSpy } = await setUpConcurrentMutexScenario();

    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('never writes the access token into localStorage across login/refresh', async () => {
    const exp = nowSeconds() + 300;
    const token = makeJwt({ sub: 'u1', exp });
    vi.spyOn(authClient, 'refresh').mockRejectedValue(new Error('no session'));
    vi.spyOn(authClient, 'login').mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      roles: [],
      status: 'login',
      access_token: token,
    });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() => useForumAuth(), { wrapper: internalWrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => {
      await result.current.login('a@b.c', 'pw');
    });

    await waitFor(() => expect(result.current.accessToken).toBe(token));

    expect(setItemSpy).not.toHaveBeenCalled();
    const dumped = JSON.stringify({ ...localStorage });
    expect(dumped).not.toContain(token);
    expect(localStorage.length).toBe(0);
  });
});

describe('ForumAuthProvider - externalAuth disables the internal flow', () => {
  function externalWrapper(accessToken: string | null, onNeedRefresh?: () => Promise<string>) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <ForumAuthProvider forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken, onNeedRefresh }}>
          {children}
        </ForumAuthProvider>
      );
    };
  }

  it('is ready immediately and never calls authClient.refresh on mount', async () => {
    const refreshSpy = vi.spyOn(authClient, 'refresh');

    const { result } = renderHook(() => useForumAuth(), { wrapper: externalWrapper('ext-token-1') });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.isExternallyManaged).toBe(true);
    expect(result.current.accessToken).toBe('ext-token-1');
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('routes a 401 retry through externalAuth.onNeedRefresh instead of authClient.refresh', async () => {
    const refreshSpy = vi.spyOn(authClient, 'refresh');
    const onNeedRefresh = vi.fn().mockResolvedValue('ext-token-2');

    let hits = 0;
    server.use(
      http.get(`${FORUM_BASE_URL}/nodes/ext-node`, () => {
        hits += 1;
        return hits === 1
          ? HttpResponse.json({ error: 'expired' }, { status: 401 })
          : HttpResponse.json({ id: 'ext-node' });
      })
    );

    const { result } = renderHook(() => useForumAuth(), {
      wrapper: externalWrapper('ext-token-1', onNeedRefresh),
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    const node = await result.current.api.getNode('ext-node');

    expect(node).toEqual({ id: 'ext-node' });
    expect(onNeedRefresh).toHaveBeenCalledTimes(1);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('rejects refresh attempts when externalAuth has no onNeedRefresh, without falling back internally', async () => {
    const refreshSpy = vi.spyOn(authClient, 'refresh');

    server.use(
      http.get(`${FORUM_BASE_URL}/nodes/ext-node-2`, () =>
        HttpResponse.json({ error: 'expired' }, { status: 401 })
      )
    );

    const { result } = renderHook(() => useForumAuth(), { wrapper: externalWrapper('ext-token-1') });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await expect(result.current.api.getNode('ext-node-2')).rejects.toThrow();
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
