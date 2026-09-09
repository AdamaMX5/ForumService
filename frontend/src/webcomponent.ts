// Self-contained <forum-thread node-id="..."> custom element for TYPO3/PHP pages (spec section
// 2/12). React/ReactDOM are bundled in via vite.webcomponent.config.ts; auth is always the full
// standalone ForumAuthProvider login/refresh flow, since there is no host React app here to
// inject an externalAuth token through (see ForumThread's externalAuth prop for that case).
// `node-id` is optional - omit it to show the Themen start page (see ForumThread.tsx); r2wc leaves
// the `nodeId` prop undefined whenever the attribute isn't set on the element.
// `theme` ("light"/"dark"/"auto") is likewise optional - omit it to keep the default OS-preference
// auto-detection (see useResolvedDarkMode.ts); most TYPO3/PHP pages that manage dark mode via a
// `.dark` class on an ancestor element don't need to set it at all, since Tailwind's dark:
// utilities here already match any ancestor with that class.
import r2wc from 'react-to-webcomponent';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ForumThread } from './components/ForumThread';
import './styles/index.css';

const ForumThreadElement = r2wc(ForumThread, React, ReactDOM as unknown as Parameters<typeof r2wc>[2], {
  props: { nodeId: 'string', theme: 'string' },
});

if (!customElements.get('forum-thread')) {
  customElements.define('forum-thread', ForumThreadElement);
}
