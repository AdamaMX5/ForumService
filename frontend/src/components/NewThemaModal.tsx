import React, { useState } from 'react';
import { useForumAuth } from '../auth/AuthContext';
import type { ForumNode } from '../api/types';

/** Popup form to create a new root Thema, opened from the "+" button ForumThreadView renders
 * whenever it's embedded without a fixed nodeId (list-capable mode) - see ThemenListe. */
export function NewThemaModal({
  onCreated,
  onCancel,
}: {
  onCreated: (node: ForumNode) => void;
  onCancel: () => void;
}) {
  const { api } = useForumAuth();
  const [text, setText] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const node = await api.createNode({
        typ: 'thema',
        texte: { neutral: text.trim() },
        tags: tags.length > 0 ? tags : undefined,
      });
      onCreated(node);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="forum-thread fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Neues Thema erstellen"
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-3 rounded-lg bg-white p-4 shadow-xl dark:bg-gray-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Neues Thema</h2>
          <button type="button" onClick={onCancel} aria-label="Schliessen" className="text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          required
          autoFocus
          placeholder="Worum soll es in diesem Thema gehen?"
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Tags, kommagetrennt (optional)"
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
            disabled={isSubmitting || !text.trim()}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Speichern…' : 'Thema erstellen'}
          </button>
        </div>
      </form>
    </div>
  );
}
