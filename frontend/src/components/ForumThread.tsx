import { useEffect, useMemo, useState } from 'react';
import { ForumAuthProvider, useForumAuth, type ExternalAuth } from '../auth/AuthContext';
import { useDeepLinkParams } from '../hooks/useDeepLinkParams';
import { ArgumentColumn } from './ArgumentColumn';
import { CommentsModal } from './CommentsModal';
import { ForumUIProvider } from './ForumUIContext';
import { LoginModal } from './LoginModal';
import { NewThemaModal } from './NewThemaModal';
import { ThemenListe } from './ThemenListe';
import { ThreadHeader } from './ThreadHeader';
import type { EdgeTyp, ForumNode, SortMode } from '../api/types';
import '../styles/index.css';

const CHILD_TYPES: EdgeTyp[] = ['pro', 'differenzierung', 'contra'];
const EMPTY_PATH: Set<string> = new Set();

export interface ForumThreadProps {
  /**
   * Root thema (or argument) node id to display. Overridden by a `?thema=` deep-link param if
   * present. Omit entirely to embed ForumThread without picking a topic upfront - it then shows
   * a start page listing every Thema (with a "+" button to create the first/a new one); selecting
   * one drives the view via the `?thema=` deep-link param from then on. The "Diskussionsforum"
   * heading is always shown and always navigates back to the Themen overview, even when a fixed
   * nodeId is given (the "+" create-thema button stays hidden in that case, though).
   */
  nodeId?: string;
  /**
   * Hand ForumThread an already-managed access token instead of letting it run its own
   * standalone login/refresh flow - use this when the host app (e.g. FreiSchule) already
   * authenticates the user, so the two never race AuthService's rotating refresh token.
   */
  externalAuth?: ExternalAuth;
  forumApiBaseUrl?: string;
}

/** Public entry point: self-contained, wraps itself in a ForumAuthProvider. */
export function ForumThread({ nodeId, externalAuth, forumApiBaseUrl }: ForumThreadProps) {
  return (
    <ForumAuthProvider externalAuth={externalAuth} forumApiBaseUrl={forumApiBaseUrl}>
      <ForumThreadView nodeId={nodeId} />
    </ForumAuthProvider>
  );
}

/** Use this instead of <ForumThread> when you already render a <ForumAuthProvider> higher up
 * (e.g. to share one login session across multiple ForumThread instances on the same page). */
