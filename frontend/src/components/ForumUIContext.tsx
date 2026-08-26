import { createContext, useContext } from 'react';
import type { SortMode } from '../api/types';

/**
 * Carries the handful of values every level of the recursive argument tree
 * (ArgumentColumn -> ArgumentNode -> ArgumentColumn -> ...) needs, so they don't have to be
 * threaded through every component's props at every recursion depth.
 */
export interface ForumUIContextValue {
  sort: SortMode;
  setSort: (sort: SortMode) => void;
  focusNodeId: string | null;
  /** Node ids along the root-to-focus ancestor path (from GET /nodes/:id/pfad) - ArgumentNode
   * auto-expands itself when its id is a member, so a `?fokus=` deep link reveals the full path
   * instead of only highlighting the leaf when it happens to already be loaded. */
  pathToFocusIds: Set<string>;
  onOpenComments: (nodeId: string) => void;
  onRequireAuth: () => void;
}

const ForumUIContext = createContext<ForumUIContextValue | null>(null);

export const ForumUIProvider = ForumUIContext.Provider;

export function useForumUI(): ForumUIContextValue {
  const ctx = useContext(ForumUIContext);
  if (!ctx) throw new Error('useForumUI must be used within a ForumUIProvider (rendered by <ForumThread>)');
  return ctx;
}
