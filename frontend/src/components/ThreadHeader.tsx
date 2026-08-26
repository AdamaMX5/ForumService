import { useForumAuth } from '../auth/AuthContext';
import { useForumUI } from './ForumUIContext';
import { LikeButton } from './LikeButton';
import { SortSwitcher } from './SortSwitcher';
import type { ForumNode } from '../api/types';

export function ThreadHeader({
  root,
  likesCount,
  onLikesCountChange,
}: {
  root: ForumNode;
  likesCount: number;
  onLikesCountChange: (next: number) => void;
}) {
  const { accessToken } = useForumAuth();
  const { sort, setSort, onOpenComments, onRequireAuth } = useForumUI();

  return (
    <header className="space-y-2 border-b border-gray-200 pb-3 dark:border-gray-700">
      <h1 className="text-xl font-bold">
        {root.texte.neutral?.text ?? root.texte.pro?.text ?? root.texte.contra?.text ?? '(ohne Titel)'}
      </h1>
      {root.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {root.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-sm">
          <LikeButton
            nodeId={root.id}
            likesCount={likesCount}
            likedByMe={root.liked_by_me}
            onLikesCountChange={onLikesCountChange}
            onRequireAuth={onRequireAuth}
          />
          <button
            type="button"
            onClick={() => onOpenComments(root.id)}
            className="text-gray-600 hover:text-blue-600 dark:text-gray-300"
          >
            💬 {root.comments_count}
          </button>
          {!accessToken && (
            <button type="button" onClick={onRequireAuth} className="text-blue-600 hover:underline">
              Anmelden
            </button>
          )}
        </div>
        <SortSwitcher value={sort} onChange={setSort} />
      </div>
    </header>
  );
}
