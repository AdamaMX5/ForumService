import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useForumAuth } from '../auth/AuthContext';
import { LikeButton } from './LikeButton';
import { ArgumentColumn } from './ArgumentColumn';
import type { EdgeTyp, ForumChildNode, SortMode } from '../api/types';

const EDGE_ACCENT: Record<EdgeTyp, string> = {
  pro: 'border-l-4 border-l-[var(--forum-pro)]',
  contra: 'border-l-4 border-l-[var(--forum-contra)]',
  differenzierung: 'border-l-4 border-l-[var(--forum-differenzierung)]',
};

const CHILD_TYPES: EdgeTyp[] = ['pro', 'contra', 'differenzierung'];

export function ArgumentNode({
  node,
  sort,
  focusNodeId,
  onOpenComments,
  onRequireAuth,
}: {
  node: ForumChildNode;
  sort: SortMode;
  focusNodeId: string | null;
  onOpenComments: (nodeId: string) => void;
  onRequireAuth: () => void;
}) {
  const { accessToken, api } = useForumAuth();
  const [expanded, setExpanded] = useState(false);
  const [likesCount, setLikesCount] = useState(node.likes_count);
  const [isAddingReference, setIsAddingReference] = useState(false);
  const [referenceTargetId, setReferenceTargetId] = useState('');
  const [referenceStatus, setReferenceStatus] = useState<string | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const isFocused = focusNodeId !== null && focusNodeId === node.id;

  useEffect(() => {
    if (isFocused) elementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isFocused]);

  const displayText = node.texte.neutral?.text ?? node.texte.pro?.text ?? node.texte.contra?.text ?? '';

  async function submitReference(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) {
      onRequireAuth();
      return;
    }
    if (!referenceTargetId.trim()) return;
    setReferenceStatus(null);
    try {
      await api.addReferenz(node.id, referenceTargetId.trim());
      setReferenceStatus('Referenz hinzugefuegt.');
      setReferenceTargetId('');
    } catch (err) {
      setReferenceStatus(err instanceof Error ? err.message : 'Referenz fehlgeschlagen');
    }
  }

  return (
    <div
      ref={elementRef}
      className={`rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 ${
        node.edge_typ ? EDGE_ACCENT[node.edge_typ] : ''
      } ${isFocused ? 'ring-2 ring-yellow-400' : ''}`}
    >
      <p className="text-sm text-gray-800 dark:text-gray-100">{displayText}</p>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <LikeButton
          nodeId={node.id}
          likesCount={likesCount}
          onLikesCountChange={setLikesCount}
          onRequireAuth={onRequireAuth}
        />
        <button type="button" onClick={() => onOpenComments(node.id)} className="hover:text-blue-600">
          💬 {node.comments_count}
        </button>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="hover:text-blue-600">
          {expanded ? 'Zuklappen' : 'Antworten anzeigen'}
        </button>
        <button type="button" onClick={() => setIsAddingReference((v) => !v)} className="hover:text-blue-600">
          Referenzieren
        </button>
      </div>

      {isAddingReference && (
        <form onSubmit={submitReference} className="mt-2 flex gap-2">
          <input
            type="text"
            value={referenceTargetId}
            onChange={(e) => setReferenceTargetId(e.target.value)}
            placeholder="Node-ID des bestehenden Arguments"
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
          />
          <button type="submit" className="rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300 dark:bg-gray-700">
            Speichern
          </button>
        </form>
      )}
      {referenceStatus && <p className="mt-1 text-xs text-gray-500">{referenceStatus}</p>}

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-gray-800 sm:flex-row">
          {CHILD_TYPES.map((typ) => (
            <ArgumentColumn
              key={typ}
              parentId={node.id}
              edgeTyp={typ}
              sort={sort}
              focusNodeId={focusNodeId}
              onOpenComments={onOpenComments}
              onRequireAuth={onRequireAuth}
            />
          ))}
        </div>
      )}
    </div>
  );
}
