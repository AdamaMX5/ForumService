import { useForumAuth } from '../auth/AuthContext';
import { useForumUI } from './ForumUIContext';
import { LikeButton } from './LikeButton';
import { ModerationControls } from './ModerationControls';
import { SortSwitcher } from './SortSwitcher';
import { primaryText } from '../utils/texte';
import type { ForumNode } from '../api/types';

export function ThreadHeader({
  root,
  likesCount,
  onLikesCountChange,
  onRootUpdated,
  onRootDeleted,
}: {
  root: ForumNode;
  likesCount: number;
  onLikesCountChange: (next: number) => void;
  /** Reflects a new text version or a sichtbarkeit toggle (see ModerationControls) into the root
   * node held by ForumThreadView. */
  onRootUpdated: (node: ForumNode) => void;
  /** The root thema was soft-deleted - ForumThreadView navigates back to the Themen overview,
   * since a soft-deleted node 404s on every subsequent fetch (no restore/undelete endpoint). */
  onRootDeleted: () => void;
}) {
  const { accessToken } = useForumAuth();
  const { sort, setSort, onOpenComments, onRequireAuth } = useForumUI();

  return (
    <header className="space-y-2 border-b border-gray-200 pb-3 dark:border-gray-700">
      <h1 className="text-xl font-bold">{primaryText(root.texte) || '(ohne Titel)'}</h1>
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

      <ModerationControls
        node={root}
        onTextUpdated={onRootUpdated}
        onSichtbarkeitChanged={onRootUpdated}
        onDeleted={onRootDeleted}
      />
    </header>
  );
}
