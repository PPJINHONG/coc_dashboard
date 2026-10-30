import { useMemo, useState } from "react";
import type { Bootstrap, DataRow, Section } from "./api";
import { cell, exportCsv, fields, SECTION_LABELS } from "./config";
import { DataTable, IssueCards, Panel, WorkCards } from "./components";

export default function SectionView({
  section,
  rows,
  data,
  rowLimit,
}: {
  section: Section;
  rows: DataRow[];
  data: Bootstrap;
  rowLimit?: number;
}) {
  const [region, setRegion] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const columns = useMemo(() => fields(section, data), [section, data]);
  const location = columns.find((field) => field.key === (section === "staff" ? "country_code" : "region"))!;
  const filtered = rows.filter(
    (row) =>
      (!region || String(row[location.key]) === region) &&
      (!status || row.status === status) &&
      (!search ||
        columns.some((field) =>
          cell(row, field).toLowerCase().includes(search.toLowerCase()),
        )),
  );
  const visible = rowLimit === undefined ? filtered : filtered.slice(0, rowLimit);
  return (
    <div className={`report-sections${section === "staff" ? " staff-page" : ""}`}>
      <header className="section-head">
        <div>
          <h1>{SECTION_LABELS[section]}</h1>
          <p className="section-sub">현재 저장된 운영 데이터</p>
        </div>
        <button
          className="btn"
          onClick={() => exportCsv(section, filtered, data)}
        >
          CSV 내보내기
        </button>
      </header>
      <div className="report-filters">
        <label>
          {location.label}
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          >
            <option value="">전체 {location.label}</option>
            {location.options?.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="report-search">
          검색
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={section === "staff" ? "성명, 직책, 업무, 근무지 검색" : "이름, 분류, 비고 검색"}
          />
        </label>
        {section === "issues" && (
          <label>
            상태
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">전체 상태</option>
              {columns
                .find((field) => field.key === "status")
                ?.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
        )}
        <span className="muted">
          {rowLimit !== undefined ? `${filtered.length}개 중 ${visible.length}개 표시` : `${filtered.length}개 항목`}
        </span>
      </div>
      {section === "work" && <WorkCards rows={filtered} />}
      {section === "issues" ? (
        <IssueCards rows={visible} data={data} />
      ) : (
        <Panel
          title={`${SECTION_LABELS[section]} 상세`}
          subtitle={section === "staff" ? undefined : "관리자 DB 설정에서 저장한 원본 데이터를 표시합니다."}
        >
          <DataTable section={section} rows={visible} data={data} />
        </Panel>
      )}
    </div>
  );
}
