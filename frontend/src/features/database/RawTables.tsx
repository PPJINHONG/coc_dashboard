import { useEffect, useState } from "react";
import ErrorMessage from "../../shared/components/ErrorMessage";
import Panel from "../../shared/components/Panel";
import { errorMessage } from "../../shared/errors";
import * as api from "./api";
import type { Catalog, Rows, TableMeta } from "./api";

function text(value: unknown) {
  return value === null
    ? "NULL"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value ?? "");
}
/** DB 원본: 웹에서 쓰는 테이블만 읽기 전용으로 조회합니다. 허용 목록은 백엔드 각 앱 feature.py의 tables입니다. */
export default function RawTables() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [selected, setSelected] = useState("");
  const [meta, setMeta] = useState<TableMeta | null>(null),
    [result, setResult] = useState<Rows | null>(null);
  const [mode, setMode] = useState<"data" | "structure">("data");
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [tableSearch, setTableSearch] = useState("");
  const [offset, setOffset] = useState(0),
    [sort, setSort] = useState(""),
    [direction, setDirection] = useState("asc"),
    [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .catalog()
      .then((value) => {
        if (!cancelled) {
          setCatalog(value);
          setSelected(
            (old) =>
              old ||
              value.tables.find((table) => table.name === "infra_resources")
                ?.name ||
              value.tables[0]?.name ||
              "",
          );
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.metadata(selected),
      api.rows(selected, {
        search: query,
        offset: String(offset),
        limit: "50",
        sort,
        direction,
      }),
    ])
      .then(([metadata, rows]) => {
        if (!cancelled) {
          setMeta(metadata);
          setResult(rows);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, query, offset, sort, direction, revision]);
  return (
    <div className="db-workspace">
      <p className="report-notice">
        웹에서 사용하는 업무·계정 테이블만 표시합니다. 이 화면은 읽기 전용이며,
        변경은 ‘기능별 설정’에서 진행하세요. 비밀번호 등 보호된 값은 표시하지
        않습니다.
      </p>
      <ErrorMessage message={error} />
      <div className="db-layout">
        <aside className="db-table-list panel">
          <label>
            테이블 검색 ({catalog?.tables.length ?? 0}개)
            <input
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder="기능·테이블 이름"
            />
          </label>
          <nav aria-label="원본 테이블">
            {catalog?.tables
              .filter((table) =>
                `${table.name} ${table.label}`
                  .toLowerCase()
                  .includes(tableSearch.toLowerCase()),
              )
              .map((table) => (
                <button
                  key={table.name}
                  className={`db-table-button${selected === table.name ? " selected" : ""}`}
                  onClick={() => {
                    setSelected(table.name);
                    setOffset(0);
                    setQuery("");
                    setSearch("");
                    setSort("");
                    setRevision((value) => value + 1);
                  }}
                >
                  <strong>{table.label}</strong>
                  <span>{table.name}</span>
                  <small>{table.column_count}개 열 · 읽기 전용</small>
                </button>
              ))}
          </nav>
        </aside>
        <div className="db-content">
          {meta && (
            <>
              <header className="db-table-heading">
                <div>
                  <h2>{meta.label}</h2>
                  <p className="muted">
                    <code>{meta.name}</code>
                  </p>
                </div>
                <button
                  className="btn btn-sm"
                  disabled={loading}
                  onClick={() => setRevision((value) => value + 1)}
                >
                  새로고침
                </button>
              </header>
              <div
                className="auth-switch db-mode-switch"
                role="group"
                aria-label="원본 조회 방식"
              >
                <button
                  aria-pressed={mode === "data"}
                  onClick={() => setMode("data")}
                >
                  데이터
                </button>
                <button
                  aria-pressed={mode === "structure"}
                  onClick={() => setMode("structure")}
                >
                  테이블 구조
                </button>
              </div>
              {loading && <p role="status">데이터를 불러오는 중…</p>}
              {mode === "data" ? (
                <Panel
                  title="원본 데이터"
                  subtitle="검색·정렬·조회만 가능합니다."
                >
                  <form
                    className="db-query"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setOffset(0);
                      setQuery(search);
                    }}
                  >
                    <label>
                      데이터 검색
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </label>
                    <button className="btn btn-sm" disabled={loading}>
                      검색
                    </button>
                    <label>
                      정렬
                      <select
                        value={
                          sort ||
                          meta.primary_key[0] ||
                          meta.columns[0]?.name ||
                          ""
                        }
                        onChange={(event) => {
                          setSort(event.target.value);
                          setOffset(0);
                        }}
                      >
                        {meta.columns
                          .filter((column) => !column.sensitive)
                          .map((column) => (
                            <option key={column.name}>{column.name}</option>
                          ))}
                      </select>
                    </label>
                    <label>
                      순서
                      <select
                        value={direction}
                        onChange={(event) => setDirection(event.target.value)}
                      >
                        <option value="asc">오름차순</option>
                        <option value="desc">내림차순</option>
                      </select>
                    </label>
                  </form>
                  <div className="report-table-scroll">
                    <table className="report-table db-data-table">
                      <thead>
                        <tr>
                          {meta.columns.map((column) => (
                            <th key={column.name}>
                              {column.name}
                              {meta.primary_key.includes(column.name) && (
                                <span className="db-pk">PK</span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result?.rows.map((row, index) => (
                          <tr key={index}>
                            {meta.columns.map((column) => (
                              <td key={column.name}>
                                <span
                                  className="db-cell"
                                  title={
                                    column.sensitive
                                      ? "보호된 값"
                                      : text(row.values[column.name])
                                  }
                                >
                                  {column.sensitive
                                    ? "보호된 값"
                                    : text(row.values[column.name])}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                        {result?.total === 0 && (
                          <tr>
                            <td
                              colSpan={meta.columns.length}
                              className="report-empty"
                            >
                              조회된 데이터가 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="db-pagination">
                    <span className="muted">
                      총 {result?.total ?? 0}행 ·{" "}
                      {result?.total ? offset + 1 : 0}–
                      {Math.min(offset + 50, result?.total ?? 0)}
                    </span>
                    <button
                      className="btn btn-sm"
                      disabled={loading || offset === 0}
                      onClick={() =>
                        setOffset((value) => Math.max(0, value - 50))
                      }
                    >
                      이전
                    </button>
                    <button
                      className="btn btn-sm"
                      disabled={loading || offset + 50 >= (result?.total ?? 0)}
                      onClick={() => setOffset((value) => value + 50)}
                    >
                      다음
                    </button>
                  </div>
                </Panel>
              ) : (
                <>
                  <Panel
                    title="열·자료형"
                    subtitle="테이블 구조는 조회만 제공합니다."
                  >
                    <div className="report-table-scroll">
                      <table className="report-table">
                        <thead>
                          <tr>
                            <th>열</th>
                            <th>자료형</th>
                            <th>기본키</th>
                            <th>NULL 허용</th>
                            <th>기본값</th>
                            <th>설명</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meta.columns.map((column) => (
                            <tr key={column.name}>
                              <td>{column.name}</td>
                              <td>{column.data_type}</td>
                              <td>
                                {meta.primary_key.includes(column.name)
                                  ? "PK"
                                  : "—"}
                              </td>
                              <td>{column.nullable ? "예" : "아니오"}</td>
                              <td>
                                {column.sensitive
                                  ? "보호된 값"
                                  : (column.default ?? "—")}
                              </td>
                              <td>{column.comment || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                  <Panel title="제약조건">
                    <div className="db-constraints">
                      {meta.constraints.map((constraint) => (
                        <p key={constraint.name}>
                          <strong>{constraint.name}</strong>
                          <br />
                          <code>{constraint.definition}</code>
                        </p>
                      ))}
                    </div>
                  </Panel>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
