import React, { useState } from 'react';
import { useForumAuth } from '../auth/AuthContext';
import { primaryTextColumn } from '../utils/texte';
import type { ForumNode } from '../api/types';

/** Moderation popup (PUT /nodes/:id/text) to save a new text version of a node - FORUM_MODERATOR/
 * ADMIN only, gated by the caller (ModerationControls). */
export function EditTextModal({
  node,
  onSaved,
  onCancel,
}: {
  node: ForumNode;
  onSaved: (node: ForumNode) => void;
  onCancel: () => void;
}) {
  const { api } = useForumAuth();
  const column = primaryTextColumn(node.texte);
  const initialText = node.texte[column]?.text ?? '';
  const [text, setText] = useState(initialText);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || trimmed === initialText.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await api.updateNodeText(node.id, { [column]: trimmed });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="forum-thread fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Text bearbeiten"
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-3 rounded-lg bg-white p-4 shadow-xl dark:bg-gray-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Text bearbeiten</h2>
          <button type="button" onClick={onCancel} aria-label="Schliessen" className="text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Speichern legt eine neue Textversion an - die vorherigen Versionen bleiben erhalten.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          required
          autoFocus
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 px-3 py-1 text-sm dark:border-gray-600"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !text.trim() || text.trim() === initialText.trim()}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Speichern…' : 'Neue Version speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}
