import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import AccountField from "../components/AccountField";
import ErrorMessage from "../components/ErrorMessage";
import { errorMessage, Modal, Panel } from "../reporting/components";
import * as api from "./api";
import type { Catalog, Rows, TableMeta } from "./api";
import type { Bootstrap, DataRow, Section, Snapshot } from "../reporting/api";
import * as operations from "../reporting/api";
import MasterData from "../reporting/MasterData";
import SectionEditor from "../reporting/SectionEditor";
import ManagedRecords from "./ManagedRecords";
import "./database.css";

export function AdminLogin({ onSuccess }: { onSuccess?: () => void }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("admin@admin"),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await login(username.trim(), password);
      if (!user.is_staff) {
        setError(
          "관리자 권한이 없는 계정입니다. 관리자 계정으로 로그인하세요.",
        );
        return;
      }
      setPassword("");
      onSuccess?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="db-login">
      <p className="report-notice">
        DB 관리에는 실제 관리자 로그인이 필요합니다. 일반 운영 화면은 개발
        모드에서 로그인 없이 이용할 수 있습니다.
      </p>
      <form onSubmit={submit} noValidate>
        <fieldset className="account-fields" disabled={busy}>
          <AccountField
            id="db-admin-email"
            label="관리자 아이디"
            type="email"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <AccountField
            id="db-admin-password"
            label="비밀번호"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
          />
          <ErrorMessage message={error} />
          <button
            className="btn btn-primary"
            disabled={busy || !username.trim() || !password}
          >
            {busy ? "확인 중…" : "관리자 로그인"}
          </button>
        </fieldset>
      </form>
    </div>
  );
}

interface AdminProps {
  data: Bootstrap;
  snapshot: Snapshot;
  onChanged: () => Promise<void>;
  onEditing: (editing: boolean) => void;
  onBusy: (busy: boolean) => void;
}
export default function DatabaseAdmin(props: AdminProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"common" | "features" | "raw">("features");
  const [feature, setFeature] = useState<Section | "accounts" | "comments">(
    "resources",
  );
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false);
  const onEditing = useCallback(
    (value: boolean) => {
      setEditing(value);
      props.onEditing(value);
    },
    [props.onEditing],
  );
  const onBusy = useCallback(
    (value: boolean) => {
      setBusy(value);
      props.onBusy(value);
    },
    [props.onBusy],
  );
  if (!user?.is_staff)
    return (
      <Panel title="관리자 인증">
        <AdminLogin />
      </Panel>
    );
  async function save(section: Section, rows: DataRow[]) {
    await operations.saveRows(props.snapshot.revision, section, rows);
    await props.onChanged();
  }
  async function comment(id: number, content: string) {
    await operations.addComment(props.snapshot.revision, id, content);
    await props.onChanged();
  }
  return (
    <div className="db-workspace">
      <header className="db-page-head">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>DB 관리</h1>
          <p className="muted">
            공통데이터와 기능별 운영 데이터를 한곳에서 관리하세요.
          </p>
        </div>
        <span className="report-badge">관리자 전용</span>
      </header>
      <div className="db-admin-layout">
        <div className="db-admin-navigation">
          <nav className="db-primary-tabs" aria-label="DB 관리 구분">
            {(
              [
                ["common", "공통데이터"],
                ["features", "기능별 설정"],
                ["raw", "DB 원본"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={mode === key}
                disabled={editing || busy}
                onClick={() => setMode(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          {editing && (
            <span className="db-editing-hint">
              편집을 저장하거나 취소한 뒤 이동하세요.
            </span>
          )}
        </div>
        <div className="db-admin-content">
          {mode === "raw" ? (
            <DatabaseWorkspace />
          ) : mode === "common" ? (
            <MasterData
              data={props.data}
              onSaved={props.onChanged}
              onEditing={onEditing}
              onBusy={onBusy}
            />
          ) : (
            <>
              <nav className="db-feature-tabs" aria-label="기능별 DB 설정">
                {(
                  [
                    ["resources", "인프라 자원"],
                    ["staff", "운영 인력"],
                    ["work", "운영 작업"],
                    ["issues", "리전 이슈"],
                    ["comments", "이슈 댓글"],
                    ["accounts", "사용자·권한"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    className={`btn${feature === key ? " btn-primary" : ""}`}
                    disabled={editing || busy}
                    aria-pressed={feature === key}
                    onClick={() => setFeature(key)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {feature === "accounts" || feature === "comments" ? (
                <ManagedRecords
                  key={feature}
                  collection={feature}
                  {...props}
                  onEditing={onEditing}
                  onBusy={onBusy}
                />
              ) : (
                <SectionEditor
                  key={feature}
                  section={feature}
                  rows={props.snapshot[feature]}
                  data={props.data}
                  onSave={save}
                  onEditing={onEditing}
                  onBusy={onBusy}
                  onRefresh={() => {
                    void props.onChanged();
                  }}
                  onComment={comment}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function text(value: unknown) {
  return value === null
    ? "NULL"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value ?? "");
}
function DatabaseWorkspace() {
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
