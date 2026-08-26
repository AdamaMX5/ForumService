// Prevents this app's own AuthProvider from firing overlapping refresh calls against
// AuthService's rotating refresh_token (e.g. a proactive timer firing at the same moment as a
// reactive 401-triggered refresh). Two layers:
//
// 1. In-flight de-duplication: if a refresh is already running anywhere in this tab, every other
//    caller is handed the *same* promise instead of starting a second `fn()` call. This is the
//    part that actually matters - without it, two concurrent callers would each successfully
//    acquire the lock in turn and each burn one rotation of the refresh_token, which is wasteful
//    and, on the in-memory fallback path below, can race a second same-tab caller against a
//    refresh_token cookie that a *different* tab is rotating at the same moment.
// 2. Serialization (Web Locks API where available, coordinating across same-origin tabs too;
//    falling back to a simple in-memory promise chain otherwise) for the case where a genuinely
//    new refresh needs to start only after a previous, unrelated one has finished.
//
// Note: this cannot prevent a *different* app/origin from racing the same rotating cookie -
// see forumApi's refresh-and-retry-once handling for how that case is absorbed gracefully.

const LOCK_NAME = 'forum-auth-refresh';

let inMemoryChain: Promise<unknown> = Promise.resolve();
let inFlight: Promise<unknown> | null = null;

export async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight) return inFlight as Promise<T>;

  const run = (async () => {
    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      return navigator.locks.request(LOCK_NAME, fn);
    }

    // Fallback: chain onto whatever is currently running so calls are serialized.
    const chained = inMemoryChain.then(fn, fn);
    // Swallow errors in the chain itself so one failed refresh doesn't wedge the queue forever;
    // the actual error still propagates to this call's caller via `chained`.
    inMemoryChain = chained.catch(() => undefined);
    return chained;
  })();

  inFlight = run.finally(() => {
    inFlight = null;
  });

  return inFlight as Promise<T>;
}
