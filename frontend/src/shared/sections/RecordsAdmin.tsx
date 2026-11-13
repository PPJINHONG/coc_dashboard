import { useEffect, useState, type ReactNode } from "react";
import type { Snapshot } from "../api/operations";
import * as api from "../api/records";
import type { ManagedRecord } from "../api/records";
import ErrorMessage from "../components/ErrorMessage";
import Modal from "../components/Modal";
import Panel from "../components/Panel";
import { errorMessage } from "../errors";
import type { AdminTabProps } from "../feature";

export interface RecordField {
  key: string;
  label: string;
  type?: string;
  options?: [string, string][];
  default?: unknown;
  optional?: boolean;
}

/** 목록형 관리 화면 설정. 사용자·권한(features/database) 등이 씁니다. */
export interface RecordsConfig {
  /** API 경로 /api/db-admin/<collection>/ */
  collection: string;
  title: string;
  subtitle: string;
  addLabel: string;
  /** 입력 창 제목에 쓰는 이름(예: 사용자) */
  noun: string;
  deleteTitle: string;
  columns: [string, string][];
  fields: (context: { editing?: ManagedRecord; rows: ManagedRecord[]; snapshot: Snapshot }) => RecordField[];
  /** 셀 표시를 바꿀 때 사용합니다. undefined를 돌려주면 기본 문자열로 표시합니다. */
  renderCell?: (key: string, row: ManagedRecord) => ReactNode | undefined;
  /** 행 복사 때 비우거나 바꿀 값 */
  copyValues?: (values: Record<string, unknown>) => Record<string, unknown>;
  /** 저장 직전 값 정리 */
  beforeSave?: (values: Record<string, unknown>, editing?: ManagedRecord) => Record<string, unknown>;
  deleteLabel: (row: ManagedRecord) => string;
  deleteBody?: (row: ManagedRecord) => unknown;
  /** 수정 버튼 앞에 둘 추가 버튼과 그 버튼이 여는 창(예: 계정별 이력) */
  extraAction?: { label: string; render: (row: ManagedRecord, close: () => void) => ReactNode };
}

export default function RecordsAdmin({
  config,
  snapshot,
  onChanged,
  onEditing,
  onBusy,
}: AdminTabProps & { config: RecordsConfig }) {
  const { collection } = config;
  const [rows, setRows] = useState<ManagedRecord[]>([]),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{
      row?: ManagedRecord;
      copyMode?: boolean;
    } | null>(null),
    [remove, setRemove] = useState<ManagedRecord | null>(null),
    [extra, setExtra] = useState<ManagedRecord | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const fields = config.fields({ editing: edit?.row, rows, snapshot });
  async function load() {
    setRows(await api.records(collection));
  }
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .records(collection)
      .then((value) => {
        if (!cancelled) setRows(value);
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
  }, [collection, snapshot.revision]);
  useEffect(() => {
    onEditing(Boolean(edit));
    return () => onEditing(false);
  }, [edit, onEditing]);
  function open(row?: ManagedRecord, copyMode = false) {
    setForm(
      Object.fromEntries(
        fields.map((field) => [
          field.key,
          field.type === "password"
            ? ""
            : (row?.[field.key] ??
              field.default ??
              field.options?.[0]?.[0] ??
              ""),
        ]),
      ),
    );
    if (copyMode && config.copyValues) setForm(config.copyValues);
    setError(null);
    setEdit({ row: copyMode ? undefined : row, copyMode });
  }
  function setWorking(value: boolean) {
    setBusy(value);
    onBusy(value);
  }
  return (
    <Panel
      title={config.title}
      subtitle={config.subtitle}
      action={
        <button
          className="btn btn-sm btn-primary"
          disabled={loading || busy}
          onClick={() => open()}
        >
          {config.addLabel}
        </button>
      }
    >
      {loading && (
        <p className="report-empty" role="status">
          불러오는 중…
        </p>
      )}
      {!edit && !remove && <ErrorMessage message={error} />}
      <div className="report-table-scroll">
        <table className="report-table">
          <thead>
            <tr>
              {config.columns.map(([key, label]) => (
                <th key={key}>{label}</th>
              ))}
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {config.columns.map(([key]) => (
                  <td key={key} className="text-cell">
                    {config.renderCell?.(key, row) ?? String(row[key] ?? "")}
                  </td>
                ))}
                <td>
                  <div className="actions">
                    {config.extraAction && (
                      <button
                        className="btn btn-sm"
                        disabled={busy}
                        onClick={() => setExtra(row)}
                      >
                        {config.extraAction.label}
                      </button>
                    )}
                    <button
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => open(row)}
                    >
                      수정
                    </button>
                    <button
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => open(row, true)}
                    >
                      행 복사
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={busy}
                      onClick={() => {
                        setError(null);
                        setRemove(row);
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !rows.length && (
              <tr>
                <td colSpan={config.columns.length + 1} className="report-empty">
                  등록된 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal
          title={`${config.noun} ${edit.copyMode ? "복사" : edit.row ? "수정" : "추가"}`}
          onClose={() => {
            if (!busy) setEdit(null);
          }}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setWorking(true);
              setError(null);
              try {
                const values = config.beforeSave
                  ? config.beforeSave({ ...form }, edit.row)
                  : { ...form };
                await api.saveRecord(collection, values, edit.row?.id);
                await onChanged();
                await load();
                setEdit(null);
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setWorking(false);
              }
            }}
          >
            <fieldset className="account-fields" disabled={busy}>
              {fields.map((field) => (
                <label key={field.key}>
                  {field.label}
                  {field.options ? (
                    <select
                      value={String(form[field.key] ?? "")}
                      required={!field.optional}
                      onChange={(event) =>
                        setForm({ ...form, [field.key]: event.target.value })
                      }
                    >
                      {!field.options.length && (
                        <option value="">이슈를 먼저 등록하세요</option>
                      )}
                      {field.options.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      rows={4}
                      required
                      maxLength={5000}
                      value={String(form[field.key] ?? "")}
                      onChange={(event) =>
                        setForm({ ...form, [field.key]: event.target.value })
                      }
                    />
                  ) : (
                    <input
                      type={field.type ?? "text"}
                      autoComplete={
                        field.type === "password" ? "new-password" : "off"
                      }
                      required={!field.optional}
                      value={String(form[field.key] ?? "")}
                      onChange={(event) =>
                        setForm({ ...form, [field.key]: event.target.value })
                      }
                    />
                  )}
                </label>
              ))}
              <ErrorMessage message={error} />
              <div className="actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => setEdit(null)}
                >
                  취소
                </button>
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? "저장 중…" : "저장"}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal
          title={config.deleteTitle}
          onClose={() => {
            if (!busy) setRemove(null);
          }}
        >
          <p>
            {config.deleteLabel(remove)} 항목을
            삭제하시겠습니까?
          </p>
          <ErrorMessage message={error} />
          <div className="actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => setRemove(null)}
            >
              취소
            </button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                setWorking(true);
                setError(null);
                try {
                  await api.deleteRecord(collection, remove, config.deleteBody?.(remove));
                  await onChanged();
                  await load();
                  setRemove(null);
                } catch (err) {
                  setError(errorMessage(err));
                } finally {
                  setWorking(false);
                }
              }}
            >
              {busy ? "삭제 중…" : "삭제"}
            </button>
          </div>
        </Modal>
      )}
      {extra && config.extraAction?.render(extra, () => setExtra(null))}
    </Panel>
  );
}
