import { useMemo, useState } from "react";
import Icon from "../components/Icon";
import InfrastructureSummary from "./InfrastructureSummary";
import type { Bootstrap, DataRow } from "./api";
import { exportCsv } from "./config";

type SortKey =
  | "region"
  | "service"
  | "environment_name"
  | "host_count"
  | "vm_count"
  | "storage_count"
  | "remarks"
  | "updated_at";
const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "region", label: "리전" },
  { key: "service", label: "서비스" },
  { key: "environment_name", label: "환경" },
  { key: "host_count", label: "Host", numeric: true },
  { key: "vm_count", label: "VM", numeric: true },
  { key: "storage_count", label: "Storage", numeric: true },
  { key: "remarks", label: "비고" },
  { key: "updated_at", label: "업데이트" },
];
const number = (value: unknown) =>
  value === null || value === undefined
    ? "—"
    : Number(value).toLocaleString("ko-KR");
const date = (value: unknown) =>
  value
    ? new Date(String(value)).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";

export default function InfrastructureView({
  rows,
  data,
  reportMode = false,
}: {
  rows: DataRow[];
  data: Bootstrap;
  reportMode?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [service, setService] = useState("");
  const [sort, setSort] = useState<SortKey>("region");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [page, setPage] = useState(0),
    [selectedLimit, setLimit] = useState(30);
  const limit = reportMode ? 15 : selectedLimit;
  const regionInfo = (id: number | undefined) =>
    data.regions.find((item) => item.id === id);
  const regionName = (id: number | undefined) => regionInfo(id)?.region_name ?? "미등록 리전";
  const serviceName = (code: unknown) =>
    data.services.find((item) => item.service_code === code)?.service_name ??
    String(code);
  const countries = [
    ...new Set(
      rows.map((row) => regionInfo(row.region)?.country_code).filter(Boolean),
    ),
  ] as string[];
  const filtered = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            (!country || regionInfo(row.region)?.country_code === country) &&
            (!region || String(row.region) === region) &&
            (!service || row.service === service) &&
            (!query ||
              `${regionName(row.region)} ${serviceName(row.service)} ${String(row.environment_name)} ${String(row.remarks)}`
                .toLowerCase()
                .includes(query.toLowerCase())),
        )
        .sort((a, b) => {
          const left =
            sort === "region"
              ? regionName(a.region)
              : sort === "service"
                ? serviceName(a.service)
                : a[sort];
          const right =
            sort === "region"
              ? regionName(b.region)
              : sort === "service"
                ? serviceName(b.service)
                : b[sort];
          if (left == null || right == null)
            return left == null ? (right == null ? 0 : 1) : -1;
          return (
            (typeof left === "number" && typeof right === "number"
              ? left - right
              : String(left).localeCompare(String(right), "ko", {
                  numeric: true,
                })) * direction
          );
        }),
    [rows, data, country, region, service, query, sort, direction],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(
    currentPage * limit,
    (currentPage + 1) * limit,
  );
  const sum = (key: string, list = filtered) =>
    list.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  function resetFilters() {
    setCountry("");
    setRegion("");
    setService("");
    setQuery("");
    setPage(0);
  }
  function sortBy(key: SortKey) {
    setDirection(sort === key ? (direction === 1 ? -1 : 1) : 1);
    setSort(key);
    setPage(0);
  }
  return (
    <div className="infrastructure-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">INFRASTRUCTURE</span>
          <h1>인프라 자원</h1>
          <p>리전과 서비스별 컴퓨팅·스토리지 자원의 현재 현황입니다.</p>
        </div>
        <button
          className="btn"
          onClick={() => exportCsv("resources", filtered, data)}
        >
          <Icon name="download" size={16} />
          CSV 내보내기
        </button>
      </header>
      <InfrastructureSummary rows={rows} data={data} />
      <section className="inventory-panel panel">
        <header className="inventory-panel-heading">
          <div className="inventory-title">
            <Icon name="server" size={18} />
            <h2>자원 목록</h2>
          </div>
          <div className="inventory-toolbar">
            <label className="search-control">
              <Icon name="search" size={16} />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="리전, 서비스, 비고 검색..."
                aria-label="인프라 자원 검색"
              />
            </label>
            <div className="inventory-selects">
              <label>
                <Icon name="globe" size={14} />
                <select
                  aria-label="리전 필터"
                  value={region}
                  onChange={(event) => {
                    setRegion(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">전체 리전</option>
                  {data.regions
                    .filter((item) => !country || item.country_code === country)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.region_name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <Icon name="layers" size={14} />
                <select
                  aria-label="서비스 필터"
                  value={service}
                  onChange={(event) => {
                    setService(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">전체 서비스</option>
                  {data.services.map((item) => (
                    <option key={item.service_code} value={item.service_code}>
                      {item.service_name}
                    </option>
                  ))}
                </select>
              </label>
              {(query || country || region || service) && (
                <button
                  className="icon-button"
                  title="필터 초기화"
                  aria-label="필터 초기화"
                  onClick={resetFilters}
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
          </div>
        </header>
        <div
          className="inventory-country-tabs"
          role="group"
          aria-label="국가별 자원"
        >
          <button
            aria-pressed={!country}
            onClick={() => {
              setCountry("");
              setRegion("");
              setPage(0);
            }}
          >
            전체 자원 <span>{rows.length}</span>
          </button>
          {countries.map((code) => (
            <button
              key={code}
              aria-pressed={country === code}
              onClick={() => {
                setCountry(code);
                setRegion("");
                setPage(0);
              }}
            >
              {code}{" "}
              <span>
                {
                  rows.filter(
                    (row) => regionInfo(row.region)?.country_code === code,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="inventory-grid-scroll">
          <table className="inventory-grid">
            <colgroup>
              <col className="gutter-col" />
              <col className="region-col" />
              <col className="service-col" />
              <col className="zone-col" />
              <col className="number-col" />
              <col className="number-col" />
              <col className="number-col" />
              <col className="remarks-col" />
              <col className="date-col" />
            </colgroup>
            <thead>
              <tr className="grid-groups">
                <th rowSpan={2} scope="col" className="grid-gutter">
                  #
                </th>
                <th colSpan={3} scope="colgroup">
                  리소스 위치
                </th>
                <th colSpan={2} scope="colgroup">
                  컴퓨팅
                </th>
                <th scope="colgroup">스토리지</th>
                <th colSpan={2} scope="colgroup">
                  운영 정보
                </th>
              </tr>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    aria-sort={
                      sort === column.key
                        ? direction === 1
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      onClick={() => sortBy(column.key)}
                      className={column.numeric ? "numeric" : ""}
                    >
                      {column.label}
                      <Icon
                        name="sort"
                        size={12}
                        className={sort === column.key ? "sort-active" : ""}
                      />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr key={row.id}>
                  <th className="grid-gutter" scope="row">
                    {currentPage * limit + index + 1}
                  </th>
                  <td className="resource-region">
                    <span
                      className={`country-tag country-${regionInfo(row.region)?.country_code.toLowerCase()}`}
                    >
                      {regionInfo(row.region)?.country_code ?? "—"}
                    </span>
                    <span>{regionName(row.region)}</span>
                  </td>
                  <td>
                    <span
                      className={`service-tag ${row.service === "CCS" ? "service-ccs" : ""}`}
                    >
                      <i />
                      {serviceName(row.service)}
                    </span>
                  </td>
                  <td className="zone-cell">{String(row.environment_name)}</td>
                  {["host_count", "vm_count", "storage_count"].map((key) => (
                    <td
                      key={key}
                      className={`numeric ${row[key] == null ? "is-null" : ""}`}
                      title={row[key] == null ? "수량 미입력" : undefined}
                    >
                      {number(row[key])}
                    </td>
                  ))}
                  <td className="resource-remarks">
                    <span title={String(row.remarks || "")}>
                      {String(row.remarks || "—")}
                    </span>
                  </td>
                  <td className="resource-date">{date(row.updated_at)}</td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={9}>
                    <div className="table-empty">
                      <Icon name="search" size={26} />
                      <strong>조회된 자원이 없습니다.</strong>
                      <span>검색 조건을 바꾸거나 필터를 초기화하세요.</span>
                      <button className="btn btn-sm" onClick={resetFilters}>
                        필터 초기화
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {!!filtered.length && (
              <tfoot>
                <tr>
                  <th className="grid-gutter">합계</th>
                  <td colSpan={3}>표시된 {filtered.length}개 자원 합계</td>
                  <td className="numeric">{number(sum("host_count"))}</td>
                  <td className="numeric">{number(sum("vm_count"))}</td>
                  <td className="numeric">{number(sum("storage_count"))}</td>
                  <td colSpan={2} className="total-note">
                    미입력 수량은 합계에서 제외
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <footer className="inventory-pagination">
          <span>
            전체 {filtered.length}개 중{" "}
            <strong>
              {filtered.length ? currentPage * limit + 1 : 0}–
              {Math.min((currentPage + 1) * limit, filtered.length)}
            </strong>{" "}
            표시
          </span>
          <div>
            <label>
              페이지당
              <select
                aria-label="페이지당 자원 수"
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(0);
                }}
              >
                {(reportMode ? [15] : [30, 50, 100]).map((value) => (
                  <option key={value} value={value}>
                    {value}개
                  </option>
                ))}
              </select>
            </label>
            <span className="page-position">
              {currentPage + 1} / {pages}
            </span>
            <button
              className="icon-button"
              disabled={!currentPage}
              aria-label="이전 페이지"
              onClick={() => setPage((value) => value - 1)}
            >
              <Icon
                name="chevron"
                size={15}
                style={{ transform: "rotate(180deg)" }}
              />
            </button>
            <button
              className="icon-button"
              disabled={currentPage >= pages - 1}
              aria-label="다음 페이지"
              onClick={() => setPage((value) => value + 1)}
            >
              <Icon name="chevron" size={15} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
