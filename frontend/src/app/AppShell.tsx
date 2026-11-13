import { useCallback, useEffect, useRef, useState } from "react";
// 공통 스타일을 기능 스타일보다 먼저 읽습니다.
import "./shell.css";
import "./home.css";
import "../shared/styles/sections.css";
import "./preferences.css";
import * as api from "../shared/api/operations";
import type { Bootstrap, NavigationPreference, Snapshot } from "../shared/api/operations";
import AdminLogin from "../shared/auth/AdminLogin";
import { useAuth } from "../shared/auth/AuthContext";
import ErrorMessage from "../shared/components/ErrorMessage";
import Icon, { type IconName } from "../shared/components/Icon";
import Modal from "../shared/components/Modal";
import { errorMessage } from "../shared/errors";
import { FEATURES } from "../features/registry";
import HomePage from "./HomePage";
import InviteDialog from "./InviteDialog";
import TabPreferences from "./TabPreferences";

/** 사이드바 첫 칸인 홈. 기능 목록은 features/registry.ts가 자동으로 모읍니다. */
const HOME = { id: "home", label: "홈", icon: "home" as IconName, adminOnly: false };
const TABS = [HOME, ...FEATURES];

const canAccessTab = (id: string, isAdmin: boolean) =>
  isAdmin || !TABS.find((tab) => tab.id === id)?.adminOnly;

function initialTab(): string {
  const value = new URLSearchParams(window.location.hash.slice(1)).get("tab");
  return value && TABS.some((tab) => tab.id === value) ? value : "home";
}
/** 기준 월 선택지: 이번 달부터 24개월 전까지(최근 월이 위). 고른 월이 범위 밖이면 함께 넣습니다. */
const MONTH_RANGE = 24;
function monthOptions(selected: string): string[] {
  const today = new Date();
  const months = Array.from({ length: MONTH_RANGE + 1 }, (_, index) => {
    const value = new Date(today.getFullYear(), today.getMonth() - index, 1);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  });
  if (selected && !months.includes(selected)) months.push(selected);
  return months.sort().reverse();
}
const monthLabel = (value: string) => {
  const [year, month] = value.split("-");
  return `${year}년 ${Number(month)}월`;
};

const DEFAULT_PREFERENCE: NavigationPreference = {
  hidden_tabs: [],
  sidebar_collapsed: false,
};

