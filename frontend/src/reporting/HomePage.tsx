import Icon, { type IconName } from "../components/Icon";
import type { Bootstrap, Snapshot, Tab } from "./api";
import { canAccessTab, TABS } from "./config";

export const FEATURES: {
  id: Tab;
  label: string;
  english: string;
  description: string;
  icon: IconName;
}[] = [
  {
    id: "resources",
    label: "인프라 자원",
    english: "INFRASTRUCTURE",
    description: "리전·서비스별 Host, VM, Storage 현황을 확인하세요.",
    icon: "server",
  },
  {
    id: "staff",
    label: "운영 인력",
    english: "PEOPLE",
    description: "운영 인력의 배치와 역할, 근무 현황을 확인하세요.",
    icon: "users",
  },
  {
    id: "work",
    label: "운영 작업",
    english: "OPERATIONS",
    description: "요청·변경·장애 대응의 진행 현황을 확인하세요.",
    icon: "work",
  },
  {
    id: "issues",
    label: "리전 이슈",
    english: "ISSUES & ACTIONS",
    description: "리전별 운영 이슈와 조치 내용, 댓글을 확인하세요.",
    icon: "flag",
  },
  {
    id: "report",
    label: "리포트",
    english: "OVERVIEW",
    description: "각 기능의 최신 운영 데이터를 한 화면에서 살펴보세요.",
    icon: "layers",
  },
  {
    id: "logs",
    label: "변경 이력",
    english: "ACTIVITY",
    description: "데이터가 언제, 어떻게 변경되었는지 확인하세요.",
    icon: "history",
  },
];

export default function HomePage({
  data,
  snapshot,
  hiddenTabs,
  isAdmin,
  navigate,
  manageTabs,
}: {
  data: Bootstrap;
  snapshot: Snapshot;
  hiddenTabs: Tab[];
  isAdmin: boolean;
  navigate: (tab: Tab) => void;
  manageTabs: () => void;
}) {
  const features = FEATURES.filter(
    (feature) => !hiddenTabs.includes(feature.id) && canAccessTab(feature.id, isAdmin),
  ).sort((a, b) => TABS.findIndex((tab) => tab.id === a.id) - TABS.findIndex((tab) => tab.id === b.id));
  const featured = ["resources", "report", "issues"].flatMap((id) =>
    features.filter((feature) => feature.id === id),
  );
  const count = (id: Tab) =>
    id === "resources"
      ? `${snapshot.resources.length}개 자원`
      : id === "staff"
        ? `${snapshot.staff.length}명 배치`
        : id === "work"
          ? `${snapshot.work.length}개 작업 현황`
          : id === "issues"
            ? `${snapshot.issues.length}개 이슈`
            : id === "logs"
              ? `${snapshot.logs.length}건 최근 변경`
              : "전체 운영 데이터";
  return (
    <div className="home-page">
      <header className="home-heading">
        <h1>COC dashboard</h1>
        <p>인프라 자원과 운영 현황을 확인하고 필요한 기능으로 이동하세요.</p>
      </header>
      {featured.length > 0 && (
        <section className="featured-section" aria-label="주요 기능">
          <h2>주요 기능</h2>
          <div className={`featured-grid featured-count-${featured.length}`}>
            {featured.map((feature) => (
              <button
                key={feature.id}
                className={`feature-card featured-card${feature.id === "resources" ? " featured-card-wide" : ""}`}
                data-feature={feature.id}
                onClick={() => navigate(feature.id)}
              >
                <div className={`featured-art featured-art-${feature.id}`} aria-hidden="true">
                  {feature.id === "resources" ? (
                    <div className="resource-preview">
                      <div className="preview-label">Infrastructure resources</div>
                      <div className="preview-row preview-row-head">
                        <span>Region</span><span>Service</span><span>Host</span><span>VM</span>
                      </div>
                      {snapshot.resources.slice(0, 4).map((row) => (
                        <div className="preview-row" key={row.id}>
                          <span>{data.regions.find((region) => region.id === row.region)?.region_name ?? "미등록 리전"}</span>
                          <span>{data.services.find((service) => service.service_code === row.service)?.service_name ?? String(row.service ?? "—")}</span>
                          <span>{Number(row.host_count).toLocaleString()}</span>
                          <span>{row.vm_count == null ? "—" : Number(row.vm_count).toLocaleString()}</span>
                        </div>
                      ))}
                      {!snapshot.resources.length && <div className="preview-no-data">등록된 자원이 없습니다.</div>}
                    </div>
                  ) : feature.id === "report" ? (
                    <div className="overview-preview">
                      <Icon name="layers" size={44} />
                      <div>
                        <span>Host <b>{snapshot.totals.hosts.toLocaleString()}</b></span>
                        <span>VM <b>{snapshot.totals.vms.toLocaleString()}</b></span>
                        <span>Storage <b>{snapshot.totals.storage.toLocaleString()}</b></span>
                      </div>
                    </div>
                  ) : (
                    <div className="issue-preview">
                      <Icon name="flag" size={38} />
                      <div>
                        <span>Regional issues</span>
                        <strong>{snapshot.issues.length} <small>issues</small></strong>
                        <span>이슈 · 조치 · 담당자</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="featured-copy">
                  <span className="feature-icon"><Icon name={feature.icon} size={20} /></span>
                  <h3>{feature.label}</h3>
                  <p>{feature.description}</p>
                </div>
                <div className="feature-card-bottom">
                  <span>{count(feature.id)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="home-directory" aria-label="전체 기능">
        <div className="directory-heading">
          <h2>
            전체 기능 <span>{features.length}</span>
          </h2>
          <button className="btn btn-sm" onClick={manageTabs}>
            <Icon name="eye" size={14} />탭 관리
          </button>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <button
              key={feature.id}
              className="feature-card"
              data-feature={feature.id}
              onClick={() => navigate(feature.id)}
            >
              <span className="feature-icon"><Icon name={feature.icon} size={20} /></span>
              <div>
                <h3>{feature.label}</h3>
                <p>{feature.description}</p>
              </div>
              <div className="feature-card-bottom">
                <span>{count(feature.id)}</span>
              </div>
            </button>
          ))}
          {isAdmin && (
            <button
              className="feature-card"
              data-feature="database"
              onClick={() => navigate("database")}
            >
              <span className="feature-icon"><Icon name="database" size={20} /></span>
              <div>
                <h3>DB 관리</h3>
                <p>
                  공통데이터와 기능별 데이터를 관리하고 원본 테이블을
                  확인하세요.
                </p>
              </div>
              <div className="feature-card-bottom">
                <span className="subtle-badge">관리자 전용</span>
                <span>데이터 관리</span>
              </div>
            </button>
          )}
        </div>
        {!features.length && (
          <div className="empty-state">
            <h3>표시된 기능이 없습니다.</h3>
            <p>탭 관리에서 다시 표시할 기능을 선택하세요.</p>
            <button className="btn btn-sm" onClick={manageTabs}>
              탭 관리
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
