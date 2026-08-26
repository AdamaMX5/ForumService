import { useState } from 'react';
import { useForumAuth } from '../auth/AuthContext';

// Backend has no "did I like this node" endpoint (see frontend/README.md "Known backend gaps"),
// so "liked by me" is tracked purely client-side, per browser, in localStorage - it is a UI
// nicety, not an authoritative cross-device signal.
const STORAGE_KEY = 'forum:likedNodeIds';

function readLikedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeLikedSet(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore (private browsing / storage disabled) - like still works for this page load
  }
}

export function LikeButton({
  nodeId,
  likesCount,
  onLikesCountChange,
  onRequireAuth,
}: {
  nodeId: string;
  likesCount: number;
  onLikesCountChange: (next: number) => void;
  onRequireAuth: () => void;
}) {
  const { accessToken, api } = useForumAuth();
  const [liked, setLiked] = useState(() => readLikedSet().has(nodeId));
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
      const set = readLikedSet();
      if (nextLiked) set.add(nodeId);
      else set.delete(nodeId);
      writeLikedSet(set);
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
