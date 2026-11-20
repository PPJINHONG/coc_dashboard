import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../shared/api/client";
import type { Bootstrap, DataRow } from "../../shared/api/operations";
import ErrorMessage from "../../shared/components/ErrorMessage";
import Icon from "../../shared/components/Icon";
import {
  createResource,
  deleteResource,
  updateResource,
  type ResourceInput,
} from "./api";
import ResourceForm from "./ResourceForm";
import ResourceTopology from "./ResourceTopology";
import { areaCode, areaOrder } from "./resourceMetrics";

type SortKey =
  | "region"
  | "service"
  | "host_count"
  | "vm_count"
  | "compute_rack_count"
  | "storage_count"
  | "remarks"
  | "updated_at";
const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "region", label: "리전" },
  { key: "service", label: "서비스" },
  { key: "host_count", label: "Host", numeric: true },
  { key: "vm_count", label: "VM", numeric: true },
  { key: "compute_rack_count", label: "Compute Rack", numeric: true },
  { key: "storage_count", label: "Storage Rack", numeric: true },
  { key: "remarks", label: "비고" },
  { key: "updated_at", label: "업데이트" },
];
const QUANTITY_KEYS = ["host_count", "vm_count", "compute_rack_count", "storage_count"] as const;
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

/** 인프라 자원 화면. */
export default function ResourcesPage({
  rows,
  data,
  month = "",
  revision = 0,
  canManage,
  refresh,
  setDirty,
  setBusy: setPageBusy,
}: {
  rows: DataRow[];
  data: Bootstrap;
  month?: string;
  revision?: number;
  canManage: boolean;
  refresh: () => Promise<void>;
  setDirty: (dirty: boolean) => void;
  setBusy: (busy: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [service, setService] = useState("");
  const [sort, setSort] = useState<SortKey>("region");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [page, setPage] = useState(0),
    [selectedLimit, setLimit] = useState(30);
  const [editMode, setEditMode] = useState(false);
  const [editor, setEditor] = useState<DataRow | "new" | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const limit = selectedLimit;
  const regionInfo = (id: number | undefined) =>
    data.regions.find((item) => item.id === id);
  const regionName = (id: number | undefined) => regionInfo(id)?.region_name ?? "미등록 리전";
  const serviceName = (value: unknown) => String(value ?? "—");
  const services = [...new Set(rows.map((row) => String(row.service ?? "")).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "ko", { numeric: true }));
  const groupCode = (code?: string) => areaCode(code);
  const activeCountries = [
    ...new Set(
      rows.map((row) => groupCode(regionInfo(row.region)?.country_code)).filter(Boolean),
    ),
  ] as string[];
  const countries = areaOrder(activeCountries);
  // 국가 탭은 상단 그래프와 자원 목록에 함께 적용합니다.
  const countryRows = useMemo(
    () =>
      country
        ? rows.filter((row) => groupCode(regionInfo(row.region)?.country_code) === country)
        : rows,
    [rows, data, country],
  );
  const filtered = useMemo(
    () =>
      countryRows
        .filter(
          (row) =>
            (!region || String(row.region) === region) &&
            (!service || row.service === service) &&
            (!query ||
              `${regionName(row.region)} ${serviceName(row.service)} ${String(row.remarks)}`
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
    [countryRows, data, region, service, query, sort, direction],
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
  const onFormDirty = useCallback(
    (dirty: boolean) => {
      setFormDirty(dirty);
      setDirty(dirty);
    },
    [setDirty],
  );
  useEffect(() => () => setDirty(false), [setDirty]);
  useEffect(() => {
    if (!canManage) {
      setEditMode(false);
      setEditor(null);
      setDeleteConfirm(null);
      onFormDirty(false);
    }
  }, [canManage, onFormDirty]);

  function discardEditor() {
    if (saving) return false;
    if (formDirty && !window.confirm("입력 중인 내용을 취소하시겠습니까?")) return false;
    setEditor(null);
    onFormDirty(false);
    setError("");
    return true;
  }

  function closeEditor() {
    discardEditor();
  }

  function leaveEditMode() {
    if (!discardEditor()) return;
    setDeleteConfirm(null);
    setEditMode(false);
  }

  async function saveResource(values: ResourceInput) {
    setSaving(true);
    setPageBusy(true);
    setError("");
    try {
      if (editor !== "new" && editor?.id != null) {
        await updateResource(Number(editor.id), revision, month, values);
      } else {
        await createResource(revision, month, values);
      }
      setEditor(null);
      setDeleteConfirm(null);
      onFormDirty(false);
      try {
        await refresh();
      } catch {
        setError("저장은 완료했지만 화면을 갱신하지 못했습니다. 새로고침해 주세요.");
      }
    } catch (cause) {
      const fieldError =
        cause instanceof ApiError
          ? Object.values(cause.fieldErrors).flat()[0]
          : undefined;
      setError(
        fieldError ||
          (cause instanceof Error
            ? cause.message
            : "인프라 자원을 저장하지 못했습니다."),
      );
    } finally {
      setSaving(false);
      setPageBusy(false);
    }
  }

  async function removeResource(row: DataRow) {
    if (row.id == null) return;
    setSaving(true);
    setPageBusy(true);
    setError("");
    try {
      await deleteResource(Number(row.id), revision, month);
      setDeleteConfirm(null);
      try {
        await refresh();
      } catch {
        setError("삭제는 완료했지만 화면을 갱신하지 못했습니다. 새로고침해 주세요.");
      }
    } catch (cause) {
      const fieldError =
        cause instanceof ApiError
          ? Object.values(cause.fieldErrors).flat()[0]
          : undefined;
      setError(
        fieldError ||
          (cause instanceof Error
            ? cause.message
            : "인프라 자원을 삭제하지 못했습니다."),
      );
    } finally {
      setSaving(false);
      setPageBusy(false);
    }
  }
  return (
    <div className="infrastructure-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">INFRASTRUCTURE</span>
          <h1>인프라 자원</h1>
          <p>리전과 서비스별 컴퓨팅·Rack 자원의 현재 현황입니다.</p>
        </div>
      </header>
      {error && !editor && <ErrorMessage message={error} />}
      <div
        className="inventory-country-tabs resource-country-tabs"
        role="group"
        aria-label="국가별 자원"
      >
        <button
          type="button"
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
            type="button"
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
                  (row) => groupCode(regionInfo(row.region)?.country_code) === code,
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      <ResourceTopology rows={countryRows} data={data} month={month} revision={revision} country={country} />
      <section className="inventory-panel panel">
        <header className="inventory-panel-heading">
          <div className="inventory-title">
            <Icon name="server" size={18} />
            <h2>자원 목록</h2>
          </div>
          <div className="inventory-toolbar">
            {canManage && (
              <div className="resource-edit-mode-controls">
                {editMode && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={Boolean(editor) || saving || !data.regions.length}
                    title={!data.regions.length ? "리전을 먼저 등록하세요." : undefined}
                    onClick={() => {
                      setEditor("new");
                      setDeleteConfirm(null);
                      setError("");
                    }}
                  >
                    ＋ 행 추가
                  </button>
                )}
                <button
                  type="button"
                  className={`btn btn-sm${editMode ? " btn-primary" : ""}`}
                  disabled={saving}
                  aria-pressed={editMode}
                  onClick={() => {
                    if (editMode) leaveEditMode();
                    else {
                      setEditMode(true);
                      setDeleteConfirm(null);
                      setError("");
                    }
                  }}
                >
                  {editMode ? "편집 종료" : "편집"}
                </button>
              </div>
            )}
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
                    .filter((item) => !country || groupCode(item.country_code) === country)
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
                  {services.map((value) => (
                    <option key={value} value={value}>
                      {value}
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
        <div className="inventory-grid-scroll">
          <table className="inventory-grid">
            <colgroup>
              <col className="gutter-col" />
              <col className="region-col" />
              <col className="service-col" />
              <col className="number-col" />
              <col className="number-col" />
              <col className="rack-col" />
              <col className="rack-col" />
              <col className="remarks-col" />
              <col className="date-col" />
              {editMode && <col className="resource-action-col" />}
            </colgroup>
            <thead>
              <tr className="grid-groups">
                <th rowSpan={2} scope="col" className="grid-gutter">
                  #
                </th>
                <th colSpan={2} scope="colgroup">
                  리소스 위치
                </th>
                <th colSpan={2} scope="colgroup">
                  컴퓨팅
                </th>
                <th colSpan={2} scope="colgroup">
                  Rack
                </th>
                <th colSpan={2} scope="colgroup">
                  운영 정보
                </th>
                {editMode && (
                  <th rowSpan={2} scope="col" className="resource-action-head">
                    관리
                  </th>
                )}
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
              {editor && (
                <ResourceForm
                  key={editor === "new" ? "new" : String(editor.id)}
                  row={editor === "new" ? null : editor}
                  data={data}
                  month={month}
                  busy={saving}
                  error={error}
                  onSubmit={saveResource}
                  onCancel={closeEditor}
                  onDirty={onFormDirty}
                />
              )}
              {visible
                .filter(
                  (row) =>
                    editor === "new" || !editor || row.id !== editor.id,
                )
                .map((row, index) => (
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
                    {QUANTITY_KEYS.map((key) => (
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
                    {editMode && (
                      <td className="resource-action">
                        <div className="resource-row-actions">
                          {deleteConfirm === row.id ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                disabled={saving}
                                onClick={() => void removeResource(row)}
                              >
                                삭제 확인
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={saving}
                                onClick={() => setDeleteConfirm(null)}
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={Boolean(editor) || saving}
                                onClick={() => {
                                  setEditor(row);
                                  setDeleteConfirm(null);
                                  setError("");
                                }}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                disabled={Boolean(editor) || saving}
                                onClick={() => {
                                  setDeleteConfirm(Number(row.id));
                                  setError("");
                                }}
                              >
                                삭제
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              {!visible.length && !editor && (
                <tr>
                  <td colSpan={editMode ? 10 : 9}>
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
                  <td colSpan={2}>표시된 {filtered.length}개 자원 합계</td>
                  {QUANTITY_KEYS.map((key) => (
                    <td key={key} className="numeric">
                      {filtered.some((row) => row[key] != null)
                        ? number(sum(key))
                        : "—"}
                    </td>
                  ))}
                  <td colSpan={editMode ? 3 : 2} className="total-note">
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
                {[30, 50, 100].map((value) => (
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
