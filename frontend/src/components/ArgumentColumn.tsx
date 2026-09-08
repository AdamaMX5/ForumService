import { useCallback, useState } from 'react';
import { useForumAuth } from '../auth/AuthContext';
import { useForumUI } from './ForumUIContext';
import { useCursorPaginated } from '../hooks/useCursorPaginated';
import { NewArgumentForm } from './NewArgumentForm';
import { ArgumentNode } from './ArgumentNode';
import type { EdgeTyp, ForumChildNode } from '../api/types';

const COLUMN_STYLE: Record<EdgeTyp, { label: string; accent: string }> = {
  pro: { label: 'Pro', accent: 'border-t-4 border-t-[var(--forum-pro)]' },
  contra: { label: 'Contra', accent: 'border-t-4 border-t-[var(--forum-contra)]' },
  differenzierung: { label: 'Differenzierung', accent: 'border-t-4 border-t-[var(--forum-differenzierung)]' },
};

export function ArgumentColumn({ parentId, edgeTyp }: { parentId: string; edgeTyp: EdgeTyp }) {
  const { accessToken, api } = useForumAuth();
  const { sort, onRequireAuth } = useForumUI();
  const [isAdding, setIsAdding] = useState(false);

  const fetchPage = useCallback(
    (cursor: string | null) => api.getKinder(parentId, { typ: edgeTyp, sort, cursor }),
    [api, parentId, edgeTyp, sort]
  );
  const { items, isLoading, isLoadingMore, error, hasMore, loadMore, reload } = useCursorPaginated<ForumChildNode>({
    fetchPage,
    resetKey: `${parentId}:${edgeTyp}:${sort}`,
  });

  const style = COLUMN_STYLE[edgeTyp];

  return (
    <div className={`flex-1 rounded bg-gray-50 p-3 dark:bg-gray-800/50 ${style.accent}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{style.label}</h3>
        {accessToken && (
          <button
            type="button"
            onClick={() => setIsAdding((v) => !v)}
            className="text-xs text-blue-600 hover:underline"
          >
            + Hinzufuegen
          </button>
        )}
      </div>

      {isAdding && (
        <NewArgumentForm
          parentId={parentId}
          edgeTyp={edgeTyp}
          onRequireAuth={onRequireAuth}
          onCancel={() => setIsAdding(false)}
          onCreated={() => {
            setIsAdding(false);
            reload();
          }}
        />
      )}

      {isLoading && <p className="text-sm text-gray-500">Laedt…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!isLoading && items.length === 0 && (
        <p className="text-sm text-gray-400">Noch keine Beitraege.</p>
      )}

      <ul className="space-y-2">
        {items.map((node) => (
          <li key={node.id}>
            <ArgumentNode node={node} onDeleted={reload} />
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoadingMore}
          className="mt-2 text-sm text-blue-600 hover:underline disabled:opacity-60"
        >
          {isLoadingMore ? 'Laedt…' : 'Mehr laden'}
        </button>
      )}
    </div>
  );
}
