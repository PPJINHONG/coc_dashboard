import "./work.css";
import { sectionRows, type Bootstrap, type DataRow } from "../../shared/api/operations";
import DataTable, { type ExtraColumn } from "../../shared/components/DataTable";
import type { FeatureDefinition } from "../../shared/feature";
import { SectionAdmin } from "../../shared/sections/SectionEditor";
import SectionPage from "../../shared/sections/SectionPage";
import type { SectionConfig } from "../../shared/sections/types";
import { workFields } from "./fields";
import WorkCards from "./WorkCards";

const progressColumns: ExtraColumn[] = [
  { label: "미완료", value: (row) => Number(row.total_count) - Number(row.completed_count) },
  {
    label: "완료율",
    value: (row) =>
      Number(row.total_count)
        ? `${((Number(row.completed_count) / Number(row.total_count)) * 100).toFixed(1)}%`
        : "—",
  },
];

const section: SectionConfig = {
  key: "work",
  label: "운영 작업",
  fields: workFields,
  filterKey: "region",
  searchPlaceholder: "이름, 분류, 비고 검색",
  viewSubtitle: "관리자 DB 설정에서 저장한 원본 데이터를 표시합니다.",
  Summary: WorkCards,
  Table: ({ rows, data }: { rows: DataRow[]; data: Bootstrap }) => (
    <DataTable columns={workFields(data)} rows={rows} extraColumns={progressColumns} />
  ),
  editorHint: "복사한 인력은 성명을, 작업은 리전·구분·대상을 선택하세요. 삭제한 행은 저장 시 반영됩니다.",
};

const feature: FeatureDefinition = {
  id: "work",
  label: "운영 작업",
  icon: "work",
  order: 40,
  english: "OPERATIONS",
  description: "요청·변경·장애 대응의 진행 현황을 확인하세요.",
  homeCount: (snapshot) => `${sectionRows(snapshot, "work").length}개 작업 현황`,
  report: {
    order: 2,
    Summary: ({ data, snapshot }) => (
      <SectionPage config={section} rows={sectionRows(snapshot, "work")} data={data} rowLimit={15} />
    ),
  },
  admin: [{ id: "work", label: "운영 작업", Editor: (props) => <SectionAdmin config={section} {...props} /> }],
  Page: ({ data, snapshot }) => (
    <>
      <span className="eyebrow">OPERATIONS</span>
      <SectionPage config={section} rows={sectionRows(snapshot, "work")} data={data} />
    </>
  ),
};

export default feature;
