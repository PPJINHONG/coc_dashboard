import homeLogo from "./home-logo.svg";
import "./regional_notices.css";
import type { FeatureDefinition, FeaturePageProps } from "../../shared/feature";
import RegionalNoticesPage from "./RegionalNoticesPage";
import { noticeReport } from "./report";

function RegionalTimeline(props: FeaturePageProps) {
  return <RegionalNoticesPage {...props} view="timeline" />;
}

function RegionalToday(props: FeaturePageProps) {
  return <RegionalNoticesPage {...props} view="today" />;
}

const feature: FeatureDefinition = {
  id: "regional_notices",
  report: noticeReport,
  label: "권역별 작업공지",
  icon: "flag",
  order: 55,
  english: "REGIONAL NOTICES",
  homeCard: { logo: homeLogo, tone: "sage" },
  description: "월간 타임라인에서 리전별 예정 작업과 오늘 공지를 확인하세요.",
  homeCount: (snapshot) => `${Number(snapshot.totals.regional_notices ?? 0)}개 공지`,
  subpages: [
    { id: "", label: "리전별 전체", Page: RegionalTimeline },
    { id: "today", label: "오늘 작업공지", Page: RegionalToday },
  ],
  Page: RegionalTimeline,
};

export default feature;
