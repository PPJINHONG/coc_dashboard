import { useCallback, useEffect, useState } from 'react';
import { listPosts, type PostListItem } from '../api/board';
import { ApiError, MSG_SERVER } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../util/format';
import ErrorMessage from '../components/ErrorMessage';

interface Props {
  onOpenPost: (id: number) => void;
  onNewPost: () => void;
}

export default function BoardListPage({ onOpenPost, onNewPost }: Props) {
  const { handleAuthError } = useAuth();
  const [posts, setPosts] = useState<PostListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listPosts();
      setPosts(data);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : MSG_SERVER);
    }
  }, [handleAuthError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="board">
      <div className="board-head">
        <h1>게시판</h1>
        <button type="button" onClick={onNewPost}>
          글쓰기
        </button>
      </div>

      <ErrorMessage message={error} />

      {posts === null && !error && (
        <p role="status" className="loading-inline">
          불러오는 중…
        </p>
      )}

      {posts !== null && posts.length === 0 && (
        <p className="empty">아직 게시글이 없습니다. 첫 글을 작성해 보세요.</p>
      )}

      {posts !== null && posts.length > 0 && (
        <ul className="post-list">
          {posts.map((post) => (
            <li key={post.id} className="post-row">
              <button type="button" className="post-link" onClick={() => onOpenPost(post.id)}>
                <span className="post-title">{post.title}</span>
                <span className="post-meta">
                  <span>{post.author}</span>
                  <span>{formatDate(post.created_at)}</span>
                  <span>댓글 {post.comment_count}</span>
                  <span>이미지 {post.image_count}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
