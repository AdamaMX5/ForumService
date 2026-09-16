import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForumAuthProvider } from '../auth/AuthContext';
import { ForumUIProvider } from './ForumUIContext';
import { ThreadHeader } from './ThreadHeader';
import { mockNodes } from '../mocks/data';
import type { ForumNode } from '../api/types';

const FORUM_BASE_URL = 'http://localhost:3000';

function renderHeader(root: ForumNode) {
  return render(
    <ForumAuthProvider forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken: null }}>
      <ForumUIProvider
        value={{
          sort: 'beste',
          setSort: vi.fn(),
          focusNodeId: null,
          pathToFocusIds: new Set(),
          onOpenComments: vi.fn(),
          onRequireAuth: vi.fn(),
        }}
      >
        <ThreadHeader
          root={root}
          likesCount={root.likes_count}
          onLikesCountChange={vi.fn()}
          onRootUpdated={vi.fn()}
          onRootDeleted={vi.fn()}
        />
      </ForumUIProvider>
    </ForumAuthProvider>
  );
}

describe('ThreadHeader - titel + Markdown (ForumService issue #10)', () => {
  it('shows titel as the heading and renders the general text as Markdown below it', () => {
    const root: ForumNode = {
      ...mockNodes.get('t1')!,
      titel: 'Sollte ein Tempolimit gelten?',
      texte: {
        neutral: { version: 1, text: 'Das ist **wichtig** fuer die Umwelt.', autor_id: 'user-1', datum: '2026-01-05T10:00:00Z' },
        pro: null,
        contra: null,
      },
    };

    renderHeader(root);

    expect(screen.getByRole('heading', { name: 'Sollte ein Tempolimit gelten?' })).toBeInTheDocument();
    // react-markdown renders **wichtig** as a <strong> element, not literal asterisks.
    expect(screen.getByText('wichtig').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*wichtig\*\*/)).not.toBeInTheDocument();
  });

  it('falls back to the body text as heading (no duplicate body) for a legacy thema without titel', () => {
    const root: ForumNode = {
      ...mockNodes.get('t1')!,
      titel: null,
      texte: {
        neutral: { version: 1, text: 'Alter Thementext ohne eigene Ueberschrift.', autor_id: 'user-1', datum: '2026-01-05T10:00:00Z' },
        pro: null,
        contra: null,
      },
    };

    renderHeader(root);

    expect(screen.getByRole('heading', { name: 'Alter Thementext ohne eigene Ueberschrift.' })).toBeInTheDocument();
    // Body text must not be rendered a second time below the heading for legacy themen.
    expect(screen.getAllByText('Alter Thementext ohne eigene Ueberschrift.')).toHaveLength(1);
  });
});
