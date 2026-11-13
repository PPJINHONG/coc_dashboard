import "./staff.css";
import { sectionRows } from "../../shared/api/operations";
import type { FeatureDefinition } from "../../shared/feature";
import SectionPage from "../../shared/sections/SectionPage";
import type { SectionConfig } from "../../shared/sections/types";
import { staffFields } from "./fields";
import StaffPage from "./StaffPage";
import StaffTable from "./StaffTable";

const section: SectionConfig = {
  key: "staff",
  label: "운영 인력",
  fields: staffFields,
  filterKey: "country_code",
  searchPlaceholder: "성명, 직책, 업무, 근무지, IP·계정 검색",
  pageClassName: " staff-page",
  Table: StaffTable,
  editorHint: "운영 인력 추가 또는 정보 수정에서 인력별로 저장합니다.",
};

const feature: FeatureDefinition = {
  id: "staff",
  label: "운영 인력",
  icon: "users",
  order: 30,
  english: "PEOPLE",
  description: "운영 인력의 배치와 역할, 근무 현황을 확인하세요.",
  homeCount: (snapshot) => `${sectionRows(snapshot, "staff").length}명 배치`,
  report: {
    order: 4,
    Summary: ({ data, snapshot }) => (
      <SectionPage config={section} rows={sectionRows(snapshot, "staff")} data={data} rowLimit={10} />
    ),
  },
  Page: (props) => (
    <>
      <span className="eyebrow">PEOPLE</span>
      <StaffPage section={section} {...props} />
    </>
  ),
};

export default feature;
