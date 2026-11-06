import "./logs.css";
import type { FeatureDefinition } from "../../shared/feature";
import LogList from "./LogList";

const feature: FeatureDefinition = {
  id: "logs",
  label: "변경 이력",
  icon: "history",
  order: 90,
  adminOnly: true,
  english: "ACTIVITY",
  description: "데이터가 언제, 어떻게 변경되었는지 확인하세요.",
  homeCount: (snapshot) => `${snapshot.logs.length}건 최근 변경`,
  Page: ({ data, snapshot, user, features }) =>
    user?.is_staff ? (
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
          <LogList
            rows={snapshot.logs}
            labels={Object.fromEntries(features.map((item) => [item.id, item.label]))}
            details
            data={data}
          />
        </section>
      </>
    ) : null,
};

export default feature;
