import type { FeaturePageProps } from "../../shared/feature";
import type { ReportContext } from "../../shared/featureReport";
import { regionalInput } from "../../shared/regionalTime";
import ReportChapter from "./ReportChapter";
import ReportOverview from "./ReportOverview";
import { useMonthlyReport } from "../../shared/report/useMonthlyReport";
import "./report.css";
import "./handoverReport.css";

function ReportCover({ year, monthReport }: { year: string; monthReport: string }) {
  return <section className="publication-cover" aria-label={`${year}년 ${monthReport} 표지`}>
    <strong className="publication-cover-brand">Solomontech AIDC사업부 클라우드운영팀</strong>
    <div className="publication-cover-main">
      <h1><span>Cloud Operations</span><span>Center</span></h1>
    </div>
    <div className="publication-cover-edition">
      <span>Monthly Operations Report</span>
      <strong>{monthReport}</strong>
      <small>{year}</small>
    </div>
    <i className="publication-cover-rule" aria-hidden="true" />
  </section>;
}

function Publication({ snapshot, data, features, user }: ReportContext) {
  const [year, month] = snapshot.month.split("-");
  const monthNumber = Number(month);
  const period = `${year}년 ${monthNumber}월`;
  const monthReport = `${monthNumber}월 보고`;
  const { issue, chapters, ordered, error, retry, preparing, publication, printReport } =
    useMonthlyReport({ snapshot, data, features, user }, `COC_${year}년_${monthReport}`);

  return <div className="ops-publication" ref={publication}>
    <header className="publication-toolbar">
      <div><b>월간 운영 리포트</b><span>{period}</span></div>
      <button className="publication-print" type="button" disabled={!chapters || preparing}
        onClick={printReport} title="인쇄 창에서 PDF로 저장">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7zM16 11h2" />
        </svg>{preparing ? "출력 준비 중…" : "인쇄 · PDF 저장"}
      </button>
    </header>

    <ReportCover year={year} monthReport={monthReport} />

    {chapters && <section id="sheet-overview" className="publication-sheet publication-overview-sheet">
      <header className="publication-page-head">
        <div><b>COC</b><span>MONTHLY OPERATIONS REPORT</span></div>
        <span>{year} · {monthReport}</span>
      </header>
      <header className="publication-section-head publication-overview-head">
        <div><h2>월간 종합 정리</h2><p>{period} 전체 운영 현황</p></div>
      </header>
      <ReportOverview chapters={chapters} period={period} />
    </section>}

    {error ? <div role="alert" className="publication-status">{error}
      <button onClick={retry}>다시 불러오기</button>
    </div> : !chapters && <p role="status" className="publication-status">리포트 데이터 불러오는 중…</p>}

    {ordered.map((chapter) => <section id={`sheet-${chapter.id}`} key={chapter.id} className="publication-sheet">
      <ReportChapter chapter={chapter} />
    </section>)}
    {issue && <footer className="publication-asof">생성 시각 {regionalInput(issue.generated, "KR").replace("T", " ")} KST</footer>}
  </div>;
}

export default function ReportPage(props: FeaturePageProps) {
  const { snapshot, user } = props;
  return <Publication key={`${snapshot.month}/${snapshot.revision}/${user?.id}/${user?.role}`} {...props} />;
}
