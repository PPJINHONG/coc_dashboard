import { useEffect, useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import { errorMessage, Modal, Panel } from "../reporting/components";
import type { Snapshot } from "../reporting/api";
import * as api from "./api";
import type { Collection, ManagedRecord } from "./api";
import ActivityHistory from "./ActivityHistory";

const ROLE_LABELS: Record<string, string> = {
  admin: "관리자",
  observer: "옵저버(읽기 전용)",
  user: "사용자",
};

type Field = {
  key: string;
  label: string;
  type?: string;
  options?: [string, string][];
  default?: unknown;
  optional?: boolean;
};
export default function ManagedRecords({
  collection,
  snapshot,
  onChanged,
  onEditing,
  onBusy,
}: {
  collection: Collection;
  snapshot: Snapshot;
  onChanged: () => Promise<void>;
  onEditing: (editing: boolean) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [rows, setRows] = useState<ManagedRecord[]>([]),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{
      row?: ManagedRecord;
      copyMode?: boolean;
    } | null>(null),
    [remove, setRemove] = useState<ManagedRecord | null>(null),
    [history, setHistory] = useState<ManagedRecord | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const isUsers = collection === "accounts";
  const fields: Field[] = isUsers
    ? [
        { key: "name", label: "이름" },
        { key: "username", label: "이메일 아이디", type: "email" },
        {
          key: "role",
          label: "권한",
          options: [
            ["user", "사용자 (글 작성·본인 데이터 수정·삭제)"],
            ["observer", "옵저버 (읽기 전용)"],
            ["admin", "관리자 (전체 수정·삭제·이력 확인)"],
          ],
          default: "user",
        },
        {
          key: "is_active",
          label: "계정 상태",
          options: [
            ["true", "활성"],
            ["false", "비활성"],
          ],
          default: true,
        },
        {
          key: "password",
          label: edit?.row ? "새 비밀번호 (변경할 때만 입력)" : "비밀번호",
          type: "password",
          optional: Boolean(edit?.row),
        },
      ]
    : [
        {
          key: "issue",
          label: "이슈",
          options: [
            ...new Map([
              ...snapshot.issues.map(
                (row) =>
                  [String(row.id), String(row.title)] as [string, string],
              ),
              ...rows.map(
                (row) =>
                  [String(row.issue), String(row.issue_title)] as [
                    string,
                    string,
                  ],
              ),
            ]).entries(),
          ],
        },
        { key: "author_name", label: "작성자 이름" },
        {
          key: "author_username",
          label: "작성자 아이디",
          optional: true,
          default: "",
        },
        { key: "content", label: "댓글 내용", type: "textarea" },
      ];
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
    if (copyMode && isUsers)
      setForm((values) => ({
        ...values,
        username: "",
        password: "",
        role: "user",
      }));
    setError(null);
    setEdit({ row: copyMode ? undefined : row, copyMode });
  }
  function setWorking(value: boolean) {
    setBusy(value);
    onBusy(value);
  }
  const columns = isUsers
    ? [
        ["name", "이름"],
        ["username", "이메일 아이디"],
        ["role", "권한"],
        ["is_active", "상태"],
        ["is_online", "로그인"],
        ["last_activity", "최근 활동"],
      ]
    : [
        ["issue_title", "이슈"],
        ["author_name", "작성자"],
        ["content", "댓글"],
        ["created_at", "등록 시각"],
      ];
  return (
    <Panel
      title={isUsers ? "사용자·아이디·권한" : "이슈 댓글 관리"}
      subtitle={
        isUsers
          ? "권한(관리자·옵저버·사용자)과 로그인 상태를 확인하고, ‘이력’에서 계정별 행동과 변경 전·후 값을 확인합니다."
          : "일반 이슈 화면과 같은 댓글 데이터를 추가·수정·삭제합니다."
      }
      action={
        <button
          className="btn btn-sm btn-primary"
          disabled={loading || busy}
          onClick={() => open()}
        >
          {isUsers ? "+ 사용자 추가" : "+ 댓글 추가"}
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
              {columns.map(([key, label]) => (
                <th key={key}>{label}</th>
              ))}
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map(([key]) => (
                  <td key={key} className="text-cell">
                    {key === "role"
                      ? ROLE_LABELS[String(row[key])] ?? String(row[key] ?? "")
                      : key === "is_online"
                        ? row[key]
                          ? <span className="report-badge status-open">로그인 중 ({String(row.active_sessions)}세션)</span>
                          : <span className="muted">로그아웃</span>
                        : key === "is_active"
                          ? row[key]
                            ? "활성"
                            : "비활성"
                          : key === "created_at" || key === "last_activity"
                            ? row[key]
                              ? new Date(String(row[key])).toLocaleString("ko-KR")
                              : "—"
                            : String(row[key] ?? "")}
                  </td>
                ))}
                <td>
                  <div className="actions">
                    {isUsers && (
                      <button
                        className="btn btn-sm"
                        disabled={busy}
                        onClick={() => setHistory(row)}
                      >
                        이력
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
                <td colSpan={columns.length + 1} className="report-empty">
                  등록된 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal
          title={`${isUsers ? "사용자" : "댓글"} ${edit.copyMode ? "복사" : edit.row ? "수정" : "추가"}`}
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
                const values = { ...form };
                if (isUsers && edit.row && !values.password)
                  delete values.password;
                if (isUsers) {
                  values.is_active = String(values.is_active) === "true";
                }
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
          title={isUsers ? "계정 삭제" : "댓글 삭제"}
          onClose={() => {
            if (!busy) setRemove(null);
          }}
        >
          <p>
            {isUsers ? String(remove.username) : `댓글 #${remove.id}`} 항목을
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
                  await api.deleteRecord(collection, remove);
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
      {history && (
        <Modal title={`${String(history.name)} (${String(history.username)}) 이력`} onClose={() => setHistory(null)}>
          <ActivityHistory accountId={history.id} />
        </Modal>
      )}
    </Panel>
  );
}
