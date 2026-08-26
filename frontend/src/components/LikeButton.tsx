import { useState } from 'react';
import { useForumAuth } from '../auth/AuthContext';

export function LikeButton({
  nodeId,
  likesCount,
  likedByMe,
  onLikesCountChange,
  onRequireAuth,
}: {
  nodeId: string;
  likesCount: number;
  /** Server-reported "did I like this" from the node's `liked_by_me` field - null (anonymous
   * request) is treated as not-liked, since liking requires auth anyway. */
  likedByMe: boolean | null;
  onLikesCountChange: (next: number) => void;
  onRequireAuth: () => void;
}) {
  const { accessToken, api } = useForumAuth();
  const [liked, setLiked] = useState(() => likedByMe ?? false);
  const [isBusy, setIsBusy] = useState(false);

  async function toggle() {
    if (!accessToken) {
      onRequireAuth();
      return;
    }
    if (isBusy) return;
    setIsBusy(true);

    const wasLiked = liked;
    const previousCount = likesCount;
    const nextLiked = !wasLiked;
    setLiked(nextLiked);
    onLikesCountChange(previousCount + (nextLiked ? 1 : -1));

    try {
      const result = nextLiked ? await api.like(nodeId) : await api.unlike(nodeId);
      onLikesCountChange(result.likes_count);
    } catch {
      // Rollback optimistic update on failure (e.g. already liked elsewhere, network error).
      setLiked(wasLiked);
      onLikesCountChange(previousCount);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isBusy}
      aria-pressed={liked}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-sm ${
        liked ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600 dark:text-gray-300'
      }`}
    >
      <span aria-hidden="true">{liked ? '♥' : '♡'}</span>
      <span>{likesCount}</span>
    </button>
  );
}
