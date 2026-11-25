import homeLogo from "./home-logo.svg";
import type { FeatureDefinition } from "../../shared/feature";
import ReportPage from "./ReportPage";

const feature: FeatureDefinition = {
  id: "report",
  label: "리포트",
  icon: "layers",
  order: 10,
  english: "OPERATIONS REPORT",
  homeCard: { logo: homeLogo, tone: "navy" },
  description: "기준 월 전체 운영 현황 종합 · PDF 보고서 저장",
  homeCount: (snapshot) => snapshot.month,
  Page: ReportPage,
};

export default feature;
