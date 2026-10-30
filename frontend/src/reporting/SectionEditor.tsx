import { useEffect, useMemo, useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import { copySectionRow } from "./copy";
import type { Bootstrap, DataRow, Section } from "./api";
import { cell, emptyRow, exportCsv, fields, SECTION_LABELS } from "./config";
import {
  DataTable,
  errorMessage,
  FieldInput,
  IssueCards,
  Panel,
  WorkCards,
} from "./components";

interface Props {
  section: Section;
  rows: DataRow[];
  data: Bootstrap;
  onSave: (section: Section, rows: DataRow[]) => Promise<void>;
  onEditing: (editing: boolean) => void;
  onBusy: (busy: boolean) => void;
  onRefresh: () => void;
  onComment: (id: number, content: string) => Promise<void>;
}

export default function SectionEditor({
  section,
  rows,
  data,
  onSave,
  onEditing,
  onBusy,
  onRefresh,
  onComment,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DataRow[]>(() => structuredClone(rows));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const columns = useMemo(() => fields(section, data), [section, data]);
  const location = columns.find((field) => field.key === (section === "staff" ? "country_code" : "region"))!;
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(rows);
  useEffect(() => {
    onEditing(dirty);
    return () => onEditing(false);
  }, [dirty, onEditing]);
  const filtered = rows.filter(
    (row) =>
      (!region || String(row[location.key]) === region) &&
      (!status || row.status === status) &&
      (!search ||
        columns.some((field) =>
          cell(row, field).toLowerCase().includes(search.toLowerCase()),
        )),
  );

  function update(index: number, key: string, value: unknown) {
    setDraft((current) =>
      current.map((row, i) =>
        i === index
          ? {
              ...row,
              [key]: value,
              ...(section === "issues" &&
              key === "status" &&
              value === "resolved"
                ? { progress_percent: 100 }
                : {}),
            }
          : row,
      ),
    );
  }
  function duplicate(index: number) {
    setDraft((current) => [
      ...current.slice(0, index + 1),
      copySectionRow(section, current[index], data),
      ...current.slice(index + 1),
    ]);
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      await onSave(section, draft);
      setEditing(false);
      onEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  const editActions = (
    <div className="actions">
      <button
        className="btn"
        disabled={busy}
        onClick={() => {
          setDraft(structuredClone(rows));
          setEditing(false);
          setError(null);
        }}
      >
        취소
      </button>
      <button
        className="btn btn-primary"
        disabled={busy || !dirty}
        onClick={save}
      >
        {busy ? "저장 중…" : "변경사항 저장"}
      </button>
    </div>
  );
  return (
    <div className="report-sections">
      <header className="section-head">
        <div>
          <h1>{SECTION_LABELS[section]}</h1>
          <p className="section-sub">
            현재 데이터 ·{" "}
            {editing
              ? "편집 후 저장을 눌러 반영하세요."
              : "편집 버튼을 누르면 데이터를 입력·수정할 수 있습니다."}
          </p>
        </div>
        {editing ? (
          editActions
        ) : (
          <div className="actions">
            <button
              className="btn"
              onClick={() => exportCsv(section, filtered, data)}
            >
              CSV 내보내기
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setDraft(structuredClone(rows));
                setEditing(true);
                setError(null);
              }}
            >
              편집
            </button>
          </div>
        )}
      </header>
      <ErrorMessage message={error} />
      {error && (
        <button className="btn btn-sm" onClick={onRefresh}>
          최신 데이터 다시 불러오기
        </button>
      )}
      {!editing && (
        <div className="report-filters">
          <label>
            {location.label}
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">전체 {location.label}</option>
              {location.options?.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="report-search">
            검색
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={section === "staff" ? "성명, 직책, 업무, 근무지 검색" : "이름, 분류, 비고 검색"}
            />
          </label>
          {section === "issues" && (
            <label>
              상태
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">전체 상태</option>
                {columns
                  .find((f) => f.key === "status")
                  ?.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <span className="muted">{filtered.length}개 항목</span>
        </div>
      )}
      {section === "work" && !editing && <WorkCards rows={filtered} />}
      {editing ? (
        <Panel
          title={`${SECTION_LABELS[section]} 편집`}
          subtitle={
            section === "resources"
              ? "VM·Storage의 빈 값은 미입력, 0은 실제 0개를 뜻합니다. 합계는 자동 계산합니다. 복사 후 리전·서비스·환경 조합을 변경해 주세요."
              : "복사한 인력은 성명을, 작업은 리전·구분·대상을 선택하세요. 삭제한 행은 저장 시 반영됩니다."
          }
          action={
            <div className="actions">
              <button
                className="btn btn-sm"
                disabled={busy}
                onClick={() =>
                  setDraft((current) => [...current, emptyRow(section, data)])
                }
              >
                {section === "issues" ? "+ 이슈 등록" : "+ 행 추가"}
              </button>
            </div>
          }
        >
          <fieldset
            className="report-editor-fieldset"
            disabled={busy}
            aria-busy={busy}
          >
            {section === "issues" ? (
              <div className="issue-edit-list">
                {draft.map((row, index) => (
                  <article
                    className="issue-edit-card"
                    key={row.id ?? `new-${index}`}
                  >
                    <header>
                      <h3>
                        {row.id
                          ? `이슈 #${String(row.id)}`
                          : `새 이슈 ${index + 1}`}
                      </h3>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => duplicate(index)}
                      >
                        행 복사
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          setDraft((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        행 삭제
                      </button>
                    </header>
                    <div className="issue-edit-fields">
                      {columns.map((field) => (
                        <label
                          key={field.key}
                          className={field.type === "textarea" ? "wide" : ""}
                        >
                          <span>{field.label}</span>
                          <FieldInput
                            field={field}
                            value={row[field.key]}
                            onChange={(value) =>
                              update(index, field.key, value)
                            }
                            label={`${index + 1}행 ${field.label}`}
                          />
                        </label>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="report-table-scroll">
                <table className="report-table report-edit-table">
                  <thead>
                    <tr>
                      <th>번호</th>
                      {columns.map((field) => (
                        <th key={field.key}>{field.label}</th>
                      ))}
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.map((row, index) => (
                      <tr key={row.id ?? `new-${index}`}>
                        <td>{index + 1}</td>
                        {columns.map((field) => (
                          <td key={field.key}>
                            <FieldInput
                              field={field}
                              value={row[field.key]}
                              onChange={(value) =>
                                update(index, field.key, value)
                              }
                              label={`${index + 1}행 ${field.label}`}
                            />
                          </td>
                        ))}
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => duplicate(index)}
                          >
                            행 복사
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() =>
                              setDraft((current) =>
                                current.filter((_, i) => i !== index),
                              )
                            }
                          >
                            행 삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!draft.length && (
              <p className="report-empty">
                행 추가 버튼으로 입력을 시작하세요.
              </p>
            )}
          </fieldset>
          <div className="report-editor-foot">
            <span className="muted">
              {draft.length}개 항목 · 최신값으로 저장됩니다.
            </span>
            {editActions}
          </div>
        </Panel>
      ) : section === "issues" ? (
        <IssueCards rows={filtered} data={data} onComment={onComment} />
      ) : (
        <Panel
          title={`${SECTION_LABELS[section]} 상세`}
          subtitle="리포트와 동일한 DB 데이터를 사용합니다."
        >
          <DataTable section={section} rows={filtered} data={data} />
        </Panel>
      )}
    </div>
  );
}
