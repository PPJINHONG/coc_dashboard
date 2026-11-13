import "./staff.css";
import { sectionRows } from "../../shared/api/operations";
import type { FeatureDefinition } from "../../shared/feature";
import { SectionAdmin } from "../../shared/sections/SectionEditor";
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
  editorHint: "복사한 인력은 성명을, 작업은 리전·구분·대상을 선택하세요. 삭제한 행은 저장 시 반영됩니다.",
  // 같은 인력을 두 번 배치할 수 없으므로 복사한 행은 성명을 다시 고릅니다.
  copyReset: ["staff"],
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
  admin: [{ id: "staff", label: "운영 인력", Editor: (props) => <SectionAdmin config={section} {...props} /> }],
  Page: (props) => (
    <>
      <span className="eyebrow">PEOPLE</span>
      <StaffPage section={section} {...props} />
    </>
  ),
};

export default feature;
