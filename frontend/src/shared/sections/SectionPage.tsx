import { useMemo, type ReactNode } from "react";
import type { Bootstrap, DataRow } from "../api/operations";
import Panel from "../components/Panel";
import { exportCsv } from "../fields";
import SectionFilters, { useSectionFilters } from "./SectionFilters";
import type { SectionConfig } from "./types";

/** 현재값 목록 기능의 일반 조회 화면: 제목·CSV·필터·요약·표. 리포트에서도 행 수를 줄여 재사용합니다. */
export default function SectionPage({
  config,
  rows,
  data,
  rowLimit,
  subtitle = "현재 저장된 운영 데이터",
  actions,
  renderBody,
  children,
}: {
  config: SectionConfig;
  rows: DataRow[];
  data: Bootstrap;
  /** 리포트처럼 일부만 보여 줄 때의 최대 행 수. 필터·검색은 전체 행에 먼저 적용합니다. */
  rowLimit?: number;
  subtitle?: string;
  /** 제목 오른쪽 버튼(CSV 내보내기 앞) */
  actions?: ReactNode;
  /** 본문을 표 대신 직접 그릴 때 */
  renderBody?: (visible: DataRow[]) => ReactNode;
  /** 화면 끝에 붙일 내용(입력 창 등) */
  children?: ReactNode;
}) {
  const columns = useMemo(() => config.fields(data), [config, data]);
  const filters = useSectionFilters(config, columns, rows);
  const { filtered } = filters;
  const visible = rowLimit === undefined ? filtered : filtered.slice(0, rowLimit);
  const { Summary, Table } = config;
  return (
    <div className={`report-sections${config.pageClassName ?? ""}`}>
      <header className="section-head">
        <div>
          <h1>{config.label}</h1>
          <p className="section-sub">{subtitle}</p>
        </div>
        <div className="actions">
          {actions}
          <button
            className="btn"
            onClick={() => exportCsv(config.key, columns, filtered)}
          >
            CSV 내보내기
          </button>
        </div>
      </header>
      <SectionFilters
        config={config}
        columns={columns}
        filters={filters}
        countText={rowLimit !== undefined ? `${filtered.length}개 중 ${visible.length}개 표시` : `${filtered.length}개 항목`}
      />
      {Summary && <Summary rows={filtered} />}
      {renderBody ? (
        renderBody(visible)
      ) : (
        <Panel title={`${config.label} 상세`} subtitle={config.viewSubtitle}>
          {Table && <Table rows={visible} data={data} />}
        </Panel>
      )}
      {children}
    </div>
  );
}