export function ForumThreadView({ nodeId }: { nodeId?: string }) {
  const { api, accessToken } = useForumAuth();
  const [params, setParams] = useDeepLinkParams();
  // The "Diskussionsforum" heading (see below) must always be able to reach the Themen overview,
  // even when the host pinned a fixed nodeId - overrides both the `?thema=` param and the nodeId
  // prop until a thema is (re-)selected, at which point the effect below clears it again.
  const [showOverview, setShowOverview] = useState(false);
  const rootId = showOverview ? null : params.thema || nodeId || null;

  const [root, setRoot] = useState<ForumNode | null>(null);
  const [isLoadingRoot, setIsLoadingRoot] = useState(() => !!rootId);
  const [rootError, setRootError] = useState<string | null>(null);
  const [likesCount, setLikesCount] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>('beste');
  const [commentsNodeId, setCommentsNodeId] = useState<string | null>(params.kommentare);
  const [showLogin, setShowLogin] = useState(false);
  const [showNewThema, setShowNewThema] = useState(false);
  const [pathToFocusIds, setPathToFocusIds] = useState<Set<string>>(EMPTY_PATH);

  useEffect(() => {
    if (params.thema) setShowOverview(false);
  }, [params.thema]);

  useEffect(() => {
    if (!rootId) {
      setRoot(null);
      setRootError(null);
      setIsLoadingRoot(false);
      return;
    }
    let cancelled = false;
    setIsLoadingRoot(true);
    setRootError(null);
    api
      .getNode(rootId)
      .then((node) => {
        if (cancelled) return;
        setRoot(node);
        setLikesCount(node.likes_count);
      })
      .catch((err) => {
        if (!cancelled) setRootError(err instanceof Error ? err.message : 'Diskussion konnte nicht geladen werden');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRoot(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, rootId]);

  // ?kommentare=<nodeId> in the URL auto-opens the comments popup for that node on load
  // (spec section 10/12 URL contract). Only applied once on mount.
  useEffect(() => {
    if (params.kommentare) setCommentsNodeId(params.kommentare);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (accessToken) setShowLogin(false);
  }, [accessToken]);

  // ?fokus=<id> must reveal the full root-to-focus path in the tree, not just highlight the leaf
  // if it happens to already be loaded (spec section 12) - resolved via GET /nodes/:id/pfad and
  // handed down through ForumUIContext so every ArgumentNode on the path can auto-expand itself.
  useEffect(() => {
    if (!params.fokus) {
      setPathToFocusIds(EMPTY_PATH);
      return;
    }
    let cancelled = false;
    api
      .getPfad(params.fokus)
      .then((result) => {
        if (!cancelled) setPathToFocusIds(new Set(result.data.map((n) => n.id)));
      })
      .catch(() => {
        if (!cancelled) setPathToFocusIds(EMPTY_PATH);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, params.fokus]);

  function requireAuth() {
    setShowLogin(true);
  }

  function selectThema(id: string) {
    setParams({ thema: id });
  }

  function backToThemenliste() {
    setShowOverview(true);
    setParams({ thema: null, fokus: null, kommentare: null });
    setCommentsNodeId(null);
  }

  function openNewThema() {
    if (!accessToken) {
      requireAuth();
      return;
    }
    setShowNewThema(true);
  }

  function handleThemaCreated(node: ForumNode) {
    setShowNewThema(false);
    selectThema(node.id);
  }

  function openComments(targetNodeId: string) {
    setCommentsNodeId(targetNodeId);
    setParams({ kommentare: targetNodeId });
  }

  function closeComments() {
    setCommentsNodeId(null);
    setParams({ kommentare: null });
  }

  const ui = useMemo(
    () => ({
      sort: sortMode,
      setSort: setSortMode,
      focusNodeId: params.fokus,
      pathToFocusIds,
      onOpenComments: openComments,
      onRequireAuth: requireAuth,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortMode, params.fokus, pathToFocusIds]
  );

  return (
    <div className="forum-thread relative w-full space-y-4 p-4 text-gray-900 dark:text-gray-50">
      <h1 className="text-xl font-bold">
        <button type="button" onClick={backToThemenliste} className="hover:underline">
          Diskussionsforum
        </button>
      </h1>

      {!rootId && <ThemenListe onSelect={selectThema} />}

      {rootId && isLoadingRoot && <p className="text-sm text-gray-500">Lade Diskussion…</p>}
      {rootId && rootError && <p className="text-sm text-red-600">{rootError}</p>}

      {rootId && root && (
        <div className="forum-thread-body">
          <ForumUIProvider value={ui}>
            <ThreadHeader
              root={root}
              likesCount={likesCount}
              onLikesCountChange={setLikesCount}
              onRootUpdated={setRoot}
              onRootDeleted={backToThemenliste}
            />
            <div className="forum-columns">
              {CHILD_TYPES.map((typ) => (
                <ArgumentColumn key={typ} parentId={root.id} edgeTyp={typ} />
              ))}
            </div>
          </ForumUIProvider>
        </div>
      )}

      {commentsNodeId && <CommentsModal nodeId={commentsNodeId} onClose={closeComments} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showNewThema && <NewThemaModal onCreated={handleThemaCreated} onCancel={() => setShowNewThema(false)} />}

      {!rootId && (
        <button
          type="button"
          onClick={openNewThema}
          aria-label="Neues Thema erstellen"
          title="Neues Thema erstellen"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl leading-none text-white shadow-lg hover:bg-blue-700"
        >
          +
        </button>
      )}
    </div>
  );
}
