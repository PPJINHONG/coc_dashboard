import { useCallback, useEffect, useState } from 'react';
import { listPosts, type PostListItem } from '../api/board';
import { ApiError, MSG_SERVER } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatRelative } from '../util/format';
import ErrorMessage from '../components/ErrorMessage';

interface Props {
  onOpenPost: (id: number) => void;
  onNewPost: () => void;
  // 내 글 수 집계용(목록 author === 현재 사용자). 없으면 0으로 처리.
  currentUsername: string | null;
}

export default function BoardListPage({ onOpenPost, onNewPost, currentUsername }: Props) {
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

  const total = posts?.length ?? 0;
  const mine = posts && currentUsername
    ? posts.filter((p) => p.author === currentUsername).length
    : 0;
  const totalComments = posts
    ? posts.reduce((sum, p) => sum + (p.comment_count ?? 0), 0)
    : 0;
  const totalImages = posts
    ? posts.reduce((sum, p) => sum + (p.image_count ?? 0), 0)
    : 0;

  return (
    <section className="board">
      <header className="section-head">
        <div className="section-title">
          <div className="section-ico" aria-hidden="true">📋</div>
          <div>
            <h1>게시판</h1>
            <p className="section-sub">Collaboration Board · 운영 이슈 공유 및 조치 기록</p>
          </div>
        </div>
        <div className="section-actions">
          <span className="badge badge-count">
            총 <strong>{total}</strong>건
          </span>
          <button type="button" className="btn btn-primary" onClick={onNewPost}>
            + 새 글 작성
          </button>
        </div>
      </header>

      <ErrorMessage message={error} />

      <div className="board-layout">
        <div className="board-main">
          {posts === null && !error && (
            <p role="status" className="loading-inline">
              불러오는 중…
            </p>
          )}

          {posts !== null && posts.length === 0 && (
            <p className="empty">아직 게시글이 없습니다. 첫 글을 작성해 보세요.</p>
          )}

          {posts !== null && posts.length > 0 && (
            <ul className="post-cards" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {posts.map((post) => {
                const isMine = currentUsername != null && post.author === currentUsername;
                return (
                  <li key={post.id}>
                    <button
                      type="button"
                      className="post-card"
                      onClick={() => onOpenPost(post.id)}
                      aria-label={`${post.title} — 작성자 ${post.author}`}
                    >
                      <div className="post-card-top">
                        <span className={isMine ? 'badge badge-mine' : 'badge badge-author'}>
                          {isMine ? '내 글' : post.author}
                        </span>
                        <span className="post-card-title">{post.title}</span>
                        <span className="post-card-time">{formatRelative(post.created_at)}</span>
                      </div>
                      {/* 목록 API에 content가 없으므로 2줄 미리보기는 생략한다. */}
                      <div className="post-card-foot">
                        <span className="post-card-author">
                          작성자: <b>{post.author}</b>
                        </span>
                        <span className="post-card-foot-right">
                          {post.image_count > 0 && (
                            <span className="badge badge-img">이미지 {post.image_count}</span>
                          )}
                          <span className="badge">댓글 {post.comment_count}</span>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="board-aside">
          <div className="aside-panel panel">
            <div className="aside-panel-head">
              <h2>
                <span aria-hidden="true">📈</span> 게시판 현황
              </h2>
              <span className="tag-realtime">Realtime</span>
            </div>
            <div className="stat-grid">
              <div className="stat-card c-plain">
                <p className="stat-label">전체 글</p>
                <p className="stat-value">{total}</p>
              </div>
              <div className="stat-card c-lavender">
                <p className="stat-label">내 글</p>
                <p className="stat-value">{mine}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">전체 댓글</p>
                <p className="stat-value">{totalComments}</p>
              </div>
              <div className="stat-card c-success">
                <p className="stat-label">이미지</p>
                <p className="stat-value">{totalImages}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <footer className="app-footer">
        <span>© 2025 COC Dashboard · Collaboration Board</span>
        <span>System Normal</span>
      </footer>
    </section>
  );
}
