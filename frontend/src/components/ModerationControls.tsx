import { useState } from 'react';
import { useForumAuth } from '../auth/AuthContext';
import { canModerate, isAdmin } from '../auth/roles';
import { EditTextModal } from './EditTextModal';
import type { ForumNode } from '../api/types';

/**
 * Moderation actions for a single node (thema or argument), gated on `user.roles` from the
 * decoded JWT - see ForumService issue #3. Renders nothing for a caller without
 * FORUM_MODERATOR/ADMIN. Backed by the three moderation endpoints in src/routes/nodes.js:
 * PUT /nodes/:id/text (Mod/Admin), PUT /nodes/:id/sichtbarkeit (Admin, thema only),
 * DELETE /nodes/:id (Mod/Admin, soft-delete).
 *
 * There is deliberately no "restore" affordance: the backend has no undelete endpoint, and
 * loadVisibleNode() 404s a soft-deleted node for every caller including Mod/Admin, so a
 * soft-deleted node cannot be fetched again once it's gone - see the ForumService.md moderation
 * endpoint table.
 */
export function ModerationControls({
  node,
  onTextUpdated,
  onSichtbarkeitChanged,
  onDeleted,
}: {
  node: ForumNode;
  onTextUpdated: (node: ForumNode) => void;
  /** Omit for nodes where sichtbarkeit doesn't apply (only typ: "thema" carries it). */
  onSichtbarkeitChanged?: (node: ForumNode) => void;
  onDeleted: () => void;
}) {
  const { user, api } = useForumAuth();
  const [showEdit, setShowEdit] = useState(false);
  const [isTogglingSichtbarkeit, setIsTogglingSichtbarkeit] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteGrund, setDeleteGrund] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canModerate(user)) return null;

  const canToggleSichtbarkeit = node.typ === 'thema' && isAdmin(user) && !!onSichtbarkeitChanged;

  async function toggleSichtbarkeit() {
    if (!canToggleSichtbarkeit) return;
    const next = node.sichtbarkeit === 'privat' ? 'oeffentlich' : 'privat';
    setIsTogglingSichtbarkeit(true);
    setError(null);
    try {
      const updated = await api.setSichtbarkeit(node.id, next);
      onSichtbarkeitChanged?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sichtbarkeit konnte nicht geaendert werden');
    } finally {
      setIsTogglingSichtbarkeit(false);
    }
  }

  async function confirmDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      await api.deleteNode(node.id, deleteGrund.trim() || undefined);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loeschen fehlgeschlagen');
      setIsDeleting(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-amber-300 pt-2 text-xs dark:border-amber-700">
      <span className="font-medium uppercase text-amber-600 dark:text-amber-400">Moderation</span>

      <button type="button" onClick={() => setShowEdit(true)} className="text-blue-600 hover:underline">
        Text bearbeiten
      </button>

      {canToggleSichtbarkeit && (
        <button
          type="button"
          onClick={toggleSichtbarkeit}
          disabled={isTogglingSichtbarkeit}
          className="text-blue-600 hover:underline disabled:opacity-60"
        >
          {node.sichtbarkeit === 'privat' ? 'Oeffentlich schalten' : 'Privat schalten'}
        </button>
      )}

      {!isConfirmingDelete ? (
        <button type="button" onClick={() => setIsConfirmingDelete(true)} className="text-red-600 hover:underline">
          Loeschen
        </button>
      ) : (
        <span className="flex flex-wrap items-center gap-1">
          <input
            type="text"
            value={deleteGrund}
            onChange={(e) => setDeleteGrund(e.target.value)}
            placeholder="Grund (optional)"
            aria-label="Loeschgrund"
            className="rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800"
          />
          <button
            type="button"
            onClick={confirmDelete}
            disabled={isDeleting}
            className="text-red-600 hover:underline disabled:opacity-60"
          >
            {isDeleting ? 'Loescht…' : 'Wirklich loeschen'}
          </button>
          <button type="button" onClick={() => setIsConfirmingDelete(false)} className="text-gray-500 hover:underline">
            Abbrechen
          </button>
        </span>
      )}

      {error && <p className="w-full text-red-600">{error}</p>}

      {showEdit && (
        <EditTextModal
          node={node}
          onSaved={(updated) => {
            setShowEdit(false);
            onTextUpdated(updated);
          }}
          onCancel={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
