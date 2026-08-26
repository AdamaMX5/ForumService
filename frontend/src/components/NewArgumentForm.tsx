import React, { useState } from 'react';
import { useForumAuth } from '../auth/AuthContext';
import type { EdgeTyp, ForumNode } from '../api/types';

const LABELS: Record<EdgeTyp, string> = {
  pro: 'Pro-Argument',
  contra: 'Contra-Argument',
  differenzierung: 'Differenzierung',
};

export function NewArgumentForm({
  parentId,
  edgeTyp,
  onCreated,
  onRequireAuth,
  onCancel,
}: {
  parentId: string;
  edgeTyp: EdgeTyp;
  onCreated: (node: ForumNode) => void;
  onRequireAuth: () => void;
  onCancel: () => void;
}) {
  const { accessToken, api } = useForumAuth();
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) {
      onRequireAuth();
      return;
    }
    if (!text.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const node = await api.createNode({
        typ: 'argument',
        texte: { neutral: text.trim() },
        parent_id: parentId,
        edge_typ: edgeTyp,
      });
      setText('');
      onCreated(node);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 rounded border border-dashed border-gray-300 p-3 dark:border-gray-600">
      <p className="text-xs font-medium uppercase text-gray-500">Neues {LABELS[edgeTyp]}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        required
        placeholder={`${LABELS[edgeTyp]} formulieren…`}
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1 text-sm dark:border-gray-600"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Speichern…' : 'Hinzufuegen'}
        </button>
      </div>
    </form>
  );
}
