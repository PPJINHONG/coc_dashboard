import { useMemo, type ReactNode } from "react";
import type { Bootstrap, DataRow } from "../api/operations";
import Panel from "../components/Panel";
import SectionFilters, { useSectionFilters } from "./SectionFilters";
import type { SectionConfig } from "./types";

/** 현재값 목록 기능의 일반 조회 화면: 제목·필터·요약·표. 일부 행만 보여 주는 화면에서도 재사용합니다. */
export default function SectionPage({
  config,
  rows,
  data,
  subtitle = "현재 저장된 운영 데이터",
  actions,
  renderBody,
  children,
}: {
  config: SectionConfig;
  rows: DataRow[];
  data: Bootstrap;
  subtitle?: string;
  /** 제목 오른쪽에 표시할 버튼 */
  actions?: ReactNode;
  /** 본문을 표 대신 직접 그릴 때 */
  renderBody?: (visible: DataRow[]) => ReactNode;
  /** 화면 끝에 붙일 내용(입력 창 등) */
  children?: ReactNode;
}) {
  const columns = useMemo(() => config.fields(data), [config, data]);
  const filters = useSectionFilters(config, columns, rows);
  const { filtered } = filters;
  const { Table } = config;
  return (
    <div className={`report-sections${config.pageClassName ?? ""}`}>
      <header className="section-head">
        <div>
          <h1>{config.label}</h1>
          <p className="section-sub">{subtitle}</p>
        </div>
        {actions && <div className="actions">{actions}</div>}
      </header>
      <SectionFilters
        config={config}
        columns={columns}
        filters={filters}
        countText={`${filtered.length}개 항목`}
      />
      {renderBody ? (
        renderBody(filtered)
      ) : (
        <Panel title={`${config.label} 상세`} subtitle={config.viewSubtitle}>
          {Table && <Table rows={filtered} data={data} />}
        </Panel>
      )}
      {children}
    </div>
  );
}
