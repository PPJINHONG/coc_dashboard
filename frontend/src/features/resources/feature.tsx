import "./resources.css";
import { sectionRows, type Bootstrap, type DataRow } from "../../shared/api/operations";
import DataTable from "../../shared/components/DataTable";
import type { FeatureDataProps, FeatureDefinition } from "../../shared/feature";
import type { Field } from "../../shared/fields";
import { SectionAdmin } from "../../shared/sections/SectionEditor";
import type { SectionConfig } from "../../shared/sections/types";
import { resourceFields } from "./fields";
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
  editorHint:
    "VM·Compute Rack·Storage Rack의 빈 값은 미입력, 0은 실제 0개를 뜻합니다. 합계는 자동 계산합니다. 복사 후 리전·서비스 조합을 변경해 주세요.",
  Table: ({ rows, data }: { rows: DataRow[]; data: Bootstrap }) => (
    <DataTable columns={resourceFields(data)} rows={rows} footer={totalsFooter} />
  ),
};

function HomePreview({ data, snapshot }: FeatureDataProps) {
  const rows = sectionRows(snapshot, "resources");
  return (
    <div className="resource-preview">
      <div className="preview-label">Infrastructure resources</div>
      <div className="preview-row preview-row-head">
        <span>Region</span><span>Service</span><span>Host</span><span>VM</span>
      </div>
      {rows.slice(0, 4).map((row) => (
        <div className="preview-row" key={row.id}>
          <span>{data.regions.find((region) => region.id === row.region)?.region_name ?? "미등록 리전"}</span>
          <span>{data.services.find((service) => service.service_code === row.service)?.service_name ?? String(row.service ?? "—")}</span>
          <span>{Number(row.host_count).toLocaleString()}</span>
          <span>{row.vm_count == null ? "—" : Number(row.vm_count).toLocaleString()}</span>
        </div>
      ))}
      {!rows.length && <div className="preview-no-data">등록된 자원이 없습니다.</div>}
    </div>
  );
}

const feature: FeatureDefinition = {
  id: "resources",
  label: "인프라 자원",
  icon: "server",
  order: 20,
  english: "INFRASTRUCTURE",
  description: "리전·서비스별 Host, VM, Storage 현황을 확인하세요.",
  homeCount: (snapshot) => `${sectionRows(snapshot, "resources").length}개 자원`,
  featured: { order: 1, wide: true, Preview: HomePreview },
  report: {
    order: 1,
    Summary: ({ data, snapshot }) => (
      <ResourcesPage rows={sectionRows(snapshot, "resources")} data={data} reportMode />
    ),
  },
  admin: [{ id: "resources", label: "인프라 자원", Editor: (props) => <SectionAdmin config={section} {...props} /> }],
  Page: ({ data, snapshot }) => <ResourcesPage rows={sectionRows(snapshot, "resources")} data={data} />,
};

export default feature;
