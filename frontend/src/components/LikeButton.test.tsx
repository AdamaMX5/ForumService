import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ForumAuthProvider } from '../auth/AuthContext';
import { LikeButton } from './LikeButton';
import { server } from '../mocks/server';

const FORUM_BASE_URL = 'http://localhost:3000';

// LikeButton receives `likesCount` as a controlled prop, so tests need a thin stateful wrapper
// to observe the onLikesCountChange callback actually taking effect - same pattern as how
// ArgumentNode/ThreadHeader own the count in the real app.
function Harness({
  nodeId,
  initialCount,
  likedByMe,
  onRequireAuth,
}: {
  nodeId: string;
  initialCount: number;
  likedByMe: boolean | null;
  onRequireAuth: () => void;
}) {
  const [count, setCount] = useState(initialCount);
  return (
    <LikeButton
      nodeId={nodeId}
      likesCount={count}
      likedByMe={likedByMe}
      onLikesCountChange={setCount}
      onRequireAuth={onRequireAuth}
    />
  );
}

function renderLikeButton({
  nodeId,
  initialCount,
  likedByMe,
  accessToken = 'fake-token',
  onRequireAuth = vi.fn(),
}: {
  nodeId: string;
  initialCount: number;
  likedByMe: boolean | null;
  accessToken?: string | null;
  onRequireAuth?: () => void;
}) {
  render(
    <ForumAuthProvider forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken }}>
      <Harness nodeId={nodeId} initialCount={initialCount} likedByMe={likedByMe} onRequireAuth={onRequireAuth} />
    </ForumAuthProvider>
  );
  return { onRequireAuth };
}

describe('LikeButton - initial state from the server-reported likedByMe prop', () => {
  it('starts liked (♥, aria-pressed=true) when likedByMe is true', () => {
    renderLikeButton({ nodeId: 'a2', initialCount: 9, likedByMe: true });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveTextContent('♥');
    expect(button).toHaveTextContent('9');
  });

  it('starts unliked (♡, aria-pressed=false) when likedByMe is false', () => {
    renderLikeButton({ nodeId: 'a3', initialCount: 5, likedByMe: false });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveTextContent('♡');
  });

  it('treats likedByMe: null (anonymous request) as unliked', () => {
    renderLikeButton({ nodeId: 'a6', initialCount: 4, likedByMe: null });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveTextContent('♡');
  });
});

describe('LikeButton - optimistic like/unlike', () => {
  it('optimistically likes, then reconciles with the server-confirmed count', async () => {
    const user = userEvent.setup();
    renderLikeButton({ nodeId: 'a3', initialCount: 5, likedByMe: false });

    const button = screen.getByRole('button');
    await user.click(button);

    // Optimistic update is immediate...
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveTextContent('6');
    // ...and stays consistent once the (mock) server confirms it.
    await waitFor(() => expect(button).toHaveTextContent('6'));
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('optimistically unlikes, then reconciles with the server-confirmed count', async () => {
    const user = userEvent.setup();
    renderLikeButton({ nodeId: 'a2', initialCount: 9, likedByMe: true });

    const button = screen.getByRole('button');
    await user.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(button).toHaveTextContent('8'));
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('rolls back to the previous liked state and count when the like request fails', async () => {
    server.use(
      http.post(`${FORUM_BASE_URL}/nodes/a5/likes`, async () => {
        await delay(50);
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      })
    );
    const user = userEvent.setup();
    renderLikeButton({ nodeId: 'a5', initialCount: 7, likedByMe: false });

    const button = screen.getByRole('button');
    await user.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveTextContent('8');

    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
    expect(button).toHaveTextContent('7');
  });

  it('rolls back to the previous liked state and count when the unlike request fails', async () => {
    server.use(
      http.delete(`${FORUM_BASE_URL}/nodes/a4/likes`, async () => {
        await delay(50);
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      })
    );
    const user = userEvent.setup();
    renderLikeButton({ nodeId: 'a4', initialCount: 12, likedByMe: true });

    const button = screen.getByRole('button');
    await user.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveTextContent('11');

    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
    expect(button).toHaveTextContent('12');
  });

  it('requires login and never calls the API when there is no access token', async () => {
    let hits = 0;
    server.use(
      http.post(`${FORUM_BASE_URL}/nodes/a1/likes`, () => {
        hits += 1;
        return HttpResponse.json({ likes_count: 999 }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    const { onRequireAuth } = renderLikeButton({ nodeId: 'a1', initialCount: 18, likedByMe: false, accessToken: null });

    const button = screen.getByRole('button');
    await user.click(button);

    expect(onRequireAuth).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveTextContent('18');
    expect(hits).toBe(0);
  });
});
