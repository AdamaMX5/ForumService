import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ForumAuthProvider } from '../auth/AuthContext';
import { ModerationControls } from './ModerationControls';
import { mockNodes } from '../mocks/data';
import type { ForumNode } from '../api/types';

const FORUM_BASE_URL = 'http://localhost:3000';

function makeJwt(roles: string[]): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: 'mod-1', roles, exp: Math.floor(Date.now() / 1000) + 900 })}.sig`;
}

function themaNode(): ForumNode {
  return { ...mockNodes.get('t1')!, id: 't1' };
}

function argumentNode(): ForumNode {
  return { ...mockNodes.get('a1')!, id: 'a1' };
}

function renderControls(
  node: ForumNode,
  {
    roles,
    onTextUpdated = vi.fn(),
    onSichtbarkeitChanged,
    onDeleted = vi.fn(),
  }: {
    roles: string[] | null;
    onTextUpdated?: (node: ForumNode) => void;
    onSichtbarkeitChanged?: (node: ForumNode) => void;
    onDeleted?: () => void;
  }
) {
  const accessToken = roles ? makeJwt(roles) : null;
  return render(
    <ForumAuthProvider forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken }}>
      <ModerationControls
        node={node}
        onTextUpdated={onTextUpdated}
        onSichtbarkeitChanged={onSichtbarkeitChanged}
        onDeleted={onDeleted}
      />
    </ForumAuthProvider>
  );
}

describe('ModerationControls - role gating', () => {
  it('renders nothing for a logged-out/anonymous caller', () => {
    renderControls(argumentNode(), { roles: null });
    expect(screen.queryByText('Moderation')).not.toBeInTheDocument();
  });

  it('renders nothing for a caller without FORUM_MODERATOR/ADMIN', () => {
    renderControls(argumentNode(), { roles: ['CONSUMER'] });
    expect(screen.queryByText('Moderation')).not.toBeInTheDocument();
  });

  it('shows edit + delete for a FORUM_MODERATOR, but no sichtbarkeit toggle (Admin-only)', () => {
    renderControls(themaNode(), { roles: ['FORUM_MODERATOR'], onSichtbarkeitChanged: vi.fn() });
    expect(screen.getByText('Moderation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Text bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loeschen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /schalten/ })).not.toBeInTheDocument();
  });

  it('shows the sichtbarkeit toggle for an ADMIN on a thema node', () => {
    renderControls(themaNode(), { roles: ['ADMIN'], onSichtbarkeitChanged: vi.fn() });
    expect(screen.getByRole('button', { name: 'Privat schalten' })).toBeInTheDocument();
  });

  it('never shows the sichtbarkeit toggle on an argument node, even for ADMIN', () => {
    renderControls(argumentNode(), { roles: ['ADMIN'], onSichtbarkeitChanged: vi.fn() });
    expect(screen.queryByRole('button', { name: /schalten/ })).not.toBeInTheDocument();
  });
});

describe('ModerationControls - edit text', () => {
  it('opens the edit modal prefilled with the current text and saves a new version', async () => {
    const user = userEvent.setup();
    const onTextUpdated = vi.fn();
    renderControls(argumentNode(), { roles: ['FORUM_MODERATOR'], onTextUpdated });

    await user.click(screen.getByRole('button', { name: 'Text bearbeiten' }));
    const dialog = screen.getByRole('dialog', { name: 'Text bearbeiten' });
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Ein Tempolimit senkt den CO2-Ausstoss messbar.');

    await user.clear(textarea);
    await user.type(textarea, 'Ueberarbeitete Fassung des Arguments.');
    await user.click(screen.getByRole('button', { name: 'Neue Version speichern' }));

    await waitFor(() => expect(onTextUpdated).toHaveBeenCalledTimes(1));
    expect(onTextUpdated.mock.calls[0][0]).toMatchObject({
      texte: { neutral: { text: 'Ueberarbeitete Fassung des Arguments.', version: 2 } },
    });
    expect(dialog).not.toBeInTheDocument();
  });
});

describe('ModerationControls - sichtbarkeit toggle', () => {
  it('toggles oeffentlich -> privat and reports the updated node', async () => {
    const user = userEvent.setup();
    const onSichtbarkeitChanged = vi.fn();
    renderControls(themaNode(), { roles: ['ADMIN'], onSichtbarkeitChanged });

    await user.click(screen.getByRole('button', { name: 'Privat schalten' }));

    await waitFor(() => expect(onSichtbarkeitChanged).toHaveBeenCalledTimes(1));
    expect(onSichtbarkeitChanged.mock.calls[0][0]).toMatchObject({ sichtbarkeit: 'privat' });
  });
});

describe('ModerationControls - soft delete', () => {
  it('requires a confirm step before calling onDeleted', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    renderControls(argumentNode(), { roles: ['FORUM_MODERATOR'], onDeleted });

    await user.click(screen.getByRole('button', { name: 'Loeschen' }));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Wirklich loeschen' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Loeschgrund'), 'Spam');
    await user.click(screen.getByRole('button', { name: 'Wirklich loeschen' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });

  it('cancelling the confirm step leaves the node untouched', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    renderControls(argumentNode(), { roles: ['FORUM_MODERATOR'], onDeleted });

    await user.click(screen.getByRole('button', { name: 'Loeschen' }));
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Loeschen' })).toBeInTheDocument();
  });
});
