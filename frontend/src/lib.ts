// Public export surface for consumers that already run React (e.g. FreiSchule embedding
// <ForumThread nodeId={...} /> natively - spec section 2). For TYPO3/PHP pages without React,
// use the separate Web Component build (see webcomponent.ts / dist/webcomponent).
export { ForumThread, ForumThreadView } from './components/ForumThread';
export type { ForumThreadProps } from './components/ForumThread';
export { ForumAuthProvider, useForumAuth } from './auth/AuthContext';
export type { ExternalAuth } from './auth/AuthContext';
export { createForumApi, ForumApiError } from './api/forumApi';
export type { ForumApi, ForumApiAuthAdapter } from './api/forumApi';
export type {
  ForumNode,
  ForumChildNode,
  ForumComment,
  EdgeTyp,
  NodeTyp,
  SortMode,
  Sichtbarkeit,
  Paginated,
  NewNodeInput,
  ReferenzEdge,
} from './api/types';

import './styles/index.css';
