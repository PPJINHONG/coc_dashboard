import type { Bootstrap, Snapshot, Tab } from "./api";
import InfrastructureView from "./InfrastructureView";
import SectionView from "./SectionView";

export default function Report({ snapshot, data, navigate }: {
  snapshot: Snapshot;
  data: Bootstrap;
  navigate: (tab: Tab) => void;
}) {
  const sections = ["resources", "work", "issues", "staff"] as const;
  return (
    <div className="report-feature-list">
      {sections.map((section) => (
        <section className="report-feature-section" key={section} aria-label={
          { resources: "인프라 자원", work: "운영 작업", issues: "리전 이슈", staff: "운영 인력" }[section]
        }>
          {section === "resources" ? (
            <InfrastructureView rows={snapshot.resources} data={data} reportMode />
          ) : (
            <SectionView section={section} rows={snapshot[section]} data={data} rowLimit={section === "staff" ? 10 : 15} />
          )}
          <div className="report-feature-actions">
            <button className="btn btn-sm" onClick={() => navigate(section)}>전체 보기 →</button>
          </div>
        </section>
      ))}
    </div>
  );
}
