import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createForumApi, type ForumApi } from '../api/forumApi';
import * as authClient from './authClient';
import { decodeJwt, msUntilRefresh, type JwtPayload } from './jwt';
import { withRefreshLock } from './refreshLock';

/**
 * Lets a host application (e.g. FreiSchule, which already manages its own login/refresh
 * against AuthService) hand ForumThread an already-valid access token instead of letting it run
 * its own standalone login/refresh flow. This exists specifically so two apps on the same page
 * never race AuthService's rotating refresh_token at the same time - see the Auth-Design section
 * of the implementation plan for the full rationale.
 */
export interface ExternalAuth {
  accessToken: string | null;
  /** Called when a request 401s and a fresh token is needed. Should resolve with the new token. */
  onNeedRefresh?: () => Promise<string>;
}

interface ForumAuthContextValue {
  accessToken: string | null;
  user: JwtPayload | null;
  /** True once the initial auto-login attempt (or externalAuth wiring) has settled. */
  isReady: boolean;
  isExternallyManaged: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  checkEmail: (email: string) => Promise<'login' | 'register'>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, repassword: string) => Promise<void>;
  logout: () => Promise<void>;
  api: ForumApi;
}

const ForumAuthContext = createContext<ForumAuthContextValue | null>(null);

export interface ForumAuthProviderProps {
  children: React.ReactNode;
  externalAuth?: ExternalAuth;
  /** Defaults to import.meta.env.VITE_FORUM_API_URL. */
  forumApiBaseUrl?: string;
}

export function ForumAuthProvider({ children, externalAuth, forumApiBaseUrl }: ForumAuthProviderProps) {
  const isExternallyManaged = externalAuth !== undefined;
  const baseUrl = (forumApiBaseUrl ?? import.meta.env.VITE_FORUM_API_URL ?? '').replace(/\/$/, '');

  const [internalToken, setInternalToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accessToken = isExternallyManaged ? externalAuth!.accessToken : internalToken;
  tokenRef.current = accessToken;

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const applyToken = useCallback(
    (token: string) => {
      setInternalToken(token);
      tokenRef.current = token;
      const payload = decodeJwt(token);
      clearRefreshTimer();
      if (payload) {
        refreshTimerRef.current = setTimeout(() => {
          ensureFreshTokenInternal().catch(() => undefined);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, msUntilRefresh(payload));
      }
    },
    [clearRefreshTimer]
  );

  const ensureFreshTokenInternal = useCallback((): Promise<string> => {
    return withRefreshLock(async () => {
      const { access_token } = await authClient.refresh();
      applyToken(access_token);
      return access_token;
    }).catch((err) => {
      setInternalToken(null);
      tokenRef.current = null;
      clearRefreshTimer();
      throw err;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyToken, clearRefreshTimer]);

  // Auto-login: if a valid refresh_token cookie already exists (user is logged in via another
  // freischule.info app / a previous visit), pick it up silently on mount. A failure here just
  // means "not logged in" - not an error worth surfacing.
  useEffect(() => {
    if (isExternallyManaged) {
      setIsReady(true);
      return;
    }
    let cancelled = false;
    ensureFreshTokenInternal()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
      clearRefreshTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExternallyManaged]);

  const refreshAccessToken = useCallback((): Promise<string> => {
    if (isExternallyManaged) {
      if (!externalAuth?.onNeedRefresh) {
        return Promise.reject(
          new Error('externalAuth was provided without onNeedRefresh - cannot refresh an expired token')
        );
      }
      return externalAuth.onNeedRefresh();
    }
    return ensureFreshTokenInternal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExternallyManaged, externalAuth]);

  const api = useMemo(
    () =>
      createForumApi(baseUrl, {
        getAccessToken: () => tokenRef.current,
        refreshAccessToken,
      }),
    [baseUrl, refreshAccessToken]
  );

  // externalAuth means a host app is the sole source of truth for this user's session - letting
  // these run anyway would let the end user spin up a second, independent ForumService session
  // that races the host app for the same rotating refresh_token cookie (the exact scenario
  // externalAuth exists to rule out, see the Auth-Design section of the implementation plan).
  const externallyManagedError = () =>
    new Error('Login wird von der Host-Anwendung verwaltet (externalAuth ist gesetzt).');

  const checkEmail = useCallback(
    async (email: string) => {
      if (isExternallyManaged) throw externallyManagedError();
      const { status } = await authClient.checkEmail(email);
      return status;
    },
    [isExternallyManaged]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      if (isExternallyManaged) throw externallyManagedError();
      setIsAuthenticating(true);
      setAuthError(null);
      try {
        const result = await authClient.login({ email, password });
        applyToken(result.access_token);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Login fehlgeschlagen');
        throw err;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [isExternallyManaged, applyToken]
  );

  const register = useCallback(
    async (email: string, password: string, repassword: string) => {
      if (isExternallyManaged) throw externallyManagedError();
      setIsAuthenticating(true);
      setAuthError(null);
      try {
        const result = await authClient.registerComplete({ email, password, repassword });
        applyToken(result.access_token);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen');
        throw err;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [isExternallyManaged, applyToken]
  );

  const logout = useCallback(async () => {
    clearRefreshTimer();
    setInternalToken(null);
    tokenRef.current = null;
    await authClient.logout().catch(() => undefined);
  }, [clearRefreshTimer]);

  const value: ForumAuthContextValue = {
    accessToken,
    user: accessToken ? decodeJwt(accessToken) : null,
    isReady,
    isExternallyManaged,
    isAuthenticating,
    authError,
    checkEmail,
    login,
    register,
    logout,
    api,
  };

  return <ForumAuthContext.Provider value={value}>{children}</ForumAuthContext.Provider>;
}

export function useForumAuth(): ForumAuthContextValue {
  const ctx = useContext(ForumAuthContext);
  if (!ctx) throw new Error('useForumAuth must be used within a ForumAuthProvider');
  return ctx;
}
