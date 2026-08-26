import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useForumAuth } from '../auth/AuthContext';
import { useForumUI } from './ForumUIContext';
import { LikeButton } from './LikeButton';
import { ArgumentColumn } from './ArgumentColumn';
import type { EdgeTyp, ForumChildNode, ReferenzListItem } from '../api/types';

const EDGE_ACCENT: Record<EdgeTyp, string> = {
  pro: 'border-l-4 border-l-[var(--forum-pro)]',
  contra: 'border-l-4 border-l-[var(--forum-contra)]',
  differenzierung: 'border-l-4 border-l-[var(--forum-differenzierung)]',
};

const CHILD_TYPES: EdgeTyp[] = ['pro', 'contra', 'differenzierung'];

function referenzLabel(node: ReferenzListItem): string {
  return node.texte.neutral?.text ?? node.texte.pro?.text ?? node.texte.contra?.text ?? '(ohne Titel)';
}

export function ArgumentNode({ node }: { node: ForumChildNode }) {
  const { accessToken, api } = useForumAuth();
  const { focusNodeId, pathToFocusIds, onOpenComments, onRequireAuth } = useForumUI();
  const [expanded, setExpanded] = useState(() => pathToFocusIds.has(node.id));
  const [likesCount, setLikesCount] = useState(node.likes_count);
  const [isAddingReference, setIsAddingReference] = useState(false);
  const [referenceTargetId, setReferenceTargetId] = useState('');
  const [referenceStatus, setReferenceStatus] = useState<string | null>(null);
  const [showReferenzen, setShowReferenzen] = useState(false);
  const [referenzen, setReferenzen] = useState<ReferenzListItem[] | null>(null);
  const [referenzenError, setReferenzenError] = useState<string | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const isFocused = focusNodeId !== null && focusNodeId === node.id;

  useEffect(() => {
    if (isFocused) elementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isFocused]);

  // A `?fokus=` deep link must reveal its full ancestor path, not just highlight the leaf if it
  // happens to already be loaded - see ForumUIContext.pathToFocusIds.
  useEffect(() => {
    if (pathToFocusIds.has(node.id)) setExpanded(true);
  }, [pathToFocusIds, node.id]);

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
      if (referenzen !== null) setReferenzen(null); // stale - force a reload next time it's shown
    } catch (err) {
      setReferenceStatus(err instanceof Error ? err.message : 'Referenz fehlgeschlagen');
    }
  }

  async function toggleReferenzen() {
    if (showReferenzen) {
      setShowReferenzen(false);
      return;
    }
    if (referenzen !== null) {
      setShowReferenzen(true);
      return;
    }
    setReferenzenError(null);
    try {
      const result = await api.getReferenzen(node.id);
      setReferenzen(result.data);
      setShowReferenzen(true);
    } catch (err) {
      setReferenzenError(err instanceof Error ? err.message : 'Referenzen konnten nicht geladen werden');
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
          likedByMe={node.liked_by_me}
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
        <button type="button" onClick={toggleReferenzen} className="hover:text-blue-600">
          {showReferenzen ? 'Referenzen ausblenden' : 'Referenzen anzeigen'}
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

      {referenzenError && <p className="mt-1 text-xs text-red-600">{referenzenError}</p>}
      {showReferenzen && referenzen && (
        referenzen.length === 0 ? (
          <p className="mt-1 text-xs text-gray-400">Keine Referenzen.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs text-gray-500">
            {referenzen.map((ref) => (
              <li key={ref.referenz.id}>→ {referenzLabel(ref)}</li>
            ))}
          </ul>
        )
      )}

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-gray-800 sm:flex-row">
          {CHILD_TYPES.map((typ) => (
            <ArgumentColumn key={typ} parentId={node.id} edgeTyp={typ} />
          ))}
        </div>
      )}
    </div>
  );
}
