import type { DataRow } from "../../shared/api/operations";
import { WORK_TYPES } from "./fields";

/** 요청·변경·장애 구분별 완료율·미완료·지연(또는 정기배치)·평균 복구시간 카드. */
export default function WorkCards({ rows }: { rows: DataRow[] }) {
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
