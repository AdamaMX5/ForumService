import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Node-side MSW server for Vitest (src/mocks/browser.ts is the browser-only counterpart used by
// npm run dev). Shares the same handlers/data so component tests exercise realistic request/
// response shapes instead of hand-rolled fetch mocks wherever that's practical.
export const server = setupServer(...handlers);
