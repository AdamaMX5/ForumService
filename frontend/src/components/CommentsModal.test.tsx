import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForumAuthProvider } from '../auth/AuthContext';
import { CommentsModal } from './CommentsModal';
import { ForumThread } from './ForumThread';
import { server } from '../mocks/server';

const FORUM_BASE_URL = 'http://localhost:3000';

function renderModal(nodeId: string, accessToken: string | null = 'fake-token') {
  return render(
    <ForumAuthProvider forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken }}>
      <CommentsModal nodeId={nodeId} onClose={() => {}} />
    </ForumAuthProvider>
  );
}

beforeEach(() => {
  window.history.pushState({}, '', '/');
});

describe('CommentsModal', () => {
  it('opens automatically when the ?kommentare= deep-link param names this node', async () => {
    window.history.pushState({}, '', '/?kommentare=t1');

    render(<ForumThread nodeId="t1" forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken: null }} />);

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Kommentare' })).toBeInTheDocument());
    expect(screen.getByText('Gibt es dazu auch Zahlen aus Frankreich, die schon lange ein Limit haben?')).toBeInTheDocument();
  });

  it('does not open automatically when there is no kommentare param', async () => {
    render(<ForumThread nodeId="t1" forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken: null }} />);

    await waitFor(() => expect(screen.getByText(/Tempolimit/)).toBeInTheDocument());
    expect(screen.queryByRole('dialog', { name: 'Kommentare' })).not.toBeInTheDocument();
  });

  it('lists existing comments and posts a new one', async () => {
    const user = userEvent.setup();
    renderModal('t1');

    await waitFor(() => expect(screen.getByText('Danke fuer die sachliche Aufbereitung!')).toBeInTheDocument());

    const input = screen.getByPlaceholderText('Kommentar schreiben…');
    await user.type(input, 'Sehr hilfreich, danke!');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    await waitFor(() => expect(screen.getByText('Sehr hilfreich, danke!')).toBeInTheDocument());
    expect(input).toHaveValue('');
  });

  it('hides the comment form and shows a login prompt when unauthenticated', async () => {
    renderModal('t1', null);

    await waitFor(() => expect(screen.getByText('Danke fuer die sachliche Aufbereitung!')).toBeInTheDocument());
    expect(screen.queryByPlaceholderText('Kommentar schreiben…')).not.toBeInTheDocument();
    expect(screen.getByText('Zum Kommentieren bitte anmelden.')).toBeInTheDocument();
  });

  it('paginates via "Mehr laden", appending the second page', async () => {
    server.use(
      http.get(`${FORUM_BASE_URL}/nodes/paginated-node/kommentare`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (!cursor) {
          return HttpResponse.json({
            data: [
              { id: 'p1', node_id: 'paginated-node', parent_comment_id: null, text: 'Erste Seite', autor_id: 'u1', erstellt_am: '2026-01-01T00:00:00Z', soft_deleted: false },
            ],
            nextCursor: 'page2',
          });
        }
        return HttpResponse.json({
          data: [
            { id: 'p2', node_id: 'paginated-node', parent_comment_id: null, text: 'Zweite Seite', autor_id: 'u1', erstellt_am: '2026-01-02T00:00:00Z', soft_deleted: false },
          ],
          nextCursor: null,
        });
      })
    );
    const user = userEvent.setup();
    renderModal('paginated-node');

    await waitFor(() => expect(screen.getByText('Erste Seite')).toBeInTheDocument());
    expect(screen.queryByText('Zweite Seite')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mehr laden' }));

    await waitFor(() => expect(screen.getByText('Zweite Seite')).toBeInTheDocument());
    expect(screen.getByText('Erste Seite')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mehr laden' })).not.toBeInTheDocument();
  });

  it('replying to a comment tags the outgoing post with parent_comment_id', async () => {
    let capturedBody: { text: string; parent_comment_id?: string | null } | null = null;
    server.use(
      http.post(`${FORUM_BASE_URL}/nodes/t1/kommentare`, async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json(
          { id: 'reply-1', node_id: 't1', parent_comment_id: capturedBody?.parent_comment_id ?? null, text: capturedBody?.text, autor_id: 'u1', erstellt_am: new Date().toISOString(), soft_deleted: false },
          { status: 201 }
        );
      })
    );
    const user = userEvent.setup();
    renderModal('t1');
    await waitFor(() => expect(screen.getByText('Danke fuer die sachliche Aufbereitung!')).toBeInTheDocument());

    const commentItem = screen.getByText('Danke fuer die sachliche Aufbereitung!').closest('li')!;
    await user.click(within(commentItem).getByRole('button', { name: 'Antworten' }));
    await user.type(screen.getByPlaceholderText('Kommentar schreiben…'), 'Gerne!');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toMatchObject({ text: 'Gerne!', parent_comment_id: 'c3' });
  });
});
