import type { ForumComment } from '../api/types';

export function CommentListItem({
  comment,
  onReply,
}: {
  comment: ForumComment;
  onReply: (comment: ForumComment) => void;
}) {
  return (
    <li className={comment.parent_comment_id ? 'ml-6 border-l-2 border-gray-200 pl-3 dark:border-gray-700' : ''}>
      <p className="text-sm text-gray-800 dark:text-gray-100">
        {comment.soft_deleted ? <em className="text-gray-400">[geloescht]</em> : comment.text}
      </p>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
        <time dateTime={comment.erstellt_am}>{new Date(comment.erstellt_am).toLocaleString('de-DE')}</time>
        {!comment.soft_deleted && (
          <button type="button" onClick={() => onReply(comment)} className="hover:text-blue-600">
            Antworten
          </button>
        )}
      </div>
    </li>
  );
}
