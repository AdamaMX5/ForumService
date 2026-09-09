import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ForumAuthProvider } from '../auth/AuthContext';
import { ReportIssueModal } from './ReportIssueModal';
import { server } from '../mocks/server';

const GIT_SERVICE_BASE_URL = 'http://localhost:5000';

function renderModal(accessToken: string | null = 'fake-token', onNeedRefresh?: () => Promise<string>) {
  return render(
    <ForumAuthProvider externalAuth={{ accessToken, onNeedRefresh }}>
      <ReportIssueModal onClose={() => {}} />
    </ForumAuthProvider>
  );
}

describe('ReportIssueModal', () => {
  it('creates a GitService issue with the chosen typ as label and shows the resulting link', async () => {
    let capturedBody: { repo: string; title: string; body: string; labels?: string[] } | null = null;
    server.use(
      http.post(`${GIT_SERVICE_BASE_URL}/issue`, async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json({ number: 42, url: 'https://git.freischule.info/freischule/ForumService/issues/42' }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByLabelText('Bug'));
    await user.type(screen.getByPlaceholderText('Kurzer Titel'), 'Glühbirne fehlt');
    await user.type(screen.getByPlaceholderText('Beschreibung…'), 'Es sollte ein Icon geben.');
    await user.click(screen.getByRole('button', { name: 'Issue erstellen' }));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toMatchObject({
      repo: 'ForumService',
      title: 'Glühbirne fehlt',
      body: 'Es sollte ein Icon geben.',
      labels: ['bug'],
    });
    expect(await screen.findByText('https://git.freischule.info/freischule/ForumService/issues/42')).toBeInTheDocument();
  });

  it('shows an error message when GitService rejects the request', async () => {
    server.use(
      http.post(`${GIT_SERVICE_BASE_URL}/issue`, () => HttpResponse.json({ error: 'GitService unreachable' }, { status: 503 }))
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText('Kurzer Titel'), 'Titel');
    await user.type(screen.getByPlaceholderText('Beschreibung…'), 'Beschreibung');
    await user.click(screen.getByRole('button', { name: 'Issue erstellen' }));

    expect(await screen.findByText('GitService unreachable')).toBeInTheDocument();
  });

  it('retries once via onNeedRefresh after a 401, then succeeds', async () => {
    const onNeedRefresh = vi.fn().mockResolvedValue('fresh-token');
    let hits = 0;
    server.use(
      http.post(`${GIT_SERVICE_BASE_URL}/issue`, () => {
        hits += 1;
        return hits === 1
          ? HttpResponse.json({ error: 'expired' }, { status: 401 })
          : HttpResponse.json({ number: 1, url: 'https://git.freischule.info/freischule/ForumService/issues/1' }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderModal('stale-token', onNeedRefresh);

    await user.type(screen.getByPlaceholderText('Kurzer Titel'), 'Titel');
    await user.type(screen.getByPlaceholderText('Beschreibung…'), 'Beschreibung');
    await user.click(screen.getByRole('button', { name: 'Issue erstellen' }));

    expect(await screen.findByText('https://git.freischule.info/freischule/ForumService/issues/1')).toBeInTheDocument();
    expect(onNeedRefresh).toHaveBeenCalledTimes(1);
    expect(hits).toBe(2);
  });
});
