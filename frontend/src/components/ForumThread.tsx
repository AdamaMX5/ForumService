import { useEffect, useState } from 'react';
import { ForumAuthProvider, useForumAuth, type ExternalAuth } from '../auth/AuthContext';
import { useDeepLinkParams } from '../hooks/useDeepLinkParams';
import { ArgumentColumn } from './ArgumentColumn';
import { CommentsModal } from './CommentsModal';
import { LikeButton } from './LikeButton';
import { LoginRegisterForm } from './LoginRegisterForm';
import { SortSwitcher } from './SortSwitcher';
import type { EdgeTyp, ForumNode, SortMode } from '../api/types';
import '../styles/index.css';

const CHILD_TYPES: EdgeTyp[] = ['pro', 'contra', 'differenzierung'];

export interface ForumThreadProps {
  /** Root thema (or argument) node id to display. Overridden by a `?thema=` deep-link param if present. */
  nodeId: string;
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
export function ForumThreadView({ nodeId }: { nodeId: string }) {
  const { api, accessToken, isExternallyManaged } = useForumAuth();
  const [params, setParams] = useDeepLinkParams();
  const rootId = params.thema || nodeId;

  const [root, setRoot] = useState<ForumNode | null>(null);
  const [isLoadingRoot, setIsLoadingRoot] = useState(true);
  const [rootError, setRootError] = useState<string | null>(null);
  const [likesCount, setLikesCount] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>('beste');
  const [commentsNodeId, setCommentsNodeId] = useState<string | null>(params.kommentare);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
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

  function requireAuth() {
    setShowLogin(true);
  }

  function openComments(targetNodeId: string) {
    setCommentsNodeId(targetNodeId);
    setParams({ kommentare: targetNodeId });
  }

  function closeComments() {
    setCommentsNodeId(null);
    setParams({ kommentare: null });
  }

  return (
    <div className="forum-thread mx-auto max-w-5xl space-y-4 p-4 text-gray-900 dark:text-gray-50">
      {isLoadingRoot && <p className="text-sm text-gray-500">Lade Diskussion…</p>}
      {rootError && <p className="text-sm text-red-600">{rootError}</p>}

      {root && (
        <>
          <header className="space-y-2 border-b border-gray-200 pb-3 dark:border-gray-700">
            <h1 className="text-xl font-bold">{root.texte.neutral?.text ?? root.texte.pro?.text ?? root.texte.contra?.text ?? '(ohne Titel)'}</h1>
            {root.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {root.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-sm">
                <LikeButton nodeId={root.id} likesCount={likesCount} onLikesCountChange={setLikesCount} onRequireAuth={requireAuth} />
                <button type="button" onClick={() => openComments(root.id)} className="text-gray-600 hover:text-blue-600 dark:text-gray-300">
                  💬 {root.comments_count}
                </button>
                {!accessToken && (
                  <button type="button" onClick={requireAuth} className="text-blue-600 hover:underline">
                    Anmelden
                  </button>
                )}
              </div>
              <SortSwitcher value={sortMode} onChange={setSortMode} />
            </div>
          </header>

          <div className="flex flex-col gap-3 sm:flex-row">
            {CHILD_TYPES.map((typ) => (
              <ArgumentColumn
                key={typ}
                parentId={root.id}
                edgeTyp={typ}
                sort={sortMode}
                focusNodeId={params.fokus}
                onOpenComments={openComments}
                onRequireAuth={requireAuth}
              />
            ))}
          </div>
        </>
      )}

      {commentsNodeId && <CommentsModal nodeId={commentsNodeId} onClose={closeComments} />}

      {showLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowLogin(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            {isExternallyManaged ? (
              <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl dark:bg-gray-900">
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  Bitte melde dich über die Anwendung an, in die dieses Forum eingebettet ist.
                </p>
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  Schließen
                </button>
              </div>
            ) : (
              <LoginRegisterForm />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
