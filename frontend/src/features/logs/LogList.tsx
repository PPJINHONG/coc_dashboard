import type { Bootstrap, Log } from "../../shared/api/operations";
import { localDate } from "../../shared/fields";
import { logDisplay } from "./logDisplay";

/** 변경 이력 목록. labels는 기능 ID → 화면 이름(공통데이터 이름은 아래에서 보충)입니다. */
export default function LogList({
  rows,
  labels,
  details = false,
  data,
}: {
  rows: Log[];
  labels: Record<string, string>;
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