/** 로그인 후 공통 뼈대: 사이드바·상단바·탭 이동·저장 전 이동 확인. 기능 화면은 각 feature.tsx의 Page가 그립니다. */
export default function AppShell() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<string>(initialTab);
  const [data, setData] = useState<Bootstrap | null>(null),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [preference, setPreference] = useState(DEFAULT_PREFERENCE);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [preferenceBusy, setPreferenceBusy] = useState(false);
  const [dirty, setDirty] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [adminLogin, setAdminLogin] = useState(false),
    [manageTabs, setManageTabs] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState<(() => void) | null>(null);
  // 상단바에서 고른 기준 월. 처음에는 비워 두고 서버가 정한 이번 달(snapshot.month)을 씁니다.
  const monthRef = useRef<string | undefined>(undefined);
  const refresh = useCallback(async () => {
    const [bootstrap, current] = await Promise.all([
      api.bootstrap(),
      api.snapshot(monthRef.current),
    ]);
    setData(bootstrap);
    setSnapshot(current);
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.bootstrap(), api.snapshot(monthRef.current), api.navigationPreference()])
      .then(([bootstrap, current, preferences]) => {
        if (!cancelled) {
          setData(bootstrap);
          setSnapshot(current);
          setPreference(preferences);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  useEffect(() => {
    if (
      !canAccessTab(tab, Boolean(user?.is_staff)) ||
      preference.hidden_tabs.includes(tab)
    ) {
      setTab("home");
      window.history.replaceState(null, "", "#tab=home");
    }
  }, [tab, user, preference.hidden_tabs]);
  useEffect(() => {
    const back = () => {
      if (!dirty && !busy) setTab(initialTab());
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [dirty, busy]);
  function guarded(action: () => void) {
    if (busy || preferenceBusy) return;
    if (dirty) setConfirm(() => action);
    else action();
  }
  function navigate(next: string) {
    guarded(() => {
      setDirty(false);
      setTab(next);
      window.history.pushState(null, "", `#tab=${next}`);
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  /** 기준 월을 바꾸면 모든 탭이 그 월 데이터를 다시 불러옵니다. 편집 중이면 먼저 확인합니다. */
  function changeMonth(next: string) {
    if (!next || next === snapshot?.month) return;
    guarded(() => {
      setDirty(false);
      const previous = monthRef.current;
      monthRef.current = next;
      setLoading(true);
      api
        .snapshot(next)
        .then((current) => {
          setSnapshot(current);
          setError(null);
        })
        .catch((err) => {
          monthRef.current = previous;
          setError(errorMessage(err));
        })
        .finally(() => setLoading(false));
    });
  }
  async function collapseSidebar() {
    if (preferenceBusy) return;
    setPreferenceBusy(true);
    const old = preference;
    const value = {
      ...preference,
      sidebar_collapsed: !preference.sidebar_collapsed,
    };
    setPreference(value);
    try {
      setPreference(await api.saveNavigationPreference(value));
    } catch (err) {
      setPreference(old);
      setError(errorMessage(err));
    } finally {
      setPreferenceBusy(false);
    }
  }
  if (!data || !snapshot)
    return (
      <main className="report-start">
        <span className="app-brand-mark">
          <Icon name="cloud" size={23} />
        </span>
        <h1>COC dashboard</h1>
        {error ? (
          <>
            <ErrorMessage message={error} />
            <button className="btn" onClick={() => window.location.reload()}>
              다시 시도
            </button>
          </>
        ) : (
          <p role="status">워크스페이스를 불러오고 있습니다…</p>
        )}
      </main>
    );
  const current = TABS.find((item) => item.id === tab)!;
  const feature = FEATURES.find((item) => item.id === tab);
  const visibleTabs = TABS.filter(
    (item) =>
      !preference.hidden_tabs.includes(item.id) &&
      canAccessTab(item.id, Boolean(user?.is_staff)),
  );
  const collapsed = preference.sidebar_collapsed;
  const navButton = (item: (typeof TABS)[number]) => (
    <button
      key={item.id}
      className={`nav-item${tab === item.id ? " active" : ""}`}
      aria-label={item.label}
      aria-current={tab === item.id ? "page" : undefined}
      disabled={busy}
      onClick={() => navigate(item.id)}
      title={collapsed ? item.label : undefined}
    >
      <Icon name={item.icon} size={18} />
      <span>{item.label}</span>
      {item.adminOnly && <Icon name="shield" size={12} />}
    </button>
  );
  return (
    <div
      className={`app-shell report-shell${collapsed ? " sidebar-collapsed" : ""}`}
    >
      <aside className="sidebar" aria-label="워크스페이스 탐색">
        <button
          className="sidebar-brand"
          onClick={() => navigate("home")}
          title="홈"
        >
          <span className="app-brand-mark">
            <Icon name="cloud" size={24} />
          </span>
          <span className="sidebar-title">
            <strong>COC dashboard</strong>
            <small>Operations console</small>
          </span>
        </button>
        <nav className="sidebar-nav" aria-label="기능 탭">
          {visibleTabs.filter((item) => !item.adminOnly).map(navButton)}
        </nav>
        {user?.is_staff && (
          <nav className="sidebar-admin-nav" aria-label="관리자 메뉴">
            <span className="sidebar-group-label">관리자</span>
            {visibleTabs.filter((item) => item.adminOnly).map(navButton)}
          </nav>
        )}
        <div className="sidebar-utilities">
          {user && user.role !== "observer" && (
            <button
              className="nav-item"
              disabled={busy}
              onClick={() => setInviteOpen(true)}
              title={collapsed ? "팀원 초대" : undefined}
            >
              <Icon name="users" size={18} />
              <span>팀원 초대</span>
            </button>
          )}
          <button
            className="nav-item"
            disabled={busy || dirty}
            onClick={() => setManageTabs(true)}
            title={collapsed ? "탭 관리" : undefined}
          >
            <Icon name="eye" size={18} />
            <span>탭 관리</span>
            {preference.hidden_tabs.length > 0 && (
              <small>{preference.hidden_tabs.length}</small>
            )}
          </button>
        </div>
        <div className="sidebar-foot">
          <div className="sidebar-user">
            <button
              className="user-avatar"
              aria-label={user ? "로그아웃" : "관리자 로그인"}
              title={user ? "로그아웃" : "관리자 로그인"}
              disabled={busy}
              onClick={() =>
                user
                  ? guarded(() => {
                      setDirty(false);
                      void logout();
                    })
                  : setAdminLogin(true)
              }
            >
              {(user?.name || "V").slice(0, 1).toUpperCase()}
            </button>
            <div>
              <strong>{user?.name || "Visitor"}</strong>
              <small>
                {user?.is_staff ? "관리자" : user?.role === "observer" ? "옵저버(읽기 전용)" : "사용자"}
              </small>
            </div>
            <button
              className="icon-button borderless"
              aria-label={user ? "로그아웃" : "관리자 로그인"}
              title={user ? "로그아웃" : "관리자 로그인"}
              disabled={busy}
              onClick={() =>
                user
                  ? guarded(() => {
                      setDirty(false);
                      void logout();
                    })
                  : setAdminLogin(true)
              }
            >
              <Icon name={user ? "logout" : "shield"} size={16} />
            </button>
          </div>
          <span className="sidebar-environment">
            <i />
            개발 워크스페이스
          </span>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              className="icon-button borderless"
              title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
              aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
              aria-expanded={!collapsed}
              disabled={preferenceBusy}
              onClick={() => {
                void collapseSidebar();
              }}
            >
              <Icon name="panel" size={18} />
            </button>
            <span className="topbar-divider" />
            <nav className="breadcrumbs" aria-label="현재 위치">
              <button onClick={() => navigate("home")}>워크스페이스</button>
              <Icon name="chevron" size={12} />
              <strong>{current.label}</strong>
            </nav>
          </div>
          <div className="topbar-actions">
            <MonthPicker
              value={snapshot.month}
              disabled={loading || busy}
              onChange={changeMonth}
            />
            <button
              className={`icon-button borderless${loading ? " is-loading" : ""}`}
              disabled={loading || busy}
              title="최신 데이터 불러오기"
              aria-label="최신 데이터 불러오기"
              onClick={() =>
                guarded(() => {
                  setDirty(false);
                  setLoading(true);
                  refresh()
                    .then(() => setError(null))
                    .catch((err) => setError(errorMessage(err)))
                    .finally(() => setLoading(false));
                })
              }
            >
              <Icon name="refresh" size={16} />
            </button>
            <button
              className="btn btn-sm"
              disabled={busy || dirty}
              onClick={() => setManageTabs(true)}
            >
              <Icon name="eye" size={14} />탭 관리
            </button>
            {tab !== "database" && (
              <button
                className="btn btn-sm btn-primary"
                disabled={busy}
                onClick={() =>
                  user?.is_staff ? navigate("database") : setAdminLogin(true)
                }
              >
                <Icon name={user?.is_staff ? "database" : "shield"} size={14} />
                {user?.is_staff ? "데이터 관리" : "관리자 로그인"}
              </button>
            )}
          </div>
        </header>
        <main
          className={`content report-main${tab === "home" ? " home-main" : ""}`}
        >
          {error && (
            <div className="page-error">
              <ErrorMessage message={error} />
            </div>
          )}
          {tab === "home" && (
            <HomePage
              data={data}
              snapshot={snapshot}
              features={FEATURES}
              hiddenTabs={preference.hidden_tabs}
              isAdmin={Boolean(user?.is_staff)}
              navigate={navigate}
              manageTabs={() => setManageTabs(true)}
            />
          )}
          {feature && (
            <feature.Page
              data={data}
              snapshot={snapshot}
              user={user}
              features={FEATURES}
              navigate={navigate}
              refresh={refresh}
              setDirty={setDirty}
              setBusy={setBusy}
            />
          )}
        </main>
      </div>
      {inviteOpen && <InviteDialog onClose={() => setInviteOpen(false)} />}
      {manageTabs && (
        <TabPreferences
          preference={preference}
          features={FEATURES}
          isAdmin={Boolean(user?.is_staff)}
          onClose={() => setManageTabs(false)}
          onSaved={setPreference}
        />
      )}
      {adminLogin && (
        <Modal title="관리자 로그인" onClose={() => setAdminLogin(false)}>
          <AdminLogin
            onSuccess={() => {
              setAdminLogin(false);
              navigate("database");
            }}
          />
        </Modal>
      )}
      {confirm && (
        <Modal title="저장하지 않은 변경 사항" onClose={() => setConfirm(null)}>
          <p>현재 편집 내용을 취소하고 이동하시겠습니까?</p>
          <div className="actions">
            <button className="btn" onClick={() => setConfirm(null)}>
              계속 편집
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                const action = confirm;
                setConfirm(null);
                action();
              }}
            >
              변경 취소 후 이동
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** 상단바 기준 월 선택. 이전·다음 달 버튼과 목록으로 고릅니다. 다음 달은 이번 달까지만 이동합니다. */
function MonthPicker({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (month: string) => void;
}) {
  const options = monthOptions(value);
  const index = options.indexOf(value);
  const older = options[index + 1];
  const newer = index > 0 ? options[index - 1] : undefined;
  return (
    <div className="month-picker" role="group" aria-label="기준 월">
      <button
        type="button"
        className="icon-button borderless"
        aria-label="이전 달"
        title="이전 달"
        disabled={disabled || !older}
        onClick={() => older && onChange(older)}
      >
        ‹
      </button>
      <select
        aria-label="기준 월 선택"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((month) => (
          <option key={month} value={month}>
            {monthLabel(month)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="icon-button borderless"
        aria-label="다음 달"
        title="다음 달"
        disabled={disabled || !newer}
        onClick={() => newer && onChange(newer)}
      >
        ›
      </button>
    </div>
  );
}
