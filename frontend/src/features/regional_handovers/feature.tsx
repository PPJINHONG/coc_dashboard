import homeLogo from "./home-logo.svg";
import "./regional_handovers.css";
import type { FeatureDefinition } from "../../shared/feature";
import RegionalHandoversPage from "./RegionalHandoversPage";
import { handoverReport } from "./report";


const feature: FeatureDefinition = {
  id: "regional_handovers",
  report: handoverReport,
  label: "권역별 핸드오버",
  icon: "layers",
  order: 60,
  english: "REGIONAL HANDOVER",
  homeCard: { logo: homeLogo, tone: "ink" },
  description: "권역 간 중요 이슈와 작업 내용을 상세하게 공유하세요.",
  homeCount: (snapshot) => {
    const active = Number(snapshot.totals.regional_handovers_active ?? 0);
    const total = Number(snapshot.totals.regional_handovers ?? 0);
    return `${active}개 미완료 · 전체 ${total}개`;
  },
  Page: RegionalHandoversPage,
};

export default feature;
