// Self-contained <forum-thread node-id="..."> custom element for TYPO3/PHP pages (spec section
// 2/12). React/ReactDOM are bundled in via vite.webcomponent.config.ts; auth is always the full
// standalone ForumAuthProvider login/refresh flow, since there is no host React app here to
// inject an externalAuth token through (see ForumThread's externalAuth prop for that case).
import r2wc from 'react-to-webcomponent';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ForumThread } from './components/ForumThread';
import './styles/index.css';

const ForumThreadElement = r2wc(ForumThread, React, ReactDOM as unknown as Parameters<typeof r2wc>[2], {
  props: { nodeId: 'string' },
});

if (!customElements.get('forum-thread')) {
  customElements.define('forum-thread', ForumThreadElement);
}
