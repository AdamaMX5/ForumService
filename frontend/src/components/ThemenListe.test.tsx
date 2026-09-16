import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ForumAuthProvider } from '../auth/AuthContext';
import { ThemenListe } from './ThemenListe';
import { server } from '../mocks/server';

const FORUM_BASE_URL = 'http://localhost:3000';

function renderListe() {
  return render(
    <ForumAuthProvider forumApiBaseUrl={FORUM_BASE_URL} externalAuth={{ accessToken: null }}>
      <ThemenListe onSelect={vi.fn()} />
    </ForumAuthProvider>
  );
}

describe('ThemenListe - titel vs. legacy fallback (ForumService issue #10)', () => {
  it('shows titel instead of the (much longer) body text when present', async () => {
    server.use(
      http.get('*/themen', () =>
        HttpResponse.json({
          data: [
            {
              id: 't-neu',
              typ: 'thema',
              titel: 'Kurze Ueberschrift',
              texte: {
                neutral: { version: 1, text: 'Ein sehr viel laengerer Fliesstext, der nicht in der Uebersicht stehen soll.', autor_id: 'u1', datum: '2026-01-05T10:00:00Z' },
                pro: null,
                contra: null,
              },
              anhaenge: [],
              ersteller_id: 'u1',
              erstellt_am: '2026-01-05T10:00:00Z',
              likes_count: 0,
              comments_count: 0,
              bearbeitet_von: [],
              soft_deleted: false,
              liked_by_me: null,
              sichtbarkeit: 'oeffentlich',
            },
          ],
          nextCursor: null,
        })
      )
    );

    renderListe();

    await waitFor(() => expect(screen.getByText('Kurze Ueberschrift')).toBeInTheDocument());
    expect(screen.queryByText(/sehr viel laengerer Fliesstext/)).not.toBeInTheDocument();
  });

  it('falls back to the body text when titel is null (legacy thema)', async () => {
    server.use(
      http.get('*/themen', () =>
        HttpResponse.json({
          data: [
            {
              id: 't-alt',
              typ: 'thema',
              titel: null,
              texte: {
                neutral: { version: 1, text: 'Altes Thema ohne eigene Ueberschrift.', autor_id: 'u1', datum: '2026-01-05T10:00:00Z' },
                pro: null,
                contra: null,
              },
              anhaenge: [],
              ersteller_id: 'u1',
              erstellt_am: '2026-01-05T10:00:00Z',
              likes_count: 0,
              comments_count: 0,
              bearbeitet_von: [],
              soft_deleted: false,
              liked_by_me: null,
              sichtbarkeit: 'oeffentlich',
            },
          ],
          nextCursor: null,
        })
      )
    );

    renderListe();

    await waitFor(() => expect(screen.getByText('Altes Thema ohne eigene Ueberschrift.')).toBeInTheDocument());
  });
});
