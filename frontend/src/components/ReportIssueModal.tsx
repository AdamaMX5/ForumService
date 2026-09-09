import React, { useState } from 'react';
import { useForumAuth } from '../auth/AuthContext';
import { createGitServiceApi } from '../api/gitServiceApi';

type ReportTyp = 'idee' | 'bug';

const GIT_SERVICE_REPO = import.meta.env.VITE_GIT_SERVICE_REPO ?? 'ForumService';

/** Popup form (opened via the 💡-Icon neben dem Schliessen-Icon im Kommentare-Popup) to file an
 * idea or bug report as a GitService issue - see Issue #7. */
export function ReportIssueModal({ onClose }: { onClose: () => void }) {
  const { accessToken, refreshAccessToken } = useForumAuth();
  const [typ, setTyp] = useState<ReportTyp>('idee');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const api = createGitServiceApi(GIT_SERVICE_REPO, { getAccessToken: () => accessToken, refreshAccessToken });
      const result = await api.createIssue({
        title: title.trim(),
        body: body.trim(),
        labels: [typ === 'bug' ? 'bug' : 'feature'],
      });
      setCreatedUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Issue konnte nicht erstellt werden');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="forum-thread fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Idee oder Bug melden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg space-y-3 rounded-lg bg-white p-4 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Idee oder Bug melden</h2>
          <button type="button" onClick={onClose} aria-label="Schliessen" className="text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>

        {createdUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-200">Danke! Das Issue wurde erstellt:</p>
            <a
              href={createdUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block break-all text-sm text-blue-600 hover:underline"
            >
              {createdUrl}
            </a>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
              >
                Schliessen
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input type="radio" name="report-typ" checked={typ === 'idee'} onChange={() => setTyp('idee')} />
                Idee
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="report-typ" checked={typ === 'bug'} onChange={() => setTyp('bug')} />
                Bug
              </label>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              placeholder="Kurzer Titel"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
              placeholder="Beschreibung…"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-gray-300 px-3 py-1 text-sm dark:border-gray-600"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !body.trim()}
                className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isSubmitting ? 'Sende…' : 'Issue erstellen'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
