import { afterEach, describe, expect, it, vi } from 'vitest';
import { withRefreshLock } from './refreshLock';

describe('withRefreshLock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('de-dupes overlapping calls via the in-memory fallback when navigator.locks is unavailable', async () => {
    // jsdom does not implement the Web Locks API, so this exercises the real fallback path used
    // in the test environment (and in any browser without navigator.locks support).
    expect('locks' in navigator).toBe(false);

    let starts = 0;
    let running = 0;
    let concurrentRunsObserved = 0;

    async function task(name: string, ms: number) {
      return withRefreshLock(async () => {
        starts += 1;
        running += 1;
        concurrentRunsObserved = Math.max(concurrentRunsObserved, running);
        await new Promise((r) => setTimeout(r, ms));
        running -= 1;
        return name;
      });
    }

    // Two callers racing while one is already in flight must share that single in-flight
    // execution instead of each burning their own call against the caller-supplied fn (e.g. a
    // rotating-refresh-token request) - see the module docstring for why this matters.
    const [a, b] = await Promise.all([task('a', 30), task('b', 5)]);

    expect(starts).toBe(1);
    expect(concurrentRunsObserved).toBe(1);
    expect(a).toBe('a');
    expect(b).toBe('a'); // b piggybacks on a's in-flight result rather than running its own fn

    // Once that call has fully settled, a genuinely new call still runs its own fn afresh.
    const c = await task('c', 1);
    expect(c).toBe('c');
    expect(starts).toBe(2);
  });

  it('propagates a rejection to only that call without wedging the queue for later calls', async () => {
    await expect(
      withRefreshLock(async () => {
        throw new Error('refresh failed');
      })
    ).rejects.toThrow('refresh failed');

    // A subsequent call must still run normally - one failed refresh must not deadlock the mutex.
    await expect(withRefreshLock(async () => 'ok')).resolves.toBe('ok');
  });

  it('de-dupes overlapping calls that race while a Web Locks-backed refresh is in flight', async () => {
    const request = vi.fn((_name: string, fn: () => Promise<unknown>) => fn());
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });

    let starts = 0;
    async function task() {
      return withRefreshLock(async () => {
        starts += 1;
        await new Promise((r) => setTimeout(r, 10));
        return 'result';
      });
    }

    const [a, b] = await Promise.all([task(), task()]);

    expect(starts).toBe(1);
    expect(a).toBe('result');
    expect(b).toBe('result');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('uses navigator.locks.request when the Web Locks API is available', async () => {
    const request = vi.fn((_name: string, fn: () => Promise<unknown>) => fn());
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });

    const result = await withRefreshLock(async () => 'via-web-locks');

    expect(result).toBe('via-web-locks');
    expect(request).toHaveBeenCalledWith('forum-auth-refresh', expect.any(Function));
  });
});
