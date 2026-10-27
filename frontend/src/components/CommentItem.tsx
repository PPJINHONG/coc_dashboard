import { useState } from 'react';
import {
  deleteComment,
  updateComment,
  type Comment,
} from '../api/board';
import { ApiError, MSG_SERVER } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../util/format';
import ErrorMessage from './ErrorMessage';

const MSG_EMPTY = '댓글 내용을 입력해 주세요.';
const MSG_DELETE_CONFIRM = '이 댓글을 삭제할까요?';

interface Props {
  comment: Comment;
  onUpdated: (next: Comment) => void;
  onDeleted: (id: number) => void;
}

// 댓글 한 건: 본인 댓글이면 수정/삭제 가능. (예시 Audit Log 스타일)
export default function CommentItem({ comment, onUpdated, onDeleted }: Props) {
  const { handleAuthError } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    if (busy) return;
    if (!draft.trim()) {
      setError(MSG_EMPTY);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await updateComment(comment.id, draft.trim());
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : MSG_SERVER);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (busy) return;
    if (!window.confirm(MSG_DELETE_CONFIRM)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteComment(comment.id);
      onDeleted(comment.id);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : MSG_SERVER);
      setBusy(false);
    }
  }

  return (
    <li className="comment">
      <div className="comment-meta">
        <span className="comment-date">{formatDate(comment.created_at)}</span>
        <span className="comment-author">{comment.author}</span>
      </div>

      {editing ? (
        <div className="field">
          <label htmlFor={`comment-edit-${comment.id}`} className="sr-only">
            댓글 수정
          </label>
          <textarea
            id={`comment-edit-${comment.id}`}
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
          />
        </div>
      ) : (
        <p className="comment-body">{comment.content}</p>
      )}

      <ErrorMessage message={error} />

      {comment.is_mine && (
        <div className="comment-actions">
          {editing ? (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={busy}>
                {busy ? '저장 중…' : '저장'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEditing(false);
                  setDraft(comment.content);
                  setError(null);
                }}
                disabled={busy}
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                수정
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={onDelete} disabled={busy}>
                삭제
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
