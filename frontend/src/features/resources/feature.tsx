import homeLogo from "./home-logo.svg";
import "./resources.css";
import { sectionRows, type Bootstrap, type DataRow } from "../../shared/api/operations";
import DataTable from "../../shared/components/DataTable";
import type { FeatureDefinition, FeaturePageProps } from "../../shared/feature";
import type { Field } from "../../shared/fields";
import type { SectionConfig } from "../../shared/sections/types";
import { resourceFields } from "./fields";
import ResourceComparison from "./ResourceComparison";
import { resourceReport } from "./report";
import ResourcesPage from "./ResourcesPage";

/** DB 관리 조회 표: 수량 열 아래에 합계를 붙입니다. 빈 값은 합계에서 빼고 "+ 미입력"으로 알립니다. */
function totalsFooter(rows: DataRow[], columns: Field[]) {
  return (
    <tfoot>
      <tr>
        <td className="row-number">합계</td>
        <td colSpan={3}>합계</td>
        {columns.slice(3).map((field) => (
          <td
            key={field.key}
            className={field.type === "number" ? "numeric" : ""}
          >
            {field.type === "number" ? (
              <>
                {rows
                  .reduce(
                    (sum, row) => sum + Number(row[field.key] ?? 0),
                    0,
                  )
                  .toLocaleString("ko-KR")}
                {rows.some((row) => row[field.key] == null) && (
                  <small> + 미입력</small>
                )}
              </>
            ) : (
              ""
            )}
          </td>
        ))}
      </tr>
    </tfoot>
  );
}

const section: SectionConfig = {
  key: "resources",
  label: "인프라 자원",
  fields: resourceFields,
  filterKey: "region",
  searchPlaceholder: "이름, 분류, 비고 검색",
  Table: ({ rows, data }: { rows: DataRow[]; data: Bootstrap }) => (
    <DataTable columns={resourceFields(data)} rows={rows} footer={totalsFooter} />
  ),
};

function ResourceOverview({
  data,
  snapshot,
  user,
  refresh,
  setDirty,
  setBusy,
}: FeaturePageProps) {
  return (
    <ResourcesPage
      month={snapshot.month}
      revision={snapshot.revision}
      rows={sectionRows(snapshot, "resources")}
      data={data}
      canManage={Boolean(user?.is_staff && data.can_manage)}
      refresh={refresh}
      setDirty={setDirty}
      setBusy={setBusy}
    />
  );
}

const feature: FeatureDefinition = {
  id: "resources",
  report: resourceReport,
  label: "인프라 자원",
  icon: "server",
  order: 20,
  english: "INFRASTRUCTURE",
  homeCard: { logo: homeLogo, tone: "mist" },
  description: "리전·서비스별 Host, VM, Storage 현황을 확인하세요.",
  homeCount: (snapshot) => `${sectionRows(snapshot, "resources").length}개 자원`,
  subpages: [
    { id: "", label: "자원 현황", Page: ResourceOverview },
    { id: "comparison", label: "자원 증감 추이", Page: ResourceComparison },
  ],
  Page: ResourceOverview,
};

export default feature;
