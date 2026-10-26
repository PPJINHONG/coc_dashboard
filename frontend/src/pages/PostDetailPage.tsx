import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  addComment,
  deletePost,
  getPost,
  type Comment,
  type PostDetail,
} from '../api/board';
import { ApiError, MSG_SERVER } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../util/format';
import ErrorMessage from '../components/ErrorMessage';
import CommentItem from '../components/CommentItem';

const MSG_EMPTY_COMMENT = '댓글 내용을 입력해 주세요.';
const MSG_DELETE_CONFIRM = '이 게시글을 삭제할까요?';

interface Props {
  postId: number;
  onBack: () => void;
  onEdit: (id: number) => void;
  onDeleted: () => void;
}

export default function PostDetailPage({ postId, onBack, onEdit, onDeleted }: Props) {
  const { handleAuthError } = useAuth();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [commentDraft, setCommentDraft] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [addingComment, setAddingComment] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getPost(postId);
      setPost(data);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : MSG_SERVER);
    }
  }, [postId, handleAuthError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDeletePost() {
    if (deleting) return;
    if (!window.confirm(MSG_DELETE_CONFIRM)) return;
    setDeleting(true);
    setError(null);
    try {
      await deletePost(postId);
      onDeleted();
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : MSG_SERVER);
      setDeleting(false);
    }
  }

  async function onAddComment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (addingComment) return;
    setCommentError(null);
    if (!commentDraft.trim()) {
      setCommentError(MSG_EMPTY_COMMENT);
      return;
    }
    setAddingComment(true);
    try {
      const created = await addComment(postId, commentDraft.trim());
      setPost((prev) => (prev ? { ...prev, comments: [...prev.comments, created] } : prev));
      setCommentDraft('');
    } catch (err) {
      if (handleAuthError(err)) return;
      setCommentError(err instanceof ApiError ? err.message : MSG_SERVER);
    } finally {
      setAddingComment(false);
    }
  }

  function onCommentUpdated(next: Comment) {
    setPost((prev) =>
      prev
        ? { ...prev, comments: prev.comments.map((c) => (c.id === next.id ? next : c)) }
        : prev,
    );
  }

  function onCommentDeleted(id: number) {
    setPost((prev) =>
      prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== id) } : prev,
    );
  }

  if (!post) {
    return (
      <section className="board">
        <div className="back-link">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
            ← 목록으로
          </button>
        </div>
        <ErrorMessage message={error} />
        {!error && (
          <p role="status" className="loading-inline">
            불러오는 중…
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="board">
      <div className="back-link">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
          ← 목록으로
        </button>
      </div>

      <ErrorMessage message={error} />

      <article className="post-detail">
        <div className="post-detail-head">
          <span className="badge badge-author">{post.author}</span>
          <h1>{post.title}</h1>
        </div>
        <div className="post-detail-meta">
          <span>작성자 {post.author}</span>
          <span>{formatDate(post.created_at)}</span>
        </div>

        {post.is_mine && (
          <div className="actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(post.id)}>
              수정
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={onDeletePost} disabled={deleting}>
              {deleting ? '삭제 중…' : '삭제'}
            </button>
          </div>
        )}

        <p className="post-content">{post.content}</p>

        {post.images.length > 0 && (
          <ul className="post-images">
            {post.images.map((img) => (
              <li key={img.id}>
                <img src={img.url} alt="게시글 첨부 이미지" />
              </li>
            ))}
          </ul>
        )}
      </article>

      <section className="comments">
        <h2>
          <span aria-hidden="true">💬</span> 댓글 {post.comments.length}
        </h2>
        {post.comments.length === 0 ? (
          <p className="empty">아직 댓글이 없습니다.</p>
        ) : (
          <ul className="comment-list">
            {post.comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                onUpdated={onCommentUpdated}
                onDeleted={onCommentDeleted}
              />
            ))}
          </ul>
        )}

        <form onSubmit={onAddComment} noValidate className="comment-form">
          <label htmlFor="comment-content">댓글 작성</label>
          <textarea
            id="comment-content"
            name="comment-content"
            rows={3}
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            aria-invalid={commentError ? true : undefined}
            aria-describedby={commentError ? 'comment-content-error' : undefined}
            disabled={addingComment}
          />
          <ErrorMessage id="comment-content-error" message={commentError} />
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={addingComment}>
              {addingComment ? '등록 중…' : '댓글 등록'}
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}
