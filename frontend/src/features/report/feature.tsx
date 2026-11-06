import "./report.css";
import Icon from "../../shared/components/Icon";
import type { FeatureDataProps, FeatureDefinition } from "../../shared/feature";
import { localDate } from "../../shared/fields";

function HomePreview({ snapshot }: FeatureDataProps) {
  return (
    <div className="overview-preview">
      <Icon name="layers" size={44} />
      <div>
        <span>Host <b>{snapshot.totals.hosts.toLocaleString()}</b></span>
        <span>VM <b>{snapshot.totals.vms.toLocaleString()}</b></span>
        <span>Storage <b>{snapshot.totals.storage.toLocaleString()}</b></span>
      </div>
    </div>
  );
}

/** 리포트: 각 기능 feature.tsx의 report.Summary를 순서대로 한 열에 이어 보여 줍니다. */
const feature: FeatureDefinition = {
  id: "report",
  label: "리포트",
  icon: "layers",
  order: 10,
  english: "OVERVIEW",
  description: "각 기능의 최신 운영 데이터를 한 화면에서 살펴보세요.",
  homeCount: () => "전체 운영 데이터",
  featured: { order: 2, Preview: HomePreview },
  Page: ({ data, snapshot, user, features, navigate }) => {
    const sections = features
      .filter((item) => item.report)
      .sort((a, b) => a.report!.order - b.report!.order);
    const reportData = { ...data, can_manage: Boolean(user?.is_staff) && data.can_manage };
    return (
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
        <div className="report-feature-list">
          {sections.map((item) => {
            const Summary = item.report!.Summary;
            return (
              <section className="report-feature-section" key={item.id} aria-label={item.label}>
                <Summary data={reportData} snapshot={snapshot} />
                <div className="report-feature-actions">
                  <button className="btn btn-sm" onClick={() => navigate(item.id)}>전체 보기 →</button>
                </div>
              </section>
            );
          })}
        </div>
      </>
    );
  },
};

export default feature;
