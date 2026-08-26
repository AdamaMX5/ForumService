import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Default build target: an ES module library that exports <ForumThread>, <ForumAuthProvider>
// and forumApi for consumers that already run React (e.g. FreiSchule embeds it natively).
// `vite` (no command) also uses this config to serve the demo app (index.html -> src/main.tsx)
// for local development against the MSW mocks.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // public/mockServiceWorker.js must stay served at "/" during `vite` (dev) for MSW to work,
  // but must NOT be copied into the published library build.
  publicDir: command === 'build' ? false : 'public',
  build: {
    outDir: 'dist/lib',
    emptyOutDir: false, // tsc already wrote .d.ts files here (build:lib script runs tsc first)
    lib: {
      entry: 'src/lib.ts',
      name: 'ForumThread',
      fileName: () => 'forum-thread.js',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
}));
