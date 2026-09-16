import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ForumAuthProvider } from '../auth/AuthContext';
import { NewThemaModal } from './NewThemaModal';

const FORUM_BASE_URL = 'http://localhost:3000';

function renderModal() {
  return render(
    <ForumAuthProvider forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken: 'fake-token' }}>
      <NewThemaModal onCreated={vi.fn()} onCancel={vi.fn()} />
    </ForumAuthProvider>
  );
}

describe('NewThemaModal - titel is required (ForumService issue #10)', () => {
  it('keeps the submit button disabled until both titel and text are filled', async () => {
    const user = userEvent.setup();
    renderModal();

    const submit = screen.getByRole('button', { name: 'Thema erstellen' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Überschrift'), 'Meine Ueberschrift');
    expect(submit).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText('Worum soll es in diesem Thema gehen? (Markdown wird unterstützt)'),
      'Beschreibungstext'
    );
    expect(submit).toBeEnabled();
  });
});
