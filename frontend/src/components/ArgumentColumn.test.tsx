import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForumAuthProvider } from '../auth/AuthContext';
import { ForumUIProvider } from './ForumUIContext';
import { ArgumentColumn } from './ArgumentColumn';

const FORUM_BASE_URL = 'http://localhost:3000';

function renderColumn(accessToken: string | null) {
  return render(
    <ForumAuthProvider forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken }}>
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
        <ArgumentColumn parentId="t1" edgeTyp="pro" />
      </ForumUIProvider>
    </ForumAuthProvider>
  );
}

describe('ArgumentColumn - "Hinzufuegen" icon button (ForumService issue #11)', () => {
  it('renders an icon-only add button for a logged-in caller, with no visible link text', async () => {
    renderColumn('fake-token');

    await waitFor(() => expect(screen.getByText('Pro')).toBeInTheDocument());
    const addButton = screen.getByRole('button', { name: 'Hinzufuegen' });
    expect(addButton.querySelector('svg')).toBeTruthy();
    expect(addButton.textContent).toBe('');
  });

  it('shows no add button at all for an anonymous caller', async () => {
    renderColumn(null);

    await waitFor(() => expect(screen.getByText('Pro')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Hinzufuegen' })).not.toBeInTheDocument();
  });
});
