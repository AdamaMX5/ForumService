import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ForumAuthProvider } from '../auth/AuthContext';
import { ArgumentNode } from './ArgumentNode';
import { ForumUIProvider, type ForumUIContextValue } from './ForumUIContext';
import { mockNodes } from '../mocks/data';
import { server } from '../mocks/server';
import type { EdgeTyp, ForumChildNode } from '../api/types';

const FORUM_BASE_URL = 'http://localhost:3000';

function makeJwt(roles: string[]): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: 'mod-1', roles, exp: Math.floor(Date.now() / 1000) + 900 })}.sig`;
}

function renderNode(nodeId: string, edgeTyp: EdgeTyp = 'contra', accessToken: string | null = null) {
  const node: ForumChildNode = { ...mockNodes.get(nodeId)!, edge_typ: edgeTyp };
  const ui: ForumUIContextValue = {
    sort: 'beste',
    setSort: () => {},
    focusNodeId: null,
    pathToFocusIds: new Set(),
    onOpenComments: vi.fn(),
    onRequireAuth: vi.fn(),
  };
  const utils = render(
    <ForumAuthProvider forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken }}>
      <ForumUIProvider value={ui}>
        <ArgumentNode node={node} />
      </ForumUIProvider>
    </ForumAuthProvider>
  );
  return { ...utils, node, ui };
}

describe('ArgumentNode - Referenzen anzeigen', () => {
  it('loads and displays referenzen when clicked', async () => {
    // a4 -> a5 is a real `referenz` edge in the mock dataset (src/mocks/data.ts).
    const user = userEvent.setup();
    renderNode('a4');

    await user.click(screen.getByRole('button', { name: 'Referenzen anzeigen' }));

    await waitFor(() =>
      expect(
        screen.getByText(/Die Unfallstatistik zeigt keinen eindeutigen Zusammenhang/)
      ).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Referenzen ausblenden' })).toBeInTheDocument();
  });

  it('shows a friendly empty state when the node has no referenzen', async () => {
    // a2 has no outgoing `referenz` edges in the mock dataset.
    const user = userEvent.setup();
    renderNode('a2');

    await user.click(screen.getByRole('button', { name: 'Referenzen anzeigen' }));

    await waitFor(() => expect(screen.getByText('Keine Referenzen.')).toBeInTheDocument());
  });

  it('shows an error message when referenzen fail to load', async () => {
    server.use(
      http.get(`${FORUM_BASE_URL}/nodes/a3/referenzen`, () =>
        HttpResponse.json({ error: 'Referenzen kaputt' }, { status: 500 })
      )
    );
    const user = userEvent.setup();
    renderNode('a3');

    await user.click(screen.getByRole('button', { name: 'Referenzen anzeigen' }));

    await waitFor(() => expect(screen.getByText('Referenzen kaputt')).toBeInTheDocument());
  });

  it('toggles visibility on repeated clicks without re-fetching once already loaded', async () => {
    let hits = 0;
    server.use(
      http.get(`${FORUM_BASE_URL}/nodes/a4/referenzen`, () => {
        hits += 1;
        return HttpResponse.json({ data: [] });
      })
    );
    const user = userEvent.setup();
    renderNode('a4');

    await user.click(screen.getByRole('button', { name: 'Referenzen anzeigen' }));
    await waitFor(() => expect(screen.getByText('Keine Referenzen.')).toBeInTheDocument());
    expect(hits).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Referenzen ausblenden' }));
    expect(screen.queryByText('Keine Referenzen.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Referenzen anzeigen' }));
    expect(screen.getByText('Keine Referenzen.')).toBeInTheDocument();
    expect(hits).toBe(1); // cached client-side - no second request
  });
});

describe('ArgumentNode - moderation text-override staleness', () => {
  it('clears a locally-edited text override once the parent hands it a genuinely fresh node.texte', async () => {
    // Regression test: ArgumentColumn keeps the same ArgumentNode instance alive across a reload
    // (list items are keyed by node.id, which doesn't change) - a moderator's local edit must not
    // permanently shadow a later, real server refetch (e.g. triggered by a sibling being
    // added/deleted in the same column).
    const user = userEvent.setup();
    const token = makeJwt(['FORUM_MODERATOR']);
    const { rerender, node, ui } = renderNode('a2', 'contra', token);

    await user.click(screen.getByRole('button', { name: 'Text bearbeiten' }));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, 'Lokal bearbeitete Fassung');
    await user.click(screen.getByRole('button', { name: 'Neue Version speichern' }));

    await waitFor(() => expect(screen.getByText('Lokal bearbeitete Fassung')).toBeInTheDocument());

    const freshNode: ForumChildNode = {
      ...node,
      texte: {
        ...node.texte,
        neutral: { version: 5, text: 'Serverseitig aktualisierte Fassung', autor_id: 'other-mod', datum: new Date().toISOString() },
      },
    };
    rerender(
      <ForumAuthProvider forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken: token }}>
        <ForumUIProvider value={ui}>
          <ArgumentNode node={freshNode} />
        </ForumUIProvider>
      </ForumAuthProvider>
    );

    await waitFor(() => expect(screen.getByText('Serverseitig aktualisierte Fassung')).toBeInTheDocument());
    expect(screen.queryByText('Lokal bearbeitete Fassung')).not.toBeInTheDocument();
  });
});
