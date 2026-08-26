import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumThread } from './ForumThread';
import { server } from '../mocks/server';

const FORUM_BASE_URL = 'http://localhost:3000';

function renderThread(nodeId: string, accessToken: string | null = null) {
  return render(
    <ForumThread nodeId={nodeId} forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken }} />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  // LikeButton reads its "liked by me" flag from real localStorage on mount - clear it so one
  // test's like click can't change another test's initial aria-pressed state for the same node.
  localStorage.clear();
});

describe('ForumThread', () => {
  it('shows a loading indicator, then the loaded thema (title, tags, pro/contra/differenzierung columns)', async () => {
    renderThread('t1');

    expect(screen.getByText(/Lade Diskussion/)).toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByText('Sollte auf deutschen Autobahnen ein generelles Tempolimit von 130 km/h gelten?')
      ).toBeInTheDocument()
    );
    expect(screen.queryByText(/Lade Diskussion/)).not.toBeInTheDocument();
    expect(screen.getByText('Verkehr')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Contra')).toBeInTheDocument();
    expect(screen.getByText('Differenzierung')).toBeInTheDocument();
  });

  it('shows an error message when the root node fails to load', async () => {
    renderThread('does-not-exist');

    await waitFor(() => expect(screen.getByText('Not found')).toBeInTheDocument());
    expect(screen.queryByText(/Lade Diskussion/)).not.toBeInTheDocument();
  });

  it('shows the empty state in every column when a node has no children', async () => {
    // 'a3' exists in the mock dataset but has no edges pointing at it as a parent.
    renderThread('a3');

    await waitFor(() => expect(screen.getAllByText('Noch keine Beitraege.')).toHaveLength(3));
  });

  describe('sort mode switching', () => {
    it('re-fetches each column with the selected sort value', async () => {
      const seenSorts: string[] = [];
      server.use(
        http.get(`${FORUM_BASE_URL}/nodes/t1/kinder`, ({ request }) => {
          const url = new URL(request.url);
          seenSorts.push(url.searchParams.get('sort') ?? 'null');
          return HttpResponse.json({ data: [], nextCursor: null });
        })
      );
      const user = userEvent.setup();
      renderThread('t1');
      await waitFor(() => expect(seenSorts).toContain('beste')); // default sort mode

      await user.click(screen.getByRole('button', { name: 'Neueste' }));
      await waitFor(() => expect(seenSorts).toContain('neu'));

      await user.click(screen.getByRole('button', { name: 'Meistgelikt' }));
      await waitFor(() => expect(seenSorts).toContain('likes'));

      const likesButton = screen.getByRole('button', { name: 'Meistgelikt' });
      expect(likesButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('optimistic like', () => {
    it('increments immediately and keeps the server-confirmed count on success', async () => {
      const user = userEvent.setup();
      renderThread('t1', 'fake-token');
      await waitFor(() => expect(screen.getByText(/Tempolimit/)).toBeInTheDocument());

      const contraColumn = screen.getByText('Contra').closest('div')!.parentElement!;
      const a5Card = within(contraColumn).getByText(/Unfallstatistik zeigt keinen eindeutigen/).closest('div')!;
      const likeButton = within(a5Card).getByRole('button', { pressed: false });
      expect(within(likeButton).getByText('7')).toBeInTheDocument();

      await user.click(likeButton);

      await waitFor(() => expect(within(likeButton).getByText('8')).toBeInTheDocument());
    });

    it('rolls back the optimistic increment when the like request fails', async () => {
      // A short artificial delay keeps the failing response from settling before we get a chance
      // to observe the optimistic "13" - without it the assertion below would race the request.
      server.use(
        http.post(`${FORUM_BASE_URL}/nodes/a4/likes`, async () => {
          await delay(50);
          return HttpResponse.json({ error: 'boom' }, { status: 500 });
        })
      );
      const user = userEvent.setup();
      renderThread('t1', 'fake-token');
      await waitFor(() => expect(screen.getByText(/Tempolimit/)).toBeInTheDocument());

      const contraColumn = screen.getByText('Contra').closest('div')!.parentElement!;
      const a4Card = within(contraColumn).getByText(/individuelle Freiheit auf der Autobahn/).closest('div')!;
      const likeButton = within(a4Card).getByRole('button', { pressed: false });
      expect(within(likeButton).getByText('12')).toBeInTheDocument();

      await user.click(likeButton);
      // Optimistic bump is visible immediately, before the (deliberately slow) request settles...
      expect(within(likeButton).getByText('13')).toBeInTheDocument();
      // ...then rolled back once the failing request actually resolves.
      await waitFor(() => expect(within(likeButton).getByText('12')).toBeInTheDocument());
    });

    it('requires login before allowing a like when no access token is present', async () => {
      const user = userEvent.setup();
      renderThread('t1', null);
      await waitFor(() => expect(screen.getByText(/Tempolimit/)).toBeInTheDocument());

      const contraColumn = screen.getByText('Contra').closest('div')!.parentElement!;
      const a5Card = within(contraColumn).getByText(/Unfallstatistik zeigt keinen eindeutigen/).closest('div')!;
      const likeButton = within(a5Card).getByRole('button', { pressed: false });
      const countBefore = likeButton.textContent;

      await user.click(likeButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(likeButton.textContent).toBe(countBefore); // unchanged - request never sent
    });
  });
});
