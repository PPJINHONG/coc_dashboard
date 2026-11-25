import homeLogo from "./home-logo.svg";
import "./staff.css";
import { sectionRows } from "../../shared/api/operations";
import type { FeatureDefinition, FeaturePageProps } from "../../shared/feature";
import type { SectionConfig } from "../../shared/sections/types";
import { staffFields } from "./fields";
import StaffPage, { type StaffView } from "./StaffPage";
import StaffTable from "./StaffTable";

const section: SectionConfig = {
  key: "staff",
  label: "운영 인력",
  fields: () => staffFields(),
  filterKey: "country_code",
  searchPlaceholder: "성명, 직책, 업무, 근무지, IP·계정 검색",
  pageClassName: " staff-page",
  Table: StaffTable,
};

function StaffScreen(props: FeaturePageProps & { view: StaffView }) {
  return (
    <>
      <span className="eyebrow">PEOPLE</span>
      <StaffPage section={section} {...props} />
    </>
  );
}

function StaffOverview(props: FeaturePageProps) {
  return <StaffScreen {...props} view="people" />;
}

function StaffTrendPage(props: FeaturePageProps) {
  return <StaffScreen {...props} view="trend" />;
}

function StaffCalendarPage(props: FeaturePageProps) {
  return <StaffScreen {...props} view="calendar" />;
}

const feature: FeatureDefinition = {
  id: "staff",
  label: "운영 인력",
  icon: "users",
  order: 30,
  english: "PEOPLE",
  report: ({ snapshot }) => {
    const people = sectionRows(snapshot, "staff");
    return {
      scope: "조회 시점의 권역별 등록 인원",
      figures: ["KR", "EU", "NA"].map((label) => ({
        label, value: people.filter((person) => person.country_code === label).length, unit: "명",
      })),
    };
  },
  homeCard: { logo: homeLogo, tone: "forest" },
  description: "운영 인력의 배치와 역할, 근무 현황을 확인하세요.",
  homeCount: (snapshot) => `${sectionRows(snapshot, "staff").length}명 배치`,
  subpages: [
    { id: "", label: "인력 현황 · 일정", Page: StaffOverview },
    { id: "trend", label: "인력 추이", Page: StaffTrendPage },
    { id: "calendar", label: "캘린더", Page: StaffCalendarPage },
  ],
  Page: StaffOverview,
};

export default feature;
