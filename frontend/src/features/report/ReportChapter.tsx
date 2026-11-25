import HandoverSummary from "./HandoverSummary";
import NoticePages from "./NoticePages";
import ResourceMonth from "./ResourceMonth";
import ResourceChart from "./ResourceChart";
import type { ReportEntry, ReportTable } from "../../shared/featureReport";
import type { Chapter } from "../../shared/report/loadReport";

function DataTable({ table, label }: { table: ReportTable; label: string }) {
  const numeric = (index: number) => table.numeric?.includes(index) ? "publication-number" : undefined;
  return <div className="publication-table-block">
    <table className="publication-table" aria-label={table.title ?? label}>
      {table.title && <caption>{table.title}</caption>}
      <thead><tr>{table.columns.map((heading, index) =>
        <th key={heading} scope="col" className={numeric(index)}>{heading}</th>)}</tr></thead>
      <tbody>{table.rows.length ? table.rows.map((row, index) =>
        <tr key={index}>{row.map((cell, col) =>
          <td key={col} className={numeric(col)}>{cell}</td>)}</tr>
      ) : <tr><td colSpan={table.columns.length} className="publication-empty">해당 데이터 없음</td></tr>}</tbody>
    </table>
    {table.note && <p className="publication-note">{table.note}</p>}
  </div>;
}

function factClass(label: string, value: string) {
  if (label === "권역") return "is-region";
  if (label === "상태") {
    if (value === "진행 중") return "is-status-progress";
    return "is-status-completed";
  }
  if (label === "우선순위") return value === "중요" ? "is-priority-high" : "is-priority-normal";
  return value === "이슈" ? "is-category-issue" : "is-category-notice";
}

function Entry({ entry }: { entry: ReportEntry }) {
  return <article className="publication-entry">
    <header>
      <h3>{entry.title}</h3>
      <dl>{entry.facts.map(([label, value]) => <div key={label} className={`publication-fact ${factClass(label, value)}`}>
        <dt>{label}</dt><dd>{value || "—"}</dd>
      </div>)}</dl>
    </header>
    {entry.richText
      ? <div className="publication-rich" onErrorCapture={(event) => {
          const image = event.target;
          if (image instanceof HTMLImageElement) {
            image.alt = "첨부 이미지 불러오기 실패";
            image.classList.add("publication-missing-image");
          }
        }} dangerouslySetInnerHTML={{ __html: entry.content }} />
      : <div className="publication-text">{entry.content}</div>}
  </article>;
}

function RequestFigures({ data }: { data: NonNullable<Chapter["requests"]> }) {
  const total = data.regions.reduce((a, r) => ({ region: "전체", now: a.now + r.now, prior: a.prior + r.prior }),
    { region: "전체", now: 0, prior: 0 });
  return <div className="request-ledger">{[total, ...data.regions].map((r) => {
    const delta = r.now - r.prior;
    return <article key={r.region}><h3>{r.region}</h3><small>{data.month}</small>
      <strong>{r.now.toLocaleString("ko-KR")}<small>건</small></strong>
      <dl><div><dt>{data.previous}</dt><dd>{r.prior}건</dd></div>
      <div><dt>전월 대비</dt><dd>{delta > 0 ? "+" : ""}{delta}건</dd></div></dl>
    </article>;
  })}</div>;
}

function ResourcePages({ chapter }: { chapter: Chapter }) {
  const [detail] = chapter.tables ?? [];
  const trend = chapter.trends;
  if (!trend || chapter.resourceRegionCount == null || !detail) return null;
  const annual: ReportTable = {
    title: "최근 12개월 자원 수량",
    columns: ["자원", ...trend.months.map((month) => month.slice(2).replace("-", ".")), "전년 동월 대비"],
    numeric: Array.from({ length: trend.months.length + 1 }, (_, i) => i + 1),
    rows: trend.series.map(({ label, values, annualChange }) => [
      label, ...values.map((value) => value == null ? "—" : value.toLocaleString("ko-KR")),
      annualChange == null ? "—" : (annualChange > 0 ? "+" : "") + annualChange.toLocaleString("ko-KR"),
    ]),
    note: "Host·VM 단위는 대, Rack 단위는 개입니다. 미등록 또는 일부 미입력으로 비교할 수 없는 수량은 —로 표시합니다.",
  };
  return <>
    <div className="resource-spread">
      <ResourceMonth regionCount={chapter.resourceRegionCount} figures={chapter.figures ?? []} month={trend.months.at(-1) ?? ""} />
      <section className="resource-year"><header><h3>연간 자원 추이</h3><p>{trend.months[0]} — {trend.months.at(-1)}</p></header>
        <ResourceChart trend={trend} labels={["Host", "VM"]} title="Host·VM 추이" unit="대" />
        <ResourceChart trend={trend} labels={["Compute Rack", "Storage Rack", "전체 Rack"]} title="Rack 구성별 추이" unit="개" />
      </section>
      <div className="resource-annual-values"><DataTable table={annual} label="연간 자원 추이 수치표" /></div>
    </div>
    <section className="resource-register"><header className="publication-section-head"><div>
      <h2>{detail.title}</h2><p>{trend.months.at(-1)} 기준 · {detail.rows.length}개 항목</p></div></header>
      <DataTable table={{ ...detail, title: undefined }} label="리전·서비스별 자원" />
    </section>
  </>;
}

export default function ReportChapter({ chapter }: { chapter: Chapter }) {
  if (chapter.timeline) return <NoticePages chapter={chapter} events={chapter.timeline} />;
  if (chapter.id === "regional_handovers") {
    const entries = chapter.entries ?? [];
    return <section className="handover-publication" aria-labelledby="handover-summary-title">
      <HandoverSummary entries={entries} title={chapter.label} scope={chapter.scope} />
      {entries.length > 0 && <section className="handover-details" aria-labelledby="handover-details-title">
        <header className="handover-running-head"><span>권역별 핸드오버</span><b>상세 내역</b></header>
        <h2 id="handover-details-title">핸드오버 상세 내역</h2>
        <div className="handover-columns">{entries.map((entry) => <Entry key={entry.id} entry={entry} />)}</div>
      </section>}
    </section>;
  }
  return <section className="publication-chapter"
    id={`publication-${chapter.id}`} aria-labelledby={`heading-${chapter.id}`}>
    <header className="publication-section-head">
      <div><h2 id={`heading-${chapter.id}`}>{chapter.label}</h2>
        <p>{chapter.scope}</p>
      </div>
      {chapter.entries && <strong>{chapter.entries.length.toLocaleString("ko-KR")}건</strong>}
    </header>
    {chapter.trends && <ResourcePages chapter={chapter} />}
    {chapter.requests && <RequestFigures data={chapter.requests} />}
    {Boolean(chapter.entries?.length) && <div className="publication-stories">
      {chapter.entries?.map((entry) => <Entry key={entry.id} entry={entry} />)}
    </div>}
    {chapter.entries?.length === 0 && <p className="publication-empty">등록된 {chapter.label.replace("권역별 ", "")} 내역 없음</p>}
  </section>;
}
