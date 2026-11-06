import { useState } from "react";
import type { Bootstrap, DataRow } from "../../shared/api/operations";
import ErrorMessage from "../../shared/components/ErrorMessage";
import Modal from "../../shared/components/Modal";
import { errorMessage } from "../../shared/errors";
import { localDate } from "../../shared/fields";
import type { IssueComment } from "./api";
import { SEVERITIES, STATUSES } from "./fields";

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
