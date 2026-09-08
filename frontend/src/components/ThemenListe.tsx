import { useCallback, useState } from 'react';
import { useForumAuth } from '../auth/AuthContext';
import { useCursorPaginated } from '../hooks/useCursorPaginated';
import { SortSwitcher } from './SortSwitcher';
import { primaryText } from '../utils/texte';
import type { ForumNode, SortMode } from '../api/types';

/** Start page shown by <ForumThread>/<forum-thread> when embedded without a fixed nodeId (and no
 * `?thema=` deep-link param) - lists every root Thema so a host page without a specific topic yet
 * still has something to render, and a way for the first Thema to be created (see the "+" button
 * rendered alongside this by ForumThreadView). */
export function ThemenListe({ onSelect }: { onSelect: (nodeId: string) => void }) {
  const { api } = useForumAuth();
  const [sort, setSort] = useState<SortMode>('beste');

  const fetchPage = useCallback((cursor: string | null) => api.getThemen({ sort, cursor }), [api, sort]);
  const { items, isLoading, isLoadingMore, error, hasMore, loadMore } = useCursorPaginated<ForumNode>({
    fetchPage,
    resetKey: sort,
  });

  return (
    <div className="space-y-3 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Themen</h1>
        <SortSwitcher value={sort} onChange={setSort} />
      </div>

      {isLoading && <p className="text-sm text-gray-500">Lade Themen…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!isLoading && items.length === 0 && !error && (
        <p className="text-sm text-gray-400">Noch keine Themen. Sei der/die Erste und erstelle eins!</p>
      )}

      <ul className="space-y-2">
        {items.map((thema) => (
          <li key={thema.id}>
            <button
              type="button"
              onClick={() => onSelect(thema.id)}
              className="forum-card w-full rounded border border-gray-200 bg-white p-3 text-left hover:border-blue-400 dark:border-gray-700 dark:bg-gray-900"
            >
              <p className="font-medium text-gray-900 dark:text-gray-50">
                {primaryText(thema.texte) || '(ohne Titel)'}
              </p>
              {thema.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {thema.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                👍 {thema.likes_count} · 💬 {thema.comments_count}
              </p>
            </button>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoadingMore}
          className="text-sm text-blue-600 hover:underline disabled:opacity-60"
        >
          {isLoadingMore ? 'Laedt…' : 'Mehr laden'}
        </button>
      )}
    </div>
  );
}
