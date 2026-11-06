import { useState } from "react";
import type { Bootstrap, DataRow } from "../../shared/api/operations";
import ErrorMessage from "../../shared/components/ErrorMessage";
import FieldInput from "../../shared/components/FieldInput";
import Modal from "../../shared/components/Modal";
import { errorMessage } from "../../shared/errors";
import SectionPage from "../../shared/sections/SectionPage";
import * as api from "./api";
import { IssueCards, type IssueActions } from "./IssueCards";
import { issueSection } from "./section";
import { issueFields } from "./fields";

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

/** 리전 이슈 화면. onChanged를 넘기면 등록·수정·삭제·댓글을 쓸 수 있고, 리포트처럼 넘기지 않으면 조회만 합니다. */
export default function IssuesPage({
  rows,
  data,
  rowLimit,
  canWrite = false,
  onChanged,
}: {
  rows: DataRow[];
  data: Bootstrap;
  rowLimit?: number;
  /** 리전 이슈 작성 권한(관리자·사용자). 옵저버는 false입니다. */
  canWrite?: boolean;
  onChanged?: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<DataRow | null>(null);
  const refresh = async () => {
    await onChanged?.();
  };
  const actions: IssueActions | undefined = onChanged
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
    <SectionPage
      config={issueSection}
      rows={rows}
      data={data}
      rowLimit={rowLimit}
      subtitle={
        canWrite
          ? "이슈를 등록하고, 본인이 작성한 이슈·댓글은 직접 수정·삭제할 수 있습니다."
          : "읽기 전용 권한입니다. 이슈와 댓글을 조회만 할 수 있습니다."
      }
      actions={
        actions &&
        canWrite && (
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            + 이슈 등록
          </button>
        )
      }
      renderBody={(visible) => <IssueCards rows={visible} data={data} actions={actions} />}
    >
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
    </SectionPage>
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
  const formFields = issueFields(data).filter((field) => ISSUE_KEYS.includes(field.key));
  const isNew = row.id === undefined;
  const [form, setForm] = useState<DataRow>(() =>
    Object.fromEntries(
      formFields.map((field) => [
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
          {formFields.map((field) => (
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
