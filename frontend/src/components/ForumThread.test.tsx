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

      const sortSelect = screen.getByRole('combobox', { name: 'Sortierung' });

      await user.selectOptions(sortSelect, 'Neueste');
      await waitFor(() => expect(seenSorts).toContain('neu'));

      await user.selectOptions(sortSelect, 'Meistgelikt');
      await waitFor(() => expect(seenSorts).toContain('likes'));

      expect(sortSelect).toHaveValue('likes');
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

  describe('embedded without a nodeId', () => {
    function renderWithoutNodeId(accessToken: string | null = null) {
      return render(<ForumThread forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken }} />);
    }

    afterEach(() => {
      window.history.replaceState(null, '', '/');
    });

    it('shows the Themen start page instead of a thread, plus a "+" create button', async () => {
      renderWithoutNodeId();

      await waitFor(() =>
        expect(
          screen.getByText('Sollte auf deutschen Autobahnen ein generelles Tempolimit von 130 km/h gelten?')
        ).toBeInTheDocument()
      );
      expect(screen.queryByText('Pro')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Neues Thema erstellen' })).toBeInTheDocument();
    });

    it('selecting a thema from the list switches to the thread view with a back link', async () => {
      const user = userEvent.setup();
      renderWithoutNodeId();

      await waitFor(() =>
        expect(
          screen.getByText('Sollte auf deutschen Autobahnen ein generelles Tempolimit von 130 km/h gelten?')
        ).toBeInTheDocument()
      );
      await user.click(
        screen.getByText('Sollte auf deutschen Autobahnen ein generelles Tempolimit von 130 km/h gelten?')
      );

      expect(await screen.findByText('Pro')).toBeInTheDocument();
      const backLink = screen.getByRole('button', { name: /Zurueck zur Themenliste/ });
      expect(backLink).toBeInTheDocument();

      await user.click(backLink);
      expect(await screen.findByRole('heading', { name: 'Themen' })).toBeInTheDocument();
    });

    it('requires login before opening the new-thema form', async () => {
      const user = userEvent.setup();
      renderWithoutNodeId(null);

      await waitFor(() => expect(screen.getByRole('heading', { name: 'Themen' })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Neues Thema erstellen' }));

      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(screen.queryByRole('dialog', { name: 'Neues Thema erstellen' })).not.toBeInTheDocument();
    });

    it('creating a new thema navigates straight into it', async () => {
      const user = userEvent.setup();
      renderWithoutNodeId('fake-token');

      await waitFor(() => expect(screen.getByRole('heading', { name: 'Themen' })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Neues Thema erstellen' }));

      const form = screen.getByRole('dialog', { name: 'Neues Thema erstellen' });
      await user.type(within(form).getByPlaceholderText('Worum soll es in diesem Thema gehen?'), 'Ein brandneues Thema');
      await user.click(within(form).getByRole('button', { name: 'Thema erstellen' }));

      await waitFor(() => expect(screen.getByText('Ein brandneues Thema')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /Zurueck zur Themenliste/ })).toBeInTheDocument();
    });
  });
});
