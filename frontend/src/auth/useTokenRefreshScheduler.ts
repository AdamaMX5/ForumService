import { useCallback, useRef, useState } from 'react';
import { decodeJwt, msUntilRefresh } from './jwt';
import { withRefreshLock } from './refreshLock';
import * as authClient from './authClient';

/**
 * Owns the internal (non-externally-managed) access token for ForumAuthProvider: applying a
 * freshly issued token, scheduling the next proactive refresh at exp-60s, and running the
 * mutex-guarded reactive refresh (`ensureFreshToken`) used both by that timer and by forumApi's
 * 401-retry path. Pure extraction from ForumAuthProvider - behavior is unchanged, only the
 * token/timer bookkeeping moved out of the provider body so the provider itself stays focused on
 * login/register/externalAuth wiring.
 */
export function useTokenRefreshScheduler() {
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const applyToken = useCallback(
    (nextToken: string) => {
      setToken(nextToken);
      tokenRef.current = nextToken;
      const payload = decodeJwt(nextToken);
      clearRefreshTimer();
      if (payload) {
        refreshTimerRef.current = setTimeout(() => {
          ensureFreshToken().catch(() => undefined);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, msUntilRefresh(payload));
      }
    },
    [clearRefreshTimer]
  );

  const ensureFreshToken = useCallback((): Promise<string> => {
    return withRefreshLock(async () => {
      const { access_token } = await authClient.refresh();
      applyToken(access_token);
      return access_token;
    }).catch((err) => {
      setToken(null);
      tokenRef.current = null;
      clearRefreshTimer();
      throw err;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyToken, clearRefreshTimer]);

  const reset = useCallback(() => {
    clearRefreshTimer();
    setToken(null);
    tokenRef.current = null;
  }, [clearRefreshTimer]);

  return { token, tokenRef, applyToken, ensureFreshToken, clearRefreshTimer, reset };
}
