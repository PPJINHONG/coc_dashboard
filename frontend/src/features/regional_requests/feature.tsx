import "./regional_requests.css";
import Icon from "../../shared/components/Icon";
import type { FeatureDataProps, FeatureDefinition } from "../../shared/feature";
import RegionalRequestsPage from "./RegionalRequestsPage";


function HomePreview({ snapshot }: FeatureDataProps) {
  const count = Number(snapshot.totals.regional_requests ?? 0);
  return (
    <div className="regional-request-preview">
      <Icon name="work" size={38} />
      <div>
        <span>Regional requests</span>
        <strong>{count} <small>tickets</small></strong>
        <span>일정 · 담당자 · 상태</span>
      </div>
    </div>
  );
}

const feature: FeatureDefinition = {
  id: "regional_requests",
  label: "권역별 요청작업",
  icon: "work",
  order: 50,
  english: "REGIONAL REQUESTS",
  description: "권역별 요청 티켓의 일정과 담당 상태를 관리하세요.",
  homeCount: (snapshot) => `${Number(snapshot.totals.regional_requests ?? 0)}개 요청`,
  featured: { order: 3, Preview: HomePreview },
  Page: RegionalRequestsPage,
};

export default feature;
