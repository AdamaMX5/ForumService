import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Self-contained <forum-thread node-id="..."> custom element bundle for TYPO3/PHP pages that
// have no React of their own. React/ReactDOM are bundled in (not external) and auth is always
// the fully standalone ForumAuthProvider flow (there is no host React context to inject an
// externalAuth token through here).
export default defineConfig({
  plugins: [react()],
  // This config is only ever run via `vite build` (never the dev server), and
  // public/mockServiceWorker.js is dev-only - never ship it in this bundle.
  publicDir: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist/webcomponent',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/webcomponent.ts',
      name: 'ForumThreadWebComponent',
      fileName: () => 'forum-thread.iife.js',
      formats: ['iife'],
    },
  },
});
