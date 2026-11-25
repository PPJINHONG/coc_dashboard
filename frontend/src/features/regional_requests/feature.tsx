import homeLogo from "./home-logo.svg";
import "./regional_requests.css";
import type { FeatureDefinition } from "../../shared/feature";
import RegionalRequestsPage from "./RegionalRequestsPage";
import { requestReport } from "./report";


const feature: FeatureDefinition = {
  id: "regional_requests",
  report: requestReport,
  label: "권역별 요청작업",
  icon: "work",
  order: 50,
  english: "REGIONAL REQUESTS",
  homeCard: { logo: homeLogo, tone: "wine" },
  description: "권역별 요청 티켓의 일정과 담당 상태를 관리하세요.",
  homeCount: (snapshot) => `${Number(snapshot.totals.regional_requests ?? 0)}개 요청`,
  Page: RegionalRequestsPage,
};

export default feature;
