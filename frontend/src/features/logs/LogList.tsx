import type { Bootstrap } from "../../shared/api/operations";
import { localDate } from "../../shared/fields";
import { changePreview, describeLog } from "./LogData";
import type { HistoryLog } from "./api";

export const ACTIONS: Record<string, string> = { create: "등록", update: "수정", delete: "삭제", restore: "복구" };

export function relativeTime(value: string, now = Date.now()) {
  const minutes = Math.floor((now - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}시간 전`;
  if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / 1440)}일 전`;
  return new Date(value).toLocaleDateString("ko-KR");
}

/** 변경 이력 목록. 한 줄에 언제·누가·어느 탭·무엇을 바꿨는지 요약하고, 상세는 onOpen으로 엽니다. */
export default function LogList({ rows, labels, data, people, onOpen }: {
  rows: HistoryLog[]; labels: Record<string, string>; data: Bootstrap; people: Record<string, string>; onOpen: (log: HistoryLog) => void;
}) {
  return (
    <div className="logs-list" role="list">
      {!rows.length && <p className="report-empty">조건에 맞는 변경 이력이 없습니다.</p>}
      {rows.map((log) => {
        const entries = describeLog(log, data, people);
        return (
          <article key={log.id} role="listitem" className="logs-row">
            <time dateTime={log.created_at} title={localDate(log.created_at)}><strong>{relativeTime(log.created_at)}</strong><small>{localDate(log.created_at)}</small></time>
            <div className="logs-row-main">
              <div className="logs-row-meta">
                <span className={`logs-kind logs-kind-${log.action}`}>{ACTIONS[log.action] ?? log.action}</span>
                <span className="report-badge">{labels[log.section] ?? log.section}</span>
                {log.month && <span className="report-badge">{log.month}</span>}
                {log.countries?.map((country) => <span className="report-badge" key={country}>{country}</span>)}
                {log.restored && <span className="report-badge">복구됨</span>}
              </div>
              <p className="logs-row-summary">{log.summary}</p>
              {entries.length > 0 && <p className="logs-row-preview">{changePreview(entries)}</p>}
            </div>
            <span className="logs-row-actor"><small>변경자</small>{log.actor_name}</span>
            <button className="btn btn-sm" onClick={() => onOpen(log)} aria-label={`${log.summary} 상세 보기`}>상세 보기</button>
          </article>
        );
      })}
    </div>
  );
}
