import type { Bootstrap, Log } from "../../shared/api/operations";
import { localDate } from "../../shared/fields";
import LogData from "./LogData";
import type { HistoryLog } from "./api";

/** 변경 이력 목록. labels는 기능 ID → 화면 이름(공통데이터 이름은 아래에서 보충)입니다. */
export default function LogList({
  rows,
  labels,
  details = false,
  data,
  onRestore,
}: {
  rows: Log[];
  labels: Record<string, string>;
  details?: boolean;
  data?: Bootstrap;
  onRestore?: (log: HistoryLog) => void;
}) {
  return (
    <div className="report-log-list">
      {!rows.length && <p className="report-empty">변경 이력이 없습니다.</p>}
      {rows.map((row) => {
        const log = row as HistoryLog;
        return (
        <article key={log.id}>
          <div>
            <span className="report-badge">
              {labels[log.section] ??
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
            {log.month && <span className="report-badge">{log.month}</span>}
            {log.countries?.map((country) => <span className="report-badge" key={country}>{country}</span>)}
            {log.regions?.map((region) => <span className="report-badge" key={region.id}>{region.region_name}</span>)}
            {onRestore && <div className="logs-restore-action">
              <button className="btn btn-sm" disabled={!log.can_restore} title={log.restore_reason || "이 변경을 변경 전 상태로 복구"} onClick={() => onRestore(log)}>{log.restored ? "복구 완료" : "복구"}</button>
              {!log.can_restore && <small>{log.restore_reason}</small>}
            </div>}
          </div>
          <p>{log.summary}</p>
          <small>{log.actor_name}</small>
          {details && data && (
            <details>
              <summary>변경 전·후 데이터</summary>
              <LogData log={log} data={data} />
            </details>
          )}
        </article>
      );})}
    </div>
  );
}
