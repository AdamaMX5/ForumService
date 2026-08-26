import React, { useCallback, useState } from 'react';
import { useForumAuth } from '../auth/AuthContext';
import { useCursorPaginated } from '../hooks/useCursorPaginated';
import { CommentListItem } from './CommentListItem';
import type { ForumComment } from '../api/types';

// Popup comment section for a single thema/argument node (spec section 10: comments are
// intentionally not shown inline in the argument tree, only behind this icon+counter popup).
export function CommentsModal({
  nodeId,
  onClose,
  onCommentPosted,
}: {
  nodeId: string;
  onClose: () => void;
  onCommentPosted?: () => void;
}) {
  const { accessToken, api } = useForumAuth();
  const fetchPage = useCallback((cursor: string | null) => api.getKommentare(nodeId, cursor), [api, nodeId]);
  const { items, isLoading, isLoadingMore, error, hasMore, loadMore, reload } = useCursorPaginated<ForumComment>({
    fetchPage,
    resetKey: nodeId,
  });

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ForumComment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.postKommentar(nodeId, text.trim(), replyTo?.id ?? null);
      setText('');
      setReplyTo(null);
      reload();
      onCommentPosted?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kommentar konnte nicht gespeichert werden');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="forum-thread fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kommentare"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Kommentare</h2>
          <button type="button" onClick={onClose} aria-label="Schliessen" className="text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading && <p className="text-sm text-gray-500">Lade Kommentare…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!isLoading && items.length === 0 && !error && (
            <p className="text-sm text-gray-500">Noch keine Kommentare. Sei der/die Erste!</p>
          )}
          <ul className="space-y-3">
            {items.map((comment) => (
              <CommentListItem key={comment.id} comment={comment} onReply={setReplyTo} />
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="mt-3 text-sm text-blue-600 hover:underline disabled:opacity-60"
            >
              {isLoadingMore ? 'Laedt…' : 'Mehr laden'}
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3 dark:border-gray-700">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800">
              <span>Antwort auf: "{(replyTo.text ?? '').slice(0, 60)}"</span>
              <button type="button" onClick={() => setReplyTo(null)} className="ml-2 text-gray-500 hover:text-gray-800">
                ✕
              </button>
            </div>
          )}
          {!accessToken ? (
            <p className="text-sm text-gray-500">Zum Kommentieren bitte anmelden.</p>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Kommentar schreiben…"
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
              <button
                type="submit"
                disabled={isSubmitting || !text.trim()}
                className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Senden
              </button>
            </div>
          )}
          {submitError && <p className="mt-1 text-sm text-red-600">{submitError}</p>}
        </form>
      </div>
    </div>
  );
}
