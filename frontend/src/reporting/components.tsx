import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { ApiError } from "../api/client";
import Icon from "../components/Icon";
import ErrorMessage from "../components/ErrorMessage";
import type {
  Bootstrap,
  DataRow,
  IssueComment,
  Log,
  Section,
  Snapshot,
} from "./api";
import {
  cell,
  fields,
  localDate,
  SECTION_LABELS,
  SEVERITIES,
  STATUSES,
  WORK_TYPES,
  type Field,
} from "./config";
import { logDisplay } from "./logDisplay";
import StaffTable from "./StaffTable";

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return "처리하지 못했습니다. 잠시 후 다시 시도하세요.";
  const details = Object.values(error.fieldErrors).flat().join(" ");
  return details ? `${error.message} ${details}` : error.message;
}

export function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="report-panel panel">
      <header className="report-panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="report-modal"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button borderless"
          onClick={onClose}
          aria-label="닫기"
        >
          <Icon name="close" size={17} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

export function FieldInput({
  field,
  value,
  onChange,
  label,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
}) {
  const props = {
    "aria-label": label,
    value: value == null ? "" : String(value),
    onChange: (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const next = event.target.value;
      onChange(
        next === "" && field.nullable
          ? null
          : field.type === "number"
            ? next === ""
              ? ""
              : Number(next)
            : ["region", "staff", "owner"].includes(field.key)
              ? Number(next)
              : next,
      );
    },
  };
  if (field.type === "select")
    return (
      <select {...props}>
        {!field.nullable && (value == null || value === "") && (
          <option value="">선택하세요</option>
        )}
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  if (field.type === "textarea") return <textarea {...props} rows={2} />;
  return (
    <input
      {...props}
      type={field.type === "number" ? "number" : "text"}
      min={field.type === "number" ? 0 : undefined}
      max={field.max}
      step={field.step ?? "1"}
      placeholder={field.nullable ? "미입력" : undefined}
    />
  );
}

export function DataTable({
  section,
  rows,
  data,
}: {
  section: Section;
  rows: DataRow[];
  data: Bootstrap;
}) {
  const columns = fields(section, data);
  if (section === "staff") return <StaffTable rows={rows} data={data} />;
  return (
    <div className="report-table-scroll">
      <table className="report-table">
        <thead>
          <tr>
            <th className="row-number" scope="col">
              #
            </th>
            {columns.map((field) => (
              <th
                key={field.key}
                scope="col"
                className={field.type === "number" ? "numeric" : ""}
              >
                {field.label}
              </th>
            ))}
            {section === "work" && (
              <>
                <th className="numeric">미완료</th>
                <th className="numeric">완료율</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>
              <th className="row-number" scope="row">
                {index + 1}
              </th>
              {columns.map((field) => (
                <td
                  key={field.key}
                  className={
                    field.type === "number"
                      ? "numeric"
                      : field.type === "textarea"
                        ? "text-cell"
                        : ""
                  }
                >
                  {field.key === "status" ? (
                    <span
                      className={`report-badge status-${String(row.status)}`}
                    >
                      {cell(row, field)}
                    </span>
                  ) : (
                    cell(row, field)
                  )}
                </td>
              ))}
              {section === "work" && (
                <>
                  <td className="numeric">
                    {Number(row.total_count) - Number(row.completed_count)}
                  </td>
                  <td className="numeric">
                    {Number(row.total_count)
                      ? `${((Number(row.completed_count) / Number(row.total_count)) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        {!rows.length && (
          <tbody>
            <tr>
              <td
                colSpan={columns.length + (section === "work" ? 2 : 0) + 1}
                className="report-empty"
              >
                등록된 데이터가 없습니다.
              </td>
            </tr>
          </tbody>
        )}
        {rows.length > 0 && section === "resources" && (
          <tfoot>
            <tr>
              <td className="row-number">합계</td>
              <td colSpan={3}>합계</td>
              {columns.slice(3).map((field) => (
                <td
                  key={field.key}
                  className={field.type === "number" ? "numeric" : ""}
                >
                  {field.type === "number" ? (
                    <>
                      {rows
                        .reduce(
                          (sum, row) => sum + Number(row[field.key] ?? 0),
                          0,
                        )
                        .toLocaleString("ko-KR")}
                      {rows.some((row) => row[field.key] == null) && (
                        <small> + 미입력</small>
                      )}
                    </>
                  ) : (
                    ""
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function Metrics({ snapshot }: { snapshot: Snapshot }) {
  const t = snapshot.totals;
  const items = [
    ["전체 Host", t.hosts, "대", "리전·서비스별 자원 합계"],
    [
      "전체 VM",
      t.vms,
      "대",
      t.missing_vm_rows
        ? `미입력 ${t.missing_vm_rows}개 행 제외`
        : "등록된 VM 합계",
    ],
    ["Storage", t.storage, "개", "현재 등록된 Storage 합계"],
    ["운영 인력", t.staff, "명", "현재 등록된 운영 인력"],
  ] as const;
  return (
    <section className="report-metrics" aria-label="현재 핵심 지표">
      {items.map(([label, value, unit, note]) => (
        <article key={label} className="report-metric panel">
          <span>{label}</span>
          <div>
            <strong>{value.toLocaleString("ko-KR")}</strong>
            <small>{unit}</small>
          </div>
          <p>{note}</p>
        </article>
      ))}
    </section>
  );
}

export function WorkCards({ rows }: { rows: DataRow[] }) {
  return (
    <div className="report-work-grid">
      {Object.entries(WORK_TYPES).map(([key, label]) => {
        const group = rows.filter((r) => r.work_type === key),
          total = group.reduce((s, r) => s + Number(r.total_count), 0),
          done = group.reduce((s, r) => s + Number(r.completed_count), 0);
        const incidents = group.filter(
          (r) => r.mttr_minutes != null && Number(r.completed_count) > 0,
        );
        const count = incidents.reduce(
          (s, r) => s + Number(r.completed_count),
          0,
        );
        return (
          <article key={key} className="report-work-card">
            <h3>{label}</h3>
            <div className="work-rate">
              {total ? `${((done / total) * 100).toFixed(1)}%` : "—"}
              <small>
                {done.toLocaleString("ko-KR")} / {total.toLocaleString("ko-KR")}
                건 완료
              </small>
            </div>
            <dl>
              <dt>미완료</dt>
              <dd>{(total - done).toLocaleString("ko-KR")}건</dd>
              <dt>{key === "request" ? "정기배치" : "지연"}</dt>
              <dd>
                {group.reduce(
                  (s, r) =>
                    s +
                    Number(
                      r[key === "request" ? "batch_count" : "delayed_count"],
                    ),
                  0,
                )}
                건
              </dd>
              {key === "incident" && (
                <>
                  <dt>평균 복구시간</dt>
                  <dd>
                    {count
                      ? `${(incidents.reduce((s, r) => s + Number(r.mttr_minutes) * Number(r.completed_count), 0) / count).toFixed(1)}분`
                      : "미입력"}
                  </dd>
                </>
              )}
            </dl>
          </article>
        );
      })}
    </div>
  );
}

/** 리전 이슈 화면의 사용자 작업. 버튼 노출은 서버가 계산한 can_edit 값을 따릅니다. */
export interface IssueActions {
  canWrite: boolean;
  onEdit: (row: DataRow) => void;
  onDelete: (row: DataRow) => Promise<void>;
  onComment: (id: number, content: string) => Promise<void>;
  onCommentEdit: (id: number, content: string) => Promise<void>;
  onCommentDelete: (id: number) => Promise<void>;
}

export function IssueCards({
  rows,
  data,
  onComment,
  actions,
}: {
  rows: DataRow[];
  data: Bootstrap;
  onComment?: (id: number, content: string) => Promise<void>;
  actions?: IssueActions;
}) {
  return (
    <div className="report-issue-list">
      {!rows.length && <p className="report-empty">등록된 이슈가 없습니다.</p>}
      {rows.map((row) => (
        <IssueCard
          key={row.id}
          row={row}
          data={data}
          onComment={onComment ?? (actions?.canWrite ? actions.onComment : undefined)}
          actions={actions}
        />
      ))}
    </div>
  );
}
function IssueCommentItem({
  item,
  actions,
}: {
  item: IssueComment;
  actions?: IssueActions;
}) {
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(item.content),
    [busy, setBusy] = useState(false),
    [confirming, setConfirming] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setEditing(false);
      setConfirming(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const editable = Boolean(actions && item.can_edit);
  return (
    <article>
      <strong>{item.author_name}</strong>
      <time>{localDate(item.created_at)}</time>
      {editing ? (
        <form
          className="issue-comment-edit"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim()) return;
            void run(() => actions!.onCommentEdit(item.id, draft.trim()));
          }}
        >
          <textarea
            aria-label="댓글 수정"
            value={draft}
            maxLength={5000}
            rows={2}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="actions">
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setEditing(false)}>
              취소
            </button>
            <button className="btn btn-sm btn-primary" disabled={busy || !draft.trim()}>
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      ) : (
        <p>{item.content}</p>
      )}
      {editable && !editing && (
        <div className="issue-comment-actions">
          {confirming ? (
            <>
              <span className="muted">이 댓글을 삭제할까요?</span>
              <button className="btn btn-sm" disabled={busy} onClick={() => setConfirming(false)}>
                취소
              </button>
              <button
                className="btn btn-sm btn-danger"
                disabled={busy}
                onClick={() => void run(() => actions!.onCommentDelete(item.id))}
              >
                {busy ? "삭제 중…" : "삭제"}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-sm"
                onClick={() => {
                  setDraft(item.content);
                  setEditing(true);
                }}
              >
                수정
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => setConfirming(true)}>
                삭제
              </button>
            </>
          )}
        </div>
      )}
      <ErrorMessage message={error} />
    </article>
  );
}
function IssueCard({
  row,
  data,
  onComment,
  actions,
}: {
  row: DataRow;
  data: Bootstrap;
  onComment?: (id: number, content: string) => Promise<void>;
  actions?: IssueActions;
}) {
  const [comment, setComment] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [confirmDelete, setConfirmDelete] = useState(false);
  const comments = (row.comments ?? []) as IssueComment[];
  const editable = Boolean(actions && row.can_edit);
  return (
    <article className={`report-issue severity-${String(row.severity)}`}>
      <div className="issue-meta">
        <span className="report-badge">
          {data.regions.find((r) => r.id === row.region)
            ?.region_name ?? "미등록 리전"}
        </span>
        <span className={`report-badge severity-${String(row.severity)}`}>
          {SEVERITIES[String(row.severity)]}
        </span>
        <span className={`report-badge status-${String(row.status)}`}>
          {STATUSES[String(row.status)]}
        </span>
        <span className="muted">
          #{String(row.id)} · {String(row.owner_name || "담당자 미지정")}
          {row.author_name ? ` · 작성 ${String(row.author_name)}` : ""}
        </span>
        {editable && (
          <span className="issue-card-actions">
            <button className="btn btn-sm" disabled={busy} onClick={() => actions!.onEdit(row)}>
              수정
            </button>
            <button
              className="btn btn-sm btn-danger"
              disabled={busy}
              onClick={() => {
                setError(null);
                setConfirmDelete(true);
              }}
            >
              삭제
            </button>
          </span>
        )}
      </div>
      <h3>{String(row.title)}</h3>
      <p className="issue-description">
        {String(row.description || "상세 내용이 없습니다.")}
      </p>
      <div className="issue-bottom">
        <span>
          조치 진행률 <strong>{String(row.progress_percent)}%</strong>
        </span>
        <span className="muted">{localDate(String(row.updated_at))}</span>
      </div>
      {row.next_action ? (
        <p className="issue-next">
          <strong>다음 조치</strong> {String(row.next_action)}
        </p>
      ) : null}
      <details className="issue-comments">
        <summary>댓글 {comments.length}개</summary>
        <div>
          {comments.map((item) => (
            <IssueCommentItem key={item.id} item={item} actions={actions} />
          ))}
        </div>
        {onComment && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy || !comment.trim()) return;
              setBusy(true);
              setError(null);
              try {
                await onComment(row.id!, comment.trim());
                setComment("");
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor={`comment-${row.id}`}>댓글 추가</label>
            <textarea
              id={`comment-${row.id}`}
              value={comment}
              maxLength={5000}
              rows={2}
              onChange={(event) => setComment(event.target.value)}
              disabled={busy}
            />
            <button className="btn btn-sm" disabled={busy || !comment.trim()}>
              {busy ? "등록 중…" : "댓글 등록"}
            </button>
            <ErrorMessage message={error} />
          </form>
        )}
      </details>
      {confirmDelete && actions && (
        <Modal title="이슈 삭제" onClose={() => !busy && setConfirmDelete(false)}>
          <p>
            #{String(row.id)} {String(row.title)} 이슈를 삭제하시겠습니까? 달린 댓글 {comments.length}개도 함께
            삭제되며, 원래 내용은 관리자가 확인할 수 있도록 이력에 보관됩니다.
          </p>
          <ErrorMessage message={error} />
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => setConfirmDelete(false)}>
              취소
            </button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await actions.onDelete(row);
                } catch (err) {
                  setError(errorMessage(err));
                  setBusy(false);
                }
              }}
            >
              {busy ? "삭제 중…" : "삭제"}
            </button>
          </div>
        </Modal>
      )}
    </article>
  );
}

export function LogList({
  rows,
  details = false,
  data,
}: {
  rows: Log[];
  details?: boolean;
  data?: Bootstrap;
}) {
  return (
    <div className="report-log-list">
      {!rows.length && <p className="report-empty">변경 이력이 없습니다.</p>}
      {rows.map((log) => (
        <article key={log.id}>
          <div>
            <span className="report-badge">
              {SECTION_LABELS[log.section] ??
                (
                  {
                    regions: "리전",
                    services: "서비스",
                    "staff-members": "인력 공통데이터",
                  } as Record<string, string>
                )[log.section] ??
                log.section}
            </span>
            <time>{localDate(log.created_at)}</time>
          </div>
          <p>{log.summary}</p>
          <small>{log.actor_name}</small>
          {details && data && (
            <details>
              <summary>변경 전·후 데이터</summary>
              <div className="log-data">
                <div>
                  <h4>변경 전</h4>
                  <pre>{JSON.stringify(logDisplay(log.before_data, log.section, data), null, 2)}</pre>
                </div>
                <div>
                  <h4>변경 후</h4>
                  <pre>{JSON.stringify(logDisplay(log.after_data, log.section, data), null, 2)}</pre>
                </div>
              </div>
            </details>
          )}
        </article>
      ))}
    </div>
  );
}

