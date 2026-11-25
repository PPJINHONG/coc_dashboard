import { countEntries } from "../../shared/report/handoverCounts";
import type { ReportEntry } from "../../shared/featureReport";

const format = (value: number) => value.toLocaleString("ko-KR");

export default function HandoverSummary({ entries, title, scope }: {
  entries: ReportEntry[]; title: string; scope: string;
}) {
  const totals = countEntries(entries);
  const regions = ["KR", "EU", "NA"].map((region) => ({
    region, ...countEntries(entries.filter((entry) => entry.region === region)),
  }));
  const largest = Math.max(1, ...regions.map((row) => row.total));
  const headers = ["권역", "전체", "진행 중", "완료", "중요", "이슈", "공지"];
  const measures = [
    { label: "진행 중", value: totals.active },
    { label: "완료", value: totals.complete },
    { label: "중요", value: totals.important },
  ];
  const cells = (row: typeof totals) =>
    [row.total, row.active, row.complete, row.important, row.issues, row.notices]
      .map((value, index) => <td key={headers[index + 1]}>{format(value)}</td>);

  return <section className="handover-summary">
    <header className="handover-running-head"><span>월간 운영 리포트</span><b>{title}</b></header>
    <h2 id="handover-summary-title">{title}</h2>
    <p className="handover-scope">{scope}</p>
    <div className="handover-summary-spread">
      <section><h3>인계 현황</h3>
        <div className="handover-total"><strong>{format(totals.total)}</strong><span>건</span></div>
        <dl className="handover-measures">{measures.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{format(value)}</dd></div>)}</dl>
      </section>
      <figure className="handover-graph">
        <figcaption>권역별 인계 건수</figcaption>
        <div className="handover-legend"><span>진행 중</span><span>완료</span></div>
        {regions.map((row) => <div className="handover-bar-row" key={row.region}
          aria-label={`${row.region} 전체 ${row.total}건, 진행 중 ${row.active}건, 완료 ${row.complete}건`}>
          <b>{row.region}</b><div className="handover-bar-track" aria-hidden="true">
            <i style={{ width: `${100 * row.active / largest}%` }} />
            <i style={{ width: `${100 * row.complete / largest}%` }} />
          </div><strong>{format(row.total)}</strong>
        </div>)}
      </figure>
    </div>
    <table className="handover-ledger"><caption>권역별 집계</caption>
      <thead><tr>{headers.map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{regions.map((row) => <tr key={row.region}><th scope="row">{row.region}</th>{cells(row)}</tr>)}</tbody>
      <tfoot><tr><th scope="row">합계</th>{cells(totals)}</tr></tfoot>
    </table>
    <p className="handover-footnote">{entries.length === 0 ? "등록된 핸드오버가 없습니다." : "중요 건수는 우선순위가 ‘중요’인 인계 건을 집계합니다."}</p>
  </section>;
}
