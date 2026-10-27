import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import BoardListPage from './BoardListPage';
import PostDetailPage from './PostDetailPage';
import PostEditorPage from './PostEditorPage';
import ProfilePage from './ProfilePage';
import PlaceholderPage from './PlaceholderPage';
import DashboardPage from './DashboardPage';
import PanelEditorPage from './PanelEditorPage';

// react-router 없이 상태 기반으로 화면을 전환한다.
type View =
  | { kind: 'board' }
  | { kind: 'detail'; id: number }
  | { kind: 'editor'; postId?: number }
  | { kind: 'dashboard' }
  | { kind: 'panelEditor'; panelId?: number }
  | { kind: 'users' }
  | { kind: 'profile' };

// 사이드바에서 강조할 상위 탭
type Tab = 'board' | 'dashboard' | 'users' | 'profile';

export default function AuthedApp() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>({ kind: 'board' });
  const [loggingOut, setLoggingOut] = useState(false);

  // 글 상세/에디터는 모두 '게시판' 탭에 속한 것으로 본다.
  const activeTab: Tab =
    view.kind === 'dashboard' || view.kind === 'panelEditor'
      ? 'dashboard'
      : view.kind === 'users'
        ? 'users'
        : view.kind === 'profile'
          ? 'profile'
          : 'board';

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
            currentUsername={user?.username ?? null}
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
      case 'dashboard':
        return (
          <DashboardPage
            onAddPanel={() => setView({ kind: 'panelEditor' })}
            onEditPanel={(id) => setView({ kind: 'panelEditor', panelId: id })}
          />
        );
      case 'panelEditor':
        return <PanelEditorPage panelId={view.panelId} onDone={() => setView({ kind: 'dashboard' })} />;
      case 'users':
        return (
          <PlaceholderPage
            icon="👥"
            title="유저관리"
            subtitle="User Management · 인력·권한 관리"
            message="유저관리 기능은 준비 중입니다. 사용자 목록과 권한·변경 이력이 이 영역에 표시될 예정입니다."
          />
        );
      case 'profile':
        return user ? <ProfilePage user={user} /> : null;
    }
  }

  const initial = (user?.username ?? '?').charAt(0).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo" aria-hidden="true">◆</div>
          <div className="sidebar-title">
            <span className="name">COC Dashboard</span>
            <span className="sub">OPERATIONS CONSOLE</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="주요 메뉴">
          <button
            type="button"
            className={activeTab === 'board' ? 'nav-item active' : 'nav-item'}
            aria-current={activeTab === 'board' ? 'page' : undefined}
            onClick={() => setView({ kind: 'board' })}
          >
            <span className="nav-ico" aria-hidden="true">📋</span>
            <span>게시판</span>
          </button>
          <button
            type="button"
            className={activeTab === 'dashboard' ? 'nav-item active' : 'nav-item'}
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
            onClick={() => setView({ kind: 'dashboard' })}
          >
            <span className="nav-ico" aria-hidden="true">📊</span>
            <span>대시보드</span>
          </button>
          <button
            type="button"
            className={activeTab === 'users' ? 'nav-item active' : 'nav-item'}
            aria-current={activeTab === 'users' ? 'page' : undefined}
            onClick={() => setView({ kind: 'users' })}
          >
            <span className="nav-ico" aria-hidden="true">👥</span>
            <span>유저관리</span>
          </button>
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <span className="avatar" aria-hidden="true">{initial}</span>
            <span className="uname" title={user?.username}>{user?.username}</span>
          </div>
          <button
            type="button"
            className={activeTab === 'profile' ? 'foot-btn active' : 'foot-btn'}
            aria-current={activeTab === 'profile' ? 'page' : undefined}
            aria-label="내 프로필"
            onClick={() => setView({ kind: 'profile' })}
          >
            <span className="nav-ico" aria-hidden="true">⚙️</span>
            <span>내 프로필</span>
          </button>
          <button type="button" className="foot-btn" onClick={onLogout} disabled={loggingOut} aria-label="로그아웃">
            <span className="nav-ico" aria-hidden="true">🚪</span>
            <span>{loggingOut ? '로그아웃 중…' : '로그아웃'}</span>
          </button>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-main-inner">{renderView()}</div>
      </main>
    </div>
  );
}
