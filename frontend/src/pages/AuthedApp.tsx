import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import BoardListPage from './BoardListPage';
import PostDetailPage from './PostDetailPage';
import PostEditorPage from './PostEditorPage';
import ProfilePage from './ProfilePage';

// react-router 없이 상태 기반으로 화면을 전환한다.
type View =
  | { kind: 'board' }
  | { kind: 'detail'; id: number }
  | { kind: 'editor'; postId?: number }
  | { kind: 'profile' };

type Tab = 'board' | 'profile';

export default function AuthedApp() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>({ kind: 'board' });
  const [loggingOut, setLoggingOut] = useState(false);

  // 내비 탭 활성 표시는 큰 분류(게시판/프로필) 기준
  const activeTab: Tab = view.kind === 'profile' ? 'profile' : 'board';

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
  }

  function renderView() {
    switch (view.kind) {
      case 'board':
        return (
          <BoardListPage
            onOpenPost={(id) => setView({ kind: 'detail', id })}
            onNewPost={() => setView({ kind: 'editor' })}
          />
        );
      case 'detail':
        return (
          <PostDetailPage
            postId={view.id}
            onBack={() => setView({ kind: 'board' })}
            onEdit={(id) => setView({ kind: 'editor', postId: id })}
            onDeleted={() => setView({ kind: 'board' })}
          />
        );
      case 'editor':
        return (
          <PostEditorPage
            postId={view.postId}
            onSaved={(post) => setView({ kind: 'detail', id: post.id })}
            onCancel={() =>
              view.postId !== undefined
                ? setView({ kind: 'detail', id: view.postId })
                : setView({ kind: 'board' })
            }
          />
        );
      case 'profile':
        return user ? <ProfilePage user={user} /> : null;
    }
  }

  return (
    <div className="app-shell">
      <nav className="top-nav" aria-label="주요 메뉴">
        <div className="nav-links">
          <button
            type="button"
            className={activeTab === 'board' ? 'nav-item active' : 'nav-item'}
            aria-current={activeTab === 'board' ? 'page' : undefined}
            onClick={() => setView({ kind: 'board' })}
          >
            게시판
          </button>
          <button
            type="button"
            className={activeTab === 'profile' ? 'nav-item active' : 'nav-item'}
            aria-current={activeTab === 'profile' ? 'page' : undefined}
            onClick={() => setView({ kind: 'profile' })}
          >
            내 프로필
          </button>
        </div>
        <button type="button" className="nav-logout" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? '로그아웃 중…' : '로그아웃'}
        </button>
      </nav>

      <main className="app-main">{renderView()}</main>
    </div>
  );
}
