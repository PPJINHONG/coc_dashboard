import { useEffect, useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import { errorMessage } from "../reporting/components";
import * as api from "./api";
import type { Activity } from "./api";

const ACTIONS: Record<string, string> = {
  login: "로그인",
  logout: "로그아웃",
  login_failed: "로그인 실패",
  create: "등록",
  update: "수정",
  delete: "삭제",
};
const TARGETS: Record<string, string> = {
  issue: "리전 이슈",
  issue_comment: "이슈 댓글",
  post: "게시글",
  post_comment: "게시글 댓글",
  session: "세션",
};
const FIELD_LABELS: Record<string, string> = {
  region: "리전 ID",
  region_name: "리전",
  title: "제목",
  description: "상세 내용",
  severity: "중요도",
  status: "상태",
  progress_percent: "진행률",
  owner: "담당자 ID",
  owner_name: "담당자",
  next_action: "다음 조치",
  content: "내용",
  comments: "댓글",
  image_ids: "첨부 이미지",
};

function show(value: unknown) {
  if (value === null || value === undefined || value === "") return "(없음)";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}

/** 관리자 전용: 한 계정의 로그인·등록·수정·삭제 이력. 수정은 항목별 이전 값→새 값, 삭제는 원래 내용을 보여 줍니다. */
export default function ActivityHistory({ accountId }: { accountId: number }) {
  const [rows, setRows] = useState<Activity[] | null>(null),
    [error, setError] = useState<string | null>(null),
    [filter, setFilter] = useState("");
  useEffect(() => {
    let cancelled = false;
    api
      .accountActivities(accountId)
      .then((value) => {
        if (!cancelled) setRows(value.activities);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);
  const visible = (rows ?? []).filter((row) => !filter || row.action === filter);
  return (
    <div className="activity-history">
      <label>
        구분
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">전체</option>
          {Object.entries(ACTIONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <ErrorMessage message={error} />
      {!rows && !error && <p role="status">불러오는 중…</p>}
      {rows && !visible.length && <p className="report-empty">기록된 이력이 없습니다.</p>}
      <ol className="activity-list">
        {visible.map((row) => (
          <li key={row.id}>
            <div className="activity-head">
              <span className={`report-badge activity-${row.action}`}>{ACTIONS[row.action] ?? row.action}</span>
              {row.target_type && row.target_type !== "session" && (
                <span className="report-badge">{TARGETS[row.target_type] ?? row.target_type}</span>
              )}
              <time>{new Date(row.created_at).toLocaleString("ko-KR")}</time>
              {row.ip_address && <small className="muted">{row.ip_address}</small>}
            </div>
            <p>{row.summary}</p>
            {row.action === "update" && Object.keys(row.changes).length > 0 && (
              <table className="report-table activity-changes">
                <thead>
                  <tr>
                    <th>항목</th>
                    <th>이전 값</th>
                    <th>새 값</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(row.changes).map(([key, change]) => (
                    <tr key={key}>
                      <td>{FIELD_LABELS[key] ?? key}</td>
                      <td className="text-cell">
                        <pre>{show(change.before)}</pre>
                      </td>
                      <td className="text-cell">
                        <pre>{show(change.after)}</pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {row.action === "delete" && (
              <details open>
                <summary>삭제 전 원래 내용</summary>
                <dl className="activity-original">
                  {Object.entries(row.before_data).map(([key, value]) => (
                    <div key={key}>
                      <dt>{FIELD_LABELS[key] ?? key}</dt>
                      <dd>
                        <pre>{show(value)}</pre>
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            {row.action === "create" && (
              <details>
                <summary>등록한 내용</summary>
                <pre className="activity-raw">{show(row.after_data)}</pre>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
