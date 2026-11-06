import { useState, type ReactNode } from "react";
import type { DataRow } from "../api/operations";
import { cell, type Field } from "../fields";
import type { SectionConfig } from "./types";

/** 리전(또는 국가)·검색·상태 필터 값과 걸러진 행 */
export function useSectionFilters(config: SectionConfig, columns: Field[], rows: DataRow[]) {
  const [region, setRegion] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const location = columns.find((field) => field.key === config.filterKey)!;
  const filtered = rows.filter(
    (row) =>
      (!region || String(row[location.key]) === region) &&
      (!status || row.status === status) &&
      (!search ||
        columns.some((field) =>
          cell(row, field).toLowerCase().includes(search.toLowerCase()),
        )),
  );
  return { region, setRegion, search, setSearch, status, setStatus, location, filtered };
}

export type SectionFilterState = ReturnType<typeof useSectionFilters>;

export default function SectionFilters({
  config,
  columns,
  filters,
  countText,
}: {
  config: SectionConfig;
  columns: Field[];
  filters: SectionFilterState;
  countText: ReactNode;
}) {
  const { location } = filters;
  return (
    <div className="report-filters">
      <label>
        {location.label}
        <select
          value={filters.region}
          onChange={(event) => filters.setRegion(event.target.value)}
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
          value={filters.search}
          onChange={(event) => filters.setSearch(event.target.value)}
          placeholder={config.searchPlaceholder}
        />
      </label>
      {config.statusFilter && (
        <label>
          상태
          <select
            value={filters.status}
            onChange={(event) => filters.setStatus(event.target.value)}
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
      <span className="muted">{countText}</span>
    </div>
  );
}
