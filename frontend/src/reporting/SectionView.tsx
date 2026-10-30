import { useMemo, useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import type { Bootstrap, DataRow, Section } from "./api";
import * as api from "./api";
import { cell, exportCsv, fields, SECTION_LABELS } from "./config";
import {
  DataTable,
  errorMessage,
  FieldInput,
  IssueCards,
  Modal,
  Panel,
  WorkCards,
  type IssueActions,
} from "./components";

const ISSUE_KEYS = [
  "region",
  "title",
  "severity",
  "status",
  "progress_percent",
  "owner",
  "description",
  "next_action",
];

export default function SectionView({
  section,
  rows,
  data,
  rowLimit,
  canWrite = false,
  onChanged,
}: {
  section: Section;
  rows: DataRow[];
  data: Bootstrap;
  rowLimit?: number;
  /** 리전 이슈 작성 권한(관리자·사용자). 옵저버는 false입니다. */
  canWrite?: boolean;
  onChanged?: () => Promise<void>;
}) {
  const [region, setRegion] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<DataRow | null>(null);
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
  const refresh = async () => {
    await onChanged?.();
  };
  const actions: IssueActions | undefined =
    section === "issues" && onChanged
      ? {
          canWrite,
          onEdit: (row) => setEditing(row),
          onDelete: async (row) => {
            await api.deleteIssue(Number(row.id));
            await refresh();
          },
          onComment: async (id, content) => {
            await api.postIssueComment(id, content);
            await refresh();
          },
          onCommentEdit: async (id, content) => {
            await api.updateIssueComment(id, content);
            await refresh();
          },
          onCommentDelete: async (id) => {
            await api.deleteIssueComment(id);
            await refresh();
          },
        }
      : undefined;
  return (
    <div className={`report-sections${section === "staff" ? " staff-page" : ""}`}>
      <header className="section-head">
        <div>
          <h1>{SECTION_LABELS[section]}</h1>
          <p className="section-sub">
            {section === "issues"
              ? canWrite
                ? "이슈를 등록하고, 본인이 작성한 이슈·댓글은 직접 수정·삭제할 수 있습니다."
                : "읽기 전용 권한입니다. 이슈와 댓글을 조회만 할 수 있습니다."
              : "현재 저장된 운영 데이터"}
          </p>
        </div>
        <div className="actions">
          {actions && canWrite && (
            <button className="btn btn-primary" onClick={() => setEditing({})}>
              + 이슈 등록
            </button>
          )}
          <button
            className="btn"
            onClick={() => exportCsv(section, filtered, data)}
          >
            CSV 내보내기
          </button>
        </div>
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
        <IssueCards rows={visible} data={data} actions={actions} />
      ) : (
        <Panel
          title={`${SECTION_LABELS[section]} 상세`}
          subtitle={section === "staff" ? undefined : "관리자 DB 설정에서 저장한 원본 데이터를 표시합니다."}
        >
          <DataTable section={section} rows={visible} data={data} />
        </Panel>
      )}
      {editing && (
        <IssueForm
          row={editing}
          data={data}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function IssueForm({
  row,
  data,
  onClose,
  onSaved,
}: {
  row: DataRow;
  data: Bootstrap;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const issueFields = fields("issues", data).filter((field) => ISSUE_KEYS.includes(field.key));
  const isNew = row.id === undefined;
  const [form, setForm] = useState<DataRow>(() =>
    Object.fromEntries(
      issueFields.map((field) => [
        field.key,
        row[field.key] ??
          field.default ??
          (field.key === "status" ? "open" : field.type === "number" ? 0 : field.nullable ? null : ""),
      ]),
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  return (
    <Modal title={isNew ? "이슈 등록" : `이슈 #${String(row.id)} 수정`} onClose={() => !busy && onClose()}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(null);
          try {
            if (isNew) await api.createIssue(form);
            else await api.updateIssue(Number(row.id), form);
            await onSaved();
          } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
          }
        }}
      >
        <fieldset className="account-fields" disabled={busy}>
          {issueFields.map((field) => (
            <label key={field.key}>
              {field.label}
              <FieldInput
                field={field}
                label={field.label}
                value={form[field.key]}
                onChange={(value) => setForm({ ...form, [field.key]: value })}
              />
            </label>
          ))}
          {!isNew && (
            <p className="muted">수정한 항목의 이전 값과 새 값은 관리자가 사용자 이력에서 확인할 수 있습니다.</p>
          )}
          <ErrorMessage message={error} />
          <div className="actions">
            <button type="button" className="btn" disabled={busy} onClick={onClose}>
              취소
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
