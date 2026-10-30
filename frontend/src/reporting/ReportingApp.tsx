import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import ErrorMessage from "../components/ErrorMessage";
import Icon from "../components/Icon";
import DatabaseAdmin, { AdminLogin } from "../database/DatabaseAdmin";
import * as api from "./api";
import type {
  Bootstrap,
  NavigationPreference,
  Section,
  Snapshot,
  Tab,
} from "./api";
import { canAccessTab, localDate, TABS } from "./config";
import { errorMessage, LogList, Modal } from "./components";
import HomePage, { FEATURES } from "./HomePage";
import InfrastructureView from "./InfrastructureView";
import TabPreferences from "./TabPreferences";
import SectionView from "./SectionView";
import Report from "./Report";
import "./reporting.css";

function initialTab(): Tab {
  const value = new URLSearchParams(window.location.hash.slice(1)).get("tab");
  return TABS.some((tab) => tab.id === value) ? (value as Tab) : "home";
}
const DEFAULT_PREFERENCE: NavigationPreference = {
  hidden_tabs: [],
  sidebar_collapsed: false,
};

export default function ReportingApp() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
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
  const [confirm, setConfirm] = useState<(() => void) | null>(null);
  const refresh = useCallback(async () => {
    const [bootstrap, current] = await Promise.all([
      api.bootstrap(),
      api.snapshot(),
    ]);
    setData(bootstrap);
    setSnapshot(current);
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.bootstrap(), api.snapshot(), api.navigationPreference()])
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
  function navigate(next: Tab) {
    guarded(() => {
      setDirty(false);
      setTab(next);
      window.history.pushState(null, "", `#tab=${next}`);
      window.scrollTo({ top: 0, behavior: "instant" });
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
  const selectedFeature = FEATURES.find((item) => item.id === tab);
  const section = ["staff", "work", "issues"].includes(tab)
    ? (tab as Section)
    : null;
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
              <small>{user?.is_staff ? "관리자" : "사용자"}</small>
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
              hiddenTabs={preference.hidden_tabs}
              isAdmin={Boolean(user?.is_staff)}
              navigate={navigate}
              manageTabs={() => setManageTabs(true)}
            />
          )}
          {tab === "resources" && (
            <InfrastructureView rows={snapshot.resources} data={data} />
          )}
          {tab === "report" && (
            <>
              <header className="page-heading">
                <div>
                  <span className="eyebrow">OVERVIEW</span>
                  <h1>리포트</h1>
                  <p>모든 운영 데이터의 최신 저장값을 확인하세요.</p>
                </div>
                <span className="updated-label">
                  {localDate(snapshot.updated_at)}
                </span>
              </header>
              <Report snapshot={snapshot} data={{ ...data, can_manage: Boolean(user?.is_staff) && data.can_manage }} navigate={navigate} />
            </>
          )}
          {section && (
            <>
              <span className="eyebrow">{selectedFeature?.english}</span>
              <SectionView
                key={section}
                section={section}
                rows={snapshot[section]}
                data={data}
              />
            </>
          )}
          {tab === "logs" && user?.is_staff && (
            <>
              <header className="page-heading">
                <div>
                  <span className="eyebrow">ACTIVITY</span>
                  <h1>변경 이력</h1>
                  <p>운영 데이터의 최근 변경 내역입니다.</p>
                </div>
                <span className="subtle-badge">
                  {snapshot.logs.length} records
                </span>
              </header>
              <section className="panel">
                <LogList rows={snapshot.logs} details data={data} />
              </section>
            </>
          )}
          {tab === "database" && (
            <DatabaseAdmin
              data={data}
              snapshot={snapshot}
              onChanged={refresh}
              onEditing={setDirty}
              onBusy={setBusy}
            />
          )}
        </main>
      </div>
      {manageTabs && (
        <TabPreferences
          preference={preference}
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
