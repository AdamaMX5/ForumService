import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForumThread } from './ForumThread';
import { server } from '../mocks/server';

const FORUM_BASE_URL = 'http://localhost:3000';

// Mock chain used throughout this file (see src/mocks/data.ts):
//   t1 (thema) --pro--> a1 (argument) --differenzierung--> a7 (argument)
// a1 is a pro-child of the root, a7 is a differenzierung-child of a1 - two recursion levels
// (ArgumentColumn -> ArgumentNode -> ArgumentColumn -> ArgumentNode) below the thema root.

beforeEach(() => {
  window.history.pushState({}, '', '/');
  // jsdom has no scrollIntoView implementation; ArgumentNode calls it whenever a node becomes the
  // ?fokus= leaf (see ArgumentNode.tsx), which this file is the first to actually exercise.
  Element.prototype.scrollIntoView = vi.fn();
});

function renderThread(accessToken: string | null = null) {
  return render(
    <ForumThread nodeId="t1" forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken }} />
  );
}

async function expandA1(user: ReturnType<typeof userEvent.setup>) {
  const a1Text = await screen.findByText(/Ein Tempolimit senkt den CO2-Ausstoss messbar/);
  const a1Card = a1Text.closest('div')!;
  await user.click(within(a1Card).getByRole('button', { name: 'Antworten anzeigen' }));
  return a1Card;
}

describe('?fokus= deep link auto-expands the full ancestor path (ForumUIContext.pathToFocusIds)', () => {
  it('expands every ancestor on the path, not just the leaf, across multiple nesting levels', async () => {
    window.history.pushState({}, '', '/?fokus=a7');
    renderThread();

    await waitFor(() => expect(screen.getByText(/Tempolimit/)).toBeInTheDocument());

    // a1 sits between the root and the focus leaf a7 - it must be auto-expanded (showing
    // "Zuklappen" instead of "Antworten anzeigen") without the user ever clicking it.
    const a1Text = await screen.findByText(/Ein Tempolimit senkt den CO2-Ausstoss messbar/);
    const a1Card = a1Text.closest('div')!;
    await waitFor(() => expect(within(a1Card).getByText('Zuklappen')).toBeInTheDocument());

    // Its differenzierung-child a7, the actual focus leaf, becomes visible as a result and is
    // visually highlighted.
    const a7Text = await within(a1Card).findByText(/Selbst bei 130 km\/h bleibt der Bremsweg/);
    const a7Card = a7Text.closest('div')!;
    expect(a7Card.className).toContain('ring-2');

    // A sibling not on the ancestor path (a2, also a pro-child of t1) stays collapsed.
    const a2Text = await screen.findByText(/Weniger Unfaelle mit schwerem Ausgang/);
    const a2Card = a2Text.closest('div')!;
    expect(within(a2Card).getByText('Antworten anzeigen')).toBeInTheDocument();
  });

  it('does not expand or highlight anything when there is no ?fokus= param', async () => {
    renderThread();

    await waitFor(() => expect(screen.getByText(/Tempolimit/)).toBeInTheDocument());

    const a1Text = await screen.findByText(/Ein Tempolimit senkt den CO2-Ausstoss messbar/);
    const a1Card = a1Text.closest('div')!;
    expect(within(a1Card).getByText('Antworten anzeigen')).toBeInTheDocument();
    expect(a1Card.className).not.toContain('ring-2');
  });
});

describe('ForumUIContext propagates through recursion without prop-drilling', () => {
  it('delivers the current sort mode to a nested ArgumentColumn purely via context', async () => {
    const seenSorts: string[] = [];
    server.use(
      http.get(`${FORUM_BASE_URL}/nodes/a1/kinder`, ({ request }) => {
        seenSorts.push(new URL(request.url).searchParams.get('sort') ?? 'null');
        return HttpResponse.json({ data: [], nextCursor: null });
      })
    );
    const user = userEvent.setup();
    renderThread();
    await waitFor(() => expect(screen.getByText(/Tempolimit/)).toBeInTheDocument());

    // Change sort at the top level BEFORE a1's own nested columns have ever mounted/fetched.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sortierung' }), 'Neueste');

    // Only now does a1's nested ArgumentColumn (for pro/contra/differenzierung under a1) mount -
    // neither <ArgumentNode> nor <ArgumentColumn> take a `sort` prop, so this can only be correct
    // if the nested column reads the up-to-date value straight from ForumUIContext.
    await expandA1(user);

    await waitFor(() => expect(seenSorts.length).toBeGreaterThan(0));
    expect(seenSorts.every((s) => s === 'neu')).toBe(true);
  });

  it('delivers onOpenComments through context two recursion levels deep, for the correct node id', async () => {
    let requestedKommentareNodeId: string | null = null;
    server.use(
      http.get(`${FORUM_BASE_URL}/nodes/a7/kommentare`, () => {
        requestedKommentareNodeId = 'a7';
        return HttpResponse.json({ data: [], nextCursor: null });
      })
    );
    const user = userEvent.setup();
    renderThread();
    await waitFor(() => expect(screen.getByText(/Tempolimit/)).toBeInTheDocument());

    const a1Card = await expandA1(user);
    const a7Text = await within(a1Card).findByText(/Selbst bei 130 km\/h bleibt der Bremsweg/);
    const a7Card = a7Text.closest('div')!;

    await user.click(within(a7Card).getByRole('button', { name: /💬/ }));

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Kommentare' })).toBeInTheDocument());
    expect(requestedKommentareNodeId).toBe('a7');
  });

  it('delivers onRequireAuth through context two recursion levels deep', async () => {
    const user = userEvent.setup();
    renderThread(null); // no access token

    await waitFor(() => expect(screen.getByText(/Tempolimit/)).toBeInTheDocument());

    const a1Card = await expandA1(user);
    const a7Text = await within(a1Card).findByText(/Selbst bei 130 km\/h bleibt der Bremsweg/);
    const a7Card = a7Text.closest('div')!;
    const likeButton = within(a7Card).getByRole('button', { pressed: false });

    await user.click(likeButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
